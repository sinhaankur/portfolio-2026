/**
 * Helion Drift — the playable Solar System.
 *
 * Every planet sits where it REALLY is on the day you launch: positions come
 * from the Universe Engine's own orbital elements (planetsData + Kepler) in
 * the ecliptic frame (+y = ecliptic north, +x = vernal equinox).
 *
 * Only the scale is a game choice, and it is stated plainly:
 *   - distance:  1 AU = AU_UNITS game units (linear, so the layout is true)
 *   - sizes:     planets keep their REAL size ratios to each other, but are
 *                drawn ~1,000x larger than true so they read as worlds you
 *                can fly to; the Sun is compressed so Mercury stays outside it
 *   - moons:     true order + true size ratios, orbits compressed (sqrt law)
 */
import * as THREE from 'three';
import { planetsData, solveKepler, eccentricToTrue, DEG, J2000_MS } from '../../../components/universe-engine/astronomy';

export const AU_UNITS = 40_000;
export const EARTH_RADIUS_UNITS = 500;
export const SUN_RADIUS_UNITS = 1_800;

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon';

export interface Body {
  id: string;
  name: string;
  kind: BodyKind;
  /** heliocentric ecliptic position, game units (float64) */
  pos: THREE.Vector3;
  radius: number;
  parent: string | null;
  texture: string | null;
  tint: string;
  tiltDeg: number;
  /** visual spin, rad/s (real rotation sped up so you can see it turn) */
  spin: number;
  rings?: { inner: number; outer: number; texture: string };
  atmosphere?: { color: string; strength: number };
  /** real facts, shown when you scan the body */
  facts: { label: string; value: string }[];
  blurb: string;
  /** for moons: orbit around parent (game units) + angular speed */
  orbit?: { radius: number; phase: number; speed: number; incl: number };
}

const EARTH_RADIUS_KM = 6371;

function fmtTemp(k?: { min?: number; mean?: number; max?: number }) {
  if (!k) return '—';
  const c = (v: number) => `${Math.round(v - 273.15)} °C`;
  if (k.mean != null) return c(k.mean);
  return '—';
}

/** Heliocentric ecliptic position for a planet on a given date (real AU). */
export function planetPositionAU(name: string, dateMs: number): THREE.Vector3 {
  const p = planetsData.find((q) => q.name === name);
  if (!p) return new THREE.Vector3();
  const e = p.deep?.eccentricity ?? 0;
  const days = (dateMs - J2000_MS) / 86_400_000;
  const M = ((p.m0Deg ?? 0) * DEG + (2 * Math.PI * days) / p.periodDays) % (2 * Math.PI);
  const E = solveKepler(M, e);
  const nu = eccentricToTrue(E, e);
  const r = (p.aAU * (1 - e * e)) / (1 + e * Math.cos(nu));
  const argPeri = ((p.periDeg ?? 0) - (p.longNodeDeg ?? 0)) * DEG;
  const node = (p.longNodeDeg ?? 0) * DEG;
  const incl = (p.inclDeg ?? 0) * DEG;
  // orbital plane → ecliptic (standard rotation), then to engine axes (y up)
  const u = argPeri + nu;
  const xEcl = r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(incl));
  const yEcl = r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(incl));
  const zEcl = r * (Math.sin(u) * Math.sin(incl));
  return new THREE.Vector3(xEcl, zEcl, yEcl);
}

const ATMOS: Record<string, { color: string; strength: number }> = {
  Venus: { color: '#f3d9a4', strength: 0.9 },
  Earth: { color: '#6fb2ff', strength: 1.0 },
  Mars: { color: '#e69a6a', strength: 0.35 },
  Jupiter: { color: '#e8d2b0', strength: 0.45 },
  Saturn: { color: '#eedcb0', strength: 0.4 },
  Uranus: { color: '#a9f0ea', strength: 0.6 },
  Neptune: { color: '#6f8fff', strength: 0.7 },
  Titan: { color: '#e0a650', strength: 0.8 },
};

/** Major moons — real semi-major axis (km), radius (km), period (days). */
const MOONS: { name: string; parent: string; aKm: number; rKm: number; periodDays: number; texture: string; blurb: string }[] = [
  { name: 'Moon', parent: 'Earth', aKm: 384_400, rKm: 1737, periodDays: 27.32, texture: '/textures/moon.webp', blurb: 'Born from a giant impact ~4.5 billion years ago. Tidally locked: the same face always looks at Earth.' },
  { name: 'Io', parent: 'Jupiter', aKm: 421_700, rKm: 1822, periodDays: 1.77, texture: '/textures/io.webp', blurb: 'The most volcanic body known — over 400 active volcanoes, heated by Jupiter\'s tides.' },
  { name: 'Europa', parent: 'Jupiter', aKm: 671_034, rKm: 1561, periodDays: 3.55, texture: '/textures/europa.webp', blurb: 'An ice shell over a global salt-water ocean holding more water than all of Earth\'s seas.' },
  { name: 'Ganymede', parent: 'Jupiter', aKm: 1_070_412, rKm: 2634, periodDays: 7.15, texture: '/textures/ganymede.webp', blurb: 'The largest moon in the Solar System — bigger than Mercury, with its own magnetic field.' },
  { name: 'Callisto', parent: 'Jupiter', aKm: 1_882_709, rKm: 2410, periodDays: 16.69, texture: '/textures/callisto.webp', blurb: 'The most heavily cratered surface known; it sits outside Jupiter\'s worst radiation.' },
  { name: 'Enceladus', parent: 'Saturn', aKm: 238_020, rKm: 252, periodDays: 1.37, texture: '/textures/enceladus.webp', blurb: 'Geysers at its south pole spray water from a hidden ocean into Saturn\'s E ring.' },
  { name: 'Titan', parent: 'Saturn', aKm: 1_221_870, rKm: 2575, periodDays: 15.95, texture: '/textures/titan.webp', blurb: 'A thick nitrogen sky and lakes of liquid methane — the only moon with a dense atmosphere.' },
  { name: 'Triton', parent: 'Neptune', aKm: 354_759, rKm: 1353, periodDays: -5.88, texture: '/textures/triton.webp', blurb: 'Orbits backwards — almost certainly a captured Kuiper Belt object. Nitrogen geysers erupt on its surface.' },
];

/** Dwarf planets / big asteroids in the main belt (real a, e≈ignored). */
const DWARFS: { name: string; aAU: number; rKm: number; lonDeg: number; texture: string; blurb: string }[] = [
  { name: 'Ceres', aAU: 2.77, rKm: 470, lonDeg: 80, texture: '/textures/ceres.webp', blurb: 'The largest object in the asteroid belt — a dwarf planet with bright salt deposits in Occator crater.' },
  { name: 'Vesta', aAU: 2.36, rKm: 263, lonDeg: 210, texture: '/textures/vesta.webp', blurb: 'A protoplanet with a 500 km impact basin; pieces of it have fallen to Earth as meteorites.' },
];

export function buildSolarSystem(dateMs: number): Body[] {
  const bodies: Body[] = [];
  bodies.push({
    id: 'Sun', name: 'Sun', kind: 'star', pos: new THREE.Vector3(), radius: SUN_RADIUS_UNITS, parent: null,
    texture: '/textures/sun.webp', tint: '#ffd27a', tiltDeg: 7.25, spin: 0.01,
    facts: [
      { label: 'Type', value: 'G2V main-sequence star' },
      { label: 'Surface', value: '5,772 K' },
      { label: 'Age', value: '4.6 billion years' },
    ],
    blurb: '99.86% of the Solar System\'s mass. Skim its corona to scoop fuel — but watch the heat.',
  });

  for (const p of planetsData) {
    const au = planetPositionAU(p.name, dateMs);
    const radius = p.radiusEarth * EARTH_RADIUS_UNITS;
    const facts = [
      { label: 'Class', value: p.classification ?? '—' },
      { label: 'Gravity', value: p.deep?.gravity != null ? `${p.deep.gravity} m/s²` : '—' },
      { label: 'Mean temp', value: fmtTemp(p.surfaceTempK) },
      { label: 'Moons', value: String(p.moons ?? 0) },
      { label: 'From Sun', value: `${p.aAU.toFixed(2)} AU` },
    ];
    const fact = (p.fact ?? '').split('. ').slice(0, 2).join('. ');
    bodies.push({
      id: p.name, name: p.name, kind: p.name === 'Pluto' ? 'dwarf' : 'planet',
      pos: au.multiplyScalar(AU_UNITS), radius, parent: null,
      texture: p.textureUrl ?? null, tint: p.shade ?? '#999', tiltDeg: p.tiltDeg ?? 0,
      spin: (2 * Math.PI) / Math.max(30, Math.abs(p.rotHours) * 6) * Math.sign(p.rotHours || 1),
      rings: p.hasRings ? { inner: radius * 1.24, outer: radius * 2.27, texture: '/textures/saturn-ring.webp' } : undefined,
      atmosphere: ATMOS[p.name],
      facts, blurb: fact.endsWith('.') ? fact : fact + '.',
    });
  }

  for (const d of DWARFS) {
    const a = d.lonDeg * DEG;
    bodies.push({
      id: d.name, name: d.name, kind: 'dwarf',
      pos: new THREE.Vector3(Math.cos(a) * d.aAU * AU_UNITS, 0, Math.sin(a) * d.aAU * AU_UNITS),
      radius: Math.max(60, (d.rKm / EARTH_RADIUS_KM) * EARTH_RADIUS_UNITS * 1.6), parent: null,
      texture: d.texture, tint: '#8a8178', tiltDeg: 4, spin: 0.05,
      facts: [{ label: 'Class', value: 'Asteroid-belt body' }, { label: 'Radius', value: `${d.rKm} km` }, { label: 'From Sun', value: `${d.aAU} AU` }],
      blurb: d.blurb,
    });
  }

  for (const m of MOONS) {
    const parent = bodies.find((b) => b.id === m.parent)!;
    const parentRealKm = (parent.radius / EARTH_RADIUS_UNITS) * EARTH_RADIUS_KM;
    const ratio = m.aKm / parentRealKm;
    const orbitR = parent.radius * (1.8 + 0.55 * Math.sqrt(ratio));
    const days = (dateMs - J2000_MS) / 86_400_000;
    const phase = ((days / m.periodDays) % 1) * 2 * Math.PI;
    const pos = parent.pos.clone().add(new THREE.Vector3(Math.cos(phase) * orbitR, 0, Math.sin(phase) * orbitR));
    bodies.push({
      id: m.name, name: m.name, kind: 'moon', pos,
      radius: Math.max(40, (m.rKm / EARTH_RADIUS_KM) * EARTH_RADIUS_UNITS), parent: m.parent,
      texture: m.texture, tint: '#aaa', tiltDeg: 0, spin: 0.02,
      atmosphere: ATMOS[m.name],
      orbit: { radius: orbitR, phase, speed: (2 * Math.PI) / (Math.abs(m.periodDays) * 600) * Math.sign(m.periodDays), incl: 0 },
      facts: [{ label: 'Orbits', value: m.parent }, { label: 'Radius', value: `${m.rKm.toLocaleString()} km` }, { label: 'Period', value: `${Math.abs(m.periodDays)} days` }],
      blurb: m.blurb,
    });
  }
  return bodies;
}

/** Advance moon orbits (purely visual pace, ~600x real). */
export function updateMoons(bodies: Body[], dt: number) {
  for (const b of bodies) {
    if (!b.orbit || !b.parent) continue;
    const parent = bodies.find((q) => q.id === b.parent);
    if (!parent) continue;
    b.orbit.phase += b.orbit.speed * dt;
    b.pos.set(
      parent.pos.x + Math.cos(b.orbit.phase) * b.orbit.radius,
      parent.pos.y,
      parent.pos.z + Math.sin(b.orbit.phase) * b.orbit.radius,
    );
  }
}

export const OBLIQUITY_RAD = 23.4393 * DEG;
