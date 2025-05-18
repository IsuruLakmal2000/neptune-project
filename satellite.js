import * as THREE from 'three';

export function createSatellite(scene, sphereRadius) {
  // Create a simple satellite (sphere + solar panels)
  const satelliteGroup = new THREE.Group();

  // Satellite body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.3 })
  );
  satelliteGroup.add(body);

  // Solar panels
  const panelGeometry = new THREE.BoxGeometry(0.08, 0.01, 0.02);
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff, metalness: 0.5, roughness: 0.4 });
  const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
  const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
  panel1.position.x = -0.07;
  panel2.position.x = 0.07;
  satelliteGroup.add(panel1, panel2);

  // Initial position (will be set in animation)
  satelliteGroup.position.set(sphereRadius + 0.2, 0, 0);

  scene.add(satelliteGroup);

  // Animation state
  let angle = 0;

  // Animate function to be called in main animate loop
  function animateSatellite(deltaTime = 0.016) {
    // Orbit parameters
    angle += 0.3 * deltaTime; // radians per second
    const orbitRadius = sphereRadius + 0.2;
    const yOrbit = Math.sin(angle * 0.5) * 0.3; // up/down for elliptical effect

    // Position satellite in orbit
    satelliteGroup.position.set(
      Math.cos(angle) * orbitRadius,
      yOrbit,
      Math.sin(angle) * orbitRadius
    );

    // Make satellite face the planet
    satelliteGroup.lookAt(0, 0, 0);
  }

  return animateSatellite;
}
