import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSatellite } from './satellite.js';
import { createBuilding } from './createBuilding.js';

const TARGET_SIZE = 0.1;
let selectedBuilding = 'building1';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const gltfLoader = new GLTFLoader();
const buildingModels = {};
function normalizeModelScale(model) {
  // Compute bounding box of the model
  const box = new Box3().setFromObject(model);
  const size = new Vector3();
  box.getSize(size);

  // Find the largest dimension (width, height, or depth)
  const maxDim = Math.max(size.x, size.y, size.z);

  // Compute scale factor to normalize to TARGET_SIZE
  const scale = TARGET_SIZE / maxDim;

  // Apply uniform scale
  model.scale.set(scale, scale, scale);
}

function loadBuildingModels() {
  gltfLoader.load('/3d/church.glb', (gltf) => {
    buildingModels['building1'] = gltf.scene;
  });
  gltfLoader.load('/3d/mansion.glb', (gltf) => {
    buildingModels['building2'] = gltf.scene;
  });
  gltfLoader.load('/3d/church.glb', (gltf) => {
    buildingModels['building3'] = gltf.scene;
  });
}

loadBuildingModels();

const loader = new THREE.TextureLoader();
const earthTexture = loader.load('/textures/planets/mars2.jpg');
const bumpMap = loader.load('/textures/details.png');
const specularMap = loader.load('/textures/earth_specular.jpg');

const material = new THREE.MeshPhongMaterial({
  map: earthTexture,
  bumpMap: bumpMap,
  bumpScale: 0.05,
  specularMap: specularMap,
  specular: new THREE.Color('grey'),
});

const geometry = new THREE.SphereGeometry(1, 1640, 1640);
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// --- Add satellite ---


const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// Directional light fixed in world space (top-right)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(3, 5, 3);
scene.add(directionalLight);

// Animate stars background by rotating a large sphere with the star texture
const starGeo = new THREE.SphereGeometry(50, 64, 64);
const starMat = new THREE.MeshBasicMaterial({
  map: loader.load('/textures/galaxy.png'),
  side: THREE.BackSide,
});
const starSphere = new THREE.Mesh(starGeo, starMat);
scene.add(starSphere);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- Adjust user drag rotation speed based on zoom ---
const baseRotateSpeed = 1.0; // default OrbitControls rotateSpeed
controls.rotateSpeed = baseRotateSpeed;

function updateRotateSpeed() {
  const zoom = camera.position.length();
  // Map zoom range [2, 10] to speed factor [0.5, 1]
  const speedFactor = Math.max(0.5, Math.min(1, (zoom - 2) / 8 + 0.5));
  controls.rotateSpeed = baseRotateSpeed * speedFactor;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


const placementPoints = [];
const popup = document.getElementById('popup');
const popupBuildingButtons = document.querySelectorAll('#popup button');
let selectedPlacementPoint = null;

// Store references to placed buildings for color editing
const placedBuildings = [];

// Add a popup for color selection
const colorPopup = document.createElement('div');
colorPopup.style.display = 'none';
colorPopup.style.position = 'absolute';
colorPopup.style.background = '#fff';
colorPopup.style.padding = '10px';
colorPopup.style.border = '1px solid #333';
colorPopup.style.borderRadius = '8px';
colorPopup.style.zIndex = 100;
colorPopup.innerHTML = `
  <label>Change Color:</label>
  <input type="color" id="buildingColorPicker" value="#888888" style="margin:0 8px;">
  <button id="applyColorBtn">Apply</button>
`;
document.body.appendChild(colorPopup);

let selectedBuildingForColor = null;



// Example: Predefined pinpoints as [latitude, longitude] in degrees
const predefinedPinpoints = [
  [0, 0],
  [30, 45],
  [30, 55],
  [-45, 90],
  [60, -60],
  [-30, -120],
  [15, 180],
  [-60, 135],
  [45, -90],
  [75, 60],
  [-75, -45]
];

// Clear placementPoints array if needed
placementPoints.length = 0;

// Helper to convert lat/lon to Cartesian coordinates on sphere of radius 1
function latLonToVector3(lat, lon, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180); // latitude to polar angle
  const theta = (lon + 180) * (Math.PI / 180); // longitude to azimuthal angle
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Create placement points at predefined positions
predefinedPinpoints.forEach(([lat, lon]) => {
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x888888 })
  );
  point.position.copy(latLonToVector3(lat, lon, 1));
  sphere.add(point);
  placementPoints.push(point);
});

// Fix: Deep clone materials for each placed building so color changes are independent
function cloneMaterials(obj) {
  obj.traverse(child => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map(mat => mat.clone());
      } else {
        child.material = child.material.clone();
      }
    }
  });
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseClick(event) {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(placementPoints);

  if (intersects.length > 0) {
    selectedPlacementPoint = intersects[0].object;
    popup.style.display = 'block';
    popup.style.left = `${event.clientX}px`;
    popup.style.top = `${event.clientY}px`;
  } else {
    // Hide popup if clicking elsewhere
    popup.style.display = 'none';
    selectedPlacementPoint = null;
  }
}

popupBuildingButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (selectedPlacementPoint) {
      const buildingType = button.dataset.building;
      // Pass buildingModels as second argument
      const building = createBuilding(buildingType, buildingModels);
      if (!building) return;
      normalizeModelScale(building);

      // Clone materials so each building has its own
      cloneMaterials(building);

      // Calculate normal at placement point
      const normal = selectedPlacementPoint.position.clone().normalize();

      // Align building "up" to the normal
      building.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Apply your custom rotation after aligning to normal
      building.rotateX(Math.PI / 2 * 3);

      // Compute bounding box after scaling and rotation
      building.updateMatrixWorld(true);

      // Find the lowest vertex along the normal direction (relative to building's local origin)
      let minProj = Infinity;
      building.traverse((child) => {
        if (child.isMesh) {
          const posAttr = child.geometry.attributes.position;
          for (let i = 0; i < posAttr.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(posAttr, i);
            vertex.applyMatrix4(child.matrixWorld);
            // Project from building.position (not from selectedPlacementPoint)
            const proj = vertex.clone().sub(building.position).dot(normal);
            if (proj < minProj) minProj = proj;
          }
        }
      });

      // Set building position at the sphere surface (not at the marker center)
      const markerRadius = 0.02;
      const sphereSurface = selectedPlacementPoint.position.clone().normalize().multiplyScalar(1);

      // Offset building so its base touches the sphere surface
      building.position.copy(sphereSurface).sub(normal.clone().multiplyScalar(minProj));

      scene.add(building);
      placedBuildings.push(building); // Track placed building

      // --- Remove the used pinpoint from the scene and placementPoints array ---
      const idx = placementPoints.indexOf(selectedPlacementPoint);
      if (idx !== -1) {
        scene.remove(selectedPlacementPoint);
        placementPoints.splice(idx, 1);
      }

      popup.style.display = 'none';
      selectedPlacementPoint = null;
    }
  });
});

// Add event listener for picking placed buildings
renderer.domElement.addEventListener('click', function (event) {
  // Ignore if popup is open for placement
  if (popup.style.display === 'block') return;

  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const mouseVec = new THREE.Vector2(mouseX, mouseY);

  raycaster.setFromCamera(mouseVec, camera);
  const intersects = raycaster.intersectObjects(placedBuildings, true);

  if (intersects.length > 0) {
    // Find the root building object (in case of GLTF hierarchy)
    let obj = intersects[0].object;
    while (obj.parent && !placedBuildings.includes(obj)) {
      obj = obj.parent;
    }
    selectedBuildingForColor = obj;

    // Show color popup at mouse position
    colorPopup.style.display = 'block';
    colorPopup.style.left = `${event.clientX}px`;
    colorPopup.style.top = `${event.clientY}px`;
  } else {
    colorPopup.style.display = 'none';
    selectedBuildingForColor = null;
  }
});

// Handle color change
document.getElementById('applyColorBtn').onclick = function () {
  if (selectedBuildingForColor) {
    const color = document.getElementById('buildingColorPicker').value;
    selectedBuildingForColor.traverse((child) => {
      if (child.isMesh && child.material) {
        // If material is an array, set all
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if (mat.color) mat.color.set(color);
          });
        } else if (child.material.color) {
          child.material.color.set(color);
        }
      }
    });
    colorPopup.style.display = 'none';
    selectedBuildingForColor = null;
  }
};

// Hide color popup if clicking elsewhere
window.addEventListener('mousedown', (e) => {
  if (
    colorPopup.style.display === 'block' &&
    !colorPopup.contains(e.target)
  ) {
    colorPopup.style.display = 'none';
    selectedBuildingForColor = null;
  }
});

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onMouseClick);

// --- Satellite management ---
const satelliteAnimators = [];

// Add the first satellite by default
//satelliteAnimators.push(createSatellite(scene, 1));

// --- Add "Add Satellite" button to the DOM ---
const addSatelliteBtn = document.createElement('button');
addSatelliteBtn.textContent = 'Add Satellite';
addSatelliteBtn.style.position = 'fixed';
addSatelliteBtn.style.left = '50%';
addSatelliteBtn.style.bottom = '32px';
addSatelliteBtn.style.transform = 'translateX(-50%)';
addSatelliteBtn.style.padding = '12px 24px';
addSatelliteBtn.style.fontSize = '18px';
addSatelliteBtn.style.background = '#222';
addSatelliteBtn.style.color = '#fff';
addSatelliteBtn.style.border = 'none';
addSatelliteBtn.style.borderRadius = '8px';
addSatelliteBtn.style.cursor = 'pointer';
addSatelliteBtn.style.zIndex = 200;
document.body.appendChild(addSatelliteBtn);

addSatelliteBtn.onclick = () => {
  // Add a new satellite at a random orbit radius between 1.15 and 1.35
  const orbitRadius = 1.15 + Math.random() * 0.2;
  satelliteAnimators.push(createSatellite(scene, orbitRadius));
};

// Handle window resize for responsiveness
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);

  updateRotateSpeed();

  controls.update();

  // Animate the star background slowly for a real-world effect
  // Reduce star rotation speed when camera is zoomed in
  const zoom = camera.position.length();
  // zoom: close to sphere = ~3, far = higher
  // Map zoom range [2, 10] to speed factor [0.5, 1]
  const speedFactor = Math.max(0.5, Math.min(1, (zoom - 2) / 8 + 0.5));
  starSphere.rotation.y += 0.0005 * speedFactor;
  starSphere.rotation.x += 0.0001 * speedFactor;

  // Always position the light in front of the camera, pointing at the sphere
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  directionalLight.position.copy(camera.position).add(cameraDirection.multiplyScalar(-2));
  directionalLight.target.position.copy(sphere.position);
  directionalLight.target.updateMatrixWorld();

  // Animate all satellites
  satelliteAnimators.forEach(fn => fn());

  renderer.render(scene, camera);
}

animate();
