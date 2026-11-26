/**
 * Helion Drift — stations, hostile bases and asteroid fields.
 * Everything is placed relative to the real bodies from solar.ts.
 */
import * as THREE from 'three';
import { AU_UNITS, type Body } from './solar';

// ---------------------------------------------------------------- RNG
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(x: number, y: number, z: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + salt * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------- stations
export interface Station {
  id: string;
  name: string;
  host: string; // body id
  /** offset from host centre, in host radii (direction) — resolved at runtime */
  offsetDir: THREE.Vector3;
  altitude: number; // multiples of host radius from centre
  pos: THREE.Vector3;
  fuelPrice: number; // credits per unit
  tagline: string;
}

export const STATION_RADIUS = 70; // collision sphere of the station hull
export const DOCK_RANGE = 340;
export const DOCK_MAX_SPEED = 70;

export function buildStations(): Station[] {
  const mk = (id: string, name: string, host: string, dir: [number, number, number], altitude: number, fuelPrice: number, tagline: string): Station => ({
    id, name, host, offsetDir: new THREE.Vector3(...dir).normalize(), altitude, pos: new THREE.Vector3(), fuelPrice, tagline,
  });
  return [
    mk('earth-orbital', 'Earth Orbital', 'Earth', [-0.6, 0.25, 0.75], 1.9, 2, 'Home port. Cheapest fuel in the system.'),
    mk('tranquility', 'Tranquility Yard', 'Moon', [0.3, 0.4, -0.85], 2.4, 3, 'Shipwright on the near side. Hull work done right.'),
    mk('phobos-yard', 'Phobos Yard', 'Mars', [0.8, 0.15, -0.55], 2.3, 3, 'Last full-service stop before the belt.'),
    mk('ceres-depot', 'Ceres Depot', 'Ceres', [-0.4, 0.3, 0.85], 3.2, 4, 'Ore buyers. They pay well for clean rock.'),
    mk('ganymede', 'Ganymede Station', 'Ganymede', [0.2, 0.35, 0.9], 2.6, 5, 'Jupiter\'s radiation is outside. Stay inside.'),
    mk('titan-port', 'Titan Port', 'Titan', [-0.7, 0.3, -0.6], 2.6, 6, 'Methane rain, cheap refining, long way from home.'),
    mk('triton-outpost', 'Triton Outpost', 'Triton', [0.5, 0.4, 0.75], 3.0, 9, 'The edge. Fuel is dear this far out.'),
  ];
}

export function resolveStations(stations: Station[], bodies: Body[]) {
  for (const s of stations) {
    const host = bodies.find((b) => b.id === s.host);
    if (!host) continue;
    s.pos.copy(host.pos).addScaledVector(s.offsetDir, host.radius * s.altitude);
  }
}

// ---------------------------------------------------------------- hostile bases
export type EnemyKind = 'fighter' | 'sniper' | 'swarm' | 'turret';

export interface BaseDef {
  id: string;
  name: string;
  /** anchor: near a body, at an offset in AU-ish terms */
  near: string;
  offset: THREE.Vector3; // game units from the anchor body centre
  turrets: number;
  garrison: number; // max fighters alive at once
  roster: EnemyKind[];
  coreHp: number;
  reward: number;
  tier: 1 | 2 | 3 | 4;
}

export const BASE_CLUSTER_RADIUS = 2600;

export function buildBaseDefs(): BaseDef[] {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return [
    { id: 'redoubt', name: 'Deimos Redoubt', near: 'Mars', offset: v(-9000, 1500, 6500), turrets: 4, garrison: 3, roster: ['fighter', 'swarm'], coreHp: 700, reward: 1800, tier: 1 },
    { id: 'hive-belt', name: 'Belt Hive', near: 'Vesta', offset: v(5200, -900, -7800), turrets: 6, garrison: 4, roster: ['fighter', 'swarm', 'sniper'], coreHp: 1500, reward: 3200, tier: 2 },
    { id: 'trojan-nest', name: 'Trojan Nest', near: 'Jupiter', offset: v(0, 0, 0), turrets: 8, garrison: 5, roster: ['fighter', 'sniper', 'swarm'], coreHp: 2200, reward: 5200, tier: 3 },
    { id: 'ring-spire', name: 'Ring Spire', near: 'Saturn', offset: v(14_000, 900, -10_000), turrets: 9, garrison: 6, roster: ['sniper', 'fighter', 'swarm'], coreHp: 2800, reward: 7000, tier: 3 },
    { id: 'kuiper-bastion', name: 'Kuiper Bastion', near: 'Pluto', offset: v(-6000, 2500, 5000), turrets: 12, garrison: 7, roster: ['sniper', 'fighter', 'swarm'], coreHp: 4200, reward: 14_000, tier: 4 },
  ];
}

/** Resolve the base position. The Trojan Nest sits at Jupiter's L4 point (60° ahead in its orbit). */
export function resolveBasePosition(def: BaseDef, bodies: Body[]): THREE.Vector3 {
  const anchor = bodies.find((b) => b.id === def.near);
  if (!anchor) return new THREE.Vector3();
  if (def.id === 'trojan-nest') {
    const r = Math.hypot(anchor.pos.x, anchor.pos.z);
    const a = Math.atan2(anchor.pos.z, anchor.pos.x) + Math.PI / 3;
    return new THREE.Vector3(Math.cos(a) * r, anchor.pos.y, Math.sin(a) * r);
  }
  return anchor.pos.clone().add(def.offset);
}

// ---------------------------------------------------------------- asteroid fields
export interface Asteroid {
  id: string;
  pos: THREE.Vector3;
  radius: number;
  axis: THREE.Vector3;
  spin: number;
  phase: number;
  type: 0 | 1; // 0 stony, 1 carbonaceous
  hp: number;
  ore: number;
}

export const CELL = 1600;

export interface FieldSampler {
  /** density (asteroids per cell) at a world point */
  density(p: THREE.Vector3): number;
  /** true if a rock of radius r at p would intrude on a base, station or world */
  blocked(p: THREE.Vector3, r: number): boolean;
}

export const BELT_INNER = 2.15 * AU_UNITS;
export const BELT_OUTER = 3.3 * AU_UNITS;
export const BELT_HALF_THICKNESS = 0.05 * AU_UNITS;

export function makeFieldSampler(basePositions: THREE.Vector3[], bodies: Body[], stationPositions: THREE.Vector3[] = []): FieldSampler {
  const jupiter = bodies.find((b) => b.id === 'Jupiter');
  const saturn = bodies.find((b) => b.id === 'Saturn');
  return {
    density(p) {
      let d = 0;
      // main belt: a thin ring between Mars and Jupiter
      const r = Math.hypot(p.x, p.z);
      if (r > BELT_INNER && r < BELT_OUTER && Math.abs(p.y) < BELT_HALF_THICKNESS) {
        const edge = Math.min(r - BELT_INNER, BELT_OUTER - r) / (0.25 * AU_UNITS);
        const vert = 1 - Math.abs(p.y) / BELT_HALF_THICKNESS;
        d += 1.6 * Math.min(1, edge) * vert;
      }
      // every hostile base hides inside a dense rubble cluster
      for (const b of basePositions) {
        const dist = p.distanceTo(b);
        if (dist < BASE_CLUSTER_RADIUS * 1.6) d += 7 * Math.max(0, 1 - dist / (BASE_CLUSTER_RADIUS * 1.6)) ** 0.7;
      }
      // Jupiter's trojan swarm around L4/L5 (beyond the base cluster)
      if (jupiter) {
        const rj = Math.hypot(jupiter.pos.x, jupiter.pos.z);
        const aj = Math.atan2(jupiter.pos.z, jupiter.pos.x);
        for (const off of [Math.PI / 3, -Math.PI / 3]) {
          const c = new THREE.Vector3(Math.cos(aj + off) * rj, jupiter.pos.y, Math.sin(aj + off) * rj);
          const dist = p.distanceTo(c);
          if (dist < 0.35 * AU_UNITS) d += 1.2 * (1 - dist / (0.35 * AU_UNITS));
        }
      }
      // Saturn's ring plane, just outside the visible rings: loose ice chunks
      if (saturn && saturn.rings) {
        const dx = p.x - saturn.pos.x, dz = p.z - saturn.pos.z, dy = p.y - saturn.pos.y;
        const rr = Math.hypot(dx, dz);
        if (rr > saturn.rings.outer * 1.02 && rr < saturn.rings.outer * 1.6 && Math.abs(dy) < 260) d += 2.4;
      }
      return d;
    },
    blocked(p, r) {
      for (const b of basePositions) if (p.distanceTo(b) < 480 + r) return true;
      for (const s of stationPositions) if (p.distanceTo(s) < 900 + r) return true;
      for (const b of bodies) {
        const lim = b.radius * 1.12 + r;
        if (Math.abs(p.x - b.pos.x) < lim && Math.abs(p.z - b.pos.z) < lim && p.distanceTo(b.pos) < lim) return true;
      }
      return false;
    },
  };
}

/** Deterministic asteroids for one cell. Same cell → same rocks, every time. */
export function cellAsteroids(cx: number, cy: number, cz: number, sampler: FieldSampler, destroyed: Set<string>): Asteroid[] {
  const center = new THREE.Vector3((cx + 0.5) * CELL, (cy + 0.5) * CELL, (cz + 0.5) * CELL);
  const dens = sampler.density(center);
  if (dens <= 0.02) return [];
  const rng = mulberry32(hash3(cx, cy, cz, 7));
  // Poisson-ish count
  let n = Math.floor(dens);
  if (rng() < dens - n) n++;
  const out: Asteroid[] = [];
  for (let i = 0; i < n; i++) {
    const id = `${cx},${cy},${cz},${i}`;
    const u = rng(), v = rng(), w = rng();
    // log-normal-ish size: lots of small rocks, a few giants
    const big = rng();
    const radius = big > 0.97 ? 70 + rng() * 90 : big > 0.8 ? 26 + rng() * 34 : 6 + rng() * 18;
    // draw every random number first so skipping a rock never shifts its neighbours
    const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    const spin = (rng() - 0.5) * 0.5, phase = rng() * Math.PI * 2, type: 0 | 1 = rng() < 0.4 ? 1 : 0;
    const pos = new THREE.Vector3(cx * CELL + u * CELL, cy * CELL + v * CELL, cz * CELL + w * CELL);
    if (destroyed.has(id) || sampler.blocked(pos, radius)) continue;
    out.push({ id, pos, radius, axis, spin, phase, type, hp: radius * 5, ore: Math.round(radius * 0.6) });
  }
  return out;
}

/** All asteroids within `range` of p. */
export function asteroidsNear(p: THREE.Vector3, range: number, sampler: FieldSampler, destroyed: Set<string>, cache: Map<string, Asteroid[]>): Asteroid[] {
  const out: Asteroid[] = [];
  const r = Math.ceil(range / CELL);
  const cx0 = Math.floor(p.x / CELL), cy0 = Math.floor(p.y / CELL), cz0 = Math.floor(p.z / CELL);
  const r2 = range * range;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    const key = `${cx0 + dx},${cy0 + dy},${cz0 + dz}`;
    let list = cache.get(key);
    if (!list) {
      list = cellAsteroids(cx0 + dx, cy0 + dy, cz0 + dz, sampler, destroyed);
      cache.set(key, list);
      if (cache.size > 6000) cache.delete(cache.keys().next().value as string);
    }
    for (const a of list) if (a.hp > 0 && a.pos.distanceToSquared(p) < r2) out.push(a);
  }
  return out;
}
