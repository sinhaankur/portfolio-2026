// Ritam 3D — random level generator.
// Builds a level from hand-tuned segment templates for one of the four worlds,
// always hands Ritam the blaster (G) and the space pack (J) at the start, then
// playtests it twice: a geometry bot with WEAKER jump/run values checks every
// pickup, the cup and the door are reachable, then a full-engine search bot plays
// it start to finish with live enemies (normal, and weak physics + faster enemies
// + no space pack). Any failure rerolls the seed.

import { DaveEngine, TILE } from './engine.js';

const ROWS = 10, SEG = 12;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function blank(W) { const m = []; for (let r = 0; r < ROWS; r++) { const row = []; for (let c = 0; c < W; c++) row.push(r === 0 || r === ROWS - 1 || c === 0 || c === W - 1 ? '#' : '.'); m.push(row); } return m; }
function H(m) { const W = m[0].length; const put = (r, c, ch) => { if (r > 0 && r < ROWS && c > 0 && c < W - 1) m[r][c] = ch; }; return { put, plat: (r, c, w) => { for (let i = 0; i < w; i++) put(r, c + i, '#'); } }; }

export const TEMPLATES = {
  flat: (x, h) => ({ spots: [[8, x + 3], [8, x + 4], [8, x + 5], [6, x + 8]], top: [8, x + 9] }),
  steps: (x, h) => { h.plat(7, x + 2, 3); h.plat(5, x + 5, 3); return { spots: [[6, x + 3], [4, x + 5], [8, x + 10]], top: [4, x + 6] }; },
  hill: (x, h) => { h.plat(8, x + 3, 6); h.plat(7, x + 4, 4); return { spots: [[7, x + 3], [6, x + 5], [6, x + 6], [8, x + 10]], top: [6, x + 6] }; },
  pit: (x, h) => { h.put(9, x + 4, '~'); h.put(9, x + 5, '~'); return { spots: [[8, x + 2], [6, x + 5], [8, x + 9]], top: [8, x + 9] }; },
  stones: (x, h) => { for (const c of [2, 3, 6, 7]) h.put(9, x + c, '~'); return { spots: [[8, x + 4], [8, x + 5], [8, x + 8], [6, x + 3], [6, x + 7]], top: [8, x + 9] }; },
  fire: (x, h) => { h.put(8, x + 4, '^'); h.put(8, x + 9, '^'); h.plat(7, x + 6, 2); return { spots: [[6, x + 6], [8, x + 2], [8, x + 11]], top: [6, x + 7] }; },
  firePit: (x, h) => { h.put(8, x + 3, '^'); h.put(8, x + 4, '^'); h.plat(7, x + 7, 2); h.put(8, x + 10, '^'); return { spots: [[6, x + 7], [8, x + 11]], top: [6, x + 8] }; },
  fireBridge: (x, h) => { for (let c = 3; c <= 8; c++) h.put(8, x + c, '^'); h.plat(7, x + 1, 2); h.plat(6, x + 3, 6); return { spots: [[5, x + 4], [5, x + 5], [5, x + 7], [8, x + 10]], top: [5, x + 6] }; },
  vine: (x, h) => { for (let r = 2; r <= 8; r++) h.put(r, x + 2, '|'); h.plat(3, x + 3, 7); return { spots: [[2, x + 4], [2, x + 6], [8, x + 8]], top: [2, x + 8] }; },
  vineGap: (x, h) => { for (let r = 3; r <= 8; r++) h.put(r, x + 1, '|'); h.plat(4, x + 2, 9); for (let c = x + 3; c <= x + 9; c++) h.put(9, c, '~'); return { spots: [[3, x + 4], [3, x + 7], [8, x + 11]], top: [3, x + 7] }; },
  tunnel: (x, h) => { for (let r = 1; r <= 5; r++) h.plat(r, x + 1, 10); return { spots: [[8, x + 3], [8, x + 4], [8, x + 5], [8, x + 8]], top: [8, x + 6] }; },
  float: (x, h) => { h.plat(7, x + 1, 2); h.plat(5, x + 3, 2); h.plat(3, x + 6, 2); h.plat(5, x + 9, 2); return { spots: [[6, x + 1], [4, x + 3], [2, x + 6], [4, x + 10]], top: [2, x + 7] }; },
  highRoute: (x, h) => { h.plat(7, x + 1, 2); h.plat(5, x + 3, 2); h.plat(3, x + 5, 6); return { spots: [[2, x + 6, 'c'], [2, x + 7, 'i'], [2, x + 8, 'c'], [8, x + 7], [8, x + 9]], top: [2, x + 10] }; },
  pillars: (x, h) => { h.put(8, x + 3, '#'); h.plat(7, x + 6, 2); h.plat(8, x + 6, 2); h.put(8, x + 10, '#'); return { spots: [[7, x + 3], [6, x + 6], [7, x + 10], [8, x + 5]], top: [6, x + 7] }; },
  platPit: (x, h) => { for (let c = x + 2; c <= x + 10; c++) h.put(9, c, '~'); h.put(9, x + 3, '-'); return { spots: [[8, x + 1], [8, x + 11]], top: [8, x + 11] }; },
  liftUp: (x, h) => { h.put(8, x + 3, '!'); for (let r = 3; r <= 8; r++) h.plat(r, x + 5, 2); h.plat(3, x + 7, 3); return { spots: [[2, x + 5], [2, x + 8], [8, x + 11]], top: [2, x + 8] }; },
  keyLock: (x, h) => { h.plat(7, x + 1, 2); h.plat(5, x + 3, 2); h.put(4, x + 4, 'k'); for (let r = 1; r <= 8; r++) h.put(r, x + 8, 'L'); return { spots: [[6, x + 1], [8, x + 6], [8, x + 10]], top: [8, x + 10] }; },
  secret: (x, h) => { h.plat(7, x + 4, 2); for (let r = 5; r <= 8; r++) h.plat(r, x + 7, 4); for (let r = 6; r <= 8; r++) { h.put(r, x + 8, '.'); h.put(r, x + 9, '.'); h.put(r, x + 7, 'X'); } h.put(8, x + 8, '$'); h.put(8, x + 9, 'c'); return { spots: [[6, x + 4], [4, x + 8], [8, x + 11]], top: [4, x + 9], secret: [x + 7, x + 10] }; }
};

const POOLS = [
  ['flat', 'steps', 'hill', 'pit', 'stones', 'fire', 'fireBridge', 'highRoute', 'float'],
  ['steps', 'hill', 'pit', 'vine', 'vineGap', 'platPit', 'tunnel', 'highRoute', 'float', 'stones'],
  ['steps', 'pit', 'pillars', 'keyLock', 'secret', 'firePit', 'tunnel', 'highRoute', 'vine', 'float'],
  ['liftUp', 'platPit', 'fireBridge', 'keyLock', 'firePit', 'highRoute', 'float', 'tunnel', 'secret', 'stones']
];
const MOBS = [['m', 'h'], ['m', 'w', 'm'], ['h', 'u', 'm'], ['u', 'w', 'm', 'h']];
const NAMES = ['Brick Lane', 'Mossy Hollow', 'Crystal Deep', 'Cloud Works'];
const GEMS = ['*', 'r', 'o', 'i', 'c', '$'];

// Ground enemies only go where there is room to jump over or stomp them:
// no fire within two tiles, no water, no low ceiling or ledge right above.
const SAFE_GROUND = new Set(['flat', 'hill', 'steps', 'tunnel', 'highRoute', 'float', 'pillars', 'vine', 'keyLock']);
function placeMob(m, h, s, k) {
  if (k === 'm' || k === 'h') {
    if (!SAFE_GROUND.has(s.k)) return false;
    for (const d of [6, 5, 7, 4, 8, 3, 9, 10]) {
      const c = s.x + d;
      let ok = m[8][c] === '.' && m[9][c] === '#';
      for (let o = -2; o <= 2 && ok; o++) { const ch = m[8][c + o]; if (ch === '^' || m[9][c + o] === '~' || m[7][c + o] === '#' || m[6][c + o] === '#') ok = false; }
      if (ok) { h.put(8, c, k); return true; }
    }
  }
  else if (k === 'u') { for (const r of [3, 2, 4]) for (const d of [6, 5, 7, 4, 8]) { const c = s.x + d; if (m[r][c] === '.' && m[r][c + 1] === '.' && m[r][c - 1] === '.') { h.put(r, c, 'u'); return true; } } }
  else if (k === 'w') { for (const d of [6, 5, 7, 4, 8, 3, 9]) { const c = s.x + d; let ok = true; for (let r = 2; r <= 6; r++) if (m[r][c] !== '.') ok = false; if (ok) { h.put(4, c, 'w'); return true; } } }
  return false;
}

// opts: difficulty 0..1 (length, enemy count, pool breadth), boss (adds an arena with the
// Boss Saucer guarding a caged cup).
export function compose(seed, world, opts = {}) {
  const R = rng(seed), pick = (a) => a[Math.floor(R() * a.length)];
  const d = opts.difficulty != null ? opts.difficulty : 0.5;
  const n = Math.min(10, 4 + Math.round(d * 5) + Math.floor(R() * 2)), segs = ['flat'];
  const pool = POOLS[world].concat(d > 0.4 ? POOLS[(world + 1) % 4].slice(0, 4) : []);
  let locks = 0;
  while (segs.length < n) {
    const k = pick(pool);
    if (k === segs[segs.length - 1]) continue;
    if (k === 'keyLock' && locks++ >= (d > 0.6 ? 2 : 1)) continue;
    segs.push(k);
  }
  const arena = opts.boss ? 36 : 0;
  const W = 5 + n * SEG + arena + 6, m = blank(W), h = H(m);
  const info = segs.map((k, i) => { const x = 5 + i * SEG; return { x, k, ...TEMPLATES[k](x, h) }; });
  const secret = info.filter((s) => s.secret).map((s) => s.secret);
  let ax = null;
  if (opts.boss) {
    ax = 5 + n * SEG;
    for (let r = 1; r <= 4; r++) { h.put(r, ax, '#'); h.put(r, ax + 35, '#'); }
    for (const [r, c] of [[7, 4], [5, 8], [7, 12], [7, 22], [5, 26], [7, 30]]) h.plat(r, ax + c, 3);
    h.put(2, ax + 18, 'B'); h.put(8, ax + 18, 'T');
    for (const [r, c] of [[8, ax + 17], [8, ax + 19], [7, ax + 17], [7, ax + 18], [7, ax + 19]]) h.put(r, c, 'L');
    for (const [r, c] of [[4, ax + 9], [6, ax + 13], [6, ax + 23], [4, ax + 27], [6, ax + 31]]) h.put(r, c, '*');
  }
  const mobs = MOBS[world].concat(d > 0.5 ? ['u', 'w'] : []);
  const mobCount = Math.round(2 + d * 6 + R() * 2);
  for (let i = 0, placed = 0; i < mobCount * 4 && placed < mobCount; i++) if (placeMob(m, h, info[1 + Math.floor(R() * (n - 1))], pick(mobs))) placed++;
  if (!opts.boss) {
    const high = info.slice(1).filter((s) => s.top[0] <= 4);
    const ts = (high.length ? pick(high) : info[1 + Math.floor(R() * (n - 1))]).top;
    h.put(ts[0], ts[1], 'T');
  }
  info.forEach((s) => s.spots.forEach(([r, c, ch]) => { if (m[r][c] === '.') h.put(r, c, ch || GEMS[Math.floor(R() * Math.min(6, world + 3 + Math.round(d * 2)))]); }));
  h.put(8, 2, 'P'); h.put(8, 3, 'G'); h.put(8, 4, 'J'); h.put(8, W - 3, 'D');
  const flagOK = (c) => m[8][c] === '.' && m[9][c] === '#' && m[7][c] === '.' && m[8][c - 1] !== '^' && m[8][c + 1] !== '^' && !secret.some(([a2, b2]) => c >= a2 - 1 && c <= b2 + 1) && !(ax != null && c >= ax);
  const fl = []; for (let t = 22; t < (ax != null ? ax : W - 10); t += 22) fl.push(t);
  if (ax != null) fl.push(ax - 2);
  for (const t of fl) for (let dd = 0; dd < 10; dd++) { const c = [t - dd, t + dd].find((cc) => cc > 5 && cc < W - 5 && flagOK(cc)); if (c != null) { h.put(8, c, 'F'); break; } }
  return { rows: m.map((r) => r.join('')), segs };
}

// ---- playtest bot -----------------------------------------------------------

function prep(rows0) {
  const m = rows0.map((r) => r.split('')), W = m[0].length;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < W; c++) {
    const ch = m[r][c];
    if ('mhwuBJ'.includes(ch)) m[r][c] = '.';
    if (ch === '-') { m[r][c] = '#'; for (let cc = c - 1; m[9][cc] === '~'; cc--) m[9][cc] = '#'; for (let cc = c + 1; m[9][cc] === '~'; cc++) m[9][cc] = '#'; }
    if (ch === '!') { m[r][c] = '.'; for (let rr = 2; rr <= 8; rr++) { m[rr][c] = '|'; m[rr][c + 1] = '|'; } }
  }
  return m;
}
const ACTS = [];
for (const dir of [-1, 1]) { ACTS.push({ walk: 1, dir }); for (const hold of [0, 8, 99]) for (const off of [0, 8 * dir]) for (const [m0, m1] of [[0, 999], [0, 12], [10, 999]]) ACTS.push({ dir, hold, off, m0, m1 }); }
for (const dir of [-1, 0, 1]) for (const d of [0, 30, 70, 110]) ACTS.push({ climb: 1, dir, d });
for (const dir of [-1, 1]) ACTS.push({ climb: 1, down: 1, dir, d: 20 });

function sim(eng, base, node, act) {
  Object.assign(eng, { map: base.map((r) => r.slice()), mode: 'playing', hasTrophy: true, pops: [], bullets: [], enemyShots: [], monsters: [], platforms: [], hitStop: 0, banner: null, ride: null });
  const p = eng.player;
  Object.assign(p, { x: node[1] * TILE + 3 + (act.off || 0), y: node[0] * TILE + 2, vx: 0, vy: 0, ground: true, climb: false, coyote: 3, buffer: 0, inv: 0 });
  let air = false; const N = act.climb ? 200 : act.walk ? 22 : 170;
  for (let f = 0; f < N; f++) {
    let L = false, Rr = false, U = false, D = false;
    if (act.climb) { U = !act.down; D = !!act.down; if (f >= act.d) { L = act.dir < 0; Rr = act.dir > 0; } }
    else if (act.walk) { if (f < 12) { L = act.dir < 0; Rr = act.dir > 0; } }
    else { U = f < act.hold; if (f >= act.m0 && f < act.m1) { L = act.dir < 0; Rr = act.dir > 0; } }
    eng.input = { left: L, right: Rr, up: U, down: D }; eng.step();
    if (eng.mode === 'cleared') return { door: true, map: eng.map };
    if (eng.mode !== 'playing') return null;
    if (!p.ground || p.climb) air = true;
    if (air && p.ground && !p.climb && f > 1) break;
  }
  if (!p.ground || p.climb) return { map: eng.map };
  return { node: [Math.floor((p.y + p.h - 1) / TILE), Math.floor((p.x + p.w / 2) / TILE)], map: eng.map };
}

export function playtest(rows0) {
  let m = prep(rows0); const W = m[0].length;
  const run = (base) => {
    const eng = new DaveEngine({ levels: [base.map((r) => r.join(''))] });
    eng.sfx = () => {};
    Object.assign(eng.phys, { jumpVelocity: -8.9, runSpeed: 2.55, coyoteFrames: 3 });
    let st; for (let r = 0; r < ROWS; r++) for (let c = 0; c < W; c++) if (base[r][c] === 'P') st = [r, c];
    base = base.map((r) => r.map((ch) => (ch === 'P' ? '.' : ch)));
    const seen = new Set([st[0] * W + st[1]]), q = [st], got = new Set(); let door = false, key = false;
    while (q.length) {
      const nd = q.shift(), near = (dr) => base[nd[0] + dr] && base[nd[0] + dr][nd[1]] === '|';
      for (const act of ACTS) {
        if (act.climb && !near(0) && !near(-1) && !near(1)) continue;
        const r = sim(eng, base, nd, act); if (!r) continue;
        for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < W; cc++) if (r.map[rr][cc] !== base[rr][cc]) { got.add(rr * W + cc); if (base[rr][cc] === 'k') key = true; }
        if (r.door) door = true;
        if (r.node) { const kk = r.node[0] * W + r.node[1]; if (!seen.has(kk)) { seen.add(kk); q.push(r.node); } }
      }
    }
    return { got, door, key, base };
  };
  let res = run(m);
  if (res.key || rows0.some((r) => r.includes('B'))) { m = m.map((r) => r.map((ch) => (ch === 'L' ? '.' : ch))); res = run(m); }
  const bad = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < W; c++) if ('*roic$GTFk'.includes(res.base[r][c]) && !res.got.has(r * W + c)) bad.push(res.base[r][c] + '@' + r + ',' + c);
  if (!res.door) bad.push('DOOR');
  return bad;
}


const KEYS = ['hasTrophy','hasKey','fuel','ammo','hasGun','recharge','fireCool','jetOn','mode','hitStop','deaths','lives','gemsTaken','score','frame','cam','dyingTimer'];
const snap = (e) => ({ map: e.map.map((r) => r.slice()), player: { ...e.player }, monsters: e.monsters.map((m) => ({ ...m })), platforms: e.platforms.map((p) => ({ ...p })), ride: e.platforms.indexOf(e.ride), bullets: e.bullets.map((b) => ({ ...b })), shots: e.enemyShots.map((s) => ({ ...s })), checkpoint: e.checkpoint && { ...e.checkpoint }, secrets: [...e.secrets], v: KEYS.map((k) => e[k]) });
const load = (e, s) => { e.map = s.map.map((r) => r.slice()); e.player = { ...s.player }; e.monsters = s.monsters.map((m) => ({ ...m })); e.platforms = s.platforms.map((p) => ({ ...p })); e.ride = s.ride >= 0 ? e.platforms[s.ride] : null; e.bullets = s.bullets.map((b) => ({ ...b })); e.enemyShots = s.shots.map((x) => ({ ...x })); e.checkpoint = s.checkpoint && { ...s.checkpoint }; e.secrets = new Set(s.secrets); KEYS.forEach((k, i) => { e[k] = s.v[i]; }); e.pops = []; e.banner = null; };
const BACTS = [{ r: 1 }, { l: 1 }, {}, { r: 1, u: 1 }, { l: 1, u: 1 }, { u: 1 }, { d: 1 }, { r: 1, f: 1 }, { l: 1, f: 1 }, { f: 1, u: 1 }, { jet: 1, u: 1, r: 1 }, { jet: 1, u: 1, l: 1 }, { jet: 1, r: 1 }, { jet: 1, d: 1 }];
class Heap { constructor() { this.a = []; } push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } } pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; } get size() { return this.a.length; } }
export function playthrough(rows, opts) {
  opts = opts || {};
  const budget = opts.budget || 40000, MAC = 8;
  let sd = opts.seed || 777; const oldRand = Math.random;
  Math.random = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  try {
    const e = new DaveEngine({ levels: [rows], lives: 1 }); e.sfx = () => {};
    if (opts.weak) Object.assign(e.phys, { jumpVelocity: -8.9, runSpeed: 2.55, coyoteFrames: 3, monsterSpeed: e.phys.monsterSpeed * 1.25, shotSpeed: e.phys.shotSpeed * 1.25 });
    e.setMode('playing');
    let trophy = null, door = null, key = null;
    for (let r = 0; r < 10; r++) for (let c = 0; c < e.cols; c++) { const ch = e.raw[r][c]; if (ch === 'T') trophy = [c * 32 + 16, r * 32 + 16]; if (ch === 'D') door = [c * 32 + 16, r * 32 + 16]; if (ch === 'k') key = [c * 32 + 16, r * 32 + 16]; }
    const score = (e, g) => {
      const p = e.player, px = p.x + p.w / 2, py = p.y + p.h / 2, boss = e.monsters.find((m) => m.kind === 'boss');
      const d = (t) => Math.hypot(px - t[0], (py - t[1]) * 1.3) / 32;
      const goals = [];
      if (boss) goals.push([boss.x + boss.w / 2, boss.y + boss.h / 2]);
      else { if (key && !e.hasKey) goals.push(key); if (!e.hasTrophy) goals.push(trophy); }
      const left = goals.length + (boss ? boss.hp : 0);
      return left * 400 + (goals.length ? Math.min(...goals.map(d)) : d(door)) + g * 0.04;
    };
    const heap = new Heap(), seen = new Set(); heap.push({ s: snap(e), g: 0, f: score(e, 0) });
    let sims = 0;
    while (heap.size && sims < budget) {
      const nd = heap.pop();
      for (const a of BACTS) {
        if (a.jet && (opts.noJet || nd.s.v[2] <= 0)) continue;
        load(e, nd.s);
        if (a.jet && !e.jetOn) e.toggleJetpack(); if (!a.jet && e.jetOn) e.toggleJetpack();
        e.input = { left: !!a.l, right: !!a.r, up: !!a.u, down: !!a.d, fire: !!a.f };
        let fail = false, win = false;
        for (let f = 0; f < MAC; f++) { e.step(); if (e.mode === 'cleared') { win = true; break; } if (e.mode !== 'playing') { fail = true; break; } }
        sims++;
        if (win) return { ok: true, sec: +(((nd.g + 1) * MAC) / 60).toFixed(1), sims };
        if (fail) continue;
        const p = e.player, boss = e.monsters.find((m) => m.kind === 'boss');
        const k = [Math.floor(p.x / 12), Math.floor(p.y / 12), e.hasTrophy ? 1 : 0, e.hasKey ? 1 : 0, boss ? boss.hp : 0, e.jetOn ? 1 : 0, p.ground ? 1 : 0, Math.floor(e.frame / 16)].join(',');
        if (seen.has(k)) continue; seen.add(k);
        heap.push({ s: snap(e), g: nd.g + 1, f: score(e, nd.g + 1) });
      }
    }
    return { ok: false, sims };
  } finally { Math.random = oldRand; }
}

/** Returns { rows, seed, world, title, hint, segs }. Rerolls until the bots agree it is fair:
 *  every pickup reachable with weak physics, and a full playthrough with live enemies both at
 *  normal settings and with a weaker jump, slower run, faster enemies and no space pack. */
export function generateLevel(seed, opts = {}) {
  let s = seed >>> 0 || 1;
  for (let tries = 0; tries < 6; tries++, s = (s * 2654435761) >>> 0) {
    const world = opts.world != null ? opts.world : s % 4;
    const lv = compose(s, world, opts);
    if (opts.verify === false || (playtest(lv.rows).length === 0 && playthrough(lv.rows, { budget: 30000 }).ok && playthrough(lv.rows, { weak: true, noJet: true, budget: 30000 }).ok)) {
      return { rows: lv.rows, seed: s, world, segs: lv.segs, title: NAMES[world] + ' #' + String(s % 10000).padStart(4, '0'), hint: 'Random level · blaster and space pack included · Z flies, X fires' };
    }
  }
  const world = s % 4, lv = compose(s, world);
  return { rows: lv.rows, seed: s, world, segs: lv.segs, title: NAMES[world] + ' #' + String(s % 10000).padStart(4, '0'), hint: 'Random level · blaster and space pack included' };
}

export default generateLevel;
