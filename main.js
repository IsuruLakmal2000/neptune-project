import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

let selectedBuilding = 'building1';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const loader = new THREE.TextureLoader();
const earthTexture = loader.load('/textures/diffuse.jpg');
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

const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// Update directional light to remain fixed in world space
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(3, 5, 3); // Top-right position
scene.add(directionalLight);

// Remove the light target and helper to ensure the light remains fixed
// directionalLight.target = lightTarget;
// scene.add(lightHelper);

const starTexture = loader.load('/textures/stars.jpg');
scene.background = starTexture;

// Reduce rotation speed by enabling damping and adjusting damping factor
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Enable damping for smoother rotation
controls.dampingFactor = 0.05; // Reduce rotation speed

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

// Create 10 dummy placement points
for (let i = 0; i < 10; i++) {
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * 2 * Math.PI;
  point.position.setFromSphericalCoords(1.02, phi, theta);
  scene.add(point);
  placementPoints.push(point);
}

function createBuilding(type) {
  const geometry = buildings[type];
  const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const building = new THREE.Mesh(geometry, material);
  return building;
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
      building.position.copy(selectedPlacementPoint.position);
      building.lookAt(sphere.position);
      scene.add(building);
      popup.style.display = 'none';
      selectedPlacementPoint = null;
    }
  });
});

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onMouseClick);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
