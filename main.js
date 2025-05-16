import * as THREE from 'three';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TARGET_SIZE = 0.1;
let selectedBuilding = 'building1';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3.0;

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
const earthTexture = loader.load('/textures/earth.jpg');
const bumpMap = loader.load('/textures/details.png');
const specularMap = loader.load('/textures/earth_specular.jpg');

const material = new THREE.MeshPhongMaterial({
  map: earthTexture,
  bumpMap: bumpMap,
  bumpScale: 0.05,
  specularMap: specularMap,
  specular: new THREE.Color('grey'),
});

const geometry = new THREE.SphereGeometry(1, 164, 164);
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

const ambientLight = new THREE.AmbientLight(0x333333, 10);
scene.add(ambientLight);

// Fixed light in scene, does NOT move with sphere
const pointerLight = new THREE.PointLight(0xffffff, 50, 50);
pointerLight.position.set(1, 3, 5);
scene.add(pointerLight);

const starTexture = loader.load('/textures/galaxy.png');
scene.background = starTexture;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const buildings = {
  building1: new THREE.BoxGeometry(0.05, 0.1, 0.05),
  building2: new THREE.CylinderGeometry(0.1, 0.1, 0.3, 32),
  building3: new THREE.ConeGeometry(0.1, 0.3, 4),
};

let currentBuilding = createBuilding(selectedBuilding);
scene.add(currentBuilding);

const placementPoints = [];
const popup = document.getElementById('popup');
const popupBuildingButtons = document.querySelectorAll('#popup button');
let selectedPlacementPoint = null;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create 10 dummy placement points
for (let i = 0; i < 10; i++) {
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * 2 * Math.PI;
point.position.setFromSphericalCoords(1.02, phi, theta);
sphere.add(point);  // Add point as child of sphere
placementPoints.push(point);

}

function createBuilding(type) {
  const model = buildingModels[type];
  if (!model) {
    console.warn(`Model for ${type} not loaded yet`);
    return null;
  }
  return model.clone(true);  // deep clone to avoid shared state
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
  }
}

popupBuildingButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (selectedPlacementPoint) {
      const buildingType = button.dataset.building;
      const building = createBuilding(buildingType);
      if (!building) return;
normalizeModelScale(building);

building.position.copy(selectedPlacementPoint.position);


const normal = selectedPlacementPoint.position.clone().normalize();

building.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
building.rotateX(Math.PI/2*3); 
sphere.add(building);
      popup.style.display = 'none';
      selectedPlacementPoint = null;
    }
  });
});


window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onMouseClick);

// --- NEW: Sphere rotation with mouse drag ---

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

renderer.domElement.addEventListener('mousedown', (event) => {
  isDragging = true;
  previousMousePosition.x = event.clientX;
  previousMousePosition.y = event.clientY;
});

renderer.domElement.addEventListener('mouseup', () => {
  isDragging = false;
});

renderer.domElement.addEventListener('mousemove', (event) => {
  if (isDragging) {
    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y,
    };

    // Rotate sphere around Y axis (horizontal drag)
    sphere.rotation.y += deltaMove.x * 0.005;

    // Rotate sphere around X axis (vertical drag)
    sphere.rotation.x += deltaMove.y * 0.005;

    previousMousePosition.x = event.clientX;
    previousMousePosition.y = event.clientY;
  }
});

// --- End of sphere rotation code ---

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
