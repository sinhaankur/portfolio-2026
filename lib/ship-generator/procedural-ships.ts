import * as THREE from 'three';
import type { ShipConfig } from '../neural-game-engine';

/**
 * Procedural Ship Generator: Creates sci-fi spaceships from primitive shapes.
 * Seed-based for deterministic generation and infinite variety.
 * Enhanced with 12–15 parts per ship, emissive engine glows, correct orientation.
 */

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  choice<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}

/**
 * Generate a player ship (Cleaver-class).
 * Long, sleek, purple accents. 12+ detailed parts.
 */
export function generatePlayerShip(config: ShipConfig): THREE.Group {
  const group = new THREE.Group();

  const scale = config.scale ?? 1;
  const color1 = config.color1 ?? { r: 0.2, g: 0.1, b: 0.4 };
  const color2 = config.color2 ?? { r: 0.6, g: 0.3, b: 0.9 };

  const baseCol = new THREE.Color(color1.r * 0.8, color1.g * 0.8, color1.b * 0.8);
  const accentCol = new THREE.Color(color2.r, color2.g, color2.b);
  const glowCol = new THREE.Color(color2.r * 0.5, color2.g * 0.3, color2.b * 0.8);

  // Hull: tapered fuselage
  const hullGeom = new THREE.ConeGeometry(0.6, 3.5, 6);
  const hullMat = new THREE.MeshStandardMaterial({ color: baseCol, metalness: 0.7, roughness: 0.3 });
  const hull = new THREE.Mesh(hullGeom, hullMat);
  hull.position.z = 1;
  hull.scale.set(scale, scale, scale);
  group.add(hull);

  // Cockpit: forward dome
  const cockpitGeom = new THREE.SphereGeometry(0.35, 16, 16);
  const cockpitMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.3, 0.3, 0.4),
    metalness: 0.9,
    roughness: 0.1,
    emissive: glowCol,
    emissiveIntensity: 0.6,
  });
  const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
  cockpit.position.z = 3.2;
  cockpit.scale.set(scale, scale, scale);
  group.add(cockpit);

  // Cockpit canopy: thin ring outline
  const canopyGeom = new THREE.TorusGeometry(0.38, 0.03, 8, 32);
  const canopyMat = new THREE.MeshStandardMaterial({ color: accentCol, metalness: 0.8, roughness: 0.2 });
  const canopy = new THREE.Mesh(canopyGeom, canopyMat);
  canopy.position.z = 3.2;
  canopy.rotation.x = Math.PI / 3;
  canopy.scale.set(scale, scale, scale);
  group.add(canopy);

  // Dorsal fin: pronounced ridge
  const finGeom = new THREE.BoxGeometry(0.15, 1.2, 1.6);
  const finMat = new THREE.MeshStandardMaterial({ color: accentCol, metalness: 0.6, roughness: 0.4 });
  const fin = new THREE.Mesh(finGeom, finMat);
  fin.position.z = 0.5;
  fin.position.y = 0.9;
  fin.scale.set(scale, scale, scale);
  group.add(fin);

  // Swept delta wings: two angled sections
  const wingGeom = new THREE.BoxGeometry(0.35, 0.15, 2.0);
  const wingMat = new THREE.MeshStandardMaterial({ color: baseCol, metalness: 0.65, roughness: 0.35 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeom, wingMat);
    wing.position.y = side * 0.85;
    wing.position.z = -0.2;
    wing.rotation.z = side * 0.25;
    wing.scale.set(scale, scale, scale);
    group.add(wing);
  }

  // Ventral strake: bottom stabiliser
  const strakeGeom = new THREE.BoxGeometry(0.12, 0.4, 1.4);
  const strakeMat = new THREE.MeshStandardMaterial({ color: baseCol, metalness: 0.65, roughness: 0.35 });
  const strake = new THREE.Mesh(strakeGeom, strakeMat);
  strake.position.y = -0.5;
  strake.position.z = 0.3;
  strake.scale.set(scale, scale, scale);
  group.add(strake);

  // Weapon rail: left side hardpoint
  const railGeom = new THREE.BoxGeometry(0.08, 0.1, 1.2);
  const railMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.3, 0.3), metalness: 0.8, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeom, railMat);
    rail.position.y = side * 0.6;
    rail.position.z = -0.1;
    rail.scale.set(scale, scale, scale);
    group.add(rail);
  }

  // Thruster bells: 3 main engines with glow
  const bellGeom = new THREE.CylinderGeometry(0.18, 0.22, 1.0, 8);
  const bellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.15, 0.15, 0.2),
    metalness: 0.85,
    roughness: 0.25,
    emissive: glowCol,
    emissiveIntensity: 0.8,
  });
  for (const offset of [-0.5, 0, 0.5]) {
    const bell = new THREE.Mesh(bellGeom, bellMat);
    bell.position.z = -1.8;
    bell.position.y = offset;
    bell.rotation.x = Math.PI / 2;
    bell.scale.set(scale, scale, scale);
    group.add(bell);
  }

  // Thruster glow cones (transparent emission)
  const glowGeom = new THREE.ConeGeometry(0.25, 0.6, 8);
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 0, 0),
    emissive: glowCol,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.6,
  });
  for (const offset of [-0.5, 0, 0.5]) {
    const cone = new THREE.Mesh(glowGeom, glowMat);
    cone.position.z = -2.3;
    cone.position.y = offset;
    cone.scale.set(scale, scale, scale);
    group.add(cone);
  }

  // Antenna array: forward sensors
  const antennaGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4);
  const antennaMat = new THREE.MeshStandardMaterial({ color: accentCol, metalness: 0.9, roughness: 0.15 });
  for (const dx of [-0.15, 0.15]) {
    for (const dy of [-0.12, 0.12]) {
      const antenna = new THREE.Mesh(antennaGeom, antennaMat);
      antenna.position.set(dx, dy, 3.8);
      antenna.rotation.x = Math.random() * 0.3;
      antenna.scale.set(scale, scale, scale);
      group.add(antenna);
    }
  }

  // Navigation lights: small blinkers
  const navGeom = new THREE.SphereGeometry(0.1, 8, 8);
  const redNav = new THREE.MeshStandardMaterial({
    color: new THREE.Color(1, 0.1, 0.1),
    emissive: new THREE.Color(1, 0, 0),
    emissiveIntensity: 0.9,
  });
  const blueNav = new THREE.Mesh(navGeom, redNav);
  blueNav.position.set(-0.8, 0, 1.5);
  blueNav.scale.set(scale, scale, scale);
  group.add(blueNav);

  const greenNav = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.1, 1, 0.1),
    emissive: new THREE.Color(0, 1, 0),
    emissiveIntensity: 0.9,
  });
  const starboardNav = new THREE.Mesh(navGeom, greenNav);
  starboardNav.position.set(0.8, 0, 1.5);
  starboardNav.scale.set(scale, scale, scale);
  group.add(starboardNav);

  // Ship should point forward (along Z-axis); group Z-rotation orients left/right
  return group;
}

/**
 * Generate an alien fighter ship.
 * Angular, aggressive, red/dark colors. Dagger wedge with 12+ parts.
 */
export function generateAlienFighter(config: ShipConfig): THREE.Group {
  const group = new THREE.Group();

  const scale = config.scale ?? 1;
  const color1 = config.color1 ?? { r: 0.5, g: 0.1, b: 0.1 };
  const color2 = config.color2 ?? { r: 0.9, g: 0.2, b: 0.2 };

  const baseCol = new THREE.Color(color1.r, color1.g, color1.b);
  const accentCol = new THREE.Color(color2.r, color2.g * 0.3, color2.b * 0.3);
  const glowCol = new THREE.Color(color2.r, color2.g * 0.1, color2.b * 0.1);

  // Hull: dagger wedge cone
  const hullGeom = new THREE.ConeGeometry(0.9, 2.8, 8);
  hullGeom.rotateX(Math.PI); // point backward (along -Z)
  const hullMat = new THREE.MeshStandardMaterial({
    color: baseCol,
    metalness: 0.8,
    roughness: 0.2,
  });
  const hull = new THREE.Mesh(hullGeom, hullMat);
  hull.position.z = 0.8;
  hull.scale.set(scale, scale, scale);
  group.add(hull);

  // Command tower: raised superstructure
  const towerGeom = new THREE.BoxGeometry(0.4, 0.5, 1.2);
  const towerMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    metalness: 0.85,
    roughness: 0.15,
  });
  const tower = new THREE.Mesh(towerGeom, towerMat);
  tower.position.z = 1.5;
  tower.position.y = 0;
  tower.scale.set(scale, scale, scale);
  group.add(tower);

  // Command dome: cockpit sphere
  const domeGeom = new THREE.SphereGeometry(0.35, 12, 12);
  const domeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.3, 0.1, 0.1),
    metalness: 0.9,
    roughness: 0.1,
    emissive: glowCol,
    emissiveIntensity: 0.7,
  });
  const dome = new THREE.Mesh(domeGeom, domeMat);
  dome.position.z = 2.4;
  dome.scale.set(scale, scale, scale);
  group.add(dome);

  // Lateral weapon pylons: outer hardpoints
  const pylonGeom = new THREE.BoxGeometry(0.2, 0.15, 1.0);
  const pylonMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.2, 0.2, 0.2),
    metalness: 0.8,
    roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(pylonGeom, pylonMat);
    pylon.position.y = side * 1.0;
    pylon.position.z = 0.5;
    pylon.scale.set(scale, scale, scale);
    group.add(pylon);

    // Weapon mounted on pylon
    const weaponGeom = new THREE.SphereGeometry(0.22, 8, 8);
    const weaponMat = new THREE.MeshStandardMaterial({
      color: accentCol,
      emissive: accentCol,
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.3,
    });
    const weapon = new THREE.Mesh(weaponGeom, weaponMat);
    weapon.position.y = side * 1.05;
    weapon.position.z = 0.5;
    weapon.scale.set(scale, scale, scale);
    group.add(weapon);
  }

  // Quad engine block: central thrust
  const engineGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.8, 8);
  const engineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.1, 0.05, 0.05),
    emissive: glowCol,
    emissiveIntensity: 0.9,
    metalness: 0.85,
    roughness: 0.2,
  });
  for (const dx of [-0.25, 0.25]) {
    for (const dy of [-0.25, 0.25]) {
      const engine = new THREE.Mesh(engineGeom, engineMat);
      engine.position.set(dx, dy, -1.2);
      engine.rotation.x = Math.PI / 2;
      engine.scale.set(scale, scale, scale);
      group.add(engine);
    }
  }

  // Engine glow plumes
  const plumGeom = new THREE.ConeGeometry(0.22, 0.7, 6);
  const plumMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 0, 0),
    emissive: glowCol,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.5,
  });
  for (const dx of [-0.25, 0.25]) {
    for (const dy of [-0.25, 0.25]) {
      const plume = new THREE.Mesh(plumGeom, plumMat);
      plume.position.set(dx, dy, -1.8);
      plume.scale.set(scale, scale, scale);
      group.add(plume);
    }
  }

  // Angled tail fins: stabilisers
  const finGeom = new THREE.BoxGeometry(0.15, 0.8, 1.2);
  const finMat = new THREE.MeshStandardMaterial({
    color: baseCol,
    metalness: 0.75,
    roughness: 0.3,
  });
  for (const angle of [-0.4, 0.4]) {
    const fin = new THREE.Mesh(finGeom, finMat);
    fin.position.y = 0;
    fin.position.z = -1.0;
    fin.rotation.x = angle;
    fin.scale.set(scale, scale, scale);
    group.add(fin);
  }

  // Running lights: red/green wings
  const lightGeom = new THREE.SphereGeometry(0.12, 8, 8);
  const redMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(1, 0, 0),
    emissive: new THREE.Color(1, 0, 0),
    emissiveIntensity: 0.8,
  });
  const redLight = new THREE.Mesh(lightGeom, redMat);
  redLight.position.set(-1.1, 0, 0.8);
  redLight.scale.set(scale, scale, scale);
  group.add(redLight);

  const greenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 1, 0),
    emissive: new THREE.Color(0, 1, 0),
    emissiveIntensity: 0.8,
  });
  const greenLight = new THREE.Mesh(lightGeom, greenMat);
  greenLight.position.set(1.1, 0, 0.8);
  greenLight.scale.set(scale, scale, scale);
  group.add(greenLight);

  return group;
}

/**
 * Generate an alien sniper ship.
 * Sleek, thin, dangerous. Needle fuselage with sensor array.
 */
export function generateAlienSniper(config: ShipConfig): THREE.Group {
  const group = new THREE.Group();

  const scale = config.scale ?? 1;
  const color1 = config.color1 ?? { r: 0.2, g: 0.2, b: 0.3 };
  const color2 = config.color2 ?? { r: 0.4, g: 0.4, b: 0.8 };

  const baseCol = new THREE.Color(color1.r, color1.g, color1.b);
  const accentCol = new THREE.Color(color2.r, color2.g, color2.b);
  const glowCol = new THREE.Color(color2.r * 0.3, color2.g * 0.3, color2.b * 0.8);

  // Long needle fuselage
  const hullGeom = new THREE.CylinderGeometry(0.22, 0.18, 3.8, 6);
  const hullMat = new THREE.MeshStandardMaterial({
    color: baseCol,
    metalness: 0.75,
    roughness: 0.25,
  });
  const hull = new THREE.Mesh(hullGeom, hullMat);
  hull.rotation.x = Math.PI / 2;
  hull.position.z = 0.6;
  hull.scale.set(scale, scale, scale);
  group.add(hull);

  // Forward sensor array: ring
  const ringGeom = new THREE.TorusGeometry(0.35, 0.04, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    metalness: 0.9,
    roughness: 0.15,
    emissive: glowCol,
    emissiveIntensity: 0.6,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.z = 2.8;
  ring.rotation.x = Math.PI / 4;
  ring.scale.set(scale, scale, scale);
  group.add(ring);

  // Needle nose: precision tip
  const noseGeom = new THREE.ConeGeometry(0.12, 1.2, 8);
  const noseMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    metalness: 0.95,
    roughness: 0.05,
  });
  const nose = new THREE.Mesh(noseGeom, noseMat);
  nose.position.z = 3.2;
  nose.scale.set(scale, scale, scale);
  group.add(nose);

  // Targeting laser emitter
  const laserGeom = new THREE.SphereGeometry(0.12, 8, 8);
  const laserMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    emissive: accentCol,
    emissiveIntensity: 0.9,
    metalness: 1,
    roughness: 0,
  });
  const laser = new THREE.Mesh(laserGeom, laserMat);
  laser.position.z = 2.8;
  laser.scale.set(scale * 0.6, scale * 0.6, scale * 0.6);
  group.add(laser);

  // Mid-ship solar wings: wide, flat panels
  const wingGeom = new THREE.BoxGeometry(1.2, 0.08, 0.6);
  const wingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.25, 0.25, 0.35),
    metalness: 0.7,
    roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeom, wingMat);
    wing.position.y = side * 0.65;
    wing.position.z = 0.2;
    wing.scale.set(scale, scale, scale);
    group.add(wing);
  }

  // Precision cannon barrel: short, thick
  const barrelGeom = new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.15, 0.15, 0.15),
    metalness: 0.85,
    roughness: 0.2,
  });
  const barrel = new THREE.Mesh(barrelGeom, barrelMat);
  barrel.position.z = 3.5;
  barrel.rotation.x = Math.PI / 2;
  barrel.scale.set(scale, scale, scale);
  group.add(barrel);

  // Recoil damper struts: support braces
  const strutGeom = new THREE.BoxGeometry(0.08, 0.1, 0.8);
  const strutMat = new THREE.MeshStandardMaterial({
    color: baseCol,
    metalness: 0.7,
    roughness: 0.3,
  });
  for (const angle of [-0.3, 0.3]) {
    const strut = new THREE.Mesh(strutGeom, strutMat);
    strut.position.z = 3.0;
    strut.rotation.y = angle;
    strut.scale.set(scale, scale, scale);
    group.add(strut);
  }

  // Engine pod: minimal, rear-mounted
  const engineGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.5, 6);
  const engineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.1, 0.1, 0.15),
    emissive: glowCol,
    emissiveIntensity: 0.7,
    metalness: 0.8,
    roughness: 0.25,
  });
  const engine = new THREE.Mesh(engineGeom, engineMat);
  engine.position.z = -1.5;
  engine.rotation.x = Math.PI / 2;
  engine.scale.set(scale, scale, scale);
  group.add(engine);

  // Engine exhaust glow
  const exhaustGeom = new THREE.ConeGeometry(0.2, 0.6, 6);
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 0, 0),
    emissive: glowCol,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.4,
  });
  const exhaust = new THREE.Mesh(exhaustGeom, exhaustMat);
  exhaust.position.z = -2.0;
  exhaust.scale.set(scale, scale, scale);
  group.add(exhaust);

  return group;
}

/**
 * Generate an alien swarm fighter.
 * Small, fast, ugly on purpose. Octahedral core with spines.
 */
export function generateSwarmFighter(config: ShipConfig): THREE.Group {
  const group = new THREE.Group();

  const scale = config.scale ?? 1;
  const color1 = config.color1 ?? { r: 0.3, g: 0.2, b: 0.1 };
  const color2 = config.color2 ?? { r: 0.7, g: 0.4, b: 0.2 };

  const baseCol = new THREE.Color(color1.r, color1.g, color1.b);
  const accentCol = new THREE.Color(color2.r, color2.g, color2.b);
  const glowCol = new THREE.Color(color2.r * 0.5, color2.g * 0.2, color2.b * 0.05);

  // Octahedral core: aggressive compact shape
  const hullGeom = new THREE.OctahedronGeometry(0.45);
  const hullMat = new THREE.MeshStandardMaterial({
    color: baseCol,
    metalness: 0.65,
    roughness: 0.35,
  });
  const hull = new THREE.Mesh(hullGeom, hullMat);
  hull.scale.set(scale, scale, scale);
  group.add(hull);

  // Four radiator spines: extend from core
  const spineGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.8, 4);
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.25, 0.2, 0.15),
    metalness: 0.7,
    roughness: 0.3,
  });
  const spinePositions = [
    { x: 0.7, y: 0, z: 0 },
    { x: -0.7, y: 0, z: 0 },
    { x: 0, y: 0.7, z: 0 },
    { x: 0, y: -0.7, z: 0 },
  ];
  for (const pos of spinePositions) {
    const spine = new THREE.Mesh(spineGeom, spineMat);
    spine.position.set(pos.x * scale, pos.y * scale, pos.z * scale);
    spine.rotation.z = pos.x !== 0 ? Math.PI / 2 : 0;
    spine.rotation.y = pos.x !== 0 ? 0 : Math.PI / 2;
    spine.scale.set(scale, scale, scale);
    group.add(spine);
  }

  // Forward spike: aggressive pointed tip
  const spikeGeom = new THREE.ConeGeometry(0.12, 0.7, 6);
  const spikeMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    metalness: 0.8,
    roughness: 0.2,
  });
  const spike = new THREE.Mesh(spikeGeom, spikeMat);
  spike.position.z = 0.7;
  spike.scale.set(scale, scale, scale);
  group.add(spike);

  // Bright engine core: pulsing glow
  const coreGeom = new THREE.SphereGeometry(0.18, 8, 8);
  const coreMat = new THREE.MeshStandardMaterial({
    color: accentCol,
    emissive: accentCol,
    emissiveIntensity: 0.8,
    metalness: 0.85,
    roughness: 0.15,
  });
  const core = new THREE.Mesh(coreGeom, coreMat);
  core.position.z = -0.4;
  core.scale.set(scale, scale, scale);
  group.add(core);

  // Tiny thruster nub: rear exhaust
  const thrustGeom = new THREE.SphereGeometry(0.08, 6, 6);
  const thrustMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0, 0, 0),
    emissive: glowCol,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.7,
  });
  const thrust = new THREE.Mesh(thrustGeom, thrustMat);
  thrust.position.z = -0.7;
  thrust.scale.set(scale, scale, scale);
  group.add(thrust);

  return group;
}

/**
 * Main factory: generate ship of given type and config.
 */
export function generateShip(config: ShipConfig): THREE.Group {
  switch (config.faction) {
    case 'player':
      return generatePlayerShip(config);
    case 'alien_basic':
      return generateAlienFighter(config);
    case 'alien_sniper':
      return generateAlienSniper(config);
    case 'alien_swarm':
      return generateSwarmFighter(config);
    case 'boss':
      // Boss ships are larger variants of fighters
      return generateAlienFighter({ ...config, scale: (config.scale ?? 1) * 2.5 });
    default:
      return generatePlayerShip(config);
  }
}
