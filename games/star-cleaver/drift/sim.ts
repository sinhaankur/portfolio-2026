/**
 * Helion Drift — game simulation. Pure TypeScript + three math, no React.
 * The renderer, HUD and audio only READ this state and drain `events`.
 */
import * as THREE from 'three';
import { buildSolarSystem, updateMoons, AU_UNITS, type Body } from './solar';
import {
  buildStations, resolveStations, buildBaseDefs, resolveBasePosition, makeFieldSampler, asteroidsNear,
  STATION_RADIUS, DOCK_RANGE, DOCK_MAX_SPEED, BASE_CLUSTER_RADIUS,
  type Station, type BaseDef, type Asteroid, type EnemyKind, type FieldSampler,
} from './world';

// ---------------------------------------------------------------- tuning
export const TUNE = {
  maxSpeed: 150,
  boostSpeed: 290,
  reverseFrac: 0.35,
  strafeSpeed: 70,
  accel: 130,
  boostAccel: 230,
  pitchRate: 1.55,
  yawRate: 1.25,
  rollRate: 2.6,
  rateResponse: 7,
  cruiseMax: 60_000,
  cruiseSpool: 1.6,
  cruiseFuelPerSec: 1.0,
  boostFuelPerSec: 1.6,
  thrustFuelPerSec: 0.035,
  boltSpeed: 1100,
  boltLife: 1.5,
  boltDamage: 11,
  boltEnergy: 4.5,
  fireInterval: 0.11,
  energyMax: 100,
  energyRegen: 27,
  torpSpeed: 420,
  torpDamage: 150,
  shieldRegen: 9,
  shieldDelay: 2.5,
  massLockRange: 1500,
  scanTime: 1.6,
};

export const UPGRADES = {
  engine: { label: 'Engine', levels: [0, 1, 2, 3], cost: [0, 900, 2200, 5000], desc: 'Top speed, boost and cruise efficiency' },
  tank: { label: 'Fuel tank', levels: [0, 1, 2, 3], cost: [0, 700, 1800, 4200], desc: 'Fly further between stations' },
  guns: { label: 'Pulse cannons', levels: [0, 1, 2, 3], cost: [0, 1000, 2600, 6000], desc: 'Damage and fire rate' },
  shield: { label: 'Shield', levels: [0, 1, 2, 3], cost: [0, 900, 2400, 5500], desc: 'Capacity and recharge' },
  hull: { label: 'Hull plating', levels: [0, 1, 2, 3], cost: [0, 800, 2000, 4800], desc: 'Take more punishment' },
  hold: { label: 'Cargo hold', levels: [0, 1, 2, 3], cost: [0, 600, 1500, 3500], desc: 'Carry more ore' },
} as const;
export type UpgradeKey = keyof typeof UPGRADES;

const ENEMY_STATS: Record<EnemyKind, { hp: number; speed: number; accel: number; range: number; dmg: number; fireCd: number; boltSpeed: number; radius: number; reward: number; turn: number }> = {
  fighter: { hp: 45, speed: 165, accel: 110, range: 950, dmg: 4, fireCd: 1.05, boltSpeed: 750, radius: 7, reward: 70, turn: 2.2 },
  sniper: { hp: 32, speed: 130, accel: 80, range: 1600, dmg: 11, fireCd: 2.8, boltSpeed: 1250, radius: 7, reward: 90, turn: 1.6 },
  swarm: { hp: 16, speed: 205, accel: 170, range: 520, dmg: 2.5, fireCd: 0.6, boltSpeed: 700, radius: 4.5, reward: 35, turn: 3.2 },
  turret: { hp: 100, speed: 0, accel: 0, range: 1300, dmg: 5, fireCd: 2.5, boltSpeed: 950, radius: 11, reward: 140, turn: 1.4 },
};

// ---------------------------------------------------------------- types
export interface Controls {
  pitch: number; yaw: number; roll: number;
  strafeX: number; strafeY: number;
  throttleDelta: number;
  throttleSet: number | null;
  allStop: boolean;
  boost: boolean;
  fire: boolean;
  torpedo: boolean;
  cruise: boolean;
  dock: boolean;
  targetNearest: boolean;
  cycleTarget: boolean;
  cycleNav: number;
}

export function emptyControls(): Controls {
  return { pitch: 0, yaw: 0, roll: 0, strafeX: 0, strafeY: 0, throttleDelta: 0, throttleSet: null, allStop: false, boost: false, fire: false, torpedo: false, cruise: false, dock: false, targetNearest: false, cycleTarget: false, cycleNav: 0 };
}

export interface Ship {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  rates: THREE.Vector3; // pitch, yaw, roll (rad/s)
  throttle: number; // -reverseFrac .. 1
  boosting: boolean;
  hull: number; hullMax: number;
  shield: number; shieldMax: number; shieldCooldown: number;
  fuel: number; fuelMax: number;
  energy: number;
  torps: number; torpsMax: number;
  heat: number;
  cruise: 'off' | 'spooling' | 'on';
  cruiseSpool: number;
  cruiseSpeed: number;
  fireCd: number; muzzle: number;
  alive: boolean;
  respawnIn: number;
  dockedAt: string | null;
  invuln: number;
}

export interface Projectile {
  id: number;
  pos: THREE.Vector3; prev: THREE.Vector3; vel: THREE.Vector3;
  life: number; dmg: number;
  team: 'player' | 'enemy';
  kind: 'bolt' | 'torp';
  target: number | null; // entity id for torps
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion;
  hp: number; hpMax: number;
  baseId: string | null;
  anchor: THREE.Vector3 | null; // turrets: offset from base centre
  fireCd: number; burst: number;
  mode: 'patrol' | 'attack' | 'evade';
  modeT: number;
  orbitSeed: number;
  alive: boolean;
}

export interface Base {
  def: BaseDef;
  pos: THREE.Vector3;
  coreHp: number;
  destroyed: boolean;
  alert: boolean;
  spawnCd: number;
  turretIds: number[];
  discovered: boolean;
}

export interface Loot {
  id: number; pos: THREE.Vector3; vel: THREE.Vector3;
  kind: 'ore' | 'fuel' | 'salvage'; amount: number; life: number;
}

export type NavRef = { type: 'body' | 'station' | 'base'; id: string };

export type GameEvent =
  | { t: 'explosion'; pos: THREE.Vector3; size: number; kind: 'ship' | 'turret' | 'base' | 'rock' | 'player' }
  | { t: 'hit'; pos: THREE.Vector3; team: 'player' | 'enemy'; shield: boolean }
  | { t: 'fire'; pos: THREE.Vector3; team: 'player' | 'enemy'; kind: 'bolt' | 'torp' }
  | { t: 'msg'; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }
  | { t: 'scan'; bodyId: string }
  | { t: 'pickup'; kind: Loot['kind']; amount: number }
  | { t: 'dock'; stationId: string }
  | { t: 'undock' }
  | { t: 'cruise'; on: boolean }
  | { t: 'playerHit'; amount: number; shield: boolean }
  | { t: 'death' };

export interface SaveData {
  v: 2;
  credits: number;
  ore: number;
  upgrades: Record<UpgradeKey, number>;
  scanned: string[];
  destroyedBases: string[];
  discoveredBases: string[];
  lastStation: string;
  torps: number;
  fuel: number;
  hull: number;
  stats: { kills: number; basesDown: number; distance: number; deaths: number };
  tutorial: Record<string, boolean>;
}

const SAVE_KEY = 'helion-drift-save-v2';

export function defaultSave(): SaveData {
  return {
    v: 2, credits: 500, ore: 0,
    upgrades: { engine: 0, tank: 0, guns: 0, shield: 0, hull: 0, hold: 0 },
    scanned: [], destroyedBases: [], discoveredBases: [], lastStation: 'earth-orbital',
    torps: 4, fuel: 100, hull: 100,
    stats: { kills: 0, basesDown: 0, distance: 0, deaths: 0 },
    tutorial: {},
  };
}

export function loadSave(): SaveData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveData;
    if (s.v !== 2) return null;
    return { ...defaultSave(), ...s, upgrades: { ...defaultSave().upgrades, ...s.upgrades }, stats: { ...defaultSave().stats, ...s.stats } };
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------- helpers
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _e1 = new THREE.Euler();
const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

/** Time-to-intercept lead point for a projectile of speed s. */
export function leadPoint(shooter: THREE.Vector3, shooterVel: THREE.Vector3, target: THREE.Vector3, targetVel: THREE.Vector3, s: number, out: THREE.Vector3) {
  const dx = target.x - shooter.x, dy = target.y - shooter.y, dz = target.z - shooter.z;
  const vx = targetVel.x - shooterVel.x, vy = targetVel.y - shooterVel.y, vz = targetVel.z - shooterVel.z;
  const a = vx * vx + vy * vy + vz * vz - s * s;
  const b = 2 * (dx * vx + dy * vy + dz * vz);
  const c = dx * dx + dy * dy + dz * dz;
  let t = 0;
  if (Math.abs(a) < 1e-6) t = c > 0 && b !== 0 ? -c / b : 0;
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
      t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
    }
  }
  if (!(t > 0) || t > 6) t = Math.sqrt(c) / s;
  return out.set(target.x + vx * t, target.y + vy * t, target.z + vz * t);
}

/** segment (a→b) vs sphere; returns true if it touches */
function segSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 > 0 ? (acx * abx + acy * aby + acz * abz) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + abx * t - c.x, py = a.y + aby * t - c.y, pz = a.z + abz * t - c.z;
  return px * px + py * py + pz * pz <= r * r;
}

function approach(cur: number, target: number, rate: number, dt: number) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}

// ---------------------------------------------------------------- the sim
export class DriftSim {
  time = 0;
  bodies: Body[];
  stations: Station[];
  bases: Base[];
  sampler: FieldSampler;
  ship: Ship;
  save: SaveData;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  loot: Loot[] = [];
  events: GameEvent[] = [];
  destroyedRocks = new Set<string>();
  rockCache = new Map<string, Asteroid[]>();
  nearRocks: Asteroid[] = [];
  private nearRocksT = 0;
  targetId: number | null = null; // enemy id, or -1 for "base core of nearest base"
  targetBase: string | null = null;
  nav: NavRef | null = null;
  scanProgress: { id: string; t: number } | null = null;
  dockable: Station | null = null;
  massLocked = false;
  /** true while cruise assist is steering */
  assist = false;
  paused = false;
  private nextId = 1;
  private patrolCd = 25;
  private lowFuelWarned = false;
  private distanceAcc = 0;

  constructor(save: SaveData | null, dateMs = Date.now()) {
    this.save = save ?? defaultSave();
    this.bodies = buildSolarSystem(dateMs);
    this.stations = buildStations();
    resolveStations(this.stations, this.bodies);
    this.bases = buildBaseDefs().map((def) => ({
      def, pos: resolveBasePosition(def, this.bodies), coreHp: def.coreHp,
      destroyed: this.save.destroyedBases.includes(def.id), alert: false, spawnCd: 0, turretIds: [],
      discovered: this.save.discoveredBases.includes(def.id),
    }));
    this.sampler = makeFieldSampler(this.bases.map((b) => b.pos), this.bodies, this.stations.map((s) => s.pos));
    const s = this.save;
    this.ship = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), rates: new THREE.Vector3(),
      throttle: 0, boosting: false,
      hull: s.hull, hullMax: 100, shield: 60, shieldMax: 60, shieldCooldown: 0,
      fuel: s.fuel, fuelMax: 100, energy: TUNE.energyMax, torps: s.torps, torpsMax: 4, heat: 0,
      cruise: 'off', cruiseSpool: 0, cruiseSpeed: 0, fireCd: 0, muzzle: 0,
      alive: true, respawnIn: 0, dockedAt: null, invuln: 0,
    };
    this.applyUpgrades();
    this.ship.hull = Math.min(this.ship.hull, this.ship.hullMax);
    this.ship.shield = this.ship.shieldMax;
    this.ship.fuel = Math.min(this.ship.fuel, this.ship.fuelMax);
    for (const b of this.bases) if (!b.destroyed) this.spawnTurrets(b);
    this.dockAt(this.station(s.lastStation) ?? this.stations[0], true);
  }

  // ---------------------------------------------------------------- derived stats
  get stats() {
    const u = this.save.upgrades;
    return {
      maxSpeed: TUNE.maxSpeed * (1 + 0.12 * u.engine),
      boostSpeed: TUNE.boostSpeed * (1 + 0.12 * u.engine),
      cruiseFuel: TUNE.cruiseFuelPerSec * (1 - 0.15 * u.engine),
      gunDamage: TUNE.boltDamage * (1 + 0.35 * u.guns),
      fireInterval: TUNE.fireInterval * (1 - 0.1 * u.guns),
      shieldRegen: TUNE.shieldRegen * (1 + 0.35 * u.shield),
      holdMax: 40 + 30 * u.hold,
    };
  }

  applyUpgrades() {
    const u = this.save.upgrades;
    this.ship.hullMax = 100 + 60 * u.hull;
    this.ship.shieldMax = 60 + 45 * u.shield;
    this.ship.fuelMax = 100 + 35 * u.tank;
    this.ship.torpsMax = 4 + u.guns;
  }

  station(id: string) { return this.stations.find((s) => s.id === id); }
  body(id: string) { return this.bodies.find((b) => b.id === id); }
  base(id: string) { return this.bases.find((b) => b.def.id === id); }
  enemy(id: number | null) { return id == null ? undefined : this.enemies.find((e) => e.id === id && e.alive); }

  msg(text: string, tone: 'info' | 'good' | 'warn' | 'bad' = 'info') { this.events.push({ t: 'msg', text, tone }); }

  persist() {
    const s = this.save;
    s.torps = this.ship.torps;
    s.fuel = Math.round(this.ship.fuel * 10) / 10;
    s.hull = Math.round(this.ship.hull);
    s.destroyedBases = this.bases.filter((b) => b.destroyed).map((b) => b.def.id);
    s.discoveredBases = this.bases.filter((b) => b.discovered).map((b) => b.def.id);
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
  }

  // ---------------------------------------------------------------- nav
  navPosition(n: NavRef | null): THREE.Vector3 | null {
    if (!n) return null;
    if (n.type === 'body') return this.body(n.id)?.pos ?? null;
    if (n.type === 'station') return this.station(n.id)?.pos ?? null;
    return this.base(n.id)?.pos ?? null;
  }
  navName(n: NavRef | null) {
    if (!n) return '';
    if (n.type === 'body') return this.body(n.id)?.name ?? '';
    if (n.type === 'station') return this.station(n.id)?.name ?? '';
    return this.base(n.id)?.def.name ?? '';
  }
  /** How close cruise brings you before it drops you out. */
  navDropDistance(n: NavRef | null) {
    if (!n) return 0;
    if (n.type === 'station') return 1100;
    if (n.type === 'base') return BASE_CLUSTER_RADIUS + 1600;
    const b = this.body(n.id);
    return b ? b.radius * 1.5 + 900 + (b.rings ? b.rings.outer - b.radius : 0) : 1000;
  }
  navList(): NavRef[] {
    const list: NavRef[] = this.stations.map((s) => ({ type: 'station', id: s.id }));
    for (const b of this.bodies) list.push({ type: 'body', id: b.id });
    for (const b of this.bases) if (b.discovered && !b.destroyed) list.push({ type: 'base', id: b.def.id });
    return list;
  }
  setNav(n: NavRef | null) {
    this.nav = n;
    if (n) this.msg(`Course set: ${this.navName(n)}`, 'info');
  }

  // ---------------------------------------------------------------- docking
  dockAt(st: Station, silent = false) {
    const sh = this.ship;
    sh.dockedAt = st.id;
    sh.cruise = 'off'; sh.cruiseSpeed = 0; sh.cruiseSpool = 0;
    sh.vel.set(0, 0, 0); sh.rates.set(0, 0, 0); sh.throttle = 0;
    sh.pos.copy(st.pos);
    this.save.lastStation = st.id;
    this.enemies = this.enemies.filter((e) => e.baseId || e.pos.distanceTo(st.pos) > 3000);
    this.projectiles.length = 0;
    if (!silent) { this.persist(); this.events.push({ t: 'dock', stationId: st.id }); }
  }

  undock() {
    const sh = this.ship;
    const st = this.station(sh.dockedAt ?? '');
    if (!st) return;
    const host = this.body(st.host);
    // launch outward from the host world, nose pointing away from it
    const out = host ? _v1.copy(st.pos).sub(host.pos).normalize() : _v1.set(0, 0, -1);
    sh.pos.copy(st.pos).addScaledVector(out, STATION_RADIUS + 90);
    // Matrix4.lookAt points -Z (our "forward") from eye toward target
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), out.clone(), UP);
    sh.quat.setFromRotationMatrix(m);
    sh.vel.copy(out).multiplyScalar(60);
    sh.throttle = 0.45;
    sh.dockedAt = null;
    sh.invuln = 2;
    this.events.push({ t: 'undock' });
    if (!this.nav) {
      const next = this.stations.find((s) => s.id !== st.id && s.host !== st.host);
      if (next && !this.save.tutorial.firstNav) this.nav = { type: 'station', id: next.id };
    }
  }

  // ---------------------------------------------------------------- station services
  refuel(): number {
    const st = this.station(this.ship.dockedAt ?? '');
    if (!st) return 0;
    const need = this.ship.fuelMax - this.ship.fuel;
    const afford = Math.floor(this.save.credits / st.fuelPrice);
    const amt = Math.max(0, Math.min(need, afford));
    this.ship.fuel += amt;
    this.save.credits -= Math.ceil(amt * st.fuelPrice);
    this.persist();
    return amt;
  }
  repairCost() { return Math.ceil((this.ship.hullMax - this.ship.hull) * 3); }
  repair() {
    const cost = this.repairCost();
    if (cost <= 0) return;
    if (this.save.credits >= cost) { this.save.credits -= cost; this.ship.hull = this.ship.hullMax; }
    else { const hp = Math.floor(this.save.credits / 3); this.save.credits -= hp * 3; this.ship.hull += hp; }
    this.persist();
  }
  orePrice() { return this.ship.dockedAt === 'ceres-depot' ? 19 : 12; }
  sellOre() {
    const v = this.save.ore * this.orePrice();
    this.save.credits += v; this.save.ore = 0;
    this.persist();
    return v;
  }
  torpCost() { return (this.ship.torpsMax - this.ship.torps) * 60; }
  rearm() {
    const per = 60;
    const n = Math.min(this.ship.torpsMax - this.ship.torps, Math.floor(this.save.credits / per));
    this.ship.torps += n; this.save.credits -= n * per;
    this.persist();
  }
  buyUpgrade(k: UpgradeKey) {
    const lvl = this.save.upgrades[k];
    const def = UPGRADES[k];
    if (lvl >= def.levels.length - 1) return false;
    const cost = def.cost[lvl + 1];
    if (this.save.credits < cost) return false;
    this.save.credits -= cost;
    this.save.upgrades[k] = lvl + 1;
    const hullFrac = this.ship.hull / this.ship.hullMax;
    this.applyUpgrades();
    this.ship.hull = Math.round(this.ship.hullMax * hullFrac);
    this.ship.shield = this.ship.shieldMax;
    this.persist();
    return true;
  }

  /** Out of fuel and stranded: pay a tug to haul you to the nearest station. */
  callTow() {
    let best: Station | null = null; let bd = Infinity;
    for (const s of this.stations) { const d = s.pos.distanceTo(this.ship.pos); if (d < bd) { bd = d; best = s; } }
    if (!best) return;
    const fee = Math.min(this.save.credits, 150 + Math.round(bd / AU_UNITS * 60));
    this.save.credits -= fee;
    this.ship.fuel = Math.max(this.ship.fuel, 10);
    this.dockAt(best);
    this.msg(`Tug fee ${fee} cr. Towed to ${best.name}.`, 'warn');
  }

  // ---------------------------------------------------------------- spawning
  spawnEnemy(kind: EnemyKind, pos: THREE.Vector3, baseId: string | null = null, anchor: THREE.Vector3 | null = null): Enemy {
    const st = ENEMY_STATS[kind];
    const e: Enemy = {
      id: this.nextId++, kind, pos: pos.clone(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(),
      hp: st.hp, hpMax: st.hp, baseId, anchor, fireCd: Math.random() * st.fireCd, burst: 0,
      mode: 'patrol', modeT: 0, orbitSeed: Math.random() * 1000, alive: true,
    };
    this.enemies.push(e);
    return e;
  }

  spawnTurrets(b: Base) {
    const n = b.def.turrets;
    b.turretIds = [];
    for (let i = 0; i < n; i++) {
      // spread on a sphere shell around the core (Fibonacci)
      const y = 1 - (i + 0.5) / n * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const anchor = new THREE.Vector3(Math.cos(a) * r, y * 0.7, Math.sin(a) * r).normalize().multiplyScalar(150 + (i % 3) * 25);
      const t = this.spawnEnemy('turret', b.pos.clone().add(anchor), b.def.id, anchor);
      t.hp = t.hpMax = ENEMY_STATS.turret.hp * (1 + 0.2 * (b.def.tier - 1));
      b.turretIds.push(t.id);
    }
  }

  spawnFromBase(b: Base) {
    const roster = b.def.roster;
    const kind = roster[Math.floor(Math.random() * roster.length)];
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const e = this.spawnEnemy(kind, b.pos.clone().addScaledVector(dir, 90), b.def.id);
    e.vel.copy(dir).multiplyScalar(120);
    e.mode = 'attack';
    const scale = 1 + 0.15 * (b.def.tier - 1);
    e.hp = e.hpMax = e.hpMax * scale;
  }

  spawnPatrol() {
    const sh = this.ship;
    const fwd = _v1.copy(FORWARD).applyQuaternion(sh.quat);
    const center = sh.pos.clone().addScaledVector(fwd, 2600).add(new THREE.Vector3((Math.random() - 0.5) * 1800, (Math.random() - 0.5) * 900, (Math.random() - 0.5) * 1800));
    const rDist = Math.hypot(sh.pos.x, sh.pos.z) / AU_UNITS;
    const n = rDist > 8 ? 4 : rDist > 4 ? 3 : 2;
    const kinds: EnemyKind[] = rDist > 4 ? ['fighter', 'sniper', 'swarm', 'swarm'] : ['fighter', 'swarm', 'fighter'];
    for (let i = 0; i < n; i++) {
      const e = this.spawnEnemy(kinds[i % kinds.length], center.clone().add(new THREE.Vector3(i * 60, (i % 2) * 40, -i * 30)));
      e.mode = 'patrol';
      const scale = 1 + Math.min(1.2, rDist * 0.06);
      e.hp = e.hpMax = e.hpMax * scale;
    }
    this.msg('Contacts ahead — hostile patrol', 'warn');
  }

  // ---------------------------------------------------------------- main update
  update(dt: number, c: Controls) {
    if (this.paused) return;
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    updateMoons(this.bodies, dt);
    resolveStations(this.stations, this.bodies);
    const sh = this.ship;

    if (sh.dockedAt) {
      const st = this.station(sh.dockedAt);
      if (st) sh.pos.copy(st.pos);
      return;
    }

    if (!sh.alive) {
      sh.respawnIn -= dt;
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      if (sh.respawnIn <= 0) this.respawn();
      return;
    }

    sh.invuln = Math.max(0, sh.invuln - dt);
    this.updateTargeting(c);
    this.updateFlight(dt, c);
    this.updateCollisions(dt);
    this.updateWeapons(dt, c);
    this.updateEnemies(dt);
    this.updateBases(dt);
    this.updateProjectiles(dt);
    this.updateLoot(dt);
    this.updateScanning(dt);
    this.updateDocking(c);
    this.updateEnvironment(dt);
    this.updatePatrols(dt);
  }

  // ---------------------------------------------------------------- flight
  nearestBody(p: THREE.Vector3) {
    let best: Body = this.bodies[0]; let bd = Infinity;
    for (const b of this.bodies) {
      const d = p.distanceTo(b.pos) - b.radius;
      if (d < bd) { bd = d; best = b; }
    }
    return { body: best, surfaceDist: bd };
  }

  private updateFlight(dt: number, c: Controls) {
    const sh = this.ship;
    const st = this.stats;
    const fuelOut = sh.fuel <= 0;

    // throttle
    if (c.allStop) sh.throttle = 0;
    if (c.throttleSet != null) sh.throttle = c.throttleSet;
    sh.throttle = THREE.MathUtils.clamp(sh.throttle + c.throttleDelta * dt * 0.9, -TUNE.reverseFrac, 1);

    // cruise toggle
    this.massLocked = this.enemies.some((e) => e.alive && e.kind !== 'turret' && e.pos.distanceToSquared(sh.pos) < TUNE.massLockRange ** 2)
      || this.bases.some((b) => !b.destroyed && b.pos.distanceTo(sh.pos) < BASE_CLUSTER_RADIUS * 1.2);
    if (c.cruise) {
      if (sh.cruise === 'off') {
        if (fuelOut) this.msg('No fuel for the cruise drive', 'bad');
        else if (this.massLocked) this.msg('Mass locked — hostiles too close', 'warn');
        else { sh.cruise = 'spooling'; sh.cruiseSpool = 0; this.save.tutorial.firstCruise = true; }
      } else this.dropCruise('manual');
    }
    if (sh.cruise === 'spooling') {
      sh.cruiseSpool += dt / TUNE.cruiseSpool;
      if (this.massLocked) { sh.cruise = 'off'; this.msg('Cruise aborted — mass locked', 'warn'); }
      else if (sh.cruiseSpool >= 1) {
        sh.cruise = 'on';
        sh.cruiseSpeed = Math.max(sh.vel.length(), st.maxSpeed);
        this.events.push({ t: 'cruise', on: true });
      }
    }

    // rotation
    let pitchIn = c.pitch, yawIn = c.yaw;
    const steering = Math.abs(c.pitch) > 0.04 || Math.abs(c.yaw) > 0.04;
    this.assist = false;
    const navAt = this.navPosition(this.nav);
    if (sh.cruise !== 'off' && navAt && !steering) {
      // cruise assist: swing the nose onto the destination (any input overrides it)
      const local = _v2.copy(navAt).sub(sh.pos).normalize().applyQuaternion(_q1.copy(sh.quat).invert());
      const yawErr = Math.atan2(-local.x, -local.z);
      const pitchErr = Math.atan2(local.y, Math.hypot(local.x, local.z));
      yawIn = THREE.MathUtils.clamp(yawErr * 2.4, -1, 1);
      pitchIn = THREE.MathUtils.clamp(pitchErr * 2.4, -1, 1);
      this.assist = true;
    }
    const rateScale = sh.cruise === 'on' ? 0.6 : sh.boosting ? 0.8 : 1;
    const tp = pitchIn * TUNE.pitchRate * rateScale, ty = yawIn * TUNE.yawRate * rateScale, tr = c.roll * TUNE.rollRate;
    sh.rates.x = approach(sh.rates.x, tp, TUNE.rateResponse, dt);
    sh.rates.y = approach(sh.rates.y, ty, TUNE.rateResponse, dt);
    sh.rates.z = approach(sh.rates.z, tr, TUNE.rateResponse, dt);
    _e1.set(sh.rates.x * dt, sh.rates.y * dt, sh.rates.z * dt, 'YXZ');
    _q1.setFromEuler(_e1);
    sh.quat.multiply(_q1).normalize();

    const fwd = _v1.copy(FORWARD).applyQuaternion(sh.quat);

    if (sh.cruise === 'on') {
      const { body, surfaceDist } = this.nearestBody(sh.pos);
      let vmax = TUNE.cruiseMax * (1 + 0.1 * this.save.upgrades.engine);
      vmax = Math.min(vmax, Math.max(700, surfaceDist * 1.15));
      const navPos = this.navPosition(this.nav);
      if (navPos) {
        const dNav = navPos.distanceTo(sh.pos) - this.navDropDistance(this.nav);
        vmax = Math.min(vmax, Math.max(600, dNav * 1.0 + 600));
        // don't race off at full speed while the nose is still swinging round
        const align = _v2.copy(navPos).sub(sh.pos).normalize().dot(fwd);
        vmax *= Math.max(0.04, align) ** 2;
        vmax = Math.max(vmax, 500);
        if (dNav <= 0) { this.dropCruise('arrived'); return; }
      }
      const rate = vmax > sh.cruiseSpeed ? 0.75 : 3.2;
      sh.cruiseSpeed = approach(sh.cruiseSpeed, vmax, rate, dt);
      sh.cruiseSpeed = Math.max(sh.cruiseSpeed, Math.min(vmax, sh.cruiseSpeed + 900 * dt));
      sh.vel.copy(fwd).multiplyScalar(sh.cruiseSpeed);
      // burn scales with speed: long hauls cost real fuel, short hops don't
      const cruiseMax = TUNE.cruiseMax * (1 + 0.1 * this.save.upgrades.engine);
      sh.fuel = Math.max(0, sh.fuel - st.cruiseFuel * (0.28 + 2.6 * (sh.cruiseSpeed / cruiseMax)) * dt);
      if (sh.fuel <= 0) this.dropCruise('fuel');
      if (surfaceDist < body.radius * 0.25) { this.dropCruise('gravity'); }
      if (this.bases.some((b) => !b.destroyed && b.pos.distanceTo(sh.pos) < BASE_CLUSTER_RADIUS + 1400)) this.dropCruise('interdicted');
    } else {
      sh.boosting = c.boost && !fuelOut && sh.throttle >= 0;
      const maxV = fuelOut ? st.maxSpeed * 0.35 : sh.boosting ? st.boostSpeed : st.maxSpeed;
      const fwdSpeed = sh.boosting ? maxV : sh.throttle * maxV;
      // desired velocity in ship frame
      const right = _v2.copy(RIGHT).applyQuaternion(sh.quat);
      const up = _v3.copy(UP).applyQuaternion(sh.quat);
      const desired = new THREE.Vector3()
        .addScaledVector(fwd, fwdSpeed)
        .addScaledVector(right, c.strafeX * TUNE.strafeSpeed)
        .addScaledVector(up, c.strafeY * TUNE.strafeSpeed);
      const dv = desired.sub(sh.vel);
      const acc = (sh.boosting ? TUNE.boostAccel : TUNE.accel) * (fuelOut ? 0.4 : 1);
      const maxDv = acc * dt;
      const dvl = dv.length();
      if (dvl > maxDv) dv.multiplyScalar(maxDv / dvl);
      sh.vel.add(dv);
      if (!fuelOut) sh.fuel = Math.max(0, sh.fuel - (sh.boosting ? TUNE.boostFuelPerSec : TUNE.thrustFuelPerSec * Math.min(1, dvl / 40)) * dt);
    }

    sh.pos.addScaledVector(sh.vel, dt);
    const moved = sh.vel.length() * dt;
    this.distanceAcc += moved;
    if (this.distanceAcc > 1000) { this.save.stats.distance += this.distanceAcc; this.distanceAcc = 0; }

    if (!this.lowFuelWarned && sh.fuel < sh.fuelMax * 0.2) { this.lowFuelWarned = true; this.msg('Fuel low — set course for a station', 'warn'); }
    if (sh.fuel > sh.fuelMax * 0.3) this.lowFuelWarned = false;
  }

  dropCruise(reason: 'manual' | 'arrived' | 'fuel' | 'gravity' | 'interdicted' | 'hit') {
    const sh = this.ship;
    if (sh.cruise === 'off') return;
    const wasOn = sh.cruise === 'on';
    sh.cruise = 'off'; sh.cruiseSpool = 0;
    const fwd = _v1.copy(FORWARD).applyQuaternion(sh.quat);
    sh.vel.copy(fwd).multiplyScalar(this.stats.maxSpeed * 0.8);
    sh.throttle = 0.8;
    sh.cruiseSpeed = 0;
    if (wasOn) this.events.push({ t: 'cruise', on: false });
    const text = {
      manual: 'Cruise disengaged', arrived: `Arrived: ${this.navName(this.nav)}`, fuel: 'Cruise drive starved — fuel empty',
      gravity: 'Emergency drop — too close to a gravity well', interdicted: 'Dropped out — hostile structure ahead', hit: 'Cruise broken by weapons fire',
    }[reason];
    this.msg(text, reason === 'arrived' ? 'good' : reason === 'manual' ? 'info' : 'warn');
  }

  // ---------------------------------------------------------------- collisions
  private damagePlayer(amount: number, srcPos?: THREE.Vector3) {
    const sh = this.ship;
    if (!sh.alive || sh.invuln > 0) return;
    sh.shieldCooldown = TUNE.shieldDelay;
    let toHull = amount;
    let shielded = false;
    if (sh.shield > 0) {
      const absorbed = Math.min(sh.shield, amount);
      sh.shield -= absorbed; toHull -= absorbed; shielded = true;
    }
    sh.hull -= toHull;
    this.events.push({ t: 'playerHit', amount, shield: shielded && toHull <= 0 });
    if (srcPos) this.events.push({ t: 'hit', pos: srcPos.clone(), team: 'enemy', shield: shielded });
    if (sh.cruise !== 'off' && amount > 2) this.dropCruise('hit');
    if (sh.hull <= 0) this.killPlayer();
  }

  private killPlayer() {
    const sh = this.ship;
    sh.alive = false; sh.hull = 0; sh.respawnIn = 3.2;
    sh.cruise = 'off';
    this.events.push({ t: 'explosion', pos: sh.pos.clone(), size: 30, kind: 'player' });
    this.events.push({ t: 'death' });
    this.save.stats.deaths++;
    const lost = this.save.ore;
    this.save.ore = 0;
    const fee = Math.round(this.save.credits * 0.1);
    this.save.credits -= fee;
    this.msg(`Ship lost.${lost ? ` ${lost} ore gone.` : ''} Insurance claim −${fee} cr.`, 'bad');
  }

  private respawn() {
    const sh = this.ship;
    sh.alive = true;
    sh.hull = sh.hullMax; sh.shield = sh.shieldMax;
    sh.fuel = Math.max(sh.fuel, sh.fuelMax * 0.5);
    sh.energy = TUNE.energyMax;
    this.targetId = null; this.targetBase = null;
    // bases that saw you die re-arm their missing turrets
    for (const b of this.bases) if (!b.destroyed) { b.alert = false; }
    this.enemies = this.enemies.filter((e) => e.baseId);
    this.dockAt(this.station(this.save.lastStation) ?? this.stations[0]);
  }

  private updateCollisions(dt: number) {
    const sh = this.ship;
    // bodies
    for (const b of this.bodies) {
      const d = sh.pos.distanceTo(b.pos);
      const lim = b.radius * (b.kind === 'star' ? 1.0 : 1.01) + 6;
      if (d < lim) {
        const n = _v1.copy(sh.pos).sub(b.pos).normalize();
        sh.pos.copy(b.pos).addScaledVector(n, lim + 1);
        const vn = sh.vel.dot(n);
        if (vn < 0) sh.vel.addScaledVector(n, -vn * 1.5);
        if (b.kind === 'star') this.damagePlayer(9999);
        else this.damagePlayer(Math.max(15, -vn * 0.4));
        if (sh.cruise !== 'off') this.dropCruise('gravity');
      }
    }
    // stations
    for (const s of this.stations) {
      const d = sh.pos.distanceTo(s.pos);
      if (d < STATION_RADIUS + 6) {
        const n = _v1.copy(sh.pos).sub(s.pos).normalize();
        const vn = sh.vel.dot(n);
        sh.pos.copy(s.pos).addScaledVector(n, STATION_RADIUS + 7);
        if (vn < 0) { sh.vel.addScaledVector(n, -vn * 1.4); if (-vn > 40) this.damagePlayer(-vn * 0.25); }
      }
    }
    // base cores
    for (const b of this.bases) {
      if (b.destroyed) continue;
      const d = sh.pos.distanceTo(b.pos);
      if (d < 75) {
        const n = _v1.copy(sh.pos).sub(b.pos).normalize();
        const vn = sh.vel.dot(n);
        sh.pos.copy(b.pos).addScaledVector(n, 76);
        if (vn < 0) { sh.vel.addScaledVector(n, -vn * 1.4); this.damagePlayer(Math.max(8, -vn * 0.3)); }
      }
    }
    // asteroids (refresh the near list a few times a second)
    this.nearRocksT -= dt;
    if (this.nearRocksT <= 0) {
      this.nearRocksT = sh.cruise === 'on' ? 0.5 : 0.2;
      this.nearRocks = sh.cruise === 'on' ? [] : asteroidsNear(sh.pos, 2200, this.sampler, this.destroyedRocks, this.rockCache);
    }
    for (const a of this.nearRocks) {
      if (a.hp <= 0) continue;
      const lim = a.radius * 0.92 + 4;
      const dx = sh.pos.x - a.pos.x, dy = sh.pos.y - a.pos.y, dz = sh.pos.z - a.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < lim * lim) {
        const d = Math.sqrt(d2) || 1;
        const n = _v1.set(dx / d, dy / d, dz / d);
        sh.pos.copy(a.pos).addScaledVector(n, lim + 0.5);
        const vn = sh.vel.dot(n);
        if (vn < 0) {
          sh.vel.addScaledVector(n, -vn * 1.35);
          sh.vel.multiplyScalar(0.8);
          if (-vn > 22) this.damagePlayer((-vn - 18) * 0.35, sh.pos.clone().addScaledVector(n, -4));
        }
      }
    }
  }

  // ---------------------------------------------------------------- targeting
  candidates(): { id: number | null; base: string | null; pos: THREE.Vector3; vel: THREE.Vector3 }[] {
    const out: { id: number | null; base: string | null; pos: THREE.Vector3; vel: THREE.Vector3 }[] = [];
    const sh = this.ship;
    for (const e of this.enemies) if (e.alive && e.pos.distanceToSquared(sh.pos) < 5000 ** 2) out.push({ id: e.id, base: null, pos: e.pos, vel: e.vel });
    for (const b of this.bases) if (!b.destroyed && b.pos.distanceTo(sh.pos) < 6000) out.push({ id: null, base: b.def.id, pos: b.pos, vel: new THREE.Vector3() });
    return out;
  }

  targetPos(): { pos: THREE.Vector3; vel: THREE.Vector3; radius: number; name: string; hp: number; hpMax: number; shielded: boolean } | null {
    const e = this.enemy(this.targetId);
    if (e) {
      const names = { fighter: 'Raider', sniper: 'Lancer', swarm: 'Wasp', turret: 'Turret' };
      return { pos: e.pos, vel: e.vel, radius: ENEMY_STATS[e.kind].radius, name: names[e.kind], hp: e.hp, hpMax: e.hpMax, shielded: false };
    }
    if (this.targetBase) {
      const b = this.base(this.targetBase);
      if (b && !b.destroyed) {
        const shielded = b.turretIds.some((id) => this.enemy(id));
        return { pos: b.pos, vel: new THREE.Vector3(), radius: 60, name: `${b.def.name} core`, hp: b.coreHp, hpMax: b.def.coreHp, shielded };
      }
    }
    return null;
  }

  private updateTargeting(c: Controls) {
    const sh = this.ship;
    if (this.targetId != null) {
      const te = this.enemy(this.targetId);
      if (!te || te.pos.distanceToSquared(sh.pos) > 7000 ** 2) this.targetId = null;
    }
    if (this.targetBase && (this.base(this.targetBase)?.pos.distanceTo(sh.pos) ?? 0) > 9000) this.targetBase = null;
    if (this.targetBase && this.base(this.targetBase)?.destroyed) this.targetBase = null;
    if (c.targetNearest || c.cycleTarget) {
      const fwd = _v1.copy(FORWARD).applyQuaternion(sh.quat);
      const list = this.candidates().map((t) => {
        const to = _v2.copy(t.pos).sub(sh.pos);
        const d = to.length();
        const ang = Math.acos(THREE.MathUtils.clamp(to.dot(fwd) / (d || 1), -1, 1));
        return { ...t, score: ang * 2.2 + d / 2500, d };
      });
      if (!list.length) { this.msg('No targets in range', 'info'); return; }
      if (c.targetNearest) list.sort((a, b) => a.score - b.score);
      else list.sort((a, b) => a.d - b.d);
      let pick = list[0];
      if (c.cycleTarget) {
        const cur = list.findIndex((t) => (t.id != null && t.id === this.targetId) || (t.base != null && t.base === this.targetBase));
        pick = list[(cur + 1) % list.length];
      }
      this.targetId = pick.id; this.targetBase = pick.base;
    }
    // auto-acquire: if nothing targeted, lock whatever just shot at us / is closest in front
    if (this.targetId == null && !this.targetBase) {
      const fwd = _v1.copy(FORWARD).applyQuaternion(sh.quat);
      let best: Enemy | null = null; let bs = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const to = _v2.copy(e.pos).sub(sh.pos);
        const d = to.length();
        if (d > 1800) continue;
        const ang = Math.acos(THREE.MathUtils.clamp(to.dot(fwd) / (d || 1), -1, 1));
        if (ang > 0.35) continue;
        const s = ang + d / 3000;
        if (s < bs) { bs = s; best = e; }
      }
      if (best) this.targetId = best.id;
    }
    if (c.cycleNav) {
      const list = this.navList();
      const i = list.findIndex((n) => this.nav && n.type === this.nav.type && n.id === this.nav.id);
      this.setNav(list[(i + c.cycleNav + list.length) % list.length]);
    }
  }

  // ---------------------------------------------------------------- weapons
  private muzzleOffsets = [new THREE.Vector3(-2.1, -0.55, -3.2), new THREE.Vector3(2.1, -0.55, -3.2)];

  private updateWeapons(dt: number, c: Controls) {
    const sh = this.ship;
    const st = this.stats;
    sh.fireCd -= dt;
    sh.energy = Math.min(TUNE.energyMax, sh.energy + TUNE.energyRegen * dt);
    if (sh.cruise !== 'off') return;
    const fwd = _v1.copy(FORWARD).applyQuaternion(sh.quat);
    if (c.fire && sh.fireCd <= 0 && sh.energy >= TUNE.boltEnergy) {
      sh.fireCd = st.fireInterval;
      sh.energy -= TUNE.boltEnergy;
      const off = this.muzzleOffsets[sh.muzzle = 1 - sh.muzzle].clone().applyQuaternion(sh.quat);
      const origin = sh.pos.clone().add(off);
      // gentle aim assist: bend the bolt toward the lead point if it's within ~4°
      let dir = fwd.clone();
      const t = this.targetPos();
      if (t) {
        const lp = leadPoint(origin, sh.vel, t.pos, t.vel, TUNE.boltSpeed, _v2);
        const to = lp.sub(origin);
        const d = to.length();
        if (d < 2200) {
          to.divideScalar(d);
          if (to.dot(fwd) > Math.cos(THREE.MathUtils.degToRad(4.5))) dir = to.clone();
        }
      }
      this.projectiles.push({
        id: this.nextId++, pos: origin.clone(), prev: origin.clone(), vel: dir.multiplyScalar(TUNE.boltSpeed).add(sh.vel),
        life: TUNE.boltLife, dmg: st.gunDamage, team: 'player', kind: 'bolt', target: null,
      });
      this.events.push({ t: 'fire', pos: origin, team: 'player', kind: 'bolt' });
    }
    if (c.torpedo) {
      const t = this.targetPos();
      if (sh.torps <= 0) this.msg('Torpedo rack empty — rearm at a station', 'warn');
      else if (!t) this.msg('Torpedoes need a target lock (T)', 'info');
      else {
        sh.torps--;
        const origin = sh.pos.clone().addScaledVector(fwd, 4).addScaledVector(_v2.copy(UP).applyQuaternion(sh.quat), -1.2);
        this.projectiles.push({
          id: this.nextId++, pos: origin.clone(), prev: origin.clone(), vel: fwd.clone().multiplyScalar(TUNE.torpSpeed * 0.5).add(sh.vel),
          life: 9, dmg: TUNE.torpDamage, team: 'player', kind: 'torp', target: this.targetId ?? (this.targetBase ? -1 : null),
        });
        this.events.push({ t: 'fire', pos: origin, team: 'player', kind: 'torp' });
      }
    }
  }

  private fireEnemyBolt(e: Enemy, target: THREE.Vector3, targetVel: THREE.Vector3) {
    const st = ENEMY_STATS[e.kind];
    const lp = leadPoint(e.pos, e.vel, target, targetVel, st.boltSpeed, _v2);
    // enemies are good, not perfect: scatter grows with range
    const dist = lp.distanceTo(e.pos);
    const spread = (e.kind === 'sniper' ? 0.007 : 0.032) * (1 + dist / 650);
    // NB: clone — lp is the shared scratch vector _v2, and projectiles keep their own velocity
    const dir = lp.clone().sub(e.pos).normalize().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
    const origin = e.pos.clone().addScaledVector(dir, st.radius + 2);
    this.projectiles.push({
      id: this.nextId++, pos: origin.clone(), prev: origin.clone(), vel: dir.multiplyScalar(st.boltSpeed).add(e.vel),
      life: st.range / st.boltSpeed * 1.4, dmg: st.dmg, team: 'enemy', kind: 'bolt', target: null,
    });
    this.events.push({ t: 'fire', pos: origin, team: 'enemy', kind: 'bolt' });
  }

  // ---------------------------------------------------------------- enemies
  private updateEnemies(dt: number) {
    const sh = this.ship;
    const playerAlive = sh.alive && !sh.dockedAt;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const st = ENEMY_STATS[e.kind];
      e.fireCd -= dt;
      const toP = _v1.copy(sh.pos).sub(e.pos);
      const dist = toP.length();

      if (e.kind === 'turret') {
        const b = e.baseId ? this.base(e.baseId) : null;
        if (b && e.anchor) e.pos.copy(b.pos).add(e.anchor);
        if (!playerAlive || dist > st.range) continue;
        // aim
        const m = new THREE.Matrix4().lookAt(e.pos, sh.pos, UP);
        _q1.setFromRotationMatrix(m);
        e.quat.slerp(_q1, Math.min(1, st.turn * dt));
        if (e.fireCd <= 0) {
          this.fireEnemyBolt(e, sh.pos, sh.vel);
          e.burst++;
          if (e.burst >= 3) { e.burst = 0; e.fireCd = st.fireCd * (0.8 + Math.random() * 0.5); }
          else e.fireCd = 0.16;
        }
        continue;
      }

      // fighters: patrol → attack → evade
      e.modeT -= dt;
      const aggro = playerAlive && dist < (e.baseId ? 3200 : 2200);
      if (e.mode === 'patrol' && aggro) e.mode = 'attack';
      if (e.mode === 'attack' && !aggro && dist > 3500) e.mode = 'patrol';
      if (e.mode === 'attack' && (dist < 70 || e.hp < e.hpMax * 0.3 && Math.random() < dt * 0.5)) { e.mode = 'evade'; e.modeT = 1.2 + Math.random(); }
      if (e.mode === 'evade' && e.modeT <= 0) e.mode = 'attack';

      const desired = _v2.set(0, 0, 0);
      if (e.mode === 'patrol') {
        const home = e.baseId ? this.base(e.baseId)?.pos : null;
        const center = home ?? e.pos;
        const a = this.time * 0.25 + e.orbitSeed;
        desired.set(center.x + Math.cos(a) * 500 - e.pos.x, center.y + Math.sin(a * 0.7) * 120 - e.pos.y, center.z + Math.sin(a) * 500 - e.pos.z);
        desired.setLength(st.speed * 0.5);
      } else if (e.mode === 'attack') {
        // fly to a point offset around the player (strafing runs), snipers hold range
        const a = this.time * (e.kind === 'swarm' ? 1.4 : 0.7) + e.orbitSeed;
        const ideal = e.kind === 'sniper' ? 1100 : e.kind === 'swarm' ? 160 : 380;
        const side = _v3.set(Math.cos(a), Math.sin(a * 1.3) * 0.5, Math.sin(a)).multiplyScalar(ideal);
        desired.copy(sh.pos).add(side).addScaledVector(sh.vel, 0.6).sub(e.pos);
        const dl = desired.length();
        desired.setLength(Math.min(st.speed, dl * 1.2 + 20));
      } else {
        desired.copy(toP).negate().normalize().add(_v3.set(Math.sin(e.orbitSeed), 0.6, Math.cos(e.orbitSeed))).setLength(st.speed);
      }
      // separation from other enemies + rocks
      for (const o of this.enemies) {
        if (o === e || !o.alive || o.kind === 'turret') continue;
        const dx = e.pos.x - o.pos.x, dy = e.pos.y - o.pos.y, dz = e.pos.z - o.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 60 * 60 && d2 > 0.01) desired.add(_v3.set(dx, dy, dz).multiplyScalar(40 / d2 * 40));
      }
      for (const a of this.nearRocks) {
        if (a.hp <= 0) continue;
        const dx = e.pos.x - a.pos.x, dy = e.pos.y - a.pos.y, dz = e.pos.z - a.pos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const lim = a.radius + 30;
        if (d < lim * 1.8 && d > 0.01) desired.add(_v3.set(dx, dy, dz).multiplyScalar((lim * 1.8 - d) / d * 2.5));
      }
      const dv = desired.sub(e.vel);
      const maxDv = st.accel * dt;
      if (dv.length() > maxDv) dv.setLength(maxDv);
      e.vel.add(dv);
      e.pos.addScaledVector(e.vel, dt);

      // face: toward player when attacking, else along velocity
      const look = e.mode === 'attack' && dist < st.range * 1.3 ? sh.pos : _v3.copy(e.pos).add(e.vel);
      if (look.distanceToSquared(e.pos) > 1) {
        const m = new THREE.Matrix4().lookAt(e.pos, look, UP);
        _q1.setFromRotationMatrix(m);
        e.quat.slerp(_q1, Math.min(1, st.turn * dt));
      }
      if (e.mode === 'attack' && playerAlive && dist < st.range && e.fireCd <= 0) {
        const facing = _v3.copy(FORWARD).applyQuaternion(e.quat).dot(toP.normalize());
        if (facing > 0.92) { this.fireEnemyBolt(e, sh.pos, sh.vel); e.fireCd = st.fireCd * (0.7 + Math.random() * 0.6); }
      }
    }
    // cull far-away strays
    if (this.enemies.length > 0) this.enemies = this.enemies.filter((e) => e.alive && (e.baseId || e.pos.distanceToSquared(sh.pos) < 12000 ** 2));
  }

  private killEnemy(e: Enemy) {
    e.alive = false;
    const st = ENEMY_STATS[e.kind];
    this.events.push({ t: 'explosion', pos: e.pos.clone(), size: e.kind === 'turret' ? 16 : st.radius * 1.6, kind: e.kind === 'turret' ? 'turret' : 'ship' });
    this.save.credits += st.reward;
    this.save.stats.kills++;
    if (this.targetId === e.id) this.targetId = null;
    // drops
    if (Math.random() < 0.35) this.dropLoot(e.pos, 'fuel', 12);
    if (Math.random() < 0.5) this.dropLoot(e.pos, 'salvage', Math.round(st.reward * 0.6));
    if (e.baseId && e.kind === 'turret') {
      const b = this.base(e.baseId);
      if (b && !b.turretIds.some((id) => this.enemy(id))) this.msg(`${b.def.name}: core shield down`, 'good');
    }
  }

  private destroyBase(b: Base) {
    b.destroyed = true; b.coreHp = 0;
    this.events.push({ t: 'explosion', pos: b.pos.clone(), size: 140, kind: 'base' });
    this.save.credits += b.def.reward;
    this.save.stats.basesDown++;
    this.msg(`${b.def.name} destroyed  +${b.def.reward.toLocaleString()} cr`, 'good');
    for (let i = 0; i < 6; i++) this.dropLoot(b.pos, i % 2 ? 'salvage' : 'fuel', i % 2 ? Math.round(b.def.reward * 0.08) : 20, 140);
    for (const e of this.enemies) {
      if (e.baseId !== b.def.id) continue;
      if (e.kind === 'turret') e.alive = false;
      else e.baseId = null; // survivors become strays
    }
    if (this.targetBase === b.def.id) this.targetBase = null;
    if (this.nav?.type === 'base' && this.nav.id === b.def.id) this.nav = null;
    this.persist();
  }

  private updateBases(dt: number) {
    const sh = this.ship;
    for (const b of this.bases) {
      if (b.destroyed) continue;
      const d = b.pos.distanceTo(sh.pos);
      if (!b.discovered && d < 30_000) {
        b.discovered = true;
        this.msg(`Hostile structure detected: ${b.def.name}`, 'warn');
        this.persist();
      }
      b.alert = sh.alive && !sh.dockedAt && d < 6000;
      if (!b.alert) continue;
      b.spawnCd -= dt;
      const alive = this.enemies.filter((e) => e.alive && e.baseId === b.def.id && e.kind !== 'turret').length;
      if (b.spawnCd <= 0 && alive < b.def.garrison) {
        this.spawnFromBase(b);
        b.spawnCd = alive === 0 ? 2.5 : 10 - b.def.tier;
      }
    }
  }

  // ---------------------------------------------------------------- projectiles
  private updateProjectiles(dt: number) {
    const sh = this.ship;
    const rocks = this.nearRocks;
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.prev.copy(p.pos);
      if (p.kind === 'torp') {
        let tgt: THREE.Vector3 | null = null;
        if (p.target === -1 && this.targetBase) tgt = this.base(this.targetBase)?.pos ?? null;
        else if (p.target != null && p.target > 0) tgt = this.enemy(p.target)?.pos ?? null;
        const speed = Math.min(TUNE.torpSpeed * 1.6, p.vel.length() + 260 * dt);
        if (tgt) {
          const want = _v1.copy(tgt).sub(p.pos).normalize();
          const cur = _v2.copy(p.vel).normalize();
          cur.lerp(want, Math.min(1, 2.8 * dt)).normalize();
          p.vel.copy(cur).multiplyScalar(speed);
        } else p.vel.setLength(speed);
      }
      p.pos.addScaledVector(p.vel, dt);

      if (p.team === 'enemy') {
        if (sh.alive && !sh.dockedAt && segSphere(p.prev, p.pos, sh.pos, 5.5)) {
          p.life = 0;
          this.damagePlayer(p.dmg, p.pos);
        }
      } else {
        // enemies
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const r = ENEMY_STATS[e.kind].radius;
          if (!segSphere(p.prev, p.pos, e.pos, r + (p.kind === 'torp' ? 6 : 1))) continue;
          p.life = 0;
          e.hp -= p.dmg;
          this.events.push({ t: 'hit', pos: p.pos.clone(), team: 'player', shield: false });
          if (e.mode === 'patrol') e.mode = 'attack';
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
        if (p.life <= 0) { if (p.kind === 'torp') this.splash(p); continue; }
        // base cores
        for (const b of this.bases) {
          if (b.destroyed || !segSphere(p.prev, p.pos, b.pos, 62)) continue;
          p.life = 0;
          const shielded = b.turretIds.some((id) => this.enemy(id));
          this.events.push({ t: 'hit', pos: p.pos.clone(), team: 'player', shield: shielded });
          if (!shielded) {
            b.coreHp -= p.dmg;
            if (b.coreHp <= 0) this.destroyBase(b);
          } else if (Math.random() < 0.08) this.msg('Core is shielded — take out the turrets first', 'info');
          break;
        }
        if (p.life <= 0) continue;
        // rocks
        for (const a of rocks) {
          if (a.hp <= 0 || !segSphere(p.prev, p.pos, a.pos, a.radius * 0.9)) continue;
          p.life = 0;
          a.hp -= p.dmg;
          this.events.push({ t: 'hit', pos: p.pos.clone(), team: 'player', shield: false });
          if (a.hp <= 0) this.breakRock(a);
          if (p.kind === 'torp') this.splash(p);
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private splash(p: Projectile) {
    this.events.push({ t: 'explosion', pos: p.pos.clone(), size: 22, kind: 'ship' });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(p.pos);
      if (d < 45) { e.hp -= p.dmg * 0.5 * (1 - d / 45); if (e.hp <= 0) this.killEnemy(e); }
    }
  }

  private breakRock(a: Asteroid) {
    a.hp = 0;
    this.destroyedRocks.add(a.id);
    this.events.push({ t: 'explosion', pos: a.pos.clone(), size: a.radius, kind: 'rock' });
    const n = Math.max(1, Math.min(4, Math.round(a.radius / 15)));
    for (let i = 0; i < n; i++) this.dropLoot(a.pos, 'ore', Math.max(2, Math.round(a.ore / n)), a.radius * 0.6);
    if (Math.random() < 0.12) this.dropLoot(a.pos, 'fuel', 8, a.radius * 0.6);
  }

  // ---------------------------------------------------------------- loot
  private dropLoot(pos: THREE.Vector3, kind: Loot['kind'], amount: number, spread = 12) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.loot.push({ id: this.nextId++, pos: pos.clone().addScaledVector(dir, spread * Math.random()), vel: dir.multiplyScalar(8 + Math.random() * 14), kind, amount, life: 90 });
  }

  private updateLoot(dt: number) {
    const sh = this.ship;
    const hold = this.stats.holdMax;
    for (const l of this.loot) {
      l.life -= dt;
      const to = _v1.copy(sh.pos).sub(l.pos);
      const d = to.length();
      const full = l.kind === 'ore' && this.save.ore >= hold;
      if (d < 180 && !full) l.vel.addScaledVector(to.normalize(), 260 * dt).multiplyScalar(0.97);
      else l.vel.multiplyScalar(0.995);
      l.pos.addScaledVector(l.vel, dt);
      if (d < 9 && !full) {
        l.life = 0;
        if (l.kind === 'ore') { const got = Math.min(l.amount, hold - this.save.ore); this.save.ore += got; this.events.push({ t: 'pickup', kind: 'ore', amount: got }); if (this.save.ore >= hold) this.msg('Cargo hold full — sell ore at a station', 'info'); }
        else if (l.kind === 'fuel') { sh.fuel = Math.min(sh.fuelMax, sh.fuel + l.amount); this.events.push({ t: 'pickup', kind: 'fuel', amount: l.amount }); }
        else { this.save.credits += l.amount; this.events.push({ t: 'pickup', kind: 'salvage', amount: l.amount }); }
      }
    }
    this.loot = this.loot.filter((l) => l.life > 0);
  }

  // ---------------------------------------------------------------- scanning
  private updateScanning(dt: number) {
    const sh = this.ship;
    let near: Body | null = null;
    for (const b of this.bodies) {
      if (this.save.scanned.includes(b.id)) continue;
      const range = Math.max(b.radius * 3.2, b.radius + 2500);
      if (sh.pos.distanceTo(b.pos) < range) { near = b; break; }
    }
    if (!near) { this.scanProgress = null; return; }
    if (!this.scanProgress || this.scanProgress.id !== near.id) this.scanProgress = { id: near.id, t: 0 };
    this.scanProgress.t += dt / TUNE.scanTime;
    if (this.scanProgress.t >= 1) {
      this.save.scanned.push(near.id);
      const reward = near.kind === 'star' ? 600 : near.kind === 'planet' ? 300 : near.kind === 'dwarf' ? 250 : 180;
      this.save.credits += reward;
      this.events.push({ t: 'scan', bodyId: near.id });
      this.msg(`Survey logged: ${near.name}  +${reward} cr`, 'good');
      this.scanProgress = null;
      this.persist();
    }
  }

  // ---------------------------------------------------------------- docking
  private updateDocking(c: Controls) {
    const sh = this.ship;
    this.dockable = null;
    if (sh.cruise !== 'off') return;
    for (const s of this.stations) {
      if (s.pos.distanceTo(sh.pos) < DOCK_RANGE) {
        this.dockable = s;
        break;
      }
    }
    if (c.dock && this.dockable) {
      if (sh.vel.length() > DOCK_MAX_SPEED) this.msg('Too fast to dock — slow down', 'warn');
      else if (this.enemies.some((e) => e.alive && e.mode === 'attack' && e.pos.distanceTo(sh.pos) < 1200)) this.msg('Docking refused — hostiles nearby', 'warn');
      else { this.save.tutorial.firstDock = true; this.dockAt(this.dockable); }
    }
  }

  // ---------------------------------------------------------------- environment (sun heat, fuel scoop)
  private updateEnvironment(dt: number) {
    const sh = this.ship;
    const sun = this.bodies[0];
    const d = sh.pos.distanceTo(sun.pos) / sun.radius;
    if (d < 4) {
      const heat = Math.max(0, (4 - d) / 2.6);
      sh.heat = Math.min(140, sh.heat + heat * 26 * dt);
      if (d < 3 && sh.cruise === 'off') sh.fuel = Math.min(sh.fuelMax, sh.fuel + (3 - d) * 4.5 * dt);
    } else sh.heat = Math.max(0, sh.heat - 22 * dt);
    if (sh.heat > 100) this.damagePlayer((sh.heat - 100) * 0.25 * dt);
    // shields
    sh.shieldCooldown -= dt;
    if (sh.shieldCooldown <= 0) sh.shield = Math.min(sh.shieldMax, sh.shield + this.stats.shieldRegen * dt);
  }

  private updatePatrols(dt: number) {
    const sh = this.ship;
    if (sh.cruise !== 'off') return;
    const rAU = Math.hypot(sh.pos.x, sh.pos.z) / AU_UNITS;
    if (rAU < 1.9) return; // the inner system is patrolled by friendlies
    const hostiles = this.enemies.filter((e) => e.alive && !e.baseId).length;
    if (hostiles > 0) return;
    this.patrolCd -= dt;
    if (this.patrolCd <= 0) {
      this.patrolCd = 45 + Math.random() * 40;
      this.spawnPatrol();
    }
  }

  // ---------------------------------------------------------------- HUD helpers
  speed() { return this.ship.vel.length(); }
  locationName() {
    const { body, surfaceDist } = this.nearestBody(this.ship.pos);
    const rAU = this.ship.pos.length() / AU_UNITS;
    if (surfaceDist < body.radius * 6 + 4000) return body.kind === 'star' ? 'Solar corona' : `${body.name} space`;
    const r = Math.hypot(this.ship.pos.x, this.ship.pos.z);
    if (r > 2.15 * AU_UNITS && r < 3.3 * AU_UNITS) return 'Main asteroid belt';
    if (rAU > 33) return 'Kuiper belt';
    if (rAU > 5.5) return 'Outer system';
    return 'Inner system';
  }
}
