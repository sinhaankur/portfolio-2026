// Ritam 3D — all game modules in one file (comments and indentation stripped; edit the sources in dave/).
const __eng = (() => {

const TILE = 32;
const ROWS = 10;
const VIEW_COLS = 20;

const SCORE = { door: 500, monster: 300, trophy: 1000, lifeBonus: 250 };

/** Collectibles: char → { name, score }. */
const PICKUPS = {
'*': { name: 'diamond', score: 100 },
'r': { name: 'ruby', score: 150 },
'o': { name: 'orb', score: 50 },
'i': { name: 'ring', score: 200 },
'c': { name: 'crown', score: 300 },
'$': { name: 'gold', score: 1000 }
};

const MONSTER_KIND = { m: 'walker', w: 'vertical', u: 'flyer', h: 'hopper', B: 'boss' };

const PHYS = {
runSpeed: 2.8,
gravity: 0.45,
terminal: 9,
jumpVelocity: -9.8,
shortHopVelocity: -4.5,
coyoteFrames: 8,
climbSpeed: 2.4,
jetRise: -3.2,
jetFall: 3.2,
jetDrift: 0.6,
jetBurn: 0.22,
monsterSpeed: 1.1,
monsterVertSpeed: 1.3,
flyerSpeed: 1.2,
flyerRange: TILE * 9,
flyerCooldown: [190, 280],
flyerCharge: 42,          // telegraph frames before a saucer fires
hopperEvery: 80,
hopperJump: -7.5,
bossHp: 8,
platSpeed: 1.2,
shotSpeed: 2.1,
bulletSpeed: 7.5,
bulletLife: 90,
fireEvery: 11,        // frames between shots while the fire key is held
rechargeEvery: 110,   // blaster regains one charge this often, up to rechargeCap
rechargeCap: 6,
aimRange: 11          // tiles; shots auto-aim at the nearest enemy in front
};

const LETHAL = new Set(['~', '^']);

class DaveEngine {
/** @param {{levels:string[][], titles?:string[], lives?:number, practice?:boolean}} opts */
constructor(opts) {
this.levels = opts.levels.map((l) => l.slice());
this.titles = opts.titles || [];
this.startingLives = opts.lives ?? 3;
this.practice = !!opts.practice;
this.autoRespawn = !!opts.autoRespawn;   // lose a life, respawn at last flag, no screen
this.hints = opts.hints || [];
this.rows = ROWS;
this.cols = this.levels[0][0].length;
this.phys = { ...PHYS };

this.on = { sound: null, score: null, pickup: null, levelStart: null, levelClear: null, death: null, modeChange: null };

this.input = { left: false, right: false, up: false, down: false, fire: false };
this.mode = 'title';
this.score = 0;
this.lives = this.startingLives;
this.levelIndex = 0;
this.fuel = 0;
this.ammo = 0;
this.hasGun = false;
this.recharge = 0;
this.fireCool = 0;
this.pops = [];
this.shake = 0;
this.banner = null;
this.frame = 0;
this.loadLevel(0);
}

setMode(m) { if (this.mode !== m) { this.mode = m; this.on.modeChange && this.on.modeChange(m); } }

loadLevel(i) {
this.levelIndex = i;
const src = this.levels[i];
this.cols = src[0].length;
this.raw = [];
for (let r = 0; r < this.rows; r++) this.raw.push(((src[r] || '') + '.'.repeat(this.cols)).slice(0, this.cols).split(''));
this.map = this.raw.map((r) => r.slice());

this.monsters = [];
this.platforms = [];
this.ride = null;
this.hitStop = 0;
this.secrets = new Set();
this.hasKey = false;
this.bullets = [];
this.enemyShots = [];
this.pops = [];
this.cam = 0;
this.hasTrophy = false;
this.jetOn = false;
this.gemsTotal = 0;
this.gemsTaken = 0;

let px = 2, py = 8;
for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
const ch = this.map[r][c];
if (ch === 'P') { px = c; py = r; this.map[r][c] = '.'; }
if (PICKUPS[ch]) this.gemsTotal++;
if (MONSTER_KIND[ch]) {
const kind = MONSTER_KIND[ch], boss = kind === 'boss';
const w = boss ? 80 : 24, h = boss ? 52 : 24, my = boss ? r * TILE : r * TILE + 5;
this.monsters.push({
x: c * TILE + 16 - w / 2, y: my, w, h, dir: 1, kind, vert: kind === 'vertical',
baseY: my, t: Math.random() * 6, cool: 60 + Math.random() * 120, charge: 0, vy: 0,
hp: boss ? this.phys.bossHp : 1, maxHp: boss ? this.phys.bossHp : 1, hurt: 0
});
this.map[r][c] = '.';
}
if (ch === '-' || ch === '!') {
this.platforms.push({ x: c * TILE, y: r * TILE, w: TILE * 2, h: 12, vert: ch === '!', dir: 1, dx: 0, dy: 0 });
this.map[r][c] = r === this.rows - 1 ? '~' : '.';
}
}
this.start = { c: px, r: py };
this.startPos = { x: px * TILE + 3, y: py * TILE + 2 };
this.checkpoint = null;
this.deaths = 0;
this.energy = 100; this.sip = 0; this.tired = false;
this.player = { x: px * TILE + 3, y: py * TILE + 2, w: 26, h: 30, vx: 0, vy: 0, face: 1, ground: false, walk: 0, climb: false, coyote: 0, buffer: 0, inv: 0 };
if (i === 0) { this.fuel = 0; this.ammo = 0; this.hasGun = false; }
this.banner = { text: 'LEVEL ' + (i + 1) + (this.titles[i] ? ' — ' + this.titles[i].toUpperCase() : ''), life: 150, next: this.hints[i] ? this.hints[i].toUpperCase() : null };
this.on.levelStart && this.on.levelStart(i);
}

start() { this.setMode('playing'); }
pause() { if (this.mode === 'playing') this.setMode('paused'); else if (this.mode === 'paused') this.setMode('playing'); }
restartLevel() { this.loadLevel(this.levelIndex); this.setMode('playing'); }
resetRun() { this.score = 0; this.lives = this.startingLives; this.fuel = 0; this.ammo = 0; this.hasGun = false; this.loadLevel(0); }

advance() {
switch (this.mode) {
case 'title': case 'paused': this.setMode('playing'); break;
case 'dead':
if (this.lives <= 0) { this.lives = this.startingLives; this.score = 0; }
this.loadLevel(this.levelIndex);
this.setMode('playing'); break;
case 'cleared':
if (this.levelIndex + 1 >= this.levels.length) { this.setMode('win'); break; }
this.loadLevel(this.levelIndex + 1); this.setMode('playing'); break;
case 'win': this.resetRun(); this.setMode('playing'); break;
}
}

setInput(next) { Object.assign(this.input, next); }

toggleJetpack() {
if (this.mode !== 'playing' || this.fuel <= 0) return;
this.jetOn = !this.jetOn;
this.sfx('pickup');
}

/** Milk break: Ritam stops and drinks from his Bupam bottle (about a second), back to full energy. */
drink() {
const p = this.player;
if (this.mode !== 'playing' || !this.bupam || this.sip > 0 || !p.ground || p.climb) return;
this.sip = 55;
this.sfx('pickup');
}

/** Blaster: auto-aims at the nearest enemy (or enemy shot) in front, up to ~60° up or down. */
fire() {
if (this.mode !== 'playing' || this.ammo <= 0 || this.fireCool > 0) return;
this.ammo--;
this.fireCool = this.phys.fireEvery;
const p = this.player, P = this.phys;
const sx = p.x + p.w / 2 + p.face * 14, sy = p.y + 13;
let best = null, bd = P.aimRange * TILE;
const consider = (tx, ty) => {
const dx = tx - sx, dy = ty - sy;
if (dx * p.face <= 0) return;
const d = Math.hypot(dx, dy);
if (d < bd && Math.abs(dy) < Math.abs(dx) * 1.8) { bd = d; best = [dx, dy]; }
};
for (const m of this.monsters) consider(m.x + m.w / 2, m.y + m.h / 2);
for (const s of this.enemyShots) consider(s.x, s.y);
let vx = p.face * P.bulletSpeed, vy = 0;
if (best) { const d = Math.hypot(best[0], best[1]) || 1; vx = (best[0] / d) * P.bulletSpeed; vy = (best[1] / d) * P.bulletSpeed; }
this.bullets.push({ x: sx - 4, y: sy - 3, vx, vy, dir: p.face, life: P.bulletLife });
this.sfx('shoot');
}

solidAt(x, y, w, h) {
for (let c = Math.floor(x / TILE); c <= Math.floor((x + w - 1) / TILE); c++)
for (let r = Math.floor(y / TILE); r <= Math.floor((y + h - 1) / TILE); r++) {
if (c < 0 || c >= this.cols) return true;
if (r >= this.rows) return true;
if (r < 0) continue;
const t = this.map[r][c];
if (t === '#' || t === 'L') return true;
}
return false;
}

tilesIn(x, y, w, h) {
const out = [];
for (let c = Math.floor(x / TILE); c <= Math.floor((x + w - 1) / TILE); c++)
for (let r = Math.floor(y / TILE); r <= Math.floor((y + h - 1) / TILE); r++) {
if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
out.push({ c, r, ch: this.map[r][c] });
}
return out;
}

sweep(body, dx, dy) {
const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
if (steps === 0) return false;
const sx = dx / steps, sy = dy / steps;
for (let i = 0; i < steps; i++) {
if (this.solidAt(body.x + sx, body.y + sy, body.w, body.h)) return true;
body.x += sx; body.y += sy;
}
return false;
}

sfx(name) { this.on.sound && this.on.sound(name); }

addScore(n, x, y, tone) {
this.score += n;
if (x != null) this.pops.push({ x, y, text: '+' + n, tone: tone || 'value', life: 55 });
this.on.score && this.on.score(n, this.score);
}

kill() {
this.sfx('die');
this.shake = 14;
this.deaths++;
if (this.practice) {
if (this.autoRespawn) { this.dyingTimer = 45; this.setMode('dying'); return; }
this.loadLevel(this.levelIndex); this.setMode('playing'); return;
}
this.lives--;
this.on.death && this.on.death(this.lives);
if (this.autoRespawn && this.lives > 0) { this.dyingTimer = 75; this.setMode('dying'); return; }
this.setMode('dead');
}

/** Back to the last flag (or the start) with the level as you left it. */
respawn() {
const at = this.checkpoint || this.startPos, p = this.player;
Object.assign(p, { x: at.x, y: at.y, vx: 0, vy: 0, climb: false, ground: false, coyote: 0, buffer: 0, inv: 100 }); this.energy = 100; this.sip = 0;
this.jetOn = false;
this.enemyShots = [];
this.bullets = [];
this.setMode('playing');
}

openLocks() {
let any = false;
for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.map[r][c] === 'L') { this.map[r][c] = '.'; any = true; }
if (any) this.shake = 8;
}

hurtBoss(m) {
if (m.hurt > 0) return;
m.hp--; m.hurt = 36;
this.sfx('kill');
this.addScore(100, m.x + m.w / 2, m.y, 'hit');
if (m.hp > 0) return;
this.monsters.splice(this.monsters.indexOf(m), 1);
this.addScore(2000, m.x + m.w / 2, m.y, 'prize');
this.openLocks();
this.shake = 20; this.hitStop = 10;
this.banner = { text: 'BOSS DOWN! GRAB THE CUP', life: 200 };
this.sfx('door');
}

clearLevel() {
const bonus = this.lives * SCORE.lifeBonus;
this.addScore(SCORE.door + bonus);
const stars = 1 + (this.gemsTaken >= this.gemsTotal ? 1 : 0) + (this.deaths === 0 ? 1 : 0);
this.lastClear = { level: this.levelIndex, gems: this.gemsTaken, gemsTotal: this.gemsTotal, bonus, deaths: this.deaths, stars };
this.sfx('door');
this.on.levelClear && this.on.levelClear(this.levelIndex, this.score);
this.setMode('cleared');
}

step() {
this.frame++;
if (this.banner && this.banner.life > 0) this.banner.life--;
if (this.banner && this.banner.life <= 0 && this.banner.next) this.banner = { text: this.banner.next, life: 240 };
if (this.shake > 0) this.shake--;
for (const q of this.pops) { q.life--; q.y -= 0.6; }
this.pops = this.pops.filter((q) => q.life > 0);
if (this.mode === 'dying') { if (--this.dyingTimer <= 0) this.respawn(); return; }
if (this.mode !== 'playing') return;
if (this.hitStop > 0) { this.hitStop--; return; }

const P = this.phys, p = this.player, { left, right, up, down } = this.input;
if (p.inv > 0) p.inv--;
if (this.fireCool > 0) this.fireCool--;
if (this.input.fire) this.fire();
if (this.hasGun && this.ammo < P.rechargeCap && ++this.recharge >= P.rechargeEvery) { this.recharge = 0; this.ammo++; }

for (const pl of this.platforms) {
if (pl.wait > 0) { pl.wait--; pl.dx = pl.dy = 0; continue; }
if (pl.vert) {
let ny = pl.y + pl.dir * P.platSpeed;
if (ny < TILE * 2 || ny > (this.rows - 1) * TILE || (pl.dir < 0 && this.solidAt(pl.x, ny, pl.w, 1))) { pl.dir *= -1; ny = pl.y; pl.wait = 50; }
pl.dx = 0; pl.dy = ny - pl.y; pl.y = ny;
} else {
let nx = pl.x + pl.dir * P.platSpeed;
if (this.solidAt(nx, pl.y, pl.w, pl.h)) { pl.dir *= -1; nx = pl.x; pl.wait = 40; }
pl.dy = 0; pl.dx = nx - pl.x; pl.x = nx;
}
}
if (this.ride) {
const pl = this.ride;
this.sweep(p, pl.dx, 0);
if (!this.solidAt(p.x, pl.y - p.h, p.w, p.h)) p.y = pl.y - p.h;
this.ride = null;
}

const onLadder = this.tilesIn(p.x + p.w / 2 - 2, p.y + 4, 4, p.h - 8).some((t) => t.ch === '|');
if (!onLadder) p.climb = false;
if (onLadder && (up || down)) p.climb = true;

p.vx = 0;
if (left) { p.vx = -P.runSpeed; p.face = -1; }
if (right) { p.vx = P.runSpeed; p.face = 1; }
if (this.energy == null) this.energy = 100;
if (this.sip > 0 && (left || right || up || !p.ground)) this.sip = 0;
if (this.sip > 0) {
this.sip--; p.vx = 0; this.energy = Math.min(100, this.energy + 1.6);
if (this.sip === 0) { this.sfx('pickup'); this.energy = 100; }
} else {
const run = Math.abs(p.vx) > 0 && p.ground;
this.energy = Math.min(100, Math.max(0, this.energy - (run ? 0.075 : 0) - (p.climb && (up || down) ? 0.09 : 0) + (!run && !p.climb && p.ground ? (this.bupam ? 0.02 : 0.15) : 0)));
}
this.tired = this.tired ? this.energy < 60 : this.energy < 25;
if (this.tired && p.vx) p.vx = Math.sign(p.vx) * Math.max(2.6, Math.abs(p.vx) * 0.88);
this.idleT = !left && !right && !up && !down && p.ground && !p.climb ? (this.idleT || 0) + 1 : 0;
if (this.bupam && this.tired && this.idleT > 35 && !this.sip) this.drink();

p.buffer = up ? p.buffer + 1 : 0;
if (this.jetOn && this.fuel > 0) {
p.climb = false;
p.vy = up ? P.jetRise : (down ? P.jetFall : P.jetDrift);
this.fuel = Math.max(0, this.fuel - P.jetBurn);
if (this.fuel <= 0) this.jetOn = false;
} else if (p.climb) {
const vineAbove = this.tilesIn(p.x + p.w / 2 - 2, p.y - 6, 4, 6).some((t) => t.ch === '|');
if (up && (left || right) && p.buffer === 1) { p.climb = false; p.vy = P.jumpVelocity * 0.8; p.buffer = 0; this.sfx('jump'); }
else if (up && !vineAbove) { p.climb = false; p.vy = P.jumpVelocity * 0.7; p.buffer = 0; this.sfx('jump'); }
else {
p.vy = up ? -P.climbSpeed : (down ? P.climbSpeed : 0);
if (!left && !right) { const vc = Math.floor((p.x + p.w / 2) / TILE) * TILE + TILE / 2 - p.w / 2; if (!this.solidAt(vc, p.y, p.w, p.h)) p.x += (vc - p.x) * 0.25; }
}
} else {
p.vy = Math.min(P.terminal, p.vy + P.gravity);
if (p.buffer > 0 && (p.ground || p.coyote > 0)) { p.vy = P.jumpVelocity; p.ground = false; p.coyote = 0; p.buffer = 0; this.sfx('jump'); this.energy = Math.max(0, (this.energy ?? 100) - 1.6); }
if (!up && p.vy < P.shortHopVelocity) p.vy = P.shortHopVelocity;
}

if (this.sweep(p, p.vx, 0)) p.vx = 0;
const blocked = this.sweep(p, 0, p.vy);
if (blocked) { p.ground = p.vy > 0; p.vy = 0; } else p.ground = false;
if (p.y < 0) { p.y = 0; if (p.vy < 0) p.vy = 0; }
if (!p.ground) p.ground = this.solidAt(p.x, p.y + 1.5, p.w, p.h) && p.vy >= 0;
if (p.vy >= 0) for (const pl of this.platforms) {
const bottom = p.y + p.h, prev = bottom - p.vy - Math.max(0, pl.dy);
if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && prev <= pl.y + 2 && bottom >= pl.y - 1) {
p.y = pl.y - p.h; p.vy = 0; p.ground = true; this.ride = pl; break;
}
}
p.coyote = p.ground ? P.coyoteFrames : Math.max(0, p.coyote - 1);
if (p.vx !== 0 && p.ground) p.walk += 0.22;

if (!p.inv) for (const t of this.tilesIn(p.x + 7, p.y + 12, p.w - 14, p.h - 12)) if (LETHAL.has(t.ch)) { this.kill(); return; }
for (const t of this.tilesIn(p.x + 3, p.y + 3, p.w - 6, p.h - 6)) {
const { ch, c, r } = t, tx = c * TILE + TILE / 2, ty = r * TILE;
if (LETHAL.has(ch)) continue;
const pk = PICKUPS[ch];
if (pk) {
this.map[r][c] = '.'; this.gemsTaken++;
this.addScore(pk.score, tx, ty, pk.score >= 300 ? 'prize' : 'value');
this.sfx(pk.score >= 300 ? 'trophy' : 'pickup');
this.on.pickup && this.on.pickup(ch, c, r);
}
if (ch === 'T') {
this.map[r][c] = '.'; this.hasTrophy = true;
this.addScore(SCORE.trophy, tx, ty, 'prize');
this.banner = { text: 'GO THRU THE DOOR!', life: 180 };
this.sfx('trophy'); this.on.pickup && this.on.pickup(ch, c, r);
}
if (ch === 'J') { this.map[r][c] = '.'; this.fuel = 100; this.banner = { text: 'SPACE PACK — PRESS Z TO FLY', life: 150 }; this.sfx('pickup'); this.on.pickup && this.on.pickup(ch, c, r); }
if (ch === 'G') { this.map[r][c] = '.'; this.ammo = Math.max(this.ammo, 0) + 10; this.hasGun = true; this.banner = { text: 'BLASTER — PRESS X OR F', life: 150 }; this.sfx('pickup'); this.on.pickup && this.on.pickup(ch, c, r); }
if (ch === 'k') {
this.map[r][c] = '.'; this.hasKey = true; this.openLocks();
this.addScore(200, tx, ty, 'prize');
this.banner = { text: 'KEY! THE BLUE LOCKS ARE OPEN', life: 160 };
this.sfx('trophy'); this.hitStop = 5; this.on.pickup && this.on.pickup(ch, c, r);
}
if (ch === 'X' && !this.secrets.has(c)) {
this.secrets.add(c - 1); this.secrets.add(c); this.secrets.add(c + 1);
this.addScore(500, tx, ty, 'prize');
this.banner = { text: 'SECRET FOUND!', life: 120 };
this.sfx('trophy');
}
if (ch === 'F') {
this.map[r][c] = 'f';
this.checkpoint = { x: c * TILE + 3, y: r * TILE + 2 };
this.banner = { text: 'CHECKPOINT', life: 110 };
this.sfx('pickup'); this.on.pickup && this.on.pickup(ch, c, r);
}
if (ch === 'D' && this.hasTrophy) { this.clearLevel(); return; }
}

const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, stomped = [];
for (const m of this.monsters) {
m.t += 0.06;
if (m.kind === 'vertical') {
m.y += m.dir * P.monsterVertSpeed;
if (this.solidAt(m.x, m.y, m.w, m.h) || m.y < 0 || m.y + m.h > this.rows * TILE) { m.y -= m.dir * P.monsterVertSpeed; m.dir *= -1; }
} else if (m.kind === 'hopper') {
m.vy = Math.min(P.terminal, m.vy + P.gravity);
const grounded = this.solidAt(m.x, m.y + 1, m.w, m.h);
if (grounded && m.vy >= 0 && --m.cool <= 0) {
m.cool = P.hopperEvery + Math.random() * 40;
m.vy = P.hopperJump;
m.dir = Math.sign(pcx - (m.x + 12)) || m.dir;
}
if ((!grounded || m.vy < 0) && this.sweep(m, m.dir * 1.8, 0)) m.dir *= -1;
if (this.sweep(m, 0, m.vy)) m.vy = 0;
} else if (m.kind === 'boss') {
if (m.hurt > 0) m.hurt--;
const rage = 1 + (m.maxHp - m.hp) / m.maxHp, sp = P.flyerSpeed * 0.9 * rage;
m.x += m.dir * sp;
if (this.solidAt(m.x, m.baseY, m.w, m.h)) { m.x -= m.dir * sp; m.dir *= -1; }
m.y = m.baseY + Math.sin(m.t * 1.2) * 10;
const dx = pcx - (m.x + m.w / 2);
if (m.charge > 0) {
if (--m.charge === 0) {
const n = m.hp <= m.maxHp / 2 ? 5 : 3;
for (let i = 0; i < n; i++) {
const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.32 - Math.sign(dx) * 0.25;
this.enemyShots.push({ x: m.x + m.w / 2, y: m.y + m.h, vx: Math.cos(a) * P.shotSpeed, vy: Math.sin(a) * P.shotSpeed, life: 240 });
}
this.sfx('zap'); this.shake = 5;
}
} else if (--m.cool <= 0) { m.cool = 110 / rage; m.charge = P.flyerCharge; }
} else if (m.kind === 'flyer') {
m.x += m.dir * P.flyerSpeed;
if (this.solidAt(m.x, m.baseY, m.w, m.h)) { m.x -= m.dir * P.flyerSpeed; m.dir *= -1; }
m.y = m.baseY + Math.sin(m.t * 1.5) * 5;
const dx = pcx - (m.x + 12), dy = pcy - (m.y + 12);
if (m.charge > 0) {
if (--m.charge === 0) {
const vx = Math.sign(dx || 1) * P.shotSpeed;
const vy = Math.max(-1.6, Math.min(1.6, dy / (Math.abs(dx) / P.shotSpeed || 1)));
this.enemyShots.push({ x: m.x + 12, y: m.y + 16, vx, vy, life: 220 });
this.sfx('zap');
}
} else if (--m.cool <= 0 && Math.abs(dx) < P.flyerRange && Math.abs(dy) < TILE * 5) {
const [a, b] = P.flyerCooldown;
m.cool = a + Math.random() * (b - a);
m.charge = P.flyerCharge;
}
} else {
m.x += m.dir * P.monsterSpeed;
const ahead = m.x + (m.dir > 0 ? m.w + 2 : -2);
if (this.solidAt(m.x, m.y, m.w, m.h) || !this.solidAt(ahead, m.y + m.h + 2, 2, 2)) { m.x -= m.dir * P.monsterSpeed; m.dir *= -1; }
}
if (p.x < m.x + m.w - 4 && p.x + p.w > m.x + 4 && p.y < m.y + m.h - 4 && p.y + p.h > m.y + 4) {
if (m.kind !== 'vertical' && p.vy > 0.5 && p.y + p.h - m.y < 18) {
p.vy = up ? P.jumpVelocity : -6.5;
this.hitStop = 4; this.shake = 4;
if (m.kind === 'boss') { this.hurtBoss(m); continue; }
stomped.push(m);
this.addScore(SCORE.monster, m.x + m.w / 2, m.y, 'hit');
this.sfx('kill');
continue;
}
if (!p.inv) { this.kill(); return; }
}
}
for (const m of stomped) this.monsters.splice(this.monsters.indexOf(m), 1);

for (const s of this.enemyShots) {
s.x += s.vx; s.y += s.vy; s.life--;
if (this.solidAt(s.x - 3, s.y - 3, 6, 6)) s.life = 0;
if (s.life > 0 && s.x > p.x + 3 && s.x < p.x + p.w - 3 && s.y > p.y + 3 && s.y < p.y + p.h - 3 && !p.inv) { this.kill(); return; }
}
this.enemyShots = this.enemyShots.filter((s) => s.life > 0);

for (const b of this.bullets) {
const bvx = b.vx != null ? b.vx : b.dir * P.bulletSpeed, bvy = b.vy || 0;
b.x += bvx; b.y += bvy; b.life--;
if (this.solidAt(b.x, b.y, 8, 6)) b.life = 0;
for (const s of this.enemyShots) if (Math.abs(s.x - (b.x + 4)) < 9 && Math.abs(s.y - (b.y + 3)) < 9) { s.life = 0; b.life = 0; this.addScore(50, s.x, s.y, 'hit'); }
if (b.life <= 0) continue;
for (let i = this.monsters.length - 1; i >= 0; i--) {
const m = this.monsters[i];
if (b.x < m.x + m.w && b.x + 8 > m.x && b.y < m.y + m.h && b.y + 6 > m.y) {
b.life = 0;
if (m.kind === 'boss') { this.hurtBoss(m); break; }
this.monsters.splice(i, 1);
this.addScore(SCORE.monster, m.x + m.w / 2, m.y, 'hit');
this.sfx('kill');
this.hitStop = 3;
break;
}
}
}
this.bullets = this.bullets.filter((b) => b.life > 0);
this.enemyShots = this.enemyShots.filter((s) => s.life > 0);

const view = VIEW_COLS * TILE;
const target = p.x + p.w / 2 + p.face * TILE * 2 - view / 2;
this.cam += (Math.max(0, Math.min(this.cols * TILE - view, target)) - this.cam) * 0.12;
}

paint(col, row, ch) {
if (col <= 0 || col >= this.cols - 1 || row <= 0 || row >= this.rows) return;
if (ch === 'P') for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.raw[r][c] === 'P') this.raw[r][c] = '.';
this.raw[row][col] = ch;
}

currentLevelSource() { return this.raw.map((r) => r.join('')); }
commitEdits() { this.levels[this.levelIndex] = this.currentLevelSource(); return this.levels; }
emptyLevel() {
this.raw = this.raw.map((rw, r) => rw.map((_, c) => (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) ? '#' : '.'));
this.raw[this.rows - 2][2] = 'P';
}
}



return { TILE, ROWS, VIEW_COLS, SCORE, PICKUPS, DaveEngine };
})();
const __inp = (() => {

const HELD = {
arrowleft: 'left', a: 'left',
arrowright: 'right', d: 'right',
arrowup: 'up', w: 'up', ' ': 'up',
arrowdown: 'down', s: 'down'
};

const SWALLOW = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'z', 'x', 'c', 'f', 'control', 'alt', 'p', 'r', 'f9']);
const FIRE = new Set(['x', 'f', 'control']);
const JET = new Set(['z', 'c', 'alt']);

/** @returns {() => void} unbind */
function bindKeyboard(game, target = window) {
const down = new Set();

const sync = () => {
game.setInput({
left: down.has('arrowleft') || down.has('a'),
right: down.has('arrowright') || down.has('d'),
up: down.has('arrowup') || down.has('w') || down.has(' '),
down: down.has('arrowdown') || down.has('s'),
fire: [...FIRE].some((k) => down.has(k))
});
};

const onDown = (e) => {
const k = e.key.toLowerCase();
if (SWALLOW.has(k)) e.preventDefault();
if (k === 'enter') { game.advance(); return; }
const fresh = !down.has(k);
down.add(k);
if (HELD[k] || FIRE.has(k)) sync();
if (!fresh) return;
if (k === 'p' || k === 'f9' || k === 'escape') game.pause();
if (k === 'r' && game.mode === 'playing') game.restartLevel();
if (JET.has(k)) game.toggleJetpack();
if ((k === 'm' || k === 'b') && game.drink) game.drink();
if (FIRE.has(k)) game.fire();
};
const onUp = (e) => { down.delete(e.key.toLowerCase()); sync(); };
const onBlur = () => { down.clear(); sync(); };

target.addEventListener('keydown', onDown);
target.addEventListener('keyup', onUp);
target.addEventListener('blur', onBlur);
return () => {
target.removeEventListener('keydown', onDown);
target.removeEventListener('keyup', onUp);
target.removeEventListener('blur', onBlur);
};
}

/**
* Wire on-screen buttons. Pass elements keyed by action:
*   bindTouch(game, { left: el, right: el, jump: el, jet: el, shoot: el })
*/
function bindTouch(game, els) {
const offs = [];
const hold = (el, key) => {
if (!el) return;
const on = (e) => { e.preventDefault(); game.setInput({ [key]: true }); };
const off = (e) => { e.preventDefault(); game.setInput({ [key]: false }); };
el.addEventListener('pointerdown', on);
el.addEventListener('pointerup', off);
el.addEventListener('pointercancel', off);
el.addEventListener('pointerleave', off);
offs.push(() => {
el.removeEventListener('pointerdown', on);
el.removeEventListener('pointerup', off);
el.removeEventListener('pointercancel', off);
el.removeEventListener('pointerleave', off);
});
};
const tap = (el, fn) => {
if (!el) return;
const on = (e) => { e.preventDefault(); fn(); };
el.addEventListener('pointerdown', on);
offs.push(() => el.removeEventListener('pointerdown', on));
};
hold(els.left, 'left');
hold(els.right, 'right');
hold(els.up || els.jump, 'up');
hold(els.down, 'down');
tap(els.jet, () => game.toggleJetpack());
hold(els.shoot, 'fire');
tap(els.shoot, () => game.fire());
return () => offs.forEach((f) => f());
}

/** Square-wave sound effects over WebAudio. Returns a function for engine.on.sound. */
function createSfx() {
let ac = null;
const seqs = {
jump: [[520, 0.06], [720, 0.06]],
pickup: [[880, 0.05], [1180, 0.06]],
trophy: [[660, 0.08], [880, 0.08], [1320, 0.16]],
shoot: [[900, 0.04], [420, 0.05]],
door: [[520, 0.09], [700, 0.09], [1040, 0.2]],
die: [[400, 0.12], [260, 0.14], [150, 0.24]],
kill: [[300, 0.05], [180, 0.08]],
zap: [[260, 0.04], [520, 0.05]]
};
const play = (name) => {
if (play.muted) return;
try {
ac = ac || new (window.AudioContext || window.webkitAudioContext)();
let at = ac.currentTime;
for (const [freq, dur] of (seqs[name] || [[440, 0.06]])) {
const o = ac.createOscillator(), g = ac.createGain();
o.type = 'square';
o.frequency.setValueAtTime(freq, at);
g.gain.setValueAtTime(0.045, at);
g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
o.connect(g); g.connect(ac.destination);
o.start(at); o.stop(at + dur);
at += dur;
}
} catch (e) { /* audio unavailable */ }
};
play.muted = false;
return play;
}

return { bindKeyboard, bindTouch, createSfx };
})();
const __lv = (() => {


const WORLDS = ["Town","Forest","Caves","Sky Fortress"];

const REGIONS = [{"name":"First Steps","theme":null,"from":0,"to":19},{"name":"Sunny Harbour","theme":0,"from":20,"to":39},{"name":"Whisper Woods","theme":1,"from":40,"to":59},{"name":"Glow Mines","theme":2,"from":60,"to":79},{"name":"Cloud Citadel","theme":3,"from":80,"to":99},{"name":"Rooftop Run","theme":0,"from":100,"to":119},{"name":"Tangle Jungle","theme":1,"from":120,"to":139},{"name":"Magma Depths","theme":2,"from":140,"to":159},{"name":"Storm Works","theme":3,"from":160,"to":179},{"name":"The Last Climb","theme":null,"from":180,"to":199}];

const THEME_OF = [0,0,0,0,0,1,1,1,1,1,2,2,2,2,2,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,1,1,1,1,1,2,2,2,2,2,3,3,3,3,3];

const TITLES = ["Hello, Ritam","Stepping Up","Splash Zone","Hot Feet","Save Point","Vine Street","Blob Party","Squash & Shoot","Rocket Park","All Aboard","Lock & Key","Hidden Rooms","Jet Set","Saucer Cave","Hop Along","Going Up","Key Master","Rocket Man","The Gauntlet","Boss Saucer","Silver Lane","Tricky Market","Sleepy Square","Echoing Plaza","Windy Rooftops","Rusty Bridge","Secret Docks","Sticky Steps","Sunny Alley","Giant Chimneys","Crooked Lane","Quiet Market","Mossy Square","Lucky Plaza","Breezy Rooftops","Misty Bridge","Tiny Docks","Dizzy Steps","Twisty Alley","Boss · Sunny Harbour","Golden Hollow","Shady Brook","Hidden Roots","Wobbly Meadow","Silver Thicket","Tricky Canopy","Sleepy Stump","Echoing Grove","Windy Glade","Rusty Ferns","Secret Hollow","Sticky Brook","Sunny Roots","Giant Meadow","Crooked Thicket","Quiet Canopy","Mossy Stump","Lucky Grove","Breezy Glade","Boss · Whisper Woods","Tiny Tunnels","Dizzy Crystals","Twisty Echoes","Bouncy Rift","Golden Shaft","Shady Vault","Hidden Seams","Wobbly Grotto","Silver Chasm","Tricky Pools","Sleepy Tunnels","Echoing Crystals","Windy Echoes","Rusty Rift","Secret Shaft","Sticky Vault","Sunny Seams","Giant Grotto","Crooked Chasm","Boss · Glow Mines","Mossy Gears","Lucky Pistons","Breezy Rails","Misty Spire","Tiny Vents","Dizzy Hangar","Twisty Deck","Bouncy Catwalk","Golden Tower","Shady Turbines","Hidden Gears","Wobbly Pistons","Silver Rails","Tricky Spire","Sleepy Vents","Echoing Hangar","Windy Deck","Rusty Catwalk","Secret Tower","Boss · Cloud Citadel","Sunny Lane","Giant Market","Crooked Square","Quiet Plaza","Mossy Rooftops","Lucky Bridge","Breezy Docks","Misty Steps","Tiny Alley","Dizzy Chimneys","Twisty Lane","Bouncy Market","Golden Square","Shady Plaza","Hidden Rooftops","Wobbly Bridge","Silver Docks","Tricky Steps","Sleepy Alley","Boss · Rooftop Run","Windy Hollow","Rusty Brook","Secret Roots","Sticky Meadow","Sunny Thicket","Giant Canopy","Crooked Stump","Quiet Grove","Mossy Glade","Lucky Ferns","Breezy Hollow","Misty Brook","Tiny Roots","Dizzy Meadow","Twisty Thicket","Bouncy Canopy","Golden Stump","Shady Grove","Hidden Glade","Boss · Tangle Jungle","Silver Tunnels","Tricky Crystals","Sleepy Echoes","Echoing Rift","Windy Shaft","Rusty Vault","Secret Seams","Sticky Grotto","Sunny Chasm","Giant Pools","Crooked Tunnels","Quiet Crystals","Mossy Echoes","Lucky Rift","Breezy Shaft","Misty Vault","Tiny Seams","Dizzy Grotto","Twisty Chasm","Boss · Magma Depths","Golden Gears","Shady Pistons","Hidden Rails","Wobbly Spire","Silver Vents","Tricky Hangar","Sleepy Deck","Echoing Catwalk","Windy Tower","Rusty Turbines","Secret Gears","Sticky Pistons","Sunny Rails","Giant Spire","Crooked Vents","Quiet Hangar","Mossy Deck","Lucky Catwalk","Breezy Tower","Boss · Storm Works","Tiny Lane","Dizzy Market","Twisty Square","Bouncy Plaza","Golden Rooftops","Shady Canopy","Hidden Stump","Wobbly Grove","Silver Glade","Tricky Ferns","Lucky Grotto","Breezy Chasm","Misty Pools","Echoing Grotto","Windy Chasm","Sticky Hangar","Sunny Deck","Giant Catwalk","Crooked Tower","Boss · The Last Climb"];

const RLE = [["#47","#.45#","#.45#","#.45#","#.21*T.22#","#.21#3.21#","#.12o.6r.13**.10#","#.18#3.10r#4.9#","#.P.5oro.16*.4#6.o.4D.#","#47"],["#59","#.57#","#.34*.11cic.T.6#","#.34##.9#6.6#","#.9r.21*.6*.18#","#.9#3.19##.4##.4##.12#","#.7o.13*r.6*.27#","#.6#3.10o#4.5##.10##.14#","#.P.12*.4#6.o.20*.o.5D.#","#59"],["#71","#.69#","#.69#","#.69#","#.45*T.22#","#.45#3.21#","#.9r.14r.6*.3*.7r.13*.11#","#.42#3.24#","#.P.4o.6r.5*3F.9ro..r.4F.8*.3*.6r.5D.#","#9~~#20~~##~~#20~~#12"],["#71","#.69#","#.69#","#.69#","#.45*.23#","#.32*oT*.9#3.21#","#.10o.10r*.8#6.6o.15*.9#","#.10##.7*#4.5##.11#3.14##.8#","#.P.4r.^.4^.o..F#6.r.4^6.*..F.8o.4^^.5^*.3D.#","#71"],["#83","#.81#","#.34cic.33*T.9#","#.33#6.31##.9#","#.67*.6r.6#","#.31##.34##.4##.6#","#.9r.12*.20*.3*.11r.5*.15#","#.22##.5##.28##.4##.14#","#.P.4o.6*.3F*.^.4^.o.7*.r.3F..ro..*.6^^.5^oF.14D.#","#9~~#32~~##~~#34"],["#71","#.69#","#.6|.i.i.58#","#.6|#7.15|..o..T.17|..*..*.9#","#.6|.22|#9.14|#9.6#","#.6|.22|.23|.15#","#.6|.17r.4|.15**.6|.15#","#.6|.22|.13*#4.5|.15#","#.P.4|.5*.6ir*F.6|.9*..F#6.o..|.9*.3D.#","#32~7#17~7#8"],["#71","#.29#10.30#","#.29#10.30#","#.29#10.30#","#.29#10.6rT.22#","#.29#10.6#3.21#","#.12i.8io.20i.16i.8#","#.19i#4.18#3.24#","#.P.5i3m.7F#6.*.4*o*m.i.4F.8i.4ioom.8D.#","#71"],["#71","#.5#10.26#10.18#","#.5#10.15|.o.r.T.4#10.18#","#.5#10.15|#7.3#10.18#","#.5#10.15|.10#10.18#","#.5#10.15|.10#10.18#","#.21r.8|.27r.10#","#.30|.27##.9#","#.PG.4iiom.o.5*F..m..o.4|.5i.5F*o*m.o.5i.^.4^.r.3D.#","#21~~#48"],["#71","#.69#","#.46cic.T.7*.10#","#.45#6.7##.9#","#.10w.10i.33o.w.4i.6#","#.21#3.19##.10##.4##.6#","#.12r.6r.11*.3r.17i.15#","#.18#3.20##.10##.14#","#.PG.4iir.11Fm.3i.5*o..r.6F.3*.*.17D.#","#31~~##~~#34"],["#71","#.69#","#.42|.i.i.T.20#","#.42|#7.19#","#.42|.26#","#.42|.26#","#.21ro.19|.26#","#.19*#4.18|.26#","#.P.3i.9i..F#6.r..*.9o..|F.4i.4*.9r.3D.#","#7~-~7#15~-~7#15~-~7#7"],["#59","#.36L.20#","#.36L.20#","#.36L.20#","#.9o.22k.3L.20#","#.9#3.19##.3L.20#","#.7o.14*.6r.6L.11c.8#","#.6#3.10*..##..*..##.5L.20#","#.P.12c.4#Fr##..#.7o.L.T.3Froom.8D.#","#59"],["#71","#.69#","#.42|.o.i.T.20#","#.42|#7.19#","#.24c.17|.17c.8#","#.23#4.15|.16#4.6#","#.12*.7r..X..#.7*.7|.13o..X..#.6#","#.20##.X..#.4c..##..c.3|.13##.X..#.6#","#.P.5ooim.8F.3X$c#i.3#.h##..#.3|F.4o.10X$c#r.3D.#","#71"],["#71","#.69#","#.22r.23cic.T.18#","#.22##.21#6..|..r..*.9#","#.19c.6c.26|#9.6#","#.19##.4##.16##.8|.15#","#.9c.7o.17r.17|.15#","#.17##.16##.4##.10|.15#","#.P.J..o.6*.7F.9^^.5^r.3F.3*.c.3|.9*.3D.#","#9~~#45~7#8"],["#71","#.69#","#.46iT.21#","#.10u.23u.11##.10u.10#","#.21c.21r.6o.18#","#.21#3.19##.4##.18#","#.12c.6o.14i.6*.18o.8#","#.18#3.10o..##..i..##.26#","#.PG.4*co.11F.4o.4#.c##..#.4F.11**c.9D.#","#71"],["#83","#.81#","#.81#","#.81#","#.81#","#.81#","#.12i.8r.11cT.11c.8o.3o.12*.8#","#.31i#4.10##.33#","#.PG.4*cch.7r.3F..*.5#6ho..Fc.^.4^.i.4ci..*.4F.orch.8D.#","#21~~#32~~##~~#22"],["#59","#.57#","#.9r..$.20i..T.20#","#.9#5.19#5.19#","#.9##.22##.22#","#.9##.22##.9$i.c.9#","#.9##.11c.10##.8#6.8#","#.9##.11##.9##.6##.14#","#.P.5!.##.4i.F$.^.4^.*.3!.##.4*F..^6.c.4D.#","#59"],["#59","#.24L.32#","#.24L.21cic.T.6#","#.24L.20#6.6#","#.20k.3L.11c.20#","#.19##.3L.10#4.4##.12#","#.17r.6L.7*..X..#.18#","#.17##.5L.7##.X..#..##.14#","#.PG..r.9$.5Fm.L.i.8X$c#c.3F..hc.*.5D.#","#7~-~7#43"],["#83","#.29#10.42#","#.22r.6#10.19cic.T.18#","#.20u.##.5#10..|..*.ur.9#6.18#","#.19i.6$..#10..|#9.19w.10#","#.19##.4##..#10..|.13##.24#","#.9$.7r.23|.28i.10#","#.17##.22|.11##.15##.9#","#.PGJ..r.6*.7F.9rrim.c.4|F.8$.7i.$.3Fc.^.4^.*.3D.#","#9~~#33~7#32"],["#95","#.36L.4#10.42#","#.36L.4#10.6i..T.32#","#.36L.4#10.6#5.8u.22#","#.10w.21k.3L.4#10.6##.13*.20#","#.31##.3L.4#10.6##.12#4.5$r.c.9#","#.11r.17c.6L.20##.9c..X..#.4#6.8#","#.11##.16##.5L.20##.9##.X..#..##.14#","#.PG.4^^.5^$Fc.9*.6h.L.$.3F$cim.$.6!.##.4$.F.5X$c#$.3^6.*.4D.#","#19~-~7#67"],["#71","#.28#.34#.5#","#.28#.17B.16#.5#","#.28#.34#.5#","#.9$.18#.8*.17*.7#.5#","#.9#3.24#3.15#3.12#","#.7r.16*.8G.7*.9*.7*.9#","#.6#3.23#3.5#3..L3..#3.5#3.8#","#.PG.11i.4**i.4F.18LTL.19D.#","#71"],["#71","#.69#","#.22cic.21o.11cic.T.6#","#.21#6.19##.9#6.6#","#.43r.6o.18#","#.19##.22##.4##.4##.12#","#.12r.23r.4o.27#","#.17##.22##.10##.14#","#.PGJ.3orr.11Fmr.o.5o*o.9F.mm.11ho.o.5D.#","#71"],["#71","#.69#","#.22oT.45#","#.22##.45#","#.19*.6o.42#","#.19##.4##.5**.o.33#","#.12o.4o.13#6.6*.3*.12r.8#","#.17##.10##.38#","#.PGJ.3**o.10Fmm.8^6.*..F..*o..o.6oomm.8D.#","#43~~##~~#22"],["#71","#.69#","#.22cic.21r.22#","#.21#6.19##.21#","#.43i.6o.6oT.10#","#.19##.11rr.*.7##.4##.6#3.9#","#.12o.18#6.4i.13r.13#","#.17##.10##.10##.11#3.12#","#.PGJ.3ior.10Fhhmm*.5^6.o.4F.15m..r.4D.#","#71"],["#71","#.69#","#.69#","#.69#","#.69#","#.20irTi.45#","#.12*.6#6.9r.10i.11*o.10#","#.17##.15##.19r#4.9#","#.PGJ.3ror.6F..^6.o.3o.^.4^.r..iF.5*.5#6.m.4D.#","#45~~#24"],["#71","#.69#","#.69#","#.69#","#.69#","#.32iiT*.20ri.i.9#","#.12*.9o.8#6.8i.9#6.8#","#.22##.5##.22##.14#","#.PGJ.3oo*.7Fr.^.4^.i.3^6.i.3*F.5r.5^6.*.4D.#","#45~~#24"],["#83","#.81#","#.81#","#.81#","#.33i.23rT.22#","#.33#3.21#3.21#","#.12r.9i.8i.11r.3i.7i.13r.11#","#.22##.6#3.21#3.24#","#.PGJ.3r*i.7F*.^.4^.r.7h3m..F..o*..i.10h..*..Fo.6*.5D.#","#43~~##~~#20~~#12"],["#83","#.81#","#.81#","#.81#","#.57rT.22#","#.44or.o.9#3.8i*.o.9#","#.12r.6r.3*.10i.8#6.6r.11#6.8#","#.34##.5##.11#3.8##.14#","#.PGJ.3irr.7F..ii..i.5r.^.4^.rF..^6.*.8m3h.F..^6.i.4D.#","#19~~##~~#58"],["#83","#.81#","#.81#","#.81#","#.69*T.10#","#.56ii.r.9#3.9#","#.12o.8i.9*.3o.12*.6#6.6i.13#","#.53##.11#3.12#","#.PGJ.3ooi.8*.3F..o.6oi..o.5Fohmhh.7^6.r..F.5hm.i.4D.#","#21~~#8~~##~~#46"],["#83","#.81#","#.46cic.T.30#","#.45#6.30#","#.81#","#.43##.23o*.*.9#","#.12i.8ii.10o.24r.8#6.8#","#.19*#4.17##.15##.5##.14#","#.PGJ.3*ro.8F#6.h.3i.6o.5F..mr.*.4*.^.4^.iF..^6.r.4D.#","#33~~#48"],["#83","#.81#","#.46cic.T.7o.22#","#.45#6.7##.21#","#.21*.33r.6o.6*.11#","#.21#3.19##.10##.4##.6#3.9#","#.12i.6*.13o.19i.13o.13#","#.18#3.20##.10##.11#3.12#","#.PGJ.3rio.11F.4r.3*.6o.5F..mr.*.7hm.6F.5hh.r.4D.#","#33~~#48"],["#83","#.81#","#.70iT.9#","#.70##.9#","#.67i.6i.6#","#.67##.4##.6#","#.12o.8*i.13o.9*.10ii.6i.15#","#.19o#4.22##.7*#4.5##.14#","#.PGJ.3oii.8F#6.m.4o*mh.6F*.^.4^.o.3#6.m.F.5m.8D.#","#83"],["#83","#.81#","#.22rT.57#","#.22##.57#","#.19*.6*.30*.23#","#.19##.4##.30#3.21#","#.12*.4r.15io.11i.8i.16o.8#","#.17##.12o#4.10##.6#3.24#","#.PGJ.3*or.10Fmm.8#6.h..F*.^.4^.i.7m..o..F.oiom.8D.#","#83"],["#83","#.81#","#.22o.58#","#.22##.57#","#.19*.6o.6iT.46#","#.19##.4##.6#3.45#","#.12r.4r.13i.16o.8ri.11*.10#","#.17##.11#3.22r#4.10##.9#","#.PGJ.3ror.10Fhh.12m..r.3F*omm.8#6.m..Fo.^.4^.o.3D.#","#83"],["#83","#.81#","#.81#","#.81#","#.69*T.10#","#.32i*.o.33#3.9#","#.12o.8io.8#6.9o.13i.6*.13#","#.19o#4.5##.15##.18#3.12#","#.PGJ.3ii*.8F#6.*.4^6.i..Fo.^.4^.*.3imhhmm.4F.5h..*.4D.#","#83"],["#83","#.81#","#.46cic.T.30#","#.45#6.30#","#.21r.59#","#.21#3.19##.11ir.*.21#","#.12r.6i.13r.21#6.8*i.10#","#.18#3.20##.10##.12o#4.9#","#.PGJ.3oio.11F.hm.o.3r.6*.5F.hmh.i.5^6.*..F.#6.m.4D.#","#33~~#48"],["#83","#.81#","#.22*T.34o.22#","#.22##.34##.21#","#.19i.6i.28i.6o.18#","#.19##.4##.28##.4##.18#","#.12r.4*.18r.6r.3o.5r.18r.8#","#.17##.34##.26#","#.PGJ.3i*o.11F.9*rim.6F..oi..i.9h.6F.irmhm.7D.#","#43~~##~~#34"],["#83","#.81#","#.81#","#.81#","#.45oT.34#","#.20oo.*.21#3.20*i.o.9#","#.12i.6#6.11r.6*.13oi.8#6.8#","#.17##.23#3.10*#4.5##.14#","#.PGJ.3rro.6F..^6.o.4orhh.6F.5hm.o.4#6.h.F..^6.i.4D.#","#83"],["#83","#.81#","#.30|.*.i.T.29|.o.r.10#","#.30|#7.28|#7.7#","#.30|.14*.20|.14#","#.30|.14#3.18|.14#","#.12o.9*.7|.12*.13r.8|.14#","#.22##.6|.11#3.21|.14#","#.PGJ.3oro.7Fr.^.4^.*..|..mm.i.4F.5h..i.3o.6r.3F|.h4*.6D.#","#57~~#24"],["#83","#.81#","#.30|.r.*.11cic.T.30#","#.30|#7.7#6.30#","#.30|.50#","#.30|.12##.23ii.i.9#","#.12*.6r.3*.6|.29*.6#6.8#","#.30|.10##.22##.14#","#.PGJ.3iri.7F..o*..i.5|..mh.o.6F.hhm.i.5orrh.5F..^6.o.4D.#","#19~~##~~#58"],["#119","#.76#.34#.5#","#.30|.*.o.19|.i.i.17#.17B.16#.5#","#.30|#7.16|#7.14#.34#.5#","#.30|.14r.8|.21#.8*.17*.7#.5#","#.30|.14#3.6|.29#3.15#3.12#","#.12r.8r.8|.12o.10|.15*.18*.9*.7*.9#","#.30|.11#3.9|.15##.8#3.5#3..L3..#3.5#3.8#","#.PGJ.3*or.8o.3F..o.4|..mh.i.4F.5mhhm.3|.5o.4F*.^.4^.i.17LTL.19D.#","#21~~#96"],["#83","#.81#","#.34*.7|.c.o.34#","#.34##.6|#7.15|..i..T.9#","#.22w.8i.6c.3|.22|#9.6#","#.31##.4##.3|.22|.15#","#.12c.8rr.6c.12|.14o.7|.15#","#.19o#4.5##.11|.22|.15#","#.PGJ.3ior.8F#6.c.7m.7|F.mm.r.5c.6o..F|.9r.3D.#","#57~~#9~7#8"],["#95","#.93#","#.34cic.5|.r.c.31|.r.r.10#","#.33#6.3|#7.28|#7.7#","#.20woT.19|.26*.8|.14#","#.21#3.7##.9|.26#3.6|.14#","#.12r.6r.22|.12r.3o.7r.10|.14#","#.18#3.8##.11|.23#3.9|.14#","#.PGJ.3rc*.11F.m3c.8o.o.4|F..m.r.7io..*.4F.8c.3|.3m.o.6D.#","#55~~##~~#34"],["#95","#.93#","#.34cic.45cT.9#","#.33#6.26|..*..i.10##.9#","#.45ww.18|#9.4c.w.4i.6#","#.31##.32|.13##.4##.6#","#.12o.6i.3c.21r.19|.11o.15#","#.29##.34|.11##.14#","#.PGJ.3irc.7F..cr..c.8mm*.*.4*F.5c.3i.9*F|.9c.15D.#","#19~~##~~#20~~#8~-~7#4~7#20"],["#95","#.29#10.14#10.30#","#.22*.6#10.7r.6#10.30#","#.22##.5#10.7##.5#10.14|..c..T.9#","#.19c.6i..#10.4c.w.4*..#10.14|#9.6#","#.19##.4##..#10.4##.4##..#10.14|.15#","#.12*.4o.23o.25c.3*.5|.15#","#.17##.22##.34|.15#","#.PGJ.3rio.10Fm3.7ior..r.6F..m.8**r..r.4F..ri..r.4|.9*.3D.#","#67~~##~~#7~7#8"],["#95","#.29#10.54#","#.22cic.4#10.19cic.T.3|.o.i.22#","#.21#6..#10.18#6.3|#7.3|..r..c.9#","#.29#10.6*.20|.10|#9.6#","#.19##.8#10.6#3.7##.9|.10|.15#","#.12*.30o.22|.10|.15#","#.17##.23#3.8##.11|.10|.15#","#.PGJ.3cio.11F.c.*.5cc*m.*.4F.5m..o.8r.r.3F|..m3r.4|.9c.3D.#","#80~7#8"],["#95","#.17#10.66#","#.17#10.31r.34#","#.17#10.14|..r..T.10##.33#","#.17#10.6ww.6|#9.4*.6*.7w.11w.10#","#.17#10.14|.13##.4##.30#","#.12c.28|.11i.15c.23#","#.41|.11##.38#","#.PGJ.3rr*.9rr*F.i.4*.9i.|F.8c.13Fo.6*.3o.9*.3D.#","#31~-~7#4~7#18~~#8~-~7#7"],["#95","#.93#","#.34r.19|.r.c.23*T.9#","#.34##.18|#7.20##.9#","#.31i.w..w.o.15|.14i.9*.w.4i.6#","#.31##.4##.15|.14#3.7##.4##.6#","#.12i.16*.13*.3r.6|.12i.9r.15#","#.29##.23|.11#3.8##.14#","#.PGJ.3r3.6Fo.9r.13F..oo..r.5|.3m.*.4F.8*.7m.8D.#","#19~-~7#15~~##~~#46"],["#95","#.29#10.54#","#.22cic.4#10.3|.*.o.T.33*.10#","#.21#6..#10.3|#7.32##.9#","#.29#10.3|.27w.8r.w.4o.6#","#.19##.8#10.3|.36##.4##.6#","#.12c.29|.14oc.10*.7c.15#","#.17##.23|.12r#4.17##.14#","#.PGJ.3cri.11F.i.o.5o*c..o.5|F..m.o.6#6.m..F*.6*.8m.8D.#","#69~~#24"],["#95","#.29#10.54#","#.29#10.43rT.9#","#.29#10.26|..o..i.10##.9#","#.29#10.26|#9.4c.w.4c.6#","#.29#10.26|.13##.4##.6#","#.12*.30r.3o.9*.7|.11*.15#","#.65|.11##.14#","#.PGJ.3ori.6F*.9*.3r*rm.i.4F..io..*.5c.6o..F|.9o.5m4.6D.#","#19~-~7#15~~##~~#8~~#9~7#20"],["#95","#.93#","#.93#","#.17|..i..c.29|..*..i.33#","#.17|#9.7w.18|#9.5woT.10ww.10#","#.17|.35|.15#3.21#","#.12r.4|.27o*.6|.13r.25#","#.17|.25r#4.5|.12#3.24#","#.PGJ.3rii.7|F.8*.*.9*..F#6.m..|.9*.F.5m..o..r.9c.3D.#","#20~7#4~-~7#16~7#16~-~7#7"],["#95","#.53#10.30#","#.18|.*.c.23cic.4#10.3|.r.o.T.20#","#.18|#7.3|..r..i.9#6..#10.3|#7.19#","#.18|.10|#9.14#10.3|.26#","#.18|.10|.13##.8#10.3|.26#","#.12i.5|.10|.36|.14i.11#","#.18|.10|.11##.23|.26#","#.PGJ.3icc.8|..Fm.r.4|.9i.3F.mmc.o.5o*mm.o.4F|.5c.5r.6o.5D.#","#32~7#42~~#12"],["#95","#.84L.8#","#.58cic.T.21L.8#","#.29|..i..r.21#6.21L.8#","#.22w.6|#9.30c.10k.3L.8#","#.29|.25##.12#3.7##.3L.8#","#.12i.8rr.6|.16c.20c.9c.6L.8#","#.19r#4.5|.13i..##..i..##.11#3.8##.5L.8#","#.PGJ.3*oc.8F#6.m..|.9c..F#.r##..#.6mmc.i.3F.5m..c.7m.L.o.4D.#","#32~7#56"],["#95","#.93#","#.30|.i.c.31|.r.o.22#","#.30|#7.3|..o..T.18|#7.19#","#.20wr.8|.10|#9.15|.26#","#.21#3.6|.10|.24|.26#","#.12*.6r.10|.10|.13o.3o.6|.14r.11#","#.18#3.9|.10|.24|.26#","#.PGJ.3icr.11F.mm.c.3|..mm.r.4|F.8i.4ir..r.4F|.3m.r.5r.6o.5D.#","#44~7#4~~##~~#20~~#12"],["#95","#.24L.68#","#.24L.57cT.9#","#.24L.57##.9#","#.20k.3L.8ww.9w*.33i.6c.6#","#.19##.3L.20#3.31##.4##.6#","#.12i.4o.6L.8o.9*.13i.9c.3o.5c.15#","#.17##.5L.17#3.32##.14#","#.PGJ.3ooi.11Fm.L.c.3r.6c.3F.5m..r.3c.6*.3F..cc..r.18D.#","#33~~#22~~#8~~##~~#22"],["#107","#.105#","#.90|.c.*.10#","#.44u.u.43|#7.7#","#.21ww.23w.21wcT.w.17|.14#","#.69#3.18|.14#","#.12o.8*.12r.10c.21*.13c.8|.14#","#.31*..##..r.27#3.21|.14#","#.PGJ.3rri.8c.3F..c.5#.r##..#.3rF.5r.3r.9r.F.8*.3i.6*.F..|.5r.6D.#","#21~~#22~~#8~-~7#17~~#24"],["#107","#.105#","#.46*.58#","#.46##.46u.10#","#.21c.21c.6r.6cT.11w.22ww.10#","#.21#3.19##.4##.6#3.45#","#.12o.6i.13*r.6o.13o.11i.3c.9i.9o.3r.9#","#.18#3.10c#4.5##.11#3.48#","#.PGJ.3rir.11F.4o.4#6.m.4F.18o..F..*o..c.5c.6o.F.4ro..*.6D.#","#67~~##~~#8~~#8~~##~~#10"],["#107","#.48L.56#","#.48L.33uic.20#","#.22u.23u.L.16|..r..r.9#6.18#","#.32wiT.9k.3L.16|#9.18ww.10#","#.33#3.7##.3L.16|.13##.24#","#.12o.6i.3*.7r.9o.6L.8i.7|.28c.10#","#.30#3.8##.5L.16|.11##.12c..##..c.6#","#.PGJ.3*ci.7F..or..o.10m..i.4F..o.L.i.3*.6r..F|.9r.7*.i.F.3#.r##..#.4D.#","#19~~##~~#32~~#9~7#32"],["#107","#.36L.68#","#.22cic.11L.17|.r.u.11c.19|.i.i.10#","#.21#6.9L.17|#7.8##.10u.7|#7.7#","#.32k.3L.17|.12o.6*.6rT.7|.14#","#.19##.10##.3L.17|.12##.4##.6#3.6|.14#","#.12o.16*.6L.17|.10r.13o.10|.14#","#.17##.10##.5L.17|.10##.11#3.9|.14#","#.PGJ.3cii.11Fmc.c.8m.L.i.F*.9i..|.3m.o.3F.5m.12m..oF..|.5i.6D.#","#43~-~7#55"],["#107","#.17#10.9L.68#","#.17#10.9L.45cic.T.7r.10#","#.17#10.7u.L.33u.10#6.7##.9#","#.17#10.5kw.wL.32w.21r.w.4r.6#","#.17#10.4##.3L.42##.10##.4##.6#","#.12r.16c.6L.8r.23ci.18o.15#","#.29##.5L.30r#4.5##.10##.14#","#.PGJ.3r*o.9*crmF*.9i.L.o.3oF.5i.3*.9r.F.#6.r.8r.o.F.15D.#","#45~~#8~-~7#43"],["#131","#.36L.51#.34#.5#","#.36L.21c.29#.17B.16#.5#","#.36L.21##.22u.5#.34#.5#","#.22w.9k.3L.9w.8o.6*.7w.17#.8*.17*.7#.5#","#.31##.3L.18##.4##.33#3.15#3.12#","#.12r.16c.6L.8*.7c.15*r.10o.19*.9*.7*.9#","#.29##.5L.16##.12*#4.20#3.5#3..L3..#3.5#3.8#","#.PGJ.3cir.6F*.9i.6o.L.r.3rF.5i.7mm.6F.#6.m.3o.6cFF.17LTL.19D.#","#19~-~7#17~~#34~~#48"],["#95","#.41#10.42#","#.30|.r.u.T.4#10.42#","#.30|#7.3#10.42#","#.30|.10#10.6*.35#","#.30|.10#10.6#3.33#","#.12c.9c.7|.24$.13c.12c.10#","#.19*..##..o.3|.23#3.22$..##..r.6#","#.PGJ.3c$o.9#Fo##..#.3|..hhmc.5Fiir..c.10h..c..F$.6$.5#.*##..#.4D.#","#69~~#24"],["#95","#.84L.8#","#.57$..*.9cic.T.9L.8#","#.22u.34#5.7#6.7u.L.8#","#.45$.11##.21k.3L.8#","#.45#3.9##.8##.10##.3L.8#","#.12r.9i.20o.13##.18r.6L.8#","#.19c..##..$.15#3.12##.6##.10##.5L.8#","#.PGJ.3i$c.9#F*##..#..*.9$.F.8i.4!.##.4iF.4mh*.o.8m.L.i.4D.#","#31~-~7#55"],["#95","#.41#10.42#","#.33r..*.4#10.30cu.$.8#","#.33#5.3#10.5u.u.11u.10#5.7#","#.33##.6#10.18cT.10##.10#","#.33##.6#10.5**.o.9#3.9##.10#","#.12r.8$.11##.20#6.6c.13##.10#","#.33##.18##.11#3.12##.10#","#.PGJ.3cic.8i.3F..*.5!.##.4$..Fii*h.$.6^6.*..F.5m..c.4!.##.4r.3D.#","#21~~#72"],["#95","#.60L.32#","#.34$.25L.9cic.T.18#","#.34##.20u.u.L.8#6.18#","#.21r.9c.6c.17k.3L.32#","#.21#3.7##.4##.5$i.r.7##.3L.6##.24#","#.12*.6*.9r.13#6.4o.6L.20r.11#","#.18#3.8##.10##.10##.5L.4##.26#","#.PGJ.3cc$.11F.hm.o.13F..^6.c.7h.L.c.F.6$.*.4i.6i.5D.#","#81~~#12"],["#83","#.81#","#.34i.46#","#.32u.##.10u.21u.u.10#","#.31c.6r.9$.20iT.10#","#.20rr.i.7##.4##.8#4.18#3.9#","#.12i.6#6.4r.14c..X..#.6c.9*.13#","#.17##.10##.13##.X..#.15#3.12#","#.PGJ.3*rr.6F..^6.i.16F.3X$c#$..$.6$.3F.5h..c.4D.#","#57~~#24"],["#83","#.60L.4#10.6#","#.30|.o.c.T.7u*u.r.11L.4#10.6#","#.22u.7|#7.7#5.8u.L.4#10.6#","#.30|.14##.9k.3L.4#10.6#","#.30|.14##.8##.3L.4#10.6#","#.12c.17|.14##.6c.6L.20#","#.30|.14##.6##.5L.20#","#.PGJ.3ri*.6Fi.9c..|.5o.5F!.##.4r.6h.L.*..F.ioi..i.6D.#","#19~-~7#55"],["#83","#.72L.8#","#.20ucu.*.9uic.35L.8#","#.21#5.7#6.5u.u.25L.8#","#.21##.37$T.6k.3L.8#","#.21##.8##.26#4.4##.3L.8#","#.12*.8##.22o.10r..X..#..c.6L.8#","#.21##.6##.25##.X..#..##.5L.8#","#.PGJ.3$r*.9!F##.4$.6ho.i.4$F.5r.9X$c#cF.5m.L.r.4D.#","#45~~#36"],["#83","#.41#10.30#","#.18|.o.r.11uic.T..#10.7u.22#","#.18|#7.7#6..#10.5u.##.21#","#.18|.22#10.4r.6i.18#","#.18|.12##.8#10.4##.4##.18#","#.12r.5|.34c.17c.9#","#.18|.10##.22##.16##.8#","#.PGJ.3$$c.8|.Fhm.r.10$.i.4F$oom.$.16F.^^.5^r.3D.#","#83"],["#95","#.29#10.9L.44#","#.20u.uic.4#10.9L.5|.o.o.11cic.T.7i.10#","#.21#6..#10.7u.L.5|#7.7#6.5u.##.9#","#.29#10.5k.w.L.5|.24o.6$.6#","#.19##.8#10.4##.3L.5|.12##.10##.4##.6#","#.12$.28r.6L.5|.22$.15#","#.17##.22##.5L.5|.10##.10##.14#","#.PGJ.3ro*.11F.o.o.5or$m.i.6F..c.L.$.3|.5*.3F.6$.o.8m.8D.#","#95"],["#95","#.17#10.26#10.21L.8#","#.17#10.19$T.5#10.21L.8#","#.17#10.19##.5#10.5u.u.11u.L.8#","#.17#10.16i.w.4o..#10.9i.7k.3L.8#","#.17#10.16##.4##..#10.8#4.4##.3L.8#","#.12i.22*.5i.26r..X..#..o.6L.8#","#.35##.4##.25##.X..#..##.5L.8#","#.PGJ.3ooc.9orrF.*.6^^.5^*.3F.11comh.$.4F.5X$c#o.6*.L.i.4D.#","#95"],["#95","#.93#","#.93#","#.34u.23u.34#","#.22w.cT.20w.14w.20w.o.8#","#.23#4.29oo.c.23#4.6#","#.12o.7*..X..#.8r.19#6.8o.10$..X..#.6#","#.20##.X..#.8##.16##.25##.X..#.6#","#.PGJ.3$$*.9F.3X$c#c.3^^.5^$Fi.9c.3^6.o..Fo.6o.9X$c#c.3D.#","#43~-~7#17~~#24"],["#95","#.24L.68#","#.24L.53|.u.u.u.8#","#.24L.21u.31|#7.7#","#.20k.3L.11rT.8w.31|.14#","#.19##.3L.10#4.29$i.o.6|.14#","#.12i.4c.6L.7r..X..#.7c.12*.7#6.5|.14#","#.17##.5L.7##.X..#.4o..##..r.8##.4##.11|.14#","#.PGJ.3cc$.11Fr.L.$.8X$c#o..F#.i##..#.4^^.5^cF..^6.$.3|..hm.$.6D.#","#95"],["#95","#.36L.56#","#.36L.5|.$.r.35iT.9#","#.20u.u.13L.5|#7.30u.##.9#","#.32k.w.L.5|.14c.21*.6c.6#","#.31##.3L.5|.14#3.8rc.$.7##.4##.6#","#.12o.9c.6r.6L.5|.12c.11#6.4i.15#","#.19$..##..o..##.5L.5|.11#3.8##.10##.14#","#.PGJ.3*io.9#F$##..#.7r.L.$.3|F..m.$.10m..r.F..^6.o.7h.8D.#","#95"],["#95","#.36L.40#10.6#","#.36L.40#10.6#","#.36L.9u.11u.11u.6#10.6#","#.32k.3L.8$T.10w.w.17#10.6#","#.31##.3L.8#3.29#10.6#","#.12*.8c.7i.6L.6*.14i.12$.21#","#.29##.5L.5#3.10r..##..*.8##.20#","#.PGJ.3ic*.8c.3F..o.8r.L.r..F.5m..i.4#.$##..#..F.^^.5^c.3irc..r.6D.#","#21~~#72"],["#95","#.24L.16#10.42#","#.24L.16#10.31uic.8#","#.22u.L.16#10.7u.11u.10#6.6#","#.20k.3L.16#10.7w.rT.7w.23#","#.19##.3L.16#10.8#4.16##.12#","#.12c.4c.6L.9$.21i..X..#.30#","#.17##.5L.6c..##..o.17##.X..#.14##.14#","#.PGJ.3cic.11Fh.L.$.4#.r##..#.3Fro*..$.10X$c#rFi.9o.7i.i.5D.#","#67~-~7#19"],["#95","#.93#","#.93#","#.22u.47u.9u.u.10#","#.46w.11w.13cT.7i.11#","#.20ri.*.47#4.6#3.9#","#.12i.6#6.8c.25o.8c..X..#.4o.13#","#.17##.40##.7##.X..#.3#3.12#","#.PGJ.3$*$.6F..^6.r.3i.6*..Fo.9r.3^^.5^i.F.5X$c#o.7m..c.4D.#","#33~~#8~-~7#43"],["#95","#.48L.44#","#.48L.9uic.T.30#","#.22u.23u.L.8#6.7u.22#","#.44k.3L.21w.22#","#.43##.3L.6##.23oc.i.9#","#.12i.20o.7*.6L.30#6.8#","#.41##.5L.4##.22##.14#","#.PGJ.3cii.6Fi.9*..*.6*.5F..i.L.*.7hi.c..Fo.9c.3^6.c.4D.#","#19~-~7#5~~#32~-~7#19"],["#95","#.77#10.6#","#.22u.23o.23c.6#10.6#","#.20u.##.22##.10u.11##.5#10.6#","#.19*.w..w.i.6c.9*.6*.9*T.5c.6*..#10.6#","#.19##.4##.6#3.7##.4##.8#4.4##.4##..#10.6#","#.12*.4i.13r.9*.14i..X..#..c.27#","#.17##.11#3.8##.13##.X..#..##.26#","#.PGJ.3o$*.11F.13h..*.4F..m.12X$c#cF.14i*i..c.6D.#","#95"],["#95","#.36L.28#10.18#","#.18|.*.u.13L.19ucu.T.4#10.6iu.c.8#","#.18|#7.10L.20#5.3#10.6#5.7#","#.18|.13k.3L.19w##.6#10.5w##.10#","#.18|.12##.3L.20##.6#10.6##.10#","#.12i.5|.10o.6L.8o.11##.22##.10#","#.18|.10##.5L.20##.22##.10#","#.PGJ.3icc.8|..F..r.9m.L.*.3$F.5i.5!.##.4$.F.*ocm.o.6!.##.4c.3D.#","#45~~#48"],["#131","#.72L.15#.34#.5#","#.22uic.19u.uic.23L.15#.17B.16#.5#","#.21#6.7u.10#6.7u.13L.15#.34#.5#","#.37w.30k.3L.8c.6#.8*.17*.7#.5#","#.19##.11oo.$.7##.11**.r.7##.3L.8#3.12#3.15#3.12#","#.12$.18#6.18#6.4*.6L.6r.21*.9*.7*.9#","#.17##.10##.10##.10##.10##.5L.5#3.11#3.5#3..L3..#3.5#3.8#","#.PGJ.3**c.11F.c.$.5^6.c.4F.3o.$.5^6.r.F.5o.L.$.10F$F.17LTL.19D.#","#131"],["#83","#.81#","#.22uic.T.18ru.o.20$..$.8#","#.21#6.18#5.19#5.7#","#.34w.10##.22##.10#","#.19##.24##.22##.10#","#.12r.20*c.10##.13*.8##.10#","#.17##.12*#4.9##.22##.10#","#.PGJ.3*o*.10Fmhr.c.5#6.m.3F!.##.4r.3*$o.7F.!.##.4c.3D.#","#83"],["#83","#.72L.8#","#.72L.8#","#.70u.L.8#","#.22w.10iT.11w.21k.3L.8#","#.33#3.31##.3L.8#","#.12r.10*.7r.15$.17c.6L.8#","#.23##.5#3.14##.16##.5L.8#","#.PGJ.3rrc.9^^.F.3^c.7h..c..F.^^.5^r.i.9$F.4h3L.r.4D.#","#55~-~7#19"],["#83","#.24L.56#","#.24L.56#","#.24L.56#","#.20k.w.L.21w.13rT.7ww.10#","#.19##.3L.34#4.18#","#.12$.4r.6L.11i.6o.3o.8c..X..#.6$.11#","#.17##.5L.31##.X..#.18#","#.PGJ.3ic*.11Fh.L.c.4i$r.7F..**..$.10X$c#i.Fr.6c.5D.#","#43~~##~~#20~~#12"],["#95","#.93#","#.58cic.21cic.T.6#","#.57#6.18#6.6#","#.22w.26w.43#","#.44o$.$.7##.11c*.$.7##.12#","#.12r.23*.6#6.18#6.20#","#.41##.10##.10##.10##.14#","#.PGJ.3rro.6Fc.9c.3ocrm.5F..^6.i.7mo.r..F..^6.r.6hhc.o.5D.#","#19~-~7#67"],["#95","#.84L.8#","#.21cu.o.33c.25L.8#","#.21#5.8u.23##.10u.13L.8#","#.21##.23w.$T.5i.6$.6ww.9k.3L.8#","#.21##.24#4.4##.4##.16##.3L.8#","#.12*.8##.8c.3*.8*..X..#..*.13$.3c.5r.6L.8#","#.21##.21##.X..#..##.22##.5L.8#","#.PGJ.3oro.9!F##.4*.4rc..$.6F.3X$c#c.13F..rc..*.9*.L.*.4D.#","#31~~##~~#30~~##~~#22"],["#95","#.93#","#.81*..r.8#","#.20u.u.11u.35u.10#5.7#","#.21w.14*.8ww.13$T.19##.10#","#.35#4.20#4.5$*.c.9##.10#","#.12r.8i.10$..X..#.6c.10r..X..#.4#6.8##.10#","#.32##.X..#.17##.X..#..##.14##.10#","#.PGJ.3io$.8r.3F..c.9X$c#*..rF.5o.9X$c#*F..^6.$.4!.##.4o.3D.#","#21~~#22~~#48"],["#95","#.93#","#.46cic.44#","#.22u.22#6.19u.22#","#.21w.14o.21w.10w..$T.7r.11#","#.35#4.4##.26#4.6#3.9#","#.12o.8oi.9*..X..#.21o.7$..X..#.4i.13#","#.19$#4.8##.X..#..##.25##.X..#.3#3.12#","#.PGJ.3c$*.8F#6.m.8X$c#c.3F.3i.r.5$$*.7F.5X$c#$.10i.4D.#","#95"],["#107","#.17#10.38#10.30#","#.17#10.38#10.18o..T.8#","#.17#10.19u.9u.u.6#10.5u.u.10#5.7#","#.17#10.6i.26*.4#10.6w..$.8##.10#","#.17#10.6#3.23#4..#10.8#4.6##.10#","#.12i.18*.24*..X..#.17*..X..#.6##.10#","#.30#3.23##.X..#.17##.X..#.6##.10#","#.PGJ.3ri*.9o*$F.c.10h..o.F*.9o.7X$c#*.F.iri..$.10X$c#cF..!.##.4i.3D.#","#43~-~7#55"],["#107","#.48L.56#","#.34*.13L.33uic.20#","#.34##.12L.32#6.7u.10#","#.31o.6$.5k.w.L.9w.13i.20iT.10#","#.31##.4##.4##.3L.22#4.4##.12#3.9#","#.12$.6*.3r.5*.11c.6L.8r.10o..X..#.16r.13#","#.29##.10##.5L.19##.X..#..##.11#3.12#","#.PGJ.3$o$.7F..ir..r.18F..h.L.o.3*.6r.3F.5X$c#o.5hmr.$.F.10$.4D.#","#19~~##~~#32~~#48"],["#107","#.96L.8#","#.34oT.60L.8#","#.20u.u.11##.60L.8#","#.24i.6c.w..w.i.34w.18k.w.L.8#","#.23#4.4##.4##.29rc.c.19##.3L.8#","#.12i.7$..X..#..*.13c.3o.19#6.16r.6L.8#","#.20##.X..#..##.34##.22##.5L.8#","#.PGJ.3oio.9F.3X$c#$.13F..oi..o.4i.9oF..^6.$..i.9$F.5i.L.$.4D.#","#43~~##~~#6~-~7#15~-~7#19"],["#107","#.65#10.30#","#.22u.11cic.8*u.o.16#10.19iT.9#","#.20u.##.9#6.6#5.8u.6#10.7u.11##.9#","#.19r.6$.17w##.14w.3#10.16$.6c.6#","#.19##.4##.4##.12##.9ir.o.5#10.16##.4##.6#","#.12*.4r.27##.8#6.20r.7r.15#","#.17##.10##.14##.6##.34##.14#","#.PGJ.3coi.11F.13r.o.4F!.##.4o.3^6.r..F.cco..*.5c.6i.F.15D.#","#81~~#24"],["#107","#.105#","#.22cic.21c.22c..T.32#","#.21#6.7u.9u.##.21#5.18u.u.10#","#.34w.8i.6i.18##.22r.11#","#.19##.22##.4##.18##.22#3.9#","#.12r.22o.5*.17o.9##.13i.6i.13#","#.17##.16##.4##.16##.8##.19#3.12#","#.PGJ.3*ii.11F.*.r.5^^.5^i.3F..h.8^^.5^c.F.!.##.4c.3iorm.4F.10c.4D.#","#107"],["#107","#.77#10.9L.8#","#.56u.u.10c..T.4#10.9L.8#","#.56u.##.9#5.3#10.5u.u.L.8#","#.24c.30c.6i.6##.6#10.5k.3L.8#","#.23#4.28##.4##.6##.6#10.4##.3L.8#","#.12*.7*..X..#.18c.7o.15##.18i.6L.8#","#.20##.X..#.26##.14##.18##.5L.8#","#.PGJ.3ror.9F.3X$c#r.i.9i..rF.5$.15F.!.##.4o.3crmh.o..F.6h.L.c.4D.#","#31~-~7#5~~#60"],["#107","#.36L.16#10.42#","#.36L.16#10.6c..r.9uic.9*T.9#","#.36L.7u.u.u.4#10.6#5.7#6.7##.9#","#.32k.3L.9w.6#10.6##.20o.6$.6#","#.20*i.o.7##.3L.16#10.6##.8##.10##.4##.6#","#.12*.6#6.4$.6L.10i.21##.18*.15#","#.17##.10##.5L.10##.20##.6##.10##.14#","#.PGJ.3oro.6F..^6.$.7i.L.i..F.^^.5^i.3co$..o.4F.!.##.4$.6m*.c.F.15D.#","#107"],["#107","#.105#","#.58cT.45#","#.34u.11u.9u.##.10u.23u.10#","#.37w.17$.6o.42#","#.32ic.$.19##.4##.5ci.*.33#","#.12i.18#6.6i.3i.5*.13#6.6*.3o.12c.8#","#.29##.22##.10##.38#","#.PGJ.3*r$.6Fr.9*.3^6.*..F..oi..i.8mm.5F..^6.r.5**..o..F.3$ii.9D.#","#19~-~7#15~~##~~#30~~##~~#22"],["#107","#.105#","#.21i..o.56*..$.20#","#.21#5.8u.23u.22#5.8u.10#","#.21##.14w.8w.23w.10##.11w.*T.7#","#.21##.9i$.$.45##.12#4.6#","#.12i.8##.8#6.23$.8r.11##.9*..X..#.6#","#.21##.6##.50##.9##.X..#.6#","#.PGJ.3ici.9!F##.4i.3^6.o.Fo.9o.3$o*h.6F$.6$.5!.##.3Fc.7X$c#*.3D.#","#43~-~7#17~~#36"],["#107","#.41#10.54#","#.41#10.19$T.33#","#.22u.18#10.7u.11##.22u.10#","#.41#10.16i.6r.30#","#.41#10.16##.4##.30#","#.12i.8i$.34i*.6r.18$.10o.9#","#.19i#4.31o#4.5##.28##.8#","#.PGJ.3$ri.8F#6.r..$.9r..Foiih.$.6#6.$.F.4mm.8cich.4F.3^^.5^*.3D.#","#31~-~7#67"],["#119","#.77#10.30#","#.33*..c.19uru.u.16#10.30#","#.33#5.8u.10#5.15#10.30#","#.21$T.9w##.20w.##.11w.6#10.9*.20#","#.21#3.9##.22##.18#10.8#4.18#","#.12i.6$.13##.10o.11##.10$.22r..X..#.6i.11#","#.18#3.12##.22##.33##.X..#.18#","#.PGJ.3$oc.11F.4i.4!.##.4$..oF.5o.5!.##.4*.Fi.6i.5*c*..$..F.7X$c#$..r.6o.5D.#","#45~~#22~~#34~~#12"],["#119","#.117#","#.34cic.21cic.T.54#","#.20u.u.10#6.7u.10#6.7u.35u.10#","#.21w.95#","#.31##.22##.60#","#.12*.8o.49$.9r*.10o.9c.3c.9#","#.29##.22##.16##.6$#4.33#","#.PGJ.3iic.8o.3F..$.9c.c..Fi.9*.6m$.o.3F.^^.5^o.3#6.hF..o.6r.6c*..o.6D.#","#21~~#20~-~7#41~~#8~~##~~#10"],["#155","#.60L.35L.15#.34#.5#","#.60L.35L.9cic.3#.17B.16#.5#","#.46u.13L.9u.23u.L.8#6.#.34#.5#","#.22w.23w.9k.3L.9w.21k.3L.15#.8*.17*.7#.5#","#.55##.3L.19*c.$.7##.3L.6##.15#3.15#3.12#","#.12$.6*.3*.9*.14o.4r.6L.8ri.8#6.4*.6L.28*.9*.7*.9#","#.53##.5L.6*#4.5##.10##.5L.4##.13#3.5#3..L3..#3.5#3.8#","#.PGJ.3rr$.7F..ci..o.5c.6c.4F*ro.12i.L.c..F.#6.h.4^6.rF.6$.L.o.8$F*F.18LTL.19D.#","#19~~##~~#8~~#120"],["#107","#.105#","#.22cic.T.51|.i.o.22#","#.21#6.31u.11u.7|#7.19#","#.78|.26#","#.19##.57|.13o*.o.9#","#.12*.20r.11oi.8o.3i.10*.7|.12#6.8#","#.17##.24r#4.22##.6|.10##.14#","#.PGJ.3i*i.10Fmm*.r.4o.6r.4F#6.m.5*i..i.4Fr.^.4^.r..|.3m.r..F.3^6.i.4D.#","#33~~#20~~##~~#46"],["#107","#.105#","#.46cic.T.54#","#.45#6.31u.22#","#.34w.35w.9w*.23#","#.43##.11*r.r.21#3.21#","#.12*.9r.10*.21#6.8i.9i.13i*.10#","#.22##.17##.10##.23#3.10o#4.9#","#.PGJ.3ooi.7F*.^.4^.*..r.6r.5F.hmi.r.5^6.*..F*.6*.9m..rF.3#6.*.4D.#","#33~~#34~~#36"],["#107","#.105#","#.58cic.T.42#","#.22u.23u.10#6.42#","#.46w.23w.22*.11#","#.55##.23ro.o.9#3.9#","#.12r.6i.3r.9**.13r.18i.3r.7#6.6i.13#","#.31o#4.17##.22##.11#3.12#","#.PGJ.3r3.7F..i*..*.6#6.h.3F*ii.12h*.r.3F..oo..i.6^6.iF.10*.4D.#","#19~~##~~#42~~##~~#34"],["#107","#.105#","#.105#","#.46u.58#","#.22w.10r.11w.11iT.35w.10#","#.33#3.21#3.45#","#.12r.8o.9o.14r.8r.13r*.8o.3i.10o.10#","#.30#3.13##.6#3.10*#4.22##.9#","#.PGJ.3rir.8*.3F..o.9mh.i..Fo.^.4^.r.10r..F.#6.*.5oi..r..F..*.^.4^.o.3D.#","#21~~#56~~##~~#22"],["#107","#.105#","#.105#","#.22u.35u.46#","#.33r.12w.22iT.34#","#.33#3.33#3.33#","#.12r.8*r.8r.13i.9o.3o.7r.13*.11o*.10#","#.19i#4.6#3.33#3.22o#4.9#","#.PGJ.3r3.8F#6.*.8mm.r.3oF.5i.6o*..r.4F.5h..r.3i.6i.F.3#6.*.4D.#","#45~~#8~~##~~#20~~#24"],["#107","#.105#","#.34*.19|.o.r.46#","#.32u.##.18|#7.8u.23u.10#","#.21rT.8o.6*.7w.7|.50#","#.21#3.7##.4##.15|.50#","#.12*.6r.9r.15r.8|.14**.10*.14*.8#","#.18#3.8##.23|.12o#4.33#","#.PGJ.3roi.11F.m..o.15oF.5i.4|.3h.i.4F.#6.*.3*.6i.F.3r3.9D.#","#45~~#34~~#24"],["#107","#.105#","#.18|.*.u.11uic.9iT.57#","#.18|#7.7#6.5u.##.57#","#.18|.24o.6*.6o.23i.23#","#.18|.12##.10##.4##.6#3.21#3.21#","#.12o.5|.22o.13i.13o.9i.11r.3o.9#","#.18|.10##.10##.11#3.21#3.24#","#.PGJ.3ooi.8|..F..i.8mm*.*.5F..h.15i..F*.6r.12oF.4oo..*.6D.#","#69~~#20~~##~~#10"],["#107","#.105#","#.34uic.57r.10#","#.33#6.19u.33u.##.9#","#.22w.22o.23*T.20*.6o.6#","#.31##.12#3.21#3.8io.*.7##.4##.6#","#.12o.8*.21r.13oi.8i.11#6.4i.15#","#.29##.11#3.10i#4.6#3.8##.10##.14#","#.PGJ.3r*o.8*.3F..r.8mo.i.3F.8*.4#6.i..F.8i.4^6.oF.5mh.8D.#","#21~~#84"],["#107","#.105#","#.66|.o.u.11oT.21#","#.46u.11u.7|#7.6u.##.10u.10#","#.58w.7|.12*.6*.18#","#.32ii.*.30|.12##.4##.18#","#.12o.8**.8#6.6o.3r.9o.8|.10r.16i.10#","#.19i#4.5##.35|.10##.15##.9#","#.PGJ.3*ii.8F#6.i.4^6.r..F..rr..*.5r.6i.3F|.5*.14F..*.^.4^.r.3D.#","#43~~##~~#8~~#48"],["#107","#.105#","#.105#","#.20u.u.11u.70#","#.20wiT.46*.12w.22#","#.21#3.8*o.r.33#3.33#","#.12i.6r.11#6.8*.12i.8i.13o.9*.3r.9#","#.18#3.8##.27##.6#3.36#","#.PGJ.3o3.11F.m..i.4^6.*.3oF.5*.4*.^.4^.i.F.8*.3o.6o.F.4or..o.6D.#","#45~~#34~~#8~~##~~#10"],["#95","#.93#","#.22oT.34cic.32#","#.20u.##.33#6.5u.u.22#","#.19o.6o.42ww.22#","#.19##.4##.28##.36#","#.12i.4i.16r.8*.3r.21i*.10r.11#","#.17##.15##.17##.12*#4.21#","#.PGJ.3*ir.11F.8i.^.4^.o.F..oo..i.9m*.*.3F.#6.h.3r.6i.5D.#","#43~~##~~#32~~#12"],["#107","#.105#","#.58*.23iT.21#","#.58##.22##.21#","#.25w.8w.10o.9r.w.4*.5wr..w.6o.6*.18#","#.20ii.o.21#3.7##.4##.6#3.7##.4##.18#","#.12i.6#6.6*.3o.7i.9i.13*.9r.15*.11#","#.17##.23#3.8##.11#3.8##.26#","#.PGJ.3rro.6F..^6.i.5**..o.4F.5h..*.14F.5h..*.7m.4F..i.6i.5D.#","#31~~##~~#56~~#12"],["#107","#.105#","#.105#","#.34u.70#","#.21ww.23w.14w.18wrT.22#","#.56ri.o.21#3.21#","#.12r.9i.8o.3*.9ro.8#6.8rr.8i.14*.10#","#.22##.19*#4.5##.12*#4.6#3.13##.9#","#.PGJ.3o*r.7Fr.^.4^.o.4r*..r.5F#6.h.4^6.o..F.#6.m.11*F..i.^.4^.*.3D.#","#31~~##~~#70"],["#107","#.105#","#.46cic.21rT.33#","#.22u.22#6.19##.22u.10#","#.21w.w.10w.32o.w..w.o.30#","#.43##.22##.4##.17*i.o.9#","#.12i.6r.3i.9i.23r.7*.15o.9#6.8#","#.41##.22##.22##.14#","#.PGJ.3*ro.7F..oo..r.5*.6r.5F.3o.r.4i.6o..F.13i.6r.F.3^6.o.4D.#","#19~~##~~#8~~#22~~#22~~#24"],["#107","#.105#","#.42|.*.o.T.56#","#.42|#7.32u.22#","#.42|.25w*.11w.23#","#.42|.26#3.33#","#.12o.8i.11r*.7|.17o.6i.16r.8r*.10#","#.31o#4.6|.23#3.22*#4.9#","#.PGJ.3i*i.8o.3F..o.5#6.m.3|F.4i.6r*rm.6F.5m..*.4*rih.4F.3#6.m.4D.#","#21~~#84"],["#107","#.105#","#.70i.34#","#.34u.35##.10u.22#","#.21r.36w.8o.6i.17wiT.10#","#.21#3.43##.4##.18#3.9#","#.12i.6c.13ro.11r.10oo.6c.15*.9o.13#","#.18#3.10r#4.10##.7*#4.5##.23#3.12#","#.PGJ.3*i*.11F.h..*.4#6.*..F*.^.4^.c.3#6.m.F.13r.6i.F.7m..o.4D.#","#81~~#24"],["#107","#.105#","#.70o.34#","#.70##.33#","#.20woT.w.9w.21wc.9c.w.4*.30#","#.21#3.33#3.7##.4##.30#","#.12r.6i.13*o.10*.9i.9r.16i.8*.3c.9#","#.18#3.10c#4.18#3.8##.15##.21#","#.PGJ.3cro.11F.m..c.4#6.m.3oF.5*.12i.F.13o.^.4^.rF.3ir..o.6D.#","#45~~#44~~##~~#10"],["#107","#.105#","#.18|.o.c.47cic.T.30#","#.18|#7.43#6.30#","#.18|.15w.47w.11w.10#","#.18|.48##.36#","#.12i.5|.17o.8o*.11*.23i.10i*.10#","#.18|.24*#4.10##.5##.15##.7c#4.9#","#.PGJ.3r*r.8|..F..o.6ormm.7F#6.c.3r.^.4^.cF.4mho.o.4r.^.4^.iF..#6.h.4D.#","#107"],["#107","#.105#","#.46oT.57#","#.46##.10u.35u.10#","#.43*.6r.10w.7ww.22*.11#","#.43##.4##.5ir.*.33#3.9#","#.12r.8i.14c.4*.13#6.11c.8c.9r.13#","#.41##.10##.35#3.12#","#.PGJ.3cor.8o.3F..r.5crch.8F..m.8^6.o..F.rcoh.7c.6c.F.7m..c.4D.#","#21~~#58~~#24"],["#143","#.100#.34#.5#","#.30|.u.u.23c.11cic.27#.17B.16#.5#","#.30|#7.18u.##.9#6.19u.5#.34#.5#","#.30|.24r.6i.37#.8*.17*.7#.5#","#.30|.24##.4##.4##.39#3.15#3.12#","#.12c.8rc.7|.17c.4c.30r.9o.18*.9*.7*.9#","#.19c#4.6|.22##.10##.27##.8#3.5#3..L3..#3.5#3.8#","#.PGJ.3*i*.8F#6.m.3|.5i.5F*c*.18F.4hm*.r.5cri.5F.Fc.^.4^.o.17LTL.19D.#","#143"],["#95","#.41#10.42#","#.41#10.42#","#.34u.6#10.42#","#.41#10.5wiT.23w.10#","#.41#10.6#3.33#","#.12c.6o.3i.10r.20i.13c.9o.3c.9#","#.31i..##..c.15#3.36#","#.PGJ.3cor.7F..ir..o.6#.r##..#.3Fiimm.c.10mm.r..Fo.6o.6**..i.6D.#","#19~~##~~#44~~#8~~##~~#10"],["#95","#.93#","#.22c.23cic.T.7*.34#","#.22##.10u.10#6.5u.##.10u.11u.10#","#.19*.6i.7w.20r.6r.6r.23#","#.19##.4##.16##.10##.4##.6#3.21#","#.12r.4c.16i.18r.13i.13i.11#","#.17##.12o..##..i..##.10##.11#3.24#","#.PGJ.3*r*.11F.9#.o##..#.4F.3*.c.8m.6F.5m..o.3r.6r.5D.#","#81~~#12"],["#95","#.17#10.33L.32#","#.17#10.33L.32#","#.17#10.7u.6|..*..c.12L.32#","#.17#10.7w.6|#9.5k.3L.8iT.11w.10#","#.17#10.14|.13##.3L.8#3.21#","#.12r.20o.7|.11*.6L.6i.25#","#.41|.11##.5L.5#3.24#","#.PGJ.3irc.9r*rF.i.5*.6i.3|F.8r.5m3Lm*..F.8c..*.9i.3D.#","#33~~#9~7#28~-~7#7"],["#95","#.65#10.18#","#.65#10.3|.r.o.T.8#","#.58u.6#10.3|#7.7#","#.32w*.12w.10w.7#10.3|.14#","#.33#3.29#10.3|.14#","#.12o.18i.11o.3c.9r*.19|.14#","#.30#3.22c#4.18|.14#","#.PGJ.3r3.6Fr.9*.10r..F..ci..o.6#6.m..F.iirm.o.5|.3m.c.6D.#","#19~-~7#15~~##~~#46"],["#95","#.72L.20#","#.54|.*.i.T.11L.20#","#.17|..i..o.10u.19|#7.8u.L.20#","#.17|#9.5w*.20|.13k.3L.7wo.11#","#.17|.15#3.18|.12##.3L.8#3.9#","#.12*.4|.13i.13or.7|.10c.6L.6i.13#","#.17|.12#3.10c#4.6|.10##.5L.5#3.12#","#.PGJ.3*c*.7|F.8c.7m..r.3F#6.m.3|.5o.3F.4mm.L.i.11i.4D.#","#20~7#68"],["#107","#.65#10.30#","#.46cic.T.14#10.15|.o.c.10#","#.45#6..|..i.ui.5#10.15|#7.7#","#.22w.30|#9..#10.6ww.7|.14#","#.43##.8|.11#10.15|.14#","#.12*.8o.9o.3o.17|.27c.8|.14#","#.41##.10|.36|.14#","#.PGJ.3r*o.8*.3F..o.6**..o.6F..mr.*.3|.9o.F.o3..*.5o.6r.F..|.3m.i.6D.#","#21~~#8~~##~~#19~7#18~~#24"],["#107","#.48L.4#10.9L.32#","#.34r.13L.4#10.9L.9i.11cic.T.6#","#.34##.12L.4#10.9L.9##.9#6.6#","#.21w3.7c.6i.5k.w.L.4#10.5k.w.L.6o.6o.18#","#.31##.4##.4##.3L.4#10.4##.3L.6##.4##.4##.12#","#.12c.8*r.6o.11*.6L.16*.6L.4i.27#","#.19c#4.5##.10##.5L.16##.5L.4##.10##.14#","#.PGJ.3i*r.8F#6.m.16F..o.L.o.4coo..i.3F.5m.L.c.12F.7r.c.5D.#","#107"],["#107","#.105#","#.34c.23*.35i.10#","#.34##.22##.32u.##.9#","#.20woT.8o.6r.7w.8c.w.4o.18ww.8*.6*.6#","#.21#3.7##.4##.16##.4##.28##.4##.6#","#.12i.6o.9c.23i.27i.7c.15#","#.18#3.8##.22##.34##.14#","#.PGJ.3c3.11F.m..i.7m.5Fc.9c.12Fi.9c..i.6r.F.15D.#","#43~-~7#15~-~7#5~~#24"],["#107","#.24L.71L.8#","#.24L.9cic.59L.8#","#.22u.L.8#6.7u.9u.u.37L.8#","#.20k.3L.19wcT.45k.w.L.8#","#.19##.3L.6##.12#3.43##.3L.8#","#.12i.4i.6L.18r.11i.3c.10r.10c.7r.6L.8#","#.17##.5L.4##.11#3.22o..##..i.14##.5L.8#","#.PGJ.3*i*.11Fm.L.c.8o.*.3F.8o.5c*..o.4F.#.i##..#.3c.6*.F.6i.L.c.4D.#","#55~~##~~#20~~#24"],["#107","#.29#10.33L.4#10.18#","#.29#10.33L.4#10.3|.o.r.T.8#","#.22u.6#10.33L.4#10.3|#7.7#","#.21w3.5#10.7w.11w.9k.3L.4#10.3|.14#","#.29#10.28##.3L.4#10.3|.14#","#.12*.8i.23$.19$.6L.17|.14#","#.65##.5L.17|.14#","#.PGJ.3c*r.8i.3F..c.5coc..*.5oF.5$.3i.9iF.5r.L.$.4icr..r..F..|.3m.c.6D.#","#21~~#22~~#8~-~7#43"],["#107","#.29#10.21L.44#","#.29#10.7iT.12L.33cic.8#","#.22u.6#10.7##.12L.32#6.6#","#.20wc.7#10.4r.6$.5k.w.L.8ww.9w$.23#","#.21#3.5#10.4##.4##.4##.3L.20#3.7##.12#","#.12*.6o.21r.11c.6L.9r.8$.25#","#.18#3.20##.10##.5L.6i..##..*.3#3.8##.14#","#.PGJ.3rcr.11F.4*.4$**m.$.6F.14o.L.r..F.#.$##..#.11*F.6mc.$.5D.#","#107"],["#107","#.105#","#.70*.34#","#.22u.30|..*..$.10##.10u.22#","#.34w.8ww*T.w.4|#9.4r.6c.19w.10#","#.45#3.5|.13##.4##.30#","#.12*.6i.3$.19c.9|.11r.15cr.10$.11#","#.42#3.8|.11##.12i#4.21#","#.PGJ.3c$o.7F..oo..c.4c.9o.F.5m..*..|.9rF.14#6.iF..c.6o.5D.#","#19~~##~~#6~-~7#16~7#30~~#12"],["#107","#.41#10.54#","#.22uic.T.14#10.39|.i.c.10#","#.21#6..|..o..r.5#10.19u.11u.7|#7.7#","#.29|#9..#10.7w.31|.14#","#.19##.8|.11#10.39|.14#","#.12c.16|.27c.23oo.7|.14#","#.17##.10|.49i#4.6|.14#","#.PGJ.3ioc.11F.r.*.3|.9c..F*iom.*.5i.6*..F*.9i.3#6.cF..|..mm.c.6D.#","#32~7#18~~#8~-~7#31"],["#119","#.17#10.62#10.9L.8#","#.17#10.62#10.9L.8#","#.17#10..|..r.uT.10u.6|..i..i.22u.6#10.9L.8#","#.17#10..|#9.6w.w.5|#9.26#10.5kww.L.8#","#.17#10..|.23|.35#10.4##.3L.8#","#.12i.16|.15i.7|.15c.9$.3c.17$.6L.8#","#.29|.23|.47##.5L.8#","#.PGJ.3*$c.9ccimFc.4|.9c..*F.5*.3|.9*.F$.6i.6ci..$..F.3ic*..r.9*.L.o.4D.#","#32~7#6~~#9~7#6~~#8~~##~~#34"],["#119","#.72L.44#","#.30|.r.i.37L.44#","#.30|#7.34L.28|..c..r.9#","#.22w.7|.15w.21kw3L.7w*T.18|#9.6#","#.30|.36##.3L.8#3.17|.15#","#.12c.17|.26r.7r.6L.6c.11$.3c.5|.15#","#.30|.34##.5L.5#3.20|.15#","#.PGJ.3ioo.6Fo.9c..|.5r.3F*.9o..r.6*..F.5m.L.*.11cF.4oc..i.4|.9$.3D.#","#19~-~7#15~-~7#5~~#32~~##~~#7~7#8"],["#119","#.117#","#.18|.$.*.35cic.5|.o.u.46#","#.18|#7.31#6.3|#7.8u.6|..i..T.21#","#.18|.27w.19|.14o.7|#9.5wr.11#","#.18|.36##.9|.14#3.5|.15#3.9#","#.12o.5|.14i.9o.3c.18|.12i.9|.13c.13#","#.18|.34##.11|.11#3.8|.12#3.12#","#.PGJ.3ror.8|..Fm.r.5r.6o.3F..$o..c.9m*.*.3F|.5*.10m..$F.|.9c.7m..c.4D.#","#33~~#8~~##~~#43~7#20"],["#119","#.117#","#.70cic.9iT.33#","#.20u.u.11u.34#6.7##.5|..$..i.21#","#.46w.10r.21c.6o..|#9.5wo.11#","#.57#3.7##.10##.4##..|.15#3.9#","#.12r.8r.11*i.8$.3o.7$.21*.11|.13r.13#","#.31i#4.18#3.8##.10##.10|.12#3.12#","#.PGJ.3o$o.8o.3F..o.5#6.c..F..oo..r.13r.F.6$.c.7mm.4F.|.9*.7m..$.4D.#","#21~~#20~~##~~#43~7#20"],["#119","#.84L.32#","#.34cic.17|.u.u.25L.9$.22#","#.33#6.15|#7.3|..o..r.12L.9##.21#","#.21ww.22*T.7|.10|#9.5kww.L.6r.6r.6i.11#","#.31##.12#3.6|.10|.13##.3L.6##.4##.6#3.9#","#.12o.8*r.20r.10|.10|.11$.6L.4r.13*.13#","#.19$#4.5##.11#3.9|.10|.11##.5L.4##.11#3.12#","#.PGJ.3roc.8F#6.c.8i.r.3F.8c.3|.3m.i.3F|.9o.6i.L.oF.19m..o.4D.#","#68~7#44"],["#119","#.24L.71L.4#10.6#","#.24L.53|.i.u.T.11L.4#10.6#","#.24L.53|#7.10L.4#10.6#","#.20k.w.L.7w$..w.8ww.9wo.20|.13k.w.L.4#10.6#","#.19##.3L.8#3.21#3.18|.12##.3L.4#10.6#","#.12*.4i.6L.6i.14r.8o.13ro.7|.10$.6L.20#","#.17##.5L.5#3.10o..##..c.3#3.10i#4.6|.10##.5L.20#","#.PGJ.3ocr.11F$.L.r.11i.3F#.r##..#.11o..F.#6.o.3|.5o..F.6i.L.o.4i*im.$.6D.#","#119"],["#155","#.84L.27#.34#.5#","#.84L.9cic.5|.i.o.5#.17B.16#.5#","#.22u.18|..*..$.36L.8#6.3|#7..#.34#.5#","#.33i.7|#9.5w*..w.9w.9k.w.L.17|.9#.8*.17*.7#.5#","#.33#3.5|.15#3.19##.3L.6##.9|.17#3.15#3.12#","#.12*.9o.8c.9|.13r.13*.7o.6L.17|.22*.9*.7*.9#","#.19c..##..*.3#3.8|.12#3.20##.5L.4##.11|.13#3.5#3..L3..#3.5#3.8#","#.PGJ.3ri*.9#Fo##..#.8m..o..|F.8c.10r..Fc.6o.8$.L.iF.6mi.c.4|.3m.$FF.18LTL.19D.#","#44~7#18~~#84"],["#119","#.36L.80#","#.36L.8i..c.21$T.9i..r.21cic.8#","#.22u.11u.L.8#5.18u.##.9#5.19#6.6#","#.21ww.9kww.L.8##.11w.8r.6o.6##.34#","#.31##.3L.8##.20##.4##.6##.20##.12#","#.12r.16c.6L.8##.10r.7c.15##.34#","#.29##.5L.8##.18##.14##.18##.14#","#.PGJ.3ioi.6Fr.9*.6c.L.r.3F!.##.4$..c.6*..F.14!.##.3F$.i.9r.7i.o.5D.#","#19~-~7#29~~#32~-~7#19"],["#119","#.60L.56#","#.21r..c.35L.21cic.T.30#","#.21#5.8u.25L.20#6.30#","#.21##.14w.18k.3L.33w.11w.10#","#.21##.9cr.$.19##.3L.18##.36#","#.12$.8##.8#6.9*.6i.6L.9i.23$.22#","#.21##.6##.12r..##..*..##.5L.6i..##..r..##.12r..##..*.18#","#.PGJ.3$c$.9!F##.4c.3^6.$.3F#.c##..#.6mm.L.i..F.#.c##..#.7mi.o.F.3#.c##..#..i.9$.3D.#","#103~-~7#7"],["#119","#.89#10.18#","#.18|.c.u.23cic.21$.18#10.18#","#.18|#7.8u.10#6.7u.11##.17#10.18#","#.18|.48i.w.4o.9$T.3#10.18#","#.18|.24##.22##.4##.8#4..#10.18#","#.12$.5|.40r.5i.14$..X..#.18r.11#","#.18|.22##.16##.4##.13##.X..#.30#","#.PGJ.3i$o.8|..F..$.4$.9*.3F..h*.i.5^^.5^oF.18X$c#oF..r$hm.o.5$.6r.5D.#","#31~-~7#65~~#12"],["#119","#.48L.4#10.26#10.18#","#.22uic.23L.4#10.18*u.T.4#10.18#","#.21#6.21L.4#10.18#5.3#10.18#","#.34w.9k.3L.4#10.17w##.6#10.10w.7#","#.19##.22##.3L.4#10.18##.6#10.5c*.r.9#","#.12i.28c.6L.20*.11##.20#6.8#","#.17##.22##.5L.32##.18##.14#","#.PGJ.3*ci.11Fh*.c.3i.9r.3F..$.L.$.4**o..*.4F*.6*.5!.##.3Fi.3ricm.r.6^6.o.4D.#","#31~-~7#29~~#48"],["#119","#.17#10.90#","#.17#10.6*..T.17|.r.$.34c..r.5|.u.u.10#","#.17#10.6#5.8u.7|#7.18u.u.10#5.4|#7.7#","#.17#10.5w##.19|.37w##.7|.14#","#.17#10.6##.19|.13*i.$.21##.7|.14#","#.12*.20##.12i.6|.12#6.8c.11##.7|.14#","#.33##.12##.5|.10##.26##.7|.14#","#.PGJ.3*$o.9$icF.i.6!.##.4r.F.^^.5^o..|.5o.3F..^6.o.3$.6c.F.3!.##.4o..|.3h.c.6D.#","#81~~#36"],["#119","#.117#","#.34i.23uT.22c.34#","#.22u.11##.20u.##.20u.##.22u.10#","#.24o.6c.6c.16o.6*.16i.6c.17wo.11#","#.23#4.4##.4##.16##.4##.16##.4##.18#3.9#","#.12i.7c..X..#..o.23r.15$.7$.17c.7o.13#","#.20##.X..#..##.22##.22##.16##.5#3.12#","#.PGJ.3io$.9F.3X$c#i.12F*.9o.13Fr.6$.8m.4F.3^^.5^$.10$.4D.#","#43~-~7#17~~#48"],["#119","#.24L.23L.28#10.30#","#.24L.9$.13L.17|.r.c.6#10.7o.22#","#.24L.7u.##.10u.L.17|#7.3#10.7##.10u.10#","#.20k.3L.6r.6$.5k.3L.17|.10#10.4o.w.4$.9*T.7#","#.19##.3L.6##.4##.4##.3L.17|.10#10.4##.4##.8#4.6#","#.12*.4$.6L.4*.11o.6L.17|.22*.14o..X..#.6#","#.17##.5L.4##.10##.5L.17|.22##.13##.X..#.6#","#.PGJ.3oi*.11Fo.L.*.7h.8F..*.L.o..c.9$.F|.3m.i.6rrmhhr..F.19X$c#$.3D.#","#55~-~7#55"],["#119","#.48L.68#","#.30|.i.u.13L.41|.c.i.T.9$.10#","#.30|#7.10L.33u.7|#7.6u.##.9#","#.30|.13k.w.L.8$.12w.r.7wi.8|.12*.6i.6#","#.30|.12##.3L.8#3.11#4.6#3.6|.12##.4##.6#","#.12r.9o.7|.10*.6L.6$.12i..X..#.4$.10|.10r.15#","#.19o..##..r.3|.10##.5L.5#3.11##.X..#.3#3.9|.10##.14#","#.PGJ.3$oo.9#Fi##..#.3|.5i.6F..m.L.o.11c..F.5X$c#c.10$F..|.3h.r.18D.#","#119"],["#119","#.96L.20#","#.34cic.21cic.T.33L.20#","#.20u.u.10#6.18#6.33L.7u.u.10#","#.21$.23*.24w.11w.$.7k.3L.20#","#.21#3.7##.12#3.7##.26#4.4##.3L.20#","#.12$.6o.23*.25$.10$..X..#..r.6L.10$.9#","#.18#3.8##.11#3.8##.25##.X..#..##.5L.10##.8#","#.PGJ.3*cc.11F.4r.7hr.c.3F.8o.8$.$.3Fr.6*.9X$c#$F.5m.L.$.4^^.5^r.3D.#","#69~~#48"],["#119","#.24L.16#10.57L.8#","#.24L.9cic.4#10.39|.*.u.T.11L.8#","#.20u.u.L.8#6..#10.39|#7.8u.L.8#","#.20k.3L.16#10.7w.9wc.20|.13k.3L.8#","#.19##.3L.6##.8#10.18#3.8co.c.6|.12##.3L.8#","#.12$.4c.6L.33$.8i.11#6.5|.10i.6L.8#","#.17##.5L.4##.24$..##..i.3#3.8##.11|.10##.5L.8#","#.PGJ.3ir*.11Fm.L.o.8r.r.4Firr..o.6#.r##..#..F.8c.4^6.$F..|.5r.9*.L.r.4D.#","#119"],["#119","#.29#10.57L.20#","#.29#10.29u.uiu.9u.13L.9cic.8#","#.22u.6#10.30#6.5u.##.12L.8#6.6#","#.29#10.21$T.17c.6r.5k.3L.20#","#.20$i.$.5#10.5cr.*.11#4.4##.10##.4##.4##.3L.6##.12#","#.12r.6#6.18#6.7r..X..#.14c.11*.6L.20#","#.17##.22##.13##.X..#..##.10##.10##.5L.4##.14#","#.PGJ.3c3.6F..^6.*.4c$mh.r.3F..^6.*.8X$c#cF.6c.o.13F.6m.L.r.8i.*.5D.#","#119"],["#119","#.117#","#.22cic.45uic.44#","#.21#6.17u.u.22#6.42#","#.33c.11ww.i.8oT.35w.22#","#.19##.12#3.11#4.6#3.7##.35o$.o.9#","#.12i.18o.12i..X..#.4$.27c.19#6.8#","#.17##.11#3.11##.X..#.3#3.8##.16##.16##.14#","#.PGJ.3irr.11F.$.r.9h..*.4F.3X$c#o.7h..*.F.6o.r.5^^.5^iFr.9r.3^6.$.4D.#","#91~-~7#19"],["#119","#.65#10.9L.32#","#.22r.23c.11cic.T..#10.9L.9cic.20#","#.22##.22##.9#6..#10.7u.L.8#6.18#","#.19r.w.4r.16*.6*.14#10.5k.w.L.21w.10#","#.19##.4##.16##.4##.4##.8#10.4##.3L.6##.24#","#.12i.4c.17$.5c.35*.6L.20r.11#","#.17##.16##.4##.10##.22##.5L.4##.26#","#.PGJ.3c*o.10Fmm.8^^.5^i.3F..h.12*.r.3F.ooih.o.9*.L.*F.7r.*.4*.6$.5D.#","#105~~#12"],["#119","#.72L.28#10.6#","#.18|.u.u.u.33r.13L.28#10.6#","#.18|#7.8u.23##.12L.28#10.6#","#.18|.14w..$.9w.8*.6c.5k.3L.8*T.18#10.6#","#.18|.16#4.16##.4##.4##.3L.8#3.8cr.c.5#10.6#","#.12o.5|.13r..X..#.6i.7c.11c.6L.6*.11#6.20#","#.18|.13##.X..#.14##.10##.5L.5#3.8##.26#","#.PGJ.3cio.8|..Fm.$.10X$c#i..cF.5r.8m.5F.5c.L.c.8m..*F.3^6.i.4rrc..$.6D.#","#45~~#72"],["#131","#.36L.28#10.54#","#.22cic.11L.9uic.T.6cu.$.4#10.30ru.o.9cic.8#","#.21#6.9L.8#6.6#5.3#10.7u.22#5.7#6.6#","#.32k.3L.20##.6#10.30##.22#","#.19##.10##.3L.6##.12##.6#10.30##.8##.12#","#.12*.16i.6L.20##.35*.10##.22#","#.17##.10##.5L.4##.14##.32*..##..*.6##.6##.14#","#.PGJ.3ir$.11F.c.*.8o.L.r.4F..h*.i.5!.##.4c.F.i*rm.*.4*.9$F..#.r##..#.4!.##..F.o.5mh$.i.5D.#","#79~-~7#43"],["#131","#.36L.28#10.21L.32#","#.36L.21o.6#10.21L.21iT.9#","#.22u.9u.u.L.21##.5#10.7u.11u.L.21##.9#","#.32k.3L.12w.5o.6o..#10.6c.10k.3L.18o.w.4r.6#","#.31##.3L.7io.r.7##.4##..#10.6#3.7##.3L.18##.4##.6#","#.12c.10$.5*.6L.6#6.4*.25r.9*.6L.10r.5o.15#","#.23##.4##.5L.4##.10##.23#3.8##.5L.10##.4##.14#","#.PGJ.3occ.9^^.F.3^o.6h.L.o.F..^6.o.14F.*o*..$.10m..iF.6r.L.$.4^^.F.3^$.15D.#","#131"],["#119","#.77#10.30#","#.77#10.5u$u.r.20#","#.22u.21u.u.9u.u.18#10.6#5.8u.10#","#.24cT.31c.19#10.6##.13*.8#","#.23#4.30#3.17#10.6##.12#4.6#","#.12c.7r..X..#.7r.12c.7r.15c.21##.9o..X..#.6#","#.20##.X..#.4$..##..r.8##.5#3.14##.20##.9##.X..#.6#","#.PGJ.3roc.9F.3X$c#$.3#.i##..#..F.^^.5^i.10i..F.^^.5^o.3*ioh.c..F.3!.##.4r.7X$c#$.3D.#","#119"],["#119","#.24L.59L.32#","#.24L.20ru.*.35L.17|.i.r.T.8#","#.20u.u.L.9u.10#5.34L.9u.7|#7.7#","#.20k.3L.8w.9ww##.33k.3L.17|.14#","#.19##.3L.20##.21$o.*.7##.3L.17|.14#","#.12*.4*.6L.8o.11##.10i.9#6.4$.6L.8o.8|.14#","#.17##.5L.20##.18##.10##.5L.17|.14#","#.PGJ.3r$$.11Fm.L.o.3r.6i.4F!.##.4$..r.6*..F..^6.$.7r.L.cF..c.6$.4|.5r.6D.#","#33~~#22~~#34~~#24"],["#119","#.48L.47L.20#","#.48L.47L.20#","#.20u.u.21u.u.L.21u.25L.9u.10#","#.44k.w.L.20iT.10ww.9k.3L.11*.8#","#.43##.3L.20#3.19##.3L.10#4.6#","#.12i.8i.12o.6i.6L.10i.7r.15$.5r.6L.7$..X..#.6#","#.31o..##..i..##.5L.10##.5#3.14##.4##.5L.7##.X..#.6#","#.PGJ.3oi$.8*.3F..o.5#.c##..#.4F..i.L.r.4^^.5^o.F.8o.4^^.5^$F.5m.L.*.8X$c#*.3D.#","#21~~#96"],["#155","#.84L.27#.34#.5#","#.30|.o.o.35c.13L.5|.$.r.17#.17B.16#.5#","#.22u.7|#7.8u.23##.12L.5|#7.8u.5#.34#.5#","#.21r.8|.27w.8i.6i.5k.w.L.5|.17$.3#.8*.17*.7#.5#","#.21#3.6|.36##.4##.4##.3L.5|.16#4.9#3.15#3.12#","#.12*.6r.10|.16i.17r.11c.6L.5|.13*..X..#.14*.9*.7*.9#","#.18#3.9|.16##.16##.10##.5L.5|.13##.X..#.5#3.5#3..L3..#3.5#3.8#","#.PGJ.3co$.11F.m..*.3|.3m.r.4F.^^.5^r.*.9oF.17c.L.$F..|.3m.i.5FF.3X$c#o.17LTL.19D.#","#55~-~7#91"],["#107","#.89#10.6#","#.33o..T.9i.33u$u.r.4#10.6#","#.33#5.8##.10u.22#5.3#10.6#","#.31ww##.8o.6i.7w.11w.*.8##.6#10.6#","#.33##.8##.4##.20#4.6##.6#10.6#","#.12*.8o.11##.6r.17r.8c..X..#.6##.22#","#.33##.6##.16##.7##.X..#.6##.22#","#.PGJ.3iro.8$.3F..c.5!.##.4i.3F..h.8^^.5^o.F.5X$c#$.3!.##.3F$.3$r*..*.6D.#","#21~~#84"],["#107","#.105#","#.46cic.33cic.20#","#.32u.u.10#6.30#6.7u.10#","#.21i.11ww.25r.8$T.22w.11#","#.21#3.19##.14#4.6#3.7##.24#","#.12r.6i.13**.21o..X..#.4i.27r.9#","#.18#3.10o#4.5##.13##.X..#.3#3.8##.16##.8#","#.PGJ.3*ii.11F.h..r.4#6.$.4F.3o.c.9X$c#*.F.8$.7mr.i.F.3^^.5^r.3D.#","#107"],["#107","#.105#","#.105#","#.22u.35u.9u.u.11u.22#","#.33*.12w.11w.25oT.19#","#.33#3.32*o.i.11#4.18#","#.12i.8ri.8$.16c.10i.7#6.7c..X..#.18#","#.19r#4.6#3.26##.4##.13##.X..#.18#","#.PGJ.3o*i.8F#6.*.11*.3Fr*c.9^^.5^cF..^6.o.8X$c#cFc.9o.3D.#","#91~-~7#7"],["#107","#.48L.56#","#.48L.20ou.T.21c.10#","#.34u.11u.L.20#5.6u.u.11##.9#","#.22w.10o.10k.3L.7w$.11##.20c.6o.6#","#.33#3.7##.3L.8#3.9##.20##.4##.6#","#.12i.6r.3c.7$.9c.6L.6$.13##.10c.7r.15#","#.30#3.8##.5L.5#3.12##.18##.14#","#.PGJ.3ro$.7F..i*..o.13i.4F..*.L.o.8mh.o..F.!.##.4$..*.6o.F.15D.#","#19~~##~~#56~~#24"],["#107","#.17#10.45L.23L.8#","#.17#10.45L.23L.8#","#.17#10.19u.23u.L.23L.8#","#.17#10.18w.w.10w.9k.3L.7w$T.9k.w.L.8#","#.17#10.40##.3L.8#3.7##.3L.8#","#.12$.23i.6i.3i.9c.7*.6L.6r.9i.6L.8#","#.65##.5L.5#3.8##.5L.8#","#.PGJ.3oo*.9i$*hFo.6oor.7F..$o..*.5c.6o..F.5m.L.i.11cF.6$.L.i.4D.#","#43~~##~~#8~~#48"],["#107","#.77#10.18#","#.22*.54#10.6$..T.8#","#.20u.##.32u.u.9u.u.6#10.6#5.7#","#.19o.6$.45$.4#10.6##.10#","#.19##.4##.44#4..#10.6##.10#","#.12$.4c.18*.23$.7$..X..#.18##.10#","#.17##.49##.X..#.18##.10#","#.PGJ.3rcr.11Fh.8ro*.6Fo.9i.3*$rm.6F.5X$c#i.3$co..c..F.3!.##.4c.3D.#","#43~-~7#55"],["#107","#.72L.32#","#.22uic.21*T.24L.9uic.20#","#.21#6.19##.24L.8#6.5u.u.10#","#.43r.6i.17k.w.L.20w.11#","#.19##.22##.4##.5*$.r.7##.3L.6##.24#","#.12o.18i.3o.5c.13#6.4r.6L.20cr.10#","#.17##.22##.10##.10##.5L.4##.12c#4.9#","#.PGJ.3$$c.11F.*.*.6$c..c.6F.11^6.r.F.5c.L.i.7m*.*.F.3#6.h.4D.#","#31~~##~~#70"],["#119","#.36L.80#","#.36L.33cic.44#","#.34u.L.7u.u.11u.10#6.7u.34#","#.32k.3L.12w.43iT.10ww.10#","#.31##.3L.7$$.i.19##.24#3.21#","#.12o.16c.6L.6#6.30*.3*.7c.15c.9#","#.29##.5L.4##.22##.23#3.14##.8#","#.PGJ.3$ic.6Fi.9*.6i.L.$.F..^6.$..$.9iF.6i.r.6$c..c..F.7m..c.4^^.5^r.3D.#","#19~-~7#27~-~7#15~~##~~#34"],["#119","#.117#","#.58$.35$T.21#","#.58##.10u.11u.11##.21#","#.36$.9w.8*.w.4r.10w.7w.9r.w.4*.7w.10#","#.20c*.c.11#4.16##.4##.5$i.o.19##.4##.18#","#.12r.6#6.7*..X..#.8c.5$.13#6.8*.7*.15c.11#","#.17##.13##.X..#.8##.4##.10##.22##.26#","#.PGJ.3r3.6F..^6.r.8X$c#i.F.^^.5^o.12F..^6.i.3*.6c.F.14*.6*.5D.#","#81~~#22~~#12"],["#119","#.29#10.14#10.45L.8#","#.29#10.14#10.45L.8#","#.29#10.7u.6#10.7u.21u.u.13L.8#","#.22w.6#10.14#10.30iT.9k.3L.8#","#.29#10.14#10.30#3.7##.3L.8#","#.12c.35i.18i.3i.12c.6$.9c.6L.8#","#.90#3.8##.5L.8#","#.PGJ.3ici.6Fo.9c.3rcch.*.5Fcr*.9rri..c.4F..oo..r.6r**h.4F.7m..*.7m.L.c.4D.#","#19~-~7#39~~##~~#46"],["#119","#.77#10.14#10.6#","#.21r..c.9$T.41#10.14#10.6#","#.21#5.8##.20u.u.18#10.7u.6#10.6#","#.21##.8i.w.4o.18w.w.17#10.6ww.6#10.6#","#.21##.8##.4##.5ci.i.20ic.*.5#10.14#10.6#","#.12*.8##.6r.13#6.6c.3i.7#6.44#","#.21##.6##.10##.22##.50#","#.PGJ.3oc*.9!F##.4c.6h.5F..^6.o.5$o..r.3F..^6.$.4*ir..o..F.i.9*.3*cr..c.6D.#","#55~~##~~#30~-~7#19"],["#119","#.41#10.66#","#.34*.6#10.31uic.T.30#","#.32u.##.5#10.7u.22#6.30#","#.31$.w.4c..#10.6i.34wo.23#","#.31##.4##..#10.6#3.19##.12#3.21#","#.12r.8oo.6c.25i.11*.3i.19i.15i.9#","#.19*#4.5##.23#3.20##.11#3.14##.8#","#.PGJ.3*ir.8F#6.o.15Fcich.*.13i..F..$r..$.8mm*.i.F.10o.4^^.5^*.3D.#","#67~~##~~#46"],["#119","#.117#","#.34cic.80#","#.33#6.31u.11u.34#","#.20w$T.23w.47w.22#","#.21#3.7##.47oo.i.33#","#.12*.6r.25*.11or.20#6.11o.20#","#.18#3.8##.24$#4.17##.38#","#.PGJ.3$$i.11F.4i.7hi.*.4*F.5o.5#6.m.Fo.9c.3^6.iF.3$ich.6r.9i.3D.#","#45~~#20~-~7#27~-~7#7"],["#119","#.117#","#.34cic.8iu.*.32$..c.9oT.21#","#.22u.10#6.6#5.20u.10#5.6u.##.10u.10#","#.45##.13*.20##.8i.w.4c.18#","#.31##.12##.12#4.18##.8##.4##.18#","#.12*.10r.21##.9i..X..#.6i.11##.6i.13*.3c.9#","#.23##.4##.14##.9##.X..#.18##.6##.26#","#.PGJ.3rr$.9^^.F.3^$.6m$.c.4F!.##.4o.7X$c#$.Fo.6c.5!.##.3Fo.5hm.9oc..i.6D.#","#69~~#32~~##~~#10"],["#119","#.117#","#.117#","#.22u.21u.u.21u.u.11u.34#","#.24$T.19$.48w.22#","#.23#4.18#3.8**.o.57#","#.12i.7*..X..#.8$.7o.11#6.23$.10o.12$.8#","#.20##.X..#.8##.5#3.8##.40##.20#","#.PGJ.3o$c.9F.3X$c#*.3^^.5^$.F.5h..*.4^6.i.Fi.9c.3$**m.4F.3^^.5^o.3$o*.9D.#","#67~-~7#43"],["#119","#.17#10.9L.16#10.54#","#.17#10.9L.16#10.18ou.T.20r..i.8#","#.17#10.9L.16#10.18#5.19#5.7#","#.17#10.5k.3L.11$.4#10.7w.o.6ww##.10ww.8ww##.10#","#.17#10.4##.3L.10#4..#10.8#4.6##.22##.10#","#.12o.16*.6L.7r..X..#.17*..X..#.6##.22##.10#","#.29##.5L.7##.X..#.17##.X..#.6##.22##.10#","#.PGJ.3ror.9oiimFr.9c.L.o.4F.3X$c#*.3rro..r.4F.5X$c#c.3!.##.3Fi.o.9r.3!.##.4o.3D.#","#91~-~7#19"],["#119","#.117#","#.22o.35cic.8r..$.44#","#.22##.10u.22#6.6#5.8u.11u.11u.10#","#.19c.w.4i.18ww.iT.19##.22w.11w.11#","#.19##.4##.5ic.*.11#4.4##.12##.46#","#.12i.4o.13#6.7i..X..#.18##.12i.9i.13$.9#","#.17##.10##.13##.X..#..##.14##.12##.22##.8#","#.PGJ.3*ii.11Fh.8^6.o.4F.3X$c#o.7c.o.3F.!.##.4i.3^^.5^*F.i.6*.5^^.5^c.3D.#","#93~~#24"],["#119","#.29#10.21L.28#10.18#","#.22cic.4#10.21L.28#10.7uic.8#","#.21#6..#10.5u.u.9u.u.L.28#10.6#6.6#","#.29#10.6i.10k.3L.11$T.15#10.18#","#.19##.8#10.6#3.7##.3L.10#4.14#10.4##.12#","#.12o.30*.9$.6L.7o..X..#.6r.35#","#.17##.23#3.8##.5L.7##.X..#.26##.14#","#.PGJ.3iri.11F.o.i.5o$rm.c.4F.8o.7h.L.i..F.5X$c#c..o.6o.F.3irr..r.9m$.i.5D.#","#81~~#36"],["#131","#.24L.64#10.30#","#.24L.21c.22c..o.16#10.30#","#.24L.9u.9u.##.10u.10#5.8u.6#10.30#","#.20k.w.L.8w.9r.6o.9oT.6w##.11w.6#10.30#","#.19##.3L.18##.4##.8#4.6##.18#10.17ri.*.9#","#.12$.4c.6L.16r.14r..X..#.6##.10*o.22c.9#6.8#","#.17##.5L.16##.13##.X..#.6##.8r#4.29##.14#","#.PGJ.3*rr.11F$.L.$..*.9c.3F.15X$c#i.F.!.##.4c.3#6.hF.3*$$m.$.5r.5Fr.5^6.$.4D.#","#31~-~7#65~~#24"],["#167","#.65#10.33L.15#.34#.5#","#.33ru.r.28#10.33L.15#.17B.16#.5#","#.33#5.8u.11u.6#10.7u.23u.L.15#.34#.5#","#.33##.23w.6#10.19w.9k.3L.15#.8*.17*.7#.5#","#.20$*.*.9##.30#10.28##.3L.23#3.15#3.12#","#.12o.6#6.8##.10oc.13i.23o.8o$.6r.6L.8r$.18*.9*.7*.9#","#.17##.14##.8*#4.43i#4.5##.5L.6i#4.8#3.5#3..L3..#3.5#3.8#","#.PGJ.3*co.6F..^6.*.4!.##.4$..F#6.m.4rci.7F.$cr..o.6iri.5F.3#6.i.7$.LFo.4#6Fm.18LTL.19D.#","#167"],["#119","#.117#","#.30|.r.o.47cic.21cic.T.6#","#.30|#7.43#6.5u.u.u.8#6.6#","#.30|.63w.22#","#.30|.13ii.*.20ic.c.7##.22##.12#","#.12c.8*.8|.12#6.8or.8#6.20i.23#","#.30|.10##.12i#4.5##.10##.22##.14#","#.PGJ.3orc.8c.3F..*.4|.5i.3F..^6.c.4#6.o.F..^6.c.6hhm.o.F..c.6*.8hc.*.5D.#","#21~~#70~~#24"],["#119","#.117#","#.18|.r.r.19|.o.*.70#","#.18|#7.6u.u.7|#7.8u.58#","#.18|.14*T.7|.74#","#.18|.14#3.6|.13i*.i.20io.r.33#","#.12r.5|.12r.10|.12#6.6c.3i.7#6.8ic.10o.11#","#.18|.11#3.9|.10##.22##.12*#4.21#","#.PGJ.3*c*.8|..F..c.10h..r.3|Fmmhho.6^6.c..F..**..c.6^6.rF.3#6.h.3o.6i.5D.#","#67~~##~~#32~~#12"],["#119","#.117#","#.42|.i.u.43|.i.i.11cic.8#","#.42|#7.8u.21u.u.7|#7.7#6.6#","#.22w.10oT.7|.14c.22w*.8|.26#","#.33#3.6|.14#3.21#3.6|.12##.12#","#.12o.8o.9*.10|.12i.13oo.8c.10|.26#","#.30#3.9|.11#3.10c#4.6#3.9|.10##.14#","#.PGJ.3roi.8c.3F..c.12*.3|F..m.o.13r..F.#6.r.11rF..|.5c.9mo.o.5D.#","#21~~#96"],["#131","#.129#","#.118r.10#","#.22u.11u.23u.11u.47##.9#","#.93rT.11w.8o.6c.6#","#.44r*.c.45#3.19##.4##.6#","#.12r.8i*.10r.9#6.8r*.11i.10c.9c.14o.6o.15#","#.19*#4.17##.12o#4.10##.18#3.13##.5##.14#","#.PGJ.3ioi.8F#6.i.3c.6i..F..^6.i.4#6.r..F*.^.4^.*..*.6i.F.10*.3o.^.4^.*F.4mmh.7D.#","#33~~#46~~#48"],["#131","#.129#","#.42|.i.o.82#","#.42|#7.6u.u.70#","#.21i.11ww.7|.27w.10r.12w.10rT.11w.10#","#.21#3.18|.38#3.21#3.21#","#.12i.6r.13*r.7|.12*.3c.9*.9c.14c.8*.11o.3c.9#","#.18#3.10o#4.6|.35#3.13##.6#3.24#","#.PGJ.3*i*.11F.h..o.4#6.*.3|F..m.*.7ri..i.4F*.6r.12rF..r.^.4^.*.9F*.5**..o.6D.#","#55~~##~~#8~~#44~~##~~#10"],["#131","#.53#10.14#10.42#","#.22c.30#10.14#10.19cic.20#","#.22##.17|..i..o.5#10.7u.6#10.7u.10#6.18#","#.19c.6*.5wo.7|#9..#10.14#10.5wiT.23w.10#","#.19##.4##.6#3.5|.11#10.14#10.6#3.7##.24#","#.12c.4$.13r.9|.49i.37#","#.17##.11#3.8|.48#3.8##.26#","#.PGJ.3$or.11Fm.15*..|F.8$.3$*rm.c.3F*.9r.3iorm.$..F.10r.7moFc.3i.9i.3D.#","#44~7#16~-~7#39~-~7#7"],["#131","#.129#","#.22cic.33*.19|.r.*.46#","#.21#6.7u.21u.##.18|#7.15|..r..c.21#","#.44w$..w.6i.6i.7w.7|.14i.7|#9.5wrT.10#","#.19##.24#3.7##.4##.15|.14#3.5|.15#3.9#","#.12*.18*.3r.7$.9r.16$.7|.12c.9|.13o.13#","#.17##.23#3.8##.12r..##..i.3|.11#3.8|.12#3.12#","#.PGJ.3ir$.11F.*.*.6co..*.4F.5m..i.14F.#.*##..#.3|.5r..F.7m..o..|.8Fi.10$.4D.#","#31~~##~~#67~7#20"],["#131","#.129#","#.106oT.21#","#.82u.6|..c.u$.10##.10u.10#","#.22w.11w.11w.23w.18|#9.4o.w..w.c.18#","#.89|.13##.4##.18#","#.12i.18*.3c.9r.9$.3r.21$*.6|.11$.27#","#.79i#4.5|.11##.26#","#.PGJ.3$*r.6Fr.9$.4$i..c.5iF.5r.6$r..i.3Fc.9*.3#6.$F.|.9*.9F.3$.9c.3D.#","#19~-~7#3~~##~~#8~~#8~~##~~#6~-~7#16~7#16~-~7#7"],["#131","#.84L.16#10.18#","#.34iT.48L.16#10.3|.$.c.10#","#.17|..u.ur.10##.48L.16#10.3|#7.7#","#.17|#9.4i.6o.7w.23w.9kw3L.16#10.3|.14#","#.17|.13##.4##.40##.3L.16#10.3|.14#","#.12$.4|.11i.15r.12$.8r.3$.5*.6L.8rc.19|.14#","#.17|.11##.24o..##..$.14##.5L.6$#4.18|.14#","#.PGJ.3ro$.7|F.8c.14rF.5i.5#.c##..#..F..ro..i.9m.L.cF.3#6.m.4cr*m.*F.4|.5o.6D.#","#20~7#18~~#20~~##~~#58"],["#131","#.60L.35L.32#","#.18|.i.u.11cic.23L.35L.5|.c.o.22#","#.18|#7.7#6.21L.4|..r..T.10u.13L.5|#7.19#","#.18|.25w$.10k.3L.4|#9.17k.w.L.5|.26#","#.18|.12##.12#3.7##.3L.4|.25##.3L.5|.26#","#.12i.5|.24o.9i.6L.4|.13i.3i.5c.6L.5|.14*.11#","#.18|.10##.11#3.8##.5L.4|.23##.5L.5|.26#","#.PGJ.3r*c.8|..Fm.$.10r.i.3F.5m3i.7r.L.$.F|.9$.4*c..r..F.6r.L.i.3|.5*F.4c.6o.5D.#","#68~7#4~~##~~#32~~#12"],["#131","#.77#10.9L.16#10.6#","#.34uic.T.38#10.9L.9cic.4#10.6#","#.20u.u.10#6.17u.u.u.16#10.9L.8#6..#10.6#","#.56wr.19#10.5k.3L.16#10.6#","#.31##.24#3.17#10.4##.3L.6##.8#10.6#","#.12o.8c.25c.7$.33r.6L.32#","#.29##.16##.5#3.32##.5L.4##.26#","#.PGJ.3ci*.8*.3F..o.8hr.$.3F.^^.5^c.10$.Fo.9$.3$$hm.$..F.6$.L.c.8iF$.5ooc..r.6D.#","#21~~#44~-~7#55"],["#131","#.29#10.45L.44#","#.29#10.45L.7u.uic.32#","#.29#10.19u.23u.L.8#6.30#","#.21c.7#10.33rT.6kww.L.44#","#.21#3.5#10.32#4.4##.3L.6##.36#","#.12$.6$.38$.9i..X..#..c.6L.33*.10#","#.18#3.34r..##..$.5##.X..#..##.5L.4##.24r..##..o.6#","#.PGJ.3coi.11F.h..o.4c*hm.$.3F*.9$.3#.*##..#..F.5X$c#r.6o.L.*F.7i.o.3c.9$F..#.o##..#.4D.#","#43~-~7#51~-~7#19"],["#131","#.24L.23L.80#","#.24L.23L.20i..c.56#","#.24L.9u.13L.20#5.8u.11u.23u.10#","#.20k.3L.8w.10k.3L.9w.$.8##.10oT.46#","#.19##.3L.18##.3L.10#4.6##.10#3.8oc.*.20ii.r.9#","#.12o.4r.6L.10$.5o.6L.7o..X..#.6##.8*.11#6.8r.9#6.8#","#.17##.5L.10##.4##.5L.7##.X..#.6##.7#3.8##.22##.14#","#.PGJ.3ioi.11Fm.L.r.4^^.5^r.3F..o.L.i.8X$c#o.F.!.##.4i.7m..*F.3^6.$.3o.5Fr.5^6.*.4D.#","#105~~#24"],["#131","#.72L.28#10.18#","#.46*.25L.28#10.3|.i.o.T.8#","#.22u.21u.##.24L.9u.11u.6#10.3|#7.7#","#.33ww.8c.6$.17k.3L.28#10.3|.14#","#.20oc.i.19##.4##.16##.3L.28#10.3|.14#","#.12$.6#6.10c.5c.17$.5*.6L.21r.19|.14#","#.17##.16##.4##.16##.4##.5L.18i..##..o.15|.14#","#.PGJ.3ioo.6F..^6.o.4^^.5^*.3F.11^^.5^rF.5$.L.$..c.9cF..#.i##..#.4*imh.cF.4|.3m.c.6D.#","#79~-~7#43"],["#131","#.89#10.21L.8#","#.21*..$.33cic.8ou.T.5|.r.u.6#10.5u$u.$.11L.8#","#.21#5.6u.u.22#6.6#5.4|#7.3#10.6#5.10L.8#","#.21##.11w.*.32##.7|.10#10.6##.9k.3L.8#","#.21##.12#4.16##.12##.7|.10#10.6##.8##.3L.8#","#.12r.8##.9c..X..#.6c.23##.7|.26##.6*.6L.8#","#.21##.9##.X..#.14##.14##.7|.26##.6##.5L.8#","#.PGJ.3io$.9!F##.4c.7X$c#r..*F.5*.7mm$.o.3F.!.##.4c..|.5*..F.3roc..r.6!.##..F.i.6i.L.i.4D.#","#45~~#84"],["#131","#.36L.35L.56#","#.36L.9c.25L.9o.22$..$.20#","#.22u.13L.9##.10u.13L.7u.##.10u.10#5.19#","#.21w.10k.3L.6o.w.4o.9rT.6k.3L.6*.6o.6c.11##.22#","#.31##.3L.6##.4##.8#4.4##.3L.6##.4##.6#3.9##.22#","#.12$.6i.3o.5*.6L.4$.14o..X..#..$.6L.4c.13o.13##.10o.11#","#.29##.5L.4##.13##.X..#..##.5L.4##.11#3.12##.22#","#.PGJ.3ori.7F..$i..r.9m.L.o.4F.15X$c#cF.5h.L.$.12F.10*.4!.##..F.i..o.6o.5D.#","#19~~##~~#92~~#12"],["#131","#.36L.47L.44#","#.36L.47L.44#","#.22u.13L.9u.9u.u.25L.44#","#.21w..iT.6k.3L.8w.11w.22k.w.L.44#","#.23#4.4##.3L.42##.3L.44#","#.12o.7i..X..#..c.6L.8oc.13c.6i.3c.5o.6L.22o.7o.3$.9#","#.20##.X..#..##.5L.6$#4.29##.5L.22##.20#","#.PGJ.3c$c.9F.3X$c#c.6m.L.*.3F#6.*.4ccr.7F..r$..c.9r.L.cF.$.9r.3^^.F.3^$.4ri..o.6D.#","#67~~##~~#18~-~7#15~~##~~#10"],["#131","#.129#","#.22u.58c..T.9uic.32#","#.20u.##.22u.34#5.7#6.30#","#.19$.6o.18w.12w.22##.23w.o.9w.10#","#.19##.4##.5rr.c.32i*.$.9##.8##.14#4.18#","#.12*.4i.13#6.10$.9$c.8#6.8##.21c..X..#.8$.9#","#.17##.10##.16##.6c#4.5##.14##.6##.13##.X..#.8##.8#","#.PGJ.3ioc.11F.9^6.o..F.^^.5^$.3#6.*.F..^6.$.4!.##.3Fc.6h*.*.9X$c#iF..^^.5^r.3D.#","#131"],["#131","#.129#","#.22cic.92r..T.8#","#.21#6.19u.35u.11u.22#5.7#","#.34w.10w.24w.10c.34w##.10#","#.19##.60#3.33##.10#","#.12r.35i.8*.9o.3r.7*.16i.8$.11##.10#","#.17##.59#3.36##.10#","#.PGJ.3rri.11Fhr.*.3$.9*..Fr$o.8*.6o.3F..$o..o.10hh.cF.3crc.8$.5F$.5!.##.4i.3D.#","#31~-~7#17~~#8~~##~~#32~~#24"],["#167","#.108L.15#.34#.5#","#.93*..c.11L.15#.17B.16#.5#","#.22u.35u.23u.10#5.10L.9u.5#.34#.5#","#.22w.34w.15w.10c.7w##.9k.w.L.15#.8*.17*.7#.5#","#.44i$.*.20*c.i.11#4.6##.8##.3L.23#3.15#3.12#","#.12i.10*.19#6.18#6.7*..X..#.6##.6c.6L.11o.16*.9*.7*.9#","#.23##.16##.22##.13##.X..#.6##.6##.5L.19#3.5#3..L3..#3.5#3.8#","#.PGJ.3i$*.9^^.F.3^r.r.9*F..^6.$..o.9iF..^6.$.8X$c#*F..!.##.4c.6c.LF$.4iri.4F.18LTL.19D.#","#31~-~7#15~-~7#103"]];
const LEVELS = RLE.map((rows) => rows.map((row) => row.replace(/(\D)(\d+)/g, (m, c, n) => c.repeat(+n))));;

const HINTS = ["Arrows run · Up jumps · grab the gold cup, then the door","Hold Up to jump higher · the top path hides crowns","Water is deadly · hop across the stepping stones","Fire is deadly too · take the bridge","Touch a flag to save your spot","Press Up on a vine to climb","Land on a blob to stomp it","Grab the blaster · hold X to fire","Rockets are spiky · shoot them, don't stomp","Step onto the moving platform and ride it across","Find the key to open the blue locks","Some walls are fake · walk into them","Z turns on the space pack · watch the fuel","Saucers glow before they fire · keep moving","Hoppers leap at you · stomp them","Step onto the lift and ride it up","Key, platform and a secret · take your time","Space pack, rockets and saucers · mind the fuel","Everything at once · flags are your friends","Stomp or shoot the Boss Saucer to free the cup","The high path hides crowns · Sunny Harbour","Jump the floating ledges · Sunny Harbour","The high path hides crowns · Sunny Harbour","Cross the bridge above the fire · Sunny Harbour","Cross the bridge above the fire · Sunny Harbour","Hop the stepping stones · Sunny Harbour","Hop the stepping stones · Sunny Harbour","Hop the stepping stones · Sunny Harbour","The high path hides crowns · Sunny Harbour","The high path hides crowns · Sunny Harbour","Jump the floating ledges · Sunny Harbour","Jump the floating ledges · Sunny Harbour","Jump the floating ledges · Sunny Harbour","Cross the bridge above the fire · Sunny Harbour","The high path hides crowns · Sunny Harbour","Jump the floating ledges · Sunny Harbour","Cross the bridge above the fire · Sunny Harbour","Climb the vine to the top shelf · Sunny Harbour","Hop the stepping stones · Sunny Harbour","Boss · stomp or blast the Boss Saucer to free the cup","Jump the floating ledges · Whisper Woods","The high path hides crowns · Whisper Woods","Hop the stepping stones · Whisper Woods","Jump the floating ledges · Whisper Woods","The high path hides crowns · Whisper Woods","Low tunnel — watch for blobs · Whisper Woods","Ride the moving platform over the water · Whisper Woods","The high path hides crowns · Whisper Woods","Ride the moving platform over the water · Whisper Woods","Climb the vines over the water · Whisper Woods","Climb the vine to the top shelf · Whisper Woods","Climb the vines over the water · Whisper Woods","Climb the vine to the top shelf · Whisper Woods","Find the key to open the blue locks · Whisper Woods","Jump the pillars · Whisper Woods","Jump the floating ledges · Whisper Woods","Hop the stepping stones · Whisper Woods","The high path hides crowns · Whisper Woods","Low tunnel — watch for blobs · Whisper Woods","Boss · stomp or blast the Boss Saucer to free the cup","Jump the pillars · Glow Mines","Jump the pillars · Glow Mines","Step on the lift and ride it up · Glow Mines","Jump the floating ledges · Glow Mines","Cross the bridge above the fire · Glow Mines","Ride the moving platform over the water · Glow Mines","Step on the lift and ride it up · Glow Mines","Climb the vine to the top shelf · Glow Mines","The high path hides crowns · Glow Mines","Low tunnel — watch for blobs · Glow Mines","Look for a fake wall — a secret room waits · Glow Mines","Find the key to open the blue locks · Glow Mines","Jump the pillars · Glow Mines","Find the key to open the blue locks · Glow Mines","Find the key to open the blue locks · Glow Mines","Cross the bridge above the fire · Glow Mines","Ride the moving platform over the water · Glow Mines","Jump the floating ledges · Glow Mines","Climb the vine to the top shelf · Glow Mines","Boss · stomp or blast the Boss Saucer to free the cup","The high path hides crowns · Cloud Citadel","Hop the fire pits · Cloud Citadel","Find the key to open the blue locks · Cloud Citadel","Ride the moving platform over the water · Cloud Citadel","Step on the lift and ride it up · Cloud Citadel","Look for a fake wall — a secret room waits · Cloud Citadel","Look for a fake wall — a secret room waits · Cloud Citadel","Low tunnel — watch for blobs · Cloud Citadel","Hop the stepping stones · Cloud Citadel","Look for a fake wall — a secret room waits · Cloud Citadel","Jump the floating ledges · Cloud Citadel","The high path hides crowns · Cloud Citadel","Look for a fake wall — a secret room waits · Cloud Citadel","Cross the bridge above the fire · Cloud Citadel","Ride the moving platform over the water · Cloud Citadel","Step on the lift and ride it up · Cloud Citadel","Ride the moving platform over the water · Cloud Citadel","Step on the lift and ride it up · Cloud Citadel","The high path hides crowns · Cloud Citadel","Boss · stomp or blast the Boss Saucer to free the cup","The high path hides crowns · Rooftop Run","The high path hides crowns · Rooftop Run","Hop the stepping stones · Rooftop Run","Hop the stepping stones · Rooftop Run","Hop the stepping stones · Rooftop Run","Jump the floating ledges · Rooftop Run","Climb the vine to the top shelf · Rooftop Run","The high path hides crowns · Rooftop Run","Cross the bridge above the fire · Rooftop Run","Cross the bridge above the fire · Rooftop Run","Jump the floating ledges · Rooftop Run","Cross the bridge above the fire · Rooftop Run","Hop the stepping stones · Rooftop Run","Hop the stepping stones · Rooftop Run","Climb the vine to the top shelf · Rooftop Run","Jump the floating ledges · Rooftop Run","Jump the floating ledges · Rooftop Run","Climb the vine to the top shelf · Rooftop Run","Jump the floating ledges · Rooftop Run","Boss · stomp or blast the Boss Saucer to free the cup","Hop the stepping stones · Tangle Jungle","Jump the floating ledges · Tangle Jungle","Low tunnel — watch for blobs · Tangle Jungle","Ride the moving platform over the water · Tangle Jungle","Climb the vines over the water · Tangle Jungle","Hop the stepping stones · Tangle Jungle","Jump the floating ledges · Tangle Jungle","Jump the floating ledges · Tangle Jungle","Find the key to open the blue locks · Tangle Jungle","Low tunnel — watch for blobs · Tangle Jungle","Low tunnel — watch for blobs · Tangle Jungle","Hop the stepping stones · Tangle Jungle","The high path hides crowns · Tangle Jungle","Low tunnel — watch for blobs · Tangle Jungle","Ride the moving platform over the water · Tangle Jungle","Climb the vine to the top shelf · Tangle Jungle","Hop the stepping stones · Tangle Jungle","The high path hides crowns · Tangle Jungle","Find the key to open the blue locks · Tangle Jungle","Boss · stomp or blast the Boss Saucer to free the cup","Ride the moving platform over the water · Magma Depths","Step on the lift and ride it up · Magma Depths","Climb the vine to the top shelf · Magma Depths","The high path hides crowns · Magma Depths","Low tunnel — watch for blobs · Magma Depths","Look for a fake wall — a secret room waits · Magma Depths","Find the key to open the blue locks · Magma Depths","Jump the pillars · Magma Depths","The high path hides crowns · Magma Depths","Find the key to open the blue locks · Magma Depths","Cross the bridge above the fire · Magma Depths","The high path hides crowns · Magma Depths","Jump the floating ledges · Magma Depths","Climb the vine to the top shelf · Magma Depths","The high path hides crowns · Magma Depths","Hop the fire pits · Magma Depths","Look for a fake wall — a secret room waits · Magma Depths","Find the key to open the blue locks · Magma Depths","Jump the pillars · Magma Depths","Boss · stomp or blast the Boss Saucer to free the cup","Step on the lift and ride it up · Storm Works","The high path hides crowns · Storm Works","Hop the fire pits · Storm Works","Hop the stepping stones · Storm Works","Low tunnel — watch for blobs · Storm Works","Jump the floating ledges · Storm Works","The high path hides crowns · Storm Works","Ride the moving platform over the water · Storm Works","Cross the bridge above the fire · Storm Works","Ride the moving platform over the water · Storm Works","Step on the lift and ride it up · Storm Works","Jump the floating ledges · Storm Works","The high path hides crowns · Storm Works","Hop the fire pits · Storm Works","Look for a fake wall — a secret room waits · Storm Works","Low tunnel — watch for blobs · Storm Works","Jump the floating ledges · Storm Works","The high path hides crowns · Storm Works","Find the key to open the blue locks · Storm Works","Boss · stomp or blast the Boss Saucer to free the cup","Climb the vine to the top shelf · The Last Climb","Climb the vine to the top shelf · The Last Climb","Climb the vine to the top shelf · The Last Climb","Cross the bridge above the fire · The Last Climb","Climb the vine to the top shelf · The Last Climb","Jump the floating ledges · The Last Climb","The high path hides crowns · The Last Climb","Ride the moving platform over the water · The Last Climb","Climb the vines over the water · The Last Climb","Climb the vine to the top shelf · The Last Climb","The high path hides crowns · The Last Climb","Low tunnel — watch for blobs · The Last Climb","Find the key to open the blue locks · The Last Climb","Cross the bridge above the fire · The Last Climb","Step on the lift and ride it up · The Last Climb","Hop the stepping stones · The Last Climb","Look for a fake wall — a secret room waits · The Last Climb","Jump the floating ledges · The Last Climb","The high path hides crowns · The Last Climb","Boss · stomp or blast the Boss Saucer to free the cup"];



return { WORLDS, REGIONS, THEME_OF, TITLES, LEVELS, HINTS };
})();
const __r3 = (() => {
const { TILE, VIEW_COLS, ROWS } = __eng;


const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
const shade = (hex, v) => {
const n = parseInt(hex.slice(1), 16), f = (x) => Math.max(0, Math.min(255, Math.round(x * (1 + v))));
return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
};

class Ritam3DRenderer {
constructor(canvas, overlay, THREE, opts = {}) {
const T = (this.T = THREE);
this.canvas = canvas;
this.overlay = overlay;
this.shadows = opts.shadows !== false;

const gl = (this.gl = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
gl.setPixelRatio(1);
gl.setSize(1280, 640, false);
gl.outputColorSpace = T.SRGBColorSpace;
gl.toneMapping = T.ACESFilmicToneMapping;
gl.toneMappingExposure = 1.06;
gl.shadowMap.enabled = this.shadows;
gl.shadowMap.type = T.PCFSoftShadowMap;

this.scene = new T.Scene();
this.scene.background = new T.Color('#120d22');
this.persp = new T.PerspectiveCamera(30, 2, 0.1, 200);
this.ortho = new T.OrthographicCamera(0, VIEW_COLS, ROWS, 0, 0.1, 200);
this.ortho.position.set(0, 0, 30);

this.hemi = new T.HemisphereLight('#d6e2ff', '#5a3a2a', 1.0);
this.scene.add(this.hemi);
this.heroLight = new T.PointLight('#fff1dc', 1.7, 3.4, 2);
this.scene.add(this.heroLight);
const key = (this.key = new T.DirectionalLight('#fff0d8', 2.3));
key.castShadow = this.shadows;
key.shadow.mapSize.set(2048, 1024);
Object.assign(key.shadow.camera, { left: -15, right: 15, top: 9, bottom: -9, near: 1, far: 60 });
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
this.scene.add(key, key.target);
const rim = (this.rim = new T.DirectionalLight('#86b6ff', 0.9));
rim.position.set(-8, 6, -10);
this.scene.add(rim);

overlay.width = 1280; overlay.height = 640;
this.o = overlay.getContext('2d');
this.o.setTransform(2, 0, 0, 2, 0, 0);
this.OW = 640; this.OH = 320;

this.assets();
this.level = new T.Group();
this.scene.add(this.level);
this.hero = this.makeHero();
this.scene.add(this.hero.root);
this.model = null; this.useModel = !!opts.useModel;
if (opts.heroModel) this.loadHeroModel(opts.heroModel);
this.sprite = null;
if (opts.heroSprite) {
const spr = new T.Group(); spr.name = 'ritam_puppet';
const blob = new T.Mesh(new T.CircleGeometry(0.5, 24), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
blob.rotation.x = -Math.PI / 2;
this.scene.add(spr, blob);
const H = 1.28, k = H / 771;
this.sprite = { mesh: spr, blob, h: H, w: H * (350 / 771), parts: {} };
this.scene.remove(this.hero.root);
const P = {
legL: { poly: [[96,505],[185,505],[184,604],[170,624],[165,655],[158,688],[161,706],[166,740],[165,765],[130,770],[102,765],[99,740],[102,700],[106,679],[104,640],[102,590],[99,545]], pivot: [140, 515], z: -0.006, order: 1 },
legR: { poly: [[185,505],[268,505],[273,528],[279,562],[283,602],[283,642],[286,672],[289,700],[280,718],[250,721],[215,709],[199,696],[196,668],[197,642],[192,618],[184,604]], pivot: [228, 515], z: -0.004, order: 1 },
armL: { poly: [[38,326],[94,346],[90,375],[86,366],[72,400],[66,420],[56,446],[52,462],[58,490],[62,515],[52,523],[40,512],[30,522],[14,515],[8,495],[11,472],[24,440],[32,400],[40,362]], pivot: [64, 336], z: -0.002, order: 2 },
armR: { poly: [[290,330],[285,348],[277,362],[289,400],[308,440],[322,465],[336,482],[338,500],[328,506],[314,500],[302,484],[296,465],[283,440],[264,400],[254,372],[250,338]], pivot: [268, 342], z: -0.002, order: 2 },
head: { poly: [[180,5],[220,11],[250,29],[264,58],[268,95],[263,138],[251,172],[234,196],[221,206],[214,214],[160,214],[150,206],[140,194],[128,186],[115,167],[96,166],[83,146],[82,125],[92,114],[103,119],[98,95],[100,60],[115,30],[145,11]], pivot: [185, 212], z: 0.004, order: 4 }
};
const JOINT = { legL: { cut: 640, pivot: [134, 640] }, legR: { cut: 640, pivot: [240, 640] }, armL: { cut: 420, pivot: [47, 420] }, armR: { cut: 420, pivot: [286, 420] } };
const img = new Image();
img.onload = () => {
const R = img.naturalWidth / 350;
const path = (x, poly) => { x.beginPath(); poly.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); };
const mk = (draw, bx, by, bw, bh) => {
const c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(bw * R)); c.height = Math.max(2, Math.ceil(bh * R));
const x = c.getContext('2d'); x.scale(R, R); x.translate(-bx, -by); x.imageSmoothingQuality = 'high'; draw(x);
const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
const mt = new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.04, depthWrite: false, side: T.DoubleSide, toneMapped: false });
(this.sprite.mats || (this.sprite.mats = [])).push(mt);
return mt;
};
const plane = (parent, mat, bx, by, bw, bh, pivot, order) => {
const m = new T.Mesh(new T.PlaneGeometry(bw * k, bh * k), mat); m.renderOrder = 10 + order;
m.position.set((bx + bw / 2 - pivot[0]) * k, (pivot[1] - (by + bh / 2)) * k, 0); parent.add(m); return m;
};
const pivotAt = (parent, pivot, origin, z) => { const g = new T.Group(); g.position.set((pivot[0] - origin[0]) * k, (origin[1] - pivot[1]) * k, z); parent.add(g); return g; };
const draw = (x) => x.drawImage(img, 0, 0, 350, 771);
for (const name in P) {
const d = P[name], xs = d.poly.map((q) => q[0]), ys = d.poly.map((q) => q[1]);
const bx = Math.min(...xs) - 3, by = Math.min(...ys) - 3, bw = Math.max(...xs) - bx + 6, bh = Math.max(...ys) - by + 6;
const root = pivotAt(spr, d.pivot, [175, 771], d.z);
this.sprite.parts[name] = root;
const J = JOINT[name];
if (!J) { plane(root, mk((x) => { path(x, d.poly); x.clip(); draw(x); }, bx, by, bw, bh), bx, by, bw, bh, d.pivot, d.order); continue; }
const topH = J.cut + 8 - by, lowY = J.cut - 8, lowH = by + bh - lowY;
plane(root, mk((x) => { path(x, d.poly); x.clip(); x.beginPath(); x.rect(bx, by, bw, topH); x.clip(); draw(x); }, bx, by, bw, topH), bx, by, bw, topH, d.pivot, d.order);
const lower = pivotAt(root, J.pivot, d.pivot, 0.001);
plane(lower, mk((x) => { path(x, d.poly); x.clip(); x.beginPath(); x.rect(bx, lowY, bw, lowH); x.clip(); draw(x); }, bx, lowY, bw, lowH), bx, lowY, bw, lowH, J.pivot, d.order + 0.5);
this.sprite.parts[name + 'Lo'] = lower;
}
const tmat = mk((x) => {
draw(x);
x.globalCompositeOperation = 'destination-out';
for (const n of ['head', 'armL', 'armR']) { path(x, P[n].poly); x.fill(); }
x.save(); x.beginPath(); x.rect(0, 503, 350, 300); x.clip();
for (const n of ['legL', 'legR']) { path(x, P[n].poly); x.fill(); }
x.restore();
}, 0, 0, 350, 771);
const troot = pivotAt(spr, [175, 520], [175, 771], 0);
plane(troot, tmat, 0, 0, 350, 771, [175, 520], 3);
this.sprite.parts.torso = troot;
{
const sc = document.createElement('canvas'); sc.width = sc.height = 4;
const sx = sc.getContext('2d');
const sample = (px, py) => { sx.clearRect(0, 0, 4, 4); sx.drawImage(img, px * R - 2, py * R - 2, 4, 4, 0, 0, 4, 4); const q = sx.getImageData(1, 1, 1, 1).data; return [q[0], q[1], q[2]]; };
const lid = sample(200, 66), rgb = (c, f) => 'rgb(' + c.map((v) => Math.round(v * f)).join(',') + ')';
const EYES = [[175, 125, 23, 19], [241, 124, 19, 18]];
const closed = (x, happy) => {
for (const [ex, ey, rx, ry] of EYES) {
const sk = sample(ex, ey + ry + 7);
const gr = x.createLinearGradient(0, ey - ry, 0, ey + ry); gr.addColorStop(0, rgb(sk, 0.84)); gr.addColorStop(0.6, rgb(sk, 0.94)); gr.addColorStop(1, rgb(sk, 0.98));
x.save(); x.shadowColor = rgb(sk, 0.94); x.shadowBlur = 4;
x.fillStyle = gr; x.beginPath(); x.ellipse(ex, ey, rx + 3, ry + 3, 0, 0, 6.28); x.fill(); x.restore();
x.strokeStyle = '#3a2216'; x.lineWidth = 2.8; x.lineCap = 'round'; x.beginPath();
if (happy) x.arc(ex, ey + ry * 0.6, rx * 0.85, Math.PI * 1.15, Math.PI * 1.85);
else { x.moveTo(ex - rx, ey + 1); x.quadraticCurveTo(ex, ey + ry * 0.6, ex + rx, ey + 1); }
x.stroke();
}
};
const oh = (x) => { x.fillStyle = '#5a1e1e'; x.beginPath(); x.ellipse(227, 182, 10, 11.5, 0, 0, 6.28); x.fill(); x.fillStyle = '#e86a74'; x.beginPath(); x.ellipse(227, 188, 6.5, 4, 0, 0, 6.28); x.fill(); };
const d = P.head, xs = d.poly.map((q) => q[0]), ys = d.poly.map((q) => q[1]);
const bx = Math.min(...xs) - 3, by = Math.min(...ys) - 3, bw = Math.max(...xs) - bx + 6, bh = Math.max(...ys) - by + 6;
const tex = (extra) => mk((x) => { path(x, d.poly); x.clip(); draw(x); extra(x); }, bx, by, bw, bh).map;
const headMesh = this.sprite.parts.head.children[0];
this.sprite.face = { mesh: headMesh, cur: 'open', tex: { open: headMesh.material.map, blink: tex((x) => closed(x, false)), happy: tex((x) => closed(x, true)), oh: tex(oh), ohBlink: tex((x) => { closed(x, false); oh(x); }) } };
}
if (this.heroTint) for (const mt of this.sprite.mats) mt.color.copy(this.heroTint);
this.sprite.parts.legL.scale.y = 0.9; this.sprite.parts.legR.scale.y = 1.115; this.sprite.footDrop = 26 * k;
if (this.sprite.parts.armRLo) { const bt = this.makeBottle(); bt.scale.setScalar(0.62); bt.position.set((326 - 286) * k, (420 - 497) * k, 0.03); bt.rotation.z = 0.5; bt.visible = false; this.sprite.parts.armRLo.add(bt); this.sprite.bottle = bt; }
};
this.requestSprite = () => { if (!img.src) img.src = opts.heroSprite; };
if (!opts.useModel) this.requestSprite();
}

this.mobs = new Map();
this.boltPool = [];
this.shotPool = [];
this.partPool = [];
this.parts = [];
this.a = { squash: 0, squashV: 0, prevGround: true, prevVy: 0, blink: 0, nextBlink: 90, lean: 0, yaw: 0.95, deathAt: null, mArr: null,
tuft: 0, tuftV: 0, happy: 0, cheer: 0, land: 0, skid: 0, shoot: 0, idle: 0, prevFace: 1, prevVx: 0, prevPh: 0, climbPh: 0, climbZ: 0.05, cx: 0, lid: -1.38, pose: null };
this.builtMap = null;
this.sig = '';
this.setupAtmosphere();
this.v = new T.Vector3();
}

setupAtmosphere() {
const T = this.T;
const ec = document.createElement('canvas');
ec.width = 256; ec.height = 128;
const x = ec.getContext('2d');
const g = x.createLinearGradient(0, 0, 0, 128);
g.addColorStop(0, '#8aa0e0'); g.addColorStop(0.45, '#3a2d5a'); g.addColorStop(1, '#1a1020');
x.fillStyle = g; x.fillRect(0, 0, 256, 128);
for (const [px, py, r, col] of [[70, 38, 34, 'rgba(255,214,160,0.95)'], [190, 46, 26, 'rgba(170,200,255,0.8)'], [128, 100, 40, 'rgba(255,120,80,0.35)']]) {
const rg = x.createRadialGradient(px, py, 0, px, py, r);
rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
x.fillStyle = rg; x.fillRect(0, 0, 256, 128);
}
const tex = new T.CanvasTexture(ec);
tex.mapping = T.EquirectangularReflectionMapping;
tex.colorSpace = T.SRGBColorSpace;
const pm = new T.PMREMGenerator(this.gl);
this.scene.environment = pm.fromEquirectangular(tex).texture;
pm.dispose(); tex.dispose();

this.lamps = [];
for (let i = 0; i < 6; i++) { const L = new T.PointLight('#ffb070', 0, 7, 2); this.scene.add(L); this.lamps.push(L); }
this.lightSrc = []; this.torches = [];

const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
this.moteSeed = [];
for (let i = 0; i < N; i++) this.moteSeed.push([Math.random() * 26, Math.random() * 10, Math.random() * 1.6 - 0.3, Math.random() * 6.28, 0.6 + Math.random() * 0.8]);
const geo = new T.BufferGeometry();
geo.setAttribute('position', new T.BufferAttribute(pos, 3));
geo.setAttribute('color', new T.BufferAttribute(col, 3));
this.motes = new T.Points(geo, new T.PointsMaterial({ size: 0.07, map: this.tex.glow, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }));
this.scene.add(this.motes);
this.setWeather('dust');
}

setWeather(kind) {
const T = this.T, W = {
dust: { n: 160, size: 0.07, pal: ['#ffd9a8'], add: true },
rain: { n: 260, size: 0.09, pal: ['#a8c8ff', '#d8e6ff'], add: false },
leaves: { n: 70, size: 0.13, pal: ['#e8a040', '#d0602a', '#8fc84a', '#f0c050'], add: false },
fireflies: { n: 70, size: 0.12, pal: ['#d8ff7a', '#fff2a0'], add: true },
embers: { n: 140, size: 0.08, pal: ['#ffb040', '#ff7030', '#ffd27a'], add: true },
seeds: { n: 80, size: 0.1, pal: ['#ffffff', '#f2f6ff'], add: true },
drips: { n: 60, size: 0.08, pal: ['#9fd8ff'], add: true },
spores: { n: 120, size: 0.09, pal: ['#c49cff', '#7fe8ff', '#ff9ad8'], add: true },
sparks: { n: 120, size: 0.07, pal: ['#9fe6ff', '#ffffff', '#ffd27a'], add: true },
glow: { n: 200, size: 0.06, pal: ['#8fd8ff', '#c8f0ff'], add: true }
}[kind] || null;
this.weather = W ? kind : 'dust';
const w = W || { n: 160, size: 0.07, pal: ['#ffd9a8'], add: true };
this.wcfg = Object.assign({}, w, { n: this.lite ? Math.min(w.n, 90) : w.n });
const m = this.motes.material;
m.size = w.size; m.blending = w.add ? T.AdditiveBlending : T.NormalBlending; m.needsUpdate = true;
const c = new T.Color();
this.wcol = this.moteSeed.map((sd, i) => { c.set(w.pal[i % w.pal.length]); return [c.r, c.g, c.b]; });
this.wcfg = Object.assign({}, this.wcfg, { n: Math.round(this.wcfg.n * 0.55) });
this.motes.geometry.setDrawRange(0, this.wcfg.n);
}

updateLights(game, t, edit) {
const cx = (game.cam || 0) / TILE + VIEW_COLS / 2, live = [];
for (const s of this.lightSrc) {
if (s.item && s.item.gone) continue;
if (s.door && s.door.open < 0.1) continue;
const d = Math.abs(s.x - cx);
if (d < 13) live.push([d, s]);
}
live.sort((a, b) => a[0] - b[0]);
const maxLamps = this.lite ? 3 : this.lamps.length;
this.lamps.forEach((L, i) => {
const s = i < maxLamps && live[i] && live[i][1];
if (!s) { L.intensity = 0; return; }
L.position.set(s.x, s.y, s.z);
L.color.set(s.color);
const k = s.flick ? 0.85 + Math.sin(t * 0.3 + s.x * 3) * 0.1 + Math.random() * 0.08 : (s.door ? s.door.open : 1);
L.intensity = s.base * k;
});
}

updateMotes(game, t, edit) {
this.motes.visible = !edit;
if (edit) return;
const cx = (game.cam || 0) / TILE - 3, arr = this.motes.geometry.attributes.position.array, ca = this.motes.geometry.attributes.color.array;
const k = this.weather, n = this.wcfg.n, wrap = (v, m) => ((v % m) + m) % m;
for (let i = 0; i < n; i++) {
const [x0, y0, z, ph, sp] = this.moteSeed[i];
let x = x0, y = y0, b = 1;
if (k === 'rain') { x = x0 - t * 0.04 * sp; y = wrap(y0 - t * 0.2 * sp, 10.5); }
else if (k === 'leaves') { x = x0 + t * 0.006 + Math.sin(t * 0.03 + ph) * 0.4; y = wrap(y0 - t * 0.011 * sp, 10.5); }
else if (k === 'fireflies') { x = x0 + Math.sin(t * 0.008 * sp + ph) * 0.8; y = 1 + y0 * 0.6 + Math.sin(t * 0.011 + ph * 2) * 0.5; b = Math.max(0.05, Math.sin(t * 0.045 * sp + ph)); }
else if (k === 'embers' || k === 'spores') { const v = k === 'embers' ? 0.022 : 0.008; x = x0 + Math.sin(t * 0.04 + ph) * 0.18; y = wrap(y0 + t * v * sp, 10.5); b = 0.5 + 0.5 * Math.sin(t * 0.2 + ph); }
else if (k === 'seeds') { x = x0 + t * 0.007 * sp + Math.sin(t * 0.02 + ph) * 0.3; y = wrap(y0 + t * 0.004 * sp + Math.sin(t * 0.03 + ph) * 0.2, 10.5); }
else if (k === 'drips') { y = wrap(y0 - t * 0.12 * sp, 12) - 1; b = y < 0 ? 0 : 1; }
else if (k === 'sparks') { x = x0 + Math.sin(t * 0.07 * sp + ph) * 0.25; y = wrap(y0 - t * 0.03 * sp, 10.5); b = Math.random() < 0.3 ? 1 : 0.25; }
else if (k === 'glow') { y = 7.4 + (y0 / 10) * 2.2; b = 0.25 + 0.75 * Math.max(0, Math.sin(t * 0.03 * sp + ph)); }
else { x = x0 + t * 0.004 + Math.sin(t * 0.01 + ph) * 0.3; y = wrap(y0 + t * 0.003, 10); b = 0.6; }
arr[i * 3] = cx + wrap(x - cx, 26); arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
const c = this.wcol[i]; ca[i * 3] = c[0] * b; ca[i * 3 + 1] = c[1] * b; ca[i * 3 + 2] = c[2] * b;
}
this.motes.geometry.attributes.position.needsUpdate = true;
this.motes.geometry.attributes.color.needsUpdate = true;
}

flavorFor(game) {
const F = [
{ name: 'Sunny morning', fx: 'dust', props: ['bunting'], key: '#fff2d6', keyI: 2.5, bg: '#1a1430' },
{ name: 'Wash day', fx: 'dust', props: ['laundry', 'bunting'] },
{ name: 'Rain shower', fx: 'rain', props: ['laundry'], key: '#cfe0ff', keyI: 1.7, bg: '#0e1426', sky: '#a8c0e8' },
{ name: 'Hot sunset', fx: 'embers', props: ['bunting'], key: '#ffb070', keyI: 2.4, bg: '#2a1020', sky: '#ffb89a' },
{ name: 'Fair night', fx: 'fireflies', props: ['lights'], key: '#d8c8ff', keyI: 1.5, bg: '#0c0a1e' },
{ name: 'Sunbeams', fx: 'leaves', props: ['shafts'] },
{ name: 'Mushroom grove', fx: 'spores', props: ['mushrooms'] },
{ name: 'Firefly dusk', fx: 'fireflies', props: ['mushrooms'], key: '#c8b8ff', keyI: 1.4, bg: '#070d14' },
{ name: 'Lantern woods', fx: 'seeds', props: ['lights', 'mist'] },
{ name: 'Misty morning', fx: 'seeds', props: ['mist', 'shafts'], key: '#e8f4ff', keyI: 2.0, bg: '#10241e' },
{ name: 'Dripping halls', fx: 'drips', props: ['glowshrooms'] },
{ name: 'Glow-worm ceiling', fx: 'glow', props: ['glowshrooms'] },
{ name: 'Lava light', fx: 'embers', props: ['bigcrystals'], key: '#ffb090', keyI: 1.8, bg: '#160606', ground: '#ff4a20' },
{ name: 'Crystal hum', fx: 'spores', props: ['bigcrystals'] },
{ name: 'Underground pond', fx: 'drips', props: ['bigcrystals', 'mist'] },
{ name: 'Above the clouds', fx: 'dust', props: ['gears', 'mist'], key: '#ffffff', keyI: 2.6, bg: '#14244a' },
{ name: 'Steam works', fx: 'sparks', props: ['steam', 'gears'] },
{ name: 'Night patrol', fx: 'glow', props: ['searchlights'], key: '#c8d8ff', keyI: 1.4, bg: '#04081a' },
{ name: 'Red alert', fx: 'sparks', props: ['beacons', 'steam'], key: '#ffd0d0', keyI: 1.7, bg: '#140a14' },
{ name: 'Storm', fx: 'rain', props: ['lightning', 'searchlights'], key: '#d0d8ff', keyI: 1.5, bg: '#06081a' }
];
const i = game.levelIndex || 0;
if (i < F.length && game.world == null) return F[i];
const w = Math.max(0, Math.min(3, game.world != null ? game.world : (game.themeOf ? game.themeOf(i) : Math.floor(i / 5) % 4)));
return F[w * 5 + (game.world != null ? (game.cols || 0) : i) % 5];
}

buildFlavor(grid, cols, f) {
const T = this.T, g = this.g, m = this.m, M = this.mesh.bind(this);
const A = (this.flavorAnim = []);
const empty = (r, c) => r > 0 && r < ROWS && c > 0 && c < cols && grid[r][c] === '.';
const solid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < cols && grid[r][c] === '#';
const std = (o) => new T.MeshStandardMaterial(o);
const fm = this.fmat || (this.fmat = {
flags: ['#e3382d', '#ffd23f', '#3f88b4', '#3fd26a', '#ff8ac0'].map((c) => std({ color: c, roughness: 0.6, side: T.DoubleSide })),
cloth: ['#f4f1ea', '#e3382d', '#3f88b4', '#ffd23f', '#8fd0a0'].map((c) => std({ color: c, roughness: 0.85, side: T.DoubleSide })),
bulbs: ['#ffd27a', '#ff9a6a', '#fff2c0'].map((c) => new T.MeshBasicMaterial({ color: c })),
cord: std({ color: '#2a2420', roughness: 0.8 }),
cap: std({ color: '#e0342b', roughness: 0.5 }), dot: std({ color: '#fff6ea', roughness: 0.6 }), stem: std({ color: '#f2e8d6', roughness: 0.8 }),
gcap: std({ color: '#7fe8ff', emissive: '#2ab8e8', emissiveIntensity: 1.2, roughness: 0.4 }),
gear: std({ color: '#8a96a8', roughness: 0.35, metalness: 0.8 }),
big: std({ color: '#c8b0ff', emissive: '#6a3ae8', emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.92 }),
beacon: new T.MeshBasicMaterial({ color: '#ff3a3a' }),
beam: new T.MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }),
shaft: (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 128); const t = new T.CanvasTexture(c); return new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); })()
});
const rope = (x1, x2, y, sag, z, mat) => {
const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16; pts.push(new T.Vector3(x1 + (x2 - x1) * u, y - sag * 4 * u * (1 - u), z)); }
const mesh = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 0.008, 4, false), mat || fm.cord);
mesh.userData.ownsGeo = true; this.level.add(mesh);
return (u) => [x1 + (x2 - x1) * u, y - sag * 4 * u * (1 - u)];
};
const spans = (row, step, len) => { const out = []; for (let c = 3; c + len < cols - 2; c += step) { let ok = true; for (let k = 0; k <= len; k++) if (!empty(row, c + k)) ok = false; if (ok) out.push(c); } return out; };
const has = (p) => f.props.includes(p);
if (has('bunting')) for (const c of spans(1, 8, 6)) {
const at = rope(c, c + 6, ROWS - 1.25, 0.45, -0.32);
for (let k = 1; k < 14; k++) { const [x, y] = at(k / 14); const fl = new T.Group(); fl.position.set(x, y, -0.32); this.level.add(fl); const t = M(g.cone, fm.flags[k % 5], [0.09, 0.16, 0.012], [0, -0.08, 0], fl); t.rotation.z = Math.PI; t.castShadow = false; A.push({ type: 'sway', o: fl, ph: k + c, amp: 0.18 }); }
}
if (has('laundry')) for (const c of spans(2, 11, 5)) {
const at = rope(c, c + 5, ROWS - 2.2, 0.3, -0.3);
[0.18, 0.34, 0.5, 0.66, 0.82].forEach((u, k) => {
const [x, y] = at(u); const it = new T.Group(); it.position.set(x, y, -0.3); this.level.add(it);
const kind = (k + c) % 3, mat = fm.cloth[(k + c) % 5];
if (kind === 0) { M(g.box, mat, [0.26, 0.24, 0.012], [0, -0.13, 0], it); M(g.box, mat, [0.36, 0.08, 0.012], [0, -0.04, 0], it); }
else if (kind === 1) { M(g.box, mat, [0.09, 0.3, 0.012], [-0.06, -0.15, 0], it); M(g.box, mat, [0.09, 0.3, 0.012], [0.06, -0.15, 0], it); }
else { M(g.box, mat, [0.06, 0.14, 0.012], [0, -0.07, 0], it); M(g.box, mat, [0.08, 0.04, 0.012], [0.02, -0.14, 0], it); }
M(g.box, m.wood, [0.02, 0.05, 0.02], [0, -0.01, 0.01], it);
A.push({ type: 'cloth', o: it, ph: k * 1.7 + c });
});
}
if (has('lights')) for (const c of spans(1, 7, 6)) {
const at = rope(c, c + 6, ROWS - 1.3, 0.55, -0.3);
for (let k = 1; k < 12; k++) { const [x, y] = at(k / 12); const b = M(g.sphere, fm.bulbs[k % 3], [0.03, 0.04, 0.03], [x, y - 0.05, -0.3], this.level); b.castShadow = false; if (k % 2) { const gl = this.glow(['#ffd27a', '#ff9a6a', '#fff2c0'][k % 3], 0.5, 0.5); gl.position.set(x, y - 0.05, -0.25); this.level.add(gl); A.push({ type: 'twinkle', o: gl, ph: k * 1.3 + c }); } }
}
if (has('mushrooms') || has('glowshrooms')) {
const glowy = has('glowshrooms');
for (let r = 1; r < ROWS - 1; r++) for (let c = 2; c < cols - 2; c++) if (empty(r, c) && solid(r + 1, c) && hash(r * 17, c * 5) > 0.8) {
const sc = 0.7 + hash(c, r) * 0.6, grp = new T.Group(); grp.position.set(c + 0.2 + hash(r, c * 3) * 0.6, ROWS - 1 - r - 0.5 + 0.5 - 0.5, -0.36); grp.position.y = this.wy(r) - 0.5; grp.scale.setScalar(sc); this.level.add(grp);
M(g.cyl, fm.stem, [0.025, 0.09, 0.025], [0, 0.045, 0], grp);
M(g.half, glowy ? fm.gcap : fm.cap, [0.08, 0.06, 0.08], [0, 0.085, 0], grp);
if (!glowy) for (let d = 0; d < 3; d++) M(g.sphere, fm.dot, [0.012, 0.01, 0.012], [Math.cos(d * 2.1) * 0.045, 0.12, Math.sin(d * 2.1) * 0.045 + 0.02], grp);
else { const gl = this.glow('#7fe8ff', 0.6, 0.5); gl.position.set(0, 0.1, 0.05); grp.add(gl); A.push({ type: 'twinkle', o: gl, ph: c + r }); }
A.push({ type: 'squish', o: grp, ph: c * 0.7, s: sc });
}
}
if (has('shafts')) for (let c = 4; c < cols - 3; c += 7) {
const sh = new T.Mesh(g.plane, fm.shaft); sh.scale.set(1.3, 9, 1); sh.position.set(c + hash(c, 1) * 2, ROWS / 2 + 0.6, -0.42); sh.rotation.z = -0.32; this.level.add(sh);
A.push({ type: 'shaft', o: sh, ph: c });
}
if (has('mist')) for (let c = 2; c < cols; c += 6) {
const ms = this.glow('#e8f0ff', 3 + hash(c, 2) * 2, 0.05); ms.position.set(c, 1 + hash(c, 5) * 2.5, -0.15 + hash(c, 7) * 0.3); this.level.add(ms);
A.push({ type: 'mist', o: ms, x: c, ph: c * 0.4 });
}
if (has('bigcrystals')) for (let c = 3; c < cols - 3; c += 6) {
let r = -1; for (let rr = ROWS - 2; rr > 1; rr--) if (empty(rr, c) && solid(rr + 1, c)) { r = rr; break; }
if (r < 0) continue;
const grp = new T.Group(); grp.position.set(c + 0.5, this.wy(r) - 0.5, -0.4); this.level.add(grp);
for (let k = 0; k < 4; k++) { const cr = M(g.oct, fm.big, [0.5 + k * 0.12, 1.6 + hash(c, k) * 1.4, 0.5], [(k - 1.5) * 0.12, 0.2, (hash(k, c) - 0.5) * 0.1], grp); cr.rotation.z = (k - 1.5) * 0.25; cr.castShadow = false; }
const gl = this.glow('#b49cff', 1.6, 0.4); gl.position.set(0, 0.3, 0.1); grp.add(gl);
A.push({ type: 'crystal', o: gl, ph: c });
}
if (has('gears')) for (let c = 4; c < cols - 3; c += 9) {
const r = 2 + Math.floor(hash(c, 9) * 3); if (!empty(r, c) || !empty(r + 1, c)) continue;
const gr = new T.Group(); gr.position.set(c + 0.5, this.wy(r) - 0.3, -0.46); const sc = 0.5 + hash(c, 4) * 0.4; gr.scale.setScalar(sc); this.level.add(gr);
const ring = M(g.torus, fm.gear, [3.2, 3.2, 2], [0, 0, 0], gr); ring.castShadow = false;
for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, tth = M(g.box, fm.gear, [0.12, 0.14, 0.08], [Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0], gr); tth.rotation.z = a; tth.castShadow = false; }
M(g.cyl, fm.gear, [0.12, 0.1, 0.12], [0, 0, 0], gr).rotation.x = Math.PI / 2;
A.push({ type: 'gear', o: gr, dir: (c % 2 ? 1 : -1) / sc });
}
if (has('steam')) {
const pipe = M(g.cyl, m.steel, [0.06, cols - 2, 0.06], [cols / 2, ROWS - 1.25, -0.44], this.level); pipe.rotation.z = Math.PI / 2; pipe.castShadow = false;
for (let c = 5; c < cols - 3; c += 6) { M(g.cyl, m.steelDark, [0.09, 0.08, 0.09], [c + 0.5, ROWS - 1.25, -0.44], this.level).rotation.z = Math.PI / 2; A.push({ type: 'steam', x: c + 0.5, y: ROWS - 1.32, ph: c }); }
}
if (has('searchlights')) for (let c = 6; c < cols - 3; c += 10) {
const piv = new T.Group(); piv.position.set(c + 0.5, 0.95, -0.44); this.level.add(piv);
const cone = new T.Mesh(new T.ConeGeometry(0.9, 8, 16, 1, true), fm.beam); cone.userData.ownsGeo = true; cone.position.y = 4; cone.rotation.x = Math.PI; piv.add(cone);
A.push({ type: 'search', o: piv, ph: c });
}
if (has('beacons')) for (let c = 5; c < cols - 3; c += 8) {
let r = -1; for (let rr = 1; rr < ROWS - 1; rr++) if (solid(rr, c) && empty(rr + 1, c)) { r = rr; break; }
if (r < 0) continue;
const b = M(g.half, fm.beacon, [0.1, 0.1, 0.1], [c + 0.5, this.wy(r) - 0.62, 0.3], this.level); b.rotation.x = Math.PI; b.castShadow = false;
const gl = this.glow('#ff3a3a', 2.2, 0.5); gl.position.set(c + 0.5, this.wy(r) - 0.7, 0.35); this.level.add(gl);
A.push({ type: 'beacon', o: gl, ph: c });
}
this.lightning = has('lightning') ? { flash: 0 } : null;
}

updateFlavor(game, t, edit) {
for (const a of this.flavorAnim || []) {
switch (a.type) {
case 'sway': a.o.rotation.x = Math.sin(t * 0.04 + a.ph) * a.amp; a.o.rotation.z = Math.sin(t * 0.03 + a.ph * 1.3) * a.amp * 0.4; break;
case 'cloth': a.o.rotation.x = Math.sin(t * 0.035 + a.ph) * 0.3 + 0.12; a.o.rotation.z = Math.sin(t * 0.05 + a.ph) * 0.08; break;
case 'twinkle': a.o.material.opacity = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.06 + a.ph * 2.3)); break;
case 'squish': a.o.scale.set(a.s * (1 + Math.sin(t * 0.05 + a.ph) * 0.04), a.s * (1 - Math.sin(t * 0.05 + a.ph) * 0.04), a.s); break;
case 'shaft': a.o.material.opacity = 0.12 + Math.sin(t * 0.012 + a.ph) * 0.05; break;
case 'mist': a.o.position.x = a.x + Math.sin(t * 0.004 + a.ph) * 1.5; a.o.material.opacity = 0.06 + Math.sin(t * 0.01 + a.ph) * 0.03; break;
case 'crystal': a.o.material.opacity = 0.3 + Math.sin(t * 0.03 + a.ph) * 0.15; a.o.material.color.setHSL((t * 0.0015 + a.ph * 0.05) % 1, 0.8, 0.7); break;
case 'gear': a.o.rotation.z = t * 0.01 * a.dir; break;
case 'steam': if (!edit && Math.random() < 0.04) this.particle(a.x + (Math.random() - 0.5) * 0.1, a.y, -0.4, (Math.random() - 0.5) * 0.004, -0.012, 0.006, '#e8eef6', 0.08 + Math.random() * 0.06, 60, 0); break;
case 'search': a.o.rotation.z = Math.sin(t * 0.008 + a.ph) * 0.6; break;
case 'beacon': a.o.material.opacity = Math.max(0, Math.sin(t * 0.12 + a.ph)) * 0.7; break;
}
}
if (this.lightning && !edit) {
const L = this.lightning;
if (L.flash <= 0 && Math.random() < 0.0035) L.flash = 1;
L.flash = Math.max(0, L.flash - 0.06);
const k = L.flash > 0.5 || (L.flash > 0.2 && L.flash < 0.3) ? L.flash : 0;
this.key.intensity = this.keyBase + k * 5;
this.scene.background.setRGB(this.bgBase.r + k * 0.35, this.bgBase.g + k * 0.38, this.bgBase.b + k * 0.45);
}
}

buildCritters(grid, cols, th) {
const T = this.T, g = this.g, M = this.mesh.bind(this), ht = this.homeTextures(), m = this.m;
const C = (this.critters = { flowers: [], birds: [], fish: [], snails: [], flies: [] });
const solid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < cols && grid[r][c] === '#';
const open = (r, c) => r > 0 && r < ROWS && c > 0 && c < cols - 1 && grid[r][c] === '.';
const cm = this.critterMats || (this.critterMats = {
petals: ['#ff6fa0', '#ffd34a', '#ffffff', '#b48cff', '#ff8a4a'].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.5 })),
stem: new T.MeshStandardMaterial({ color: '#4fa83c', roughness: 0.7 }),
birds: ['#4a8fe0', '#e8c040', '#e0603a', '#7ac85a'].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.55 })),
belly: new T.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.6 }),
fish: new T.MeshStandardMaterial({ color: '#ff8a3a', roughness: 0.3, metalness: 0.2 }),
shell: new T.MeshStandardMaterial({ color: '#c88a4a', roughness: 0.5 }),
snail: new T.MeshStandardMaterial({ color: '#d8e0a0', roughness: 0.6 })
});
const lush = th.name === 'forest' ? 0.68 : th.name === 'town' ? 0.8 : th.name === 'caves' ? 0.94 : 0.9;
for (let c = 6; c < cols - 2; c++) for (let r = 2; r < ROWS; r++) {
if (!solid(r, c) || !open(r - 1, c)) continue;
if (grid[r - 1][c - 1] === '^' || grid[r - 1][c + 1] === '^') continue;
for (let k = 0; k < 2; k++) {
if (hash(r * 7 + k, c * 3) < lush) continue;
const fl = new T.Group(); const fx = c + 0.15 + hash(c, r + k) * 0.7;
fl.position.set(fx, this.wy(r) + 0.5, 0.36 + hash(r, c * 5 + k) * 0.1); this.level.add(fl);
const h = 0.1 + hash(c * 3, r + k) * 0.09, pm = cm.petals[Math.floor(hash(c + k, r * 9) * 5)];
const st = M(g.cyl, cm.stem, [0.006, h, 0.006], [0, h / 2, 0], fl); st.castShadow = false;
const hd = new T.Group(); hd.position.y = h; fl.add(hd);
for (let q = 0; q < 5; q++) { const a = (q / 5) * Math.PI * 2; const pe = M(g.sphere, pm, [0.022, 0.012, 0.012], [Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0], hd); pe.castShadow = false; }
M(g.sphere, m.gold, [0.012, 0.012, 0.01], [0, 0, 0.006], hd).castShadow = false;
C.flowers.push({ o: fl, x: fx, y: this.wy(r) + 0.5, ph: c * 1.3 + k, bend: 0, v: 0 });
}
}
for (let c = 10; c < cols - 4; c += 9 + Math.floor(hash(c, 3) * 6)) {
let r = -1; for (let rr = 2; rr < ROWS; rr++) if (solid(rr, c) && open(rr - 1, c) && open(rr - 2, c)) { r = rr; break; }
if (r < 0) continue;
const bd = new T.Group(); bd.position.set(c + 0.5, this.wy(r) + 0.5, 0.15); this.level.add(bd);
const mat = cm.birds[Math.floor(hash(c, r) * 4)];
M(g.sphere, mat, [0.06, 0.05, 0.045], [0, 0.06, 0], bd);
M(g.sphere, cm.belly, [0.04, 0.035, 0.03], [0.018, 0.05, 0.022], bd);
const hd = new T.Group(); hd.position.set(0.05, 0.11, 0); bd.add(hd);
M(g.sphere, mat, [0.036, 0.034, 0.034], [0, 0, 0], hd);
M(g.cone, ht.beak, [0.012, 0.03, 0.012], [0.04, -0.004, 0], hd).rotation.z = -Math.PI / 2;
for (const sz of [1, -1]) M(g.sphere, m.pupil, [0.007, 0.008, 0.005], [0.018, 0.01, sz * 0.03], hd);
const wings = [];
for (const sz of [1, -1]) { const wp = new T.Group(); wp.position.set(-0.01, 0.075, sz * 0.04); bd.add(wp); M(g.sphere, mat, [0.05, 0.01, 0.035], [-0.01, 0, sz * 0.025], wp); wings.push({ wp, sz }); }
M(g.box, mat, [0.05, 0.012, 0.03], [-0.07, 0.07, 0], bd).rotation.z = 0.4;
C.birds.push({ o: bd, hd, wings, x: c + 0.5, y: this.wy(r) + 0.5, state: 'perch', t: 0, dir: hash(r, c) > 0.5 ? 1 : -1, ph: c });
}
for (let r = 1; r < ROWS; r++) for (let c = 1; c < cols - 1; c++) {
if (grid[r][c] !== '~' || grid[r][c - 1] === '~') continue;
let w = 0; while (grid[r][c + w] === '~') w++;
if (w < 2) continue;
const fs = new T.Group(); fs.visible = false; this.level.add(fs);
M(g.sphere, cm.fish, [0.1, 0.055, 0.04], [0, 0, 0], fs);
M(g.cone, cm.fish, [0.05, 0.08, 0.02], [-0.11, 0, 0], fs).rotation.z = Math.PI / 2;
for (const sz of [1, -1]) M(g.sphere, m.pupil, [0.01, 0.01, 0.006], [0.06, 0.015, sz * 0.034], fs);
C.fish.push({ o: fs, x0: c + 0.3, x1: c + w - 0.3, y: this.wy(r) + 0.3, t: -60 - hash(r, c) * 240 });
}
let sn = 0;
for (let c = 8; c < cols - 3 && sn < 3; c += 13) {
let r = -1; for (let rr = ROWS - 1; rr > 1; rr--) if (solid(rr, c) && open(rr - 1, c)) { r = rr; break; }
if (r < 0) continue;
const so = new T.Group(); so.position.set(c + 0.5, this.wy(r) + 0.5, -0.38); this.level.add(so);
M(g.sphere, cm.snail, [0.06, 0.02, 0.025], [0, 0.018, 0], so);
M(g.sphere, cm.shell, [0.04, 0.042, 0.03], [-0.012, 0.055, 0], so);
M(g.torus, cm.belly, [0.17, 0.17, 0.12], [-0.012, 0.055, 0.026], so);
for (const sz of [1, -1]) M(g.cyl, cm.snail, [0.003, 0.03, 0.003], [0.05, 0.05, sz * 0.008], so).rotation.z = -0.4;
C.snails.push({ o: so, r, x: c + 0.5, dir: 1 }); sn++;
}
for (let k = 0; k < (th.name === 'town' || th.name === 'forest' ? 3 : 0) && C.flowers.length; k++) {
const f = C.flowers[Math.floor(hash(k, 77) * C.flowers.length)];
const bf = new T.Group(); this.level.add(bf);
M(g.cyl, ht.bug, [0.005, 0.04, 0.005], [0, 0, 0], bf);
const wl = [], wm = k % 2 ? ht.wingA : ht.wingB;
for (const sx of [1, -1]) { const wp = new T.Group(); bf.add(wp); M(g.sphere, wm, [0.028, 0.024, 0.003], [sx * 0.028, 0.008, 0], wp).castShadow = false; M(g.sphere, wm, [0.018, 0.015, 0.003], [sx * 0.02, -0.014, 0], wp).castShadow = false; wl.push({ wp, sx }); }
C.flies.push({ o: bf, wl, cx: f.x, cy: f.y + 0.6, ph: k * 1.9 });
}
}

updateCritters(game, t, edit) {
const C = this.critters; if (!C) return;
const p = game.player, px = (p.x + p.w / 2) / TILE, py = ROWS - (p.y + p.h) / TILE;
for (const f of C.flowers) {
const dx = f.x - px, near = Math.abs(dx) < 0.45 && Math.abs(py - f.y) < 0.6 && !edit;
const target = near ? Math.sign(dx || 1) * -0.9 * (1 - Math.abs(dx) / 0.45) : Math.sin(t * 0.03 + f.ph) * 0.08;
f.v += (target - f.bend) * 0.2; f.v *= 0.7; f.bend += f.v;
f.o.rotation.z = f.bend;
}
for (const b of C.birds) {
if (b.state === 'perch') {
b.o.position.set(b.x, b.y, 0.15);
b.hd.rotation.z = Math.sin(t * 0.08 + b.ph) > 0.9 ? -0.7 : 0;
b.o.rotation.y = Math.sin(t * 0.01 + b.ph) > 0 ? 0 : Math.PI;
for (const w of b.wings) w.wp.rotation.x = w.sz * 0.1;
if (!edit && Math.abs(px - b.x) < 1.8 && Math.abs(py - b.y) < 2.5) { b.state = 'fly'; b.t = 0; b.dir = px < b.x ? 1 : -1; }
} else if (b.state === 'fly') {
b.t++;
b.o.position.set(b.x + b.dir * b.t * 0.05, b.y + b.t * 0.035 + Math.sin(b.t * 0.3) * 0.03, 0.15 - b.t * 0.002);
b.o.rotation.y = b.dir > 0 ? 0 : Math.PI;
for (const w of b.wings) w.wp.rotation.x = w.sz * (0.2 + Math.abs(Math.sin(t * 1.1)) * 1.4);
if (b.t > 160) { b.state = 'gone'; b.o.visible = false; }
} else if (b.state === 'gone' && Math.abs(px - b.x) > 9) { b.state = 'perch'; b.o.visible = true; }
}
for (const f of C.fish) {
f.t++;
if (f.t < 0 || edit) { f.o.visible = false; continue; }
const u = f.t / 70;
if (u >= 1) { f.t = -180 - Math.random() * 300; f.o.visible = false; this.burst({ x: f.x1, y: f.y, z: 0.1 }, '#bfe6ff', 8); continue; }
if (f.t === 1) this.burst({ x: f.x0, y: f.y, z: 0.1 }, '#bfe6ff', 8);
f.o.visible = true;
f.o.position.set(f.x0 + (f.x1 - f.x0) * u, f.y + Math.sin(u * Math.PI) * 1.2, 0.12);
f.o.rotation.z = Math.cos(u * Math.PI) * 0.9;
}
for (const sn of C.snails) {
if (edit) break;
const nx = sn.x + sn.dir * 0.0025, c = Math.floor(nx + sn.dir * 0.3);
const ok = this.walkable && this.walkable(sn.r, c);
if (!ok) sn.dir *= -1; else sn.x = nx;
sn.o.position.x = sn.x; sn.o.rotation.y = sn.dir > 0 ? 0 : Math.PI;
sn.o.scale.x = 1 + Math.sin(t * 0.08) * 0.05;
}
for (const b of C.flies) {
const k = t * 0.014 + b.ph;
b.o.position.set(b.cx + Math.sin(k) * 0.9, b.cy + Math.sin(k * 1.6) * 0.3, 0.3 + Math.cos(k * 1.2) * 0.1);
const f = Math.sin(t * 0.7 + b.ph) * 1.1;
for (const w of b.wl) w.wp.rotation.y = w.sx * f;
}
}


brickTex(base, light, dark, mortar) {
const T = this.T, c = document.createElement('canvas');
c.width = c.height = 32;
const x = c.getContext('2d');
x.fillStyle = mortar; x.fillRect(0, 0, 32, 32);
for (let row = 0; row < 4; row++) {
const off = row % 2 ? 8 : 0;
for (let bx = -16; bx < 32; bx += 16) {
const X = bx + off + 1, Y = row * 8 + 1;
x.fillStyle = base; x.fillRect(X, Y, 14, 6);
x.fillStyle = light; x.fillRect(X, Y, 14, 1);
x.fillStyle = dark; x.fillRect(X, Y + 5, 14, 1);
}
}
const t = new T.CanvasTexture(c);
t.magFilter = T.NearestFilter;
t.colorSpace = T.SRGBColorSpace;
t.anisotropy = 4;
return t;
}

glowTex() {
const T = this.T, c = document.createElement('canvas');
c.width = c.height = 64;
const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
x.fillStyle = g; x.fillRect(0, 0, 64, 64);
return new T.CanvasTexture(c);
}

makeBrick(o) {
const T = this.T, S = 128, rows = 4, bh = S / rows, bw = S / 2;
let seed = o.seed || 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
const [cc, x] = mk(), [bc, b] = mk();
x.fillStyle = o.mortar; x.fillRect(0, 0, S, S);
b.fillStyle = '#303030'; b.fillRect(0, 0, S, S);
for (let r = 0; r < rows; r++) {
const off = r % 2 ? bw / 2 : 0;
for (let bx = -bw; bx < S + bw; bx += bw) {
const X = bx + off + 2.5, Y = r * bh + 2.5, w = bw - 5, h = bh - 5;
x.fillStyle = shade(o.base, (rnd() - 0.5) * o.vary); x.fillRect(X, Y, w, h);
x.fillStyle = 'rgba(255,255,255,0.13)'; x.fillRect(X, Y, w, 2);
x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(X, Y + h - 3, w, 3);
b.fillStyle = '#c8c8c8'; b.fillRect(X, Y, w, h);
b.fillStyle = '#f0f0f0'; b.fillRect(X + 2, Y + 2, w - 4, h - 4);
for (let k = 0; k < 3; k++) {
const px = X + rnd() * w, py = Y + rnd() * h, rr = 1 + rnd() * 2.5;
x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(px, py, rr, 0, 6.28); x.fill();
b.fillStyle = '#909090'; b.beginPath(); b.arc(px, py, rr, 0, 6.28); b.fill();
}
}
}
for (const [ctx, amt] of [[x, o.noise], [b, 18]]) {
const img = ctx.getImageData(0, 0, S, S), d = img.data;
for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
ctx.putImageData(img, 0, 0);
}
const map = new T.CanvasTexture(cc); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
const bump = new T.CanvasTexture(bc); bump.anisotropy = 8;
return { map, bump };
}

makeWood() {
const T = this.T, S = 128, c = document.createElement('canvas');
c.width = c.height = S;
const x = c.getContext('2d');
x.fillStyle = '#e2c49e'; x.fillRect(0, 0, S, S);
for (let i = 0; i < 38; i++) {
const y0 = (i / 38) * S + Math.random() * 3;
x.strokeStyle = 'rgba(90,50,20,' + (0.12 + Math.random() * 0.22).toFixed(2) + ')';
x.lineWidth = 0.6 + Math.random() * 1.4;
x.beginPath();
for (let px = 0; px <= S; px += 8) { const yy = y0 + Math.sin(px / 18 + i) * 1.6; px === 0 ? x.moveTo(px, yy) : x.lineTo(px, yy); }
x.stroke();
}
x.fillStyle = 'rgba(80,40,15,0.35)'; x.beginPath(); x.ellipse(40, 70, 5, 3, 0, 0, 6.28); x.fill();
const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
return t;
}

makeSurface(o) {
if (o.pattern === 'brick') return this.makeBrick(o);
const T = this.T, S = 128;
let seed = o.seed || 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
const [cc, x] = mk(), [bc, b] = mk();
const rr = (ctx, X, Y, w, h, r) => { ctx.beginPath(); ctx.moveTo(X + r, Y); ctx.arcTo(X + w, Y, X + w, Y + h, r); ctx.arcTo(X + w, Y + h, X, Y + h, r); ctx.arcTo(X, Y + h, X, Y, r); ctx.arcTo(X, Y, X + w, Y, r); ctx.closePath(); };
x.fillStyle = o.mortar; x.fillRect(0, 0, S, S);
b.fillStyle = '#262626'; b.fillRect(0, 0, S, S);
const block = (X, Y, w, h, rad) => {
const v = (rnd() - 0.5) * o.vary, spots = [], moss = [];
for (let k = 0; k < 3; k++) spots.push([rnd(), rnd(), 1 + rnd() * 2.5]);
if (o.moss && rnd() < 0.6) for (let k = 0; k < 8; k++) moss.push([rnd(), rnd() * 0.32, 2.5 + rnd() * 5]);
for (const ox of [-S, 0]) {
const XX = X + ox;
if (XX > S || XX + w < 0) continue;
x.fillStyle = shade(o.base, v); rr(x, XX, Y, w, h, rad); x.fill();
x.fillStyle = 'rgba(255,255,255,0.14)'; rr(x, XX + 2, Y + 1.5, w - 4, 3, 1.5); x.fill();
x.fillStyle = 'rgba(0,0,0,0.3)'; rr(x, XX + 2, Y + h - 4, w - 4, 3, 1.5); x.fill();
b.fillStyle = '#bcbcbc'; rr(b, XX, Y, w, h, rad); b.fill();
b.fillStyle = '#ededed'; rr(b, XX + 3, Y + 3, w - 6, h - 6, Math.max(1, rad - 2)); b.fill();
for (const [sx, sy, r] of spots) {
x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.arc(XX + sx * w, Y + sy * h, r, 0, 6.28); x.fill();
b.fillStyle = '#8a8a8a'; b.beginPath(); b.arc(XX + sx * w, Y + sy * h, r, 0, 6.28); b.fill();
}
for (const [mx, my, r] of moss) { x.fillStyle = 'rgba(92,158,60,0.6)'; x.beginPath(); x.arc(XX + mx * w, Y + my * h, r, 0, 6.28); x.fill(); }
if (o.pattern === 'plate') {
for (let l = Y + 8; l < Y + h - 8; l += 2) { x.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.06).toFixed(3) + ')'; x.fillRect(XX + 4, l, w - 8, 1); }
for (const [px, py] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) {
x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.arc(XX + px + 0.7, Y + py + 0.9, 2.8, 0, 6.28); x.fill();
x.fillStyle = shade(o.base, 0.3); x.beginPath(); x.arc(XX + px, Y + py, 2.3, 0, 6.28); x.fill();
b.fillStyle = '#ffffff'; b.beginPath(); b.arc(XX + px, Y + py, 2.5, 0, 6.28); b.fill();
}
}
}
};
if (o.pattern === 'plate') {
for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) block(c * 64 + 2, r * 64 + 2, 60, 60, 3);
} else {
const rows = 3, bh = S / rows;
for (let r = 0; r < rows; r++) {
const ws = []; let tot = 0;
while (S - tot > 54) { const w = 24 + rnd() * 30; ws.push(w); tot += w; }
ws.push(S - tot);
let X = rnd() * 40;
for (const w of ws) { block(X % S + 2, r * bh + 2, w - 4, bh - 4, 7); X += w; }
}
}
for (const [ctx, amt] of [[x, o.noise], [b, 16]]) {
const img = ctx.getImageData(0, 0, S, S), d = img.data;
for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
ctx.putImageData(img, 0, 0);
}
const map = new T.CanvasTexture(cc); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
const bump = new T.CanvasTexture(bc); bump.anisotropy = 8;
return { map, bump };
}

theme(w) {
this.themes = this.themes || [];
if (this.themes[w]) return this.themes[w];
const T = this.T;
const D = [
{ name: 'town', bg: '#120d22', sky: '#cdd9ff', ground: '#5a3a24', key: '#fff0d6', rim: '#9cc8ff', house: '#ede3d2' },
{ name: 'forest', wall: { pattern: 'stone', base: '#8b8e78', mortar: '#29301f', vary: 0.28, noise: 28, seed: 11, moss: true }, back: { pattern: 'stone', base: '#34503e', mortar: '#16281c', vary: 0.2, noise: 14, seed: 5 }, backTint: '#9aa69e', bg: '#0b1c16', sky: '#d8f2c4', ground: '#26361e', key: '#fff2c8', rim: '#a8f0b8', house: '#e8e0cc' },
{ name: 'caves', wall: { pattern: 'stone', base: '#5d627c', mortar: '#1b1c28', vary: 0.3, noise: 30, seed: 17 }, backTint: '#a4a8c0', back: { pattern: 'stone', base: '#33375a', mortar: '#12121e', vary: 0.22, noise: 14, seed: 23 }, bg: '#06060e', sky: '#a6b6ff', ground: '#1a1630', key: '#e2e8ff', rim: '#7a9cff', house: '#e2ddd2' },
{ name: 'fortress', wall: { pattern: 'plate', base: '#909cb2', mortar: '#353d4c', vary: 0.12, noise: 14, seed: 29 }, backTint: '#b0b8cc', back: { pattern: 'plate', base: '#3e4a6e', mortar: '#1a2236', vary: 0.1, noise: 10, seed: 31 }, bg: '#0b1430', sky: '#dae6ff', ground: '#2c2e48', key: '#ffffff', rim: '#9ad4ff', house: '#e6e8ee' }
][w];
const wall = D.wall ? this.makeSurface(D.wall) : { map: this.tex.brick, bump: this.tex.brickBump };
const back = D.back ? this.makeSurface(D.back) : { map: this.tex.back, bump: this.tex.backBump };
for (const tx of [back.map, back.bump]) tx.wrapS = tx.wrapT = T.RepeatWrapping;
D.metal = w === 3;
D.wallMat = w === 0 ? this.m.brick : new T.MeshStandardMaterial({ map: wall.map, bumpMap: wall.bump, bumpScale: D.metal ? 1.5 : 3, roughness: D.metal ? 0.42 : 0.9, metalness: D.metal ? 0.55 : 0 });
D.wallTex = wall; D.backTex = back;
return (this.themes[w] = D);
}

assets() {
const T = this.T;
const std = (o) => new T.MeshStandardMaterial(o);
const brick = this.makeBrick({ base: '#b8392c', mortar: '#4a2a22', vary: 0.22, noise: 26, seed: 7 });
const back = this.makeBrick({ base: '#3e2433', mortar: '#1a0f18', vary: 0.18, noise: 18, seed: 3 });
for (const tx of [back.map, back.bump]) tx.wrapS = tx.wrapT = T.RepeatWrapping;
this.woodTex = this.makeWood();
this.tex = { brick: brick.map, brickBump: brick.bump, back: back.map, backBump: back.bump, glow: this.glowTex() };
this.m = {
brick: std({ map: this.tex.brick, bumpMap: this.tex.brickBump, bumpScale: 3, roughness: 0.88 }),
back: std({ map: this.tex.back, bumpMap: this.tex.backBump, bumpScale: 2, roughness: 0.95 }),
water: std({ color: '#2f8cff', emissive: '#0b2f7a', emissiveIntensity: 0.35, roughness: 0.03, metalness: 0.2, envMapIntensity: 2, transparent: true, opacity: 0.82 }),
coal: std({ color: '#3a1d12', emissive: '#7a2a08', emissiveIntensity: 0.9, roughness: 0.9 }),
flameA: new T.MeshBasicMaterial({ color: '#ff5a2a' }),
flameB: new T.MeshBasicMaterial({ color: '#ffae3a' }),
flameC: new T.MeshBasicMaterial({ color: '#fff0a8' }),
diamond: std({ color: '#5ef0ff', emissive: '#0e8aa8', emissiveIntensity: 0.4, roughness: 0.04, metalness: 0.35, envMapIntensity: 2.2, flatShading: true }),
ruby: std({ color: '#ff2e55', emissive: '#7a0018', emissiveIntensity: 0.35, roughness: 0.04, metalness: 0.35, envMapIntensity: 2.2, flatShading: true }),
orb: std({ color: '#c04dff', emissive: '#4a0f70', emissiveIntensity: 0.6, roughness: 0.2 }),
gold: std({ color: '#ffc23d', emissive: '#6a3d00', emissiveIntensity: 0.15, roughness: 0.22, metalness: 1, envMapIntensity: 1.6 }),
wood: std({ color: '#c98a55', map: this.woodTex, roughness: 0.7 }),
woodDark: std({ color: '#7a4a2a', map: this.woodTex, roughness: 0.75 }),
doorGlow: std({ color: '#ffe2a0', emissive: '#ffb84a', emissiveIntensity: 1.6, roughness: 0.6 }),
steel: std({ color: '#b8c4d6', roughness: 0.3, metalness: 0.8 }),
steelDark: std({ color: '#4a5568', roughness: 0.4, metalness: 0.7 }),
red: std({ color: '#e0342b', roughness: 0.45 }),
vine: std({ color: '#3faf4b', roughness: 0.7 }),
leaf: std({ color: '#6fd65a', roughness: 0.6 }),
skin: std({ color: '#ffd1ad', roughness: 0.55 }),
cap: std({ color: '#e2302b', roughness: 0.45 }),
shirt: std({ color: '#f7f7fb', roughness: 0.6 }),
overall: std({ color: '#3b6fd6', roughness: 0.55 }),
shoe: std({ color: '#5a3825', roughness: 0.6 }),
hair: std({ color: '#5a3622', roughness: 0.7 }),
eye: std({ color: '#ffffff', roughness: 0.2 }),
pupil: std({ color: '#16161c', roughness: 0.2 }),
blush: std({ color: '#ff8e9a', roughness: 0.8, transparent: true, opacity: 0.75 }),
mouth: std({ color: '#7a2a2a', roughness: 0.6 }),
blob: std({ color: '#9b5cff', roughness: 0.35 }),
blobDark: std({ color: '#6b37c7', roughness: 0.4 }),
saucer: std({ color: '#cfd8e6', roughness: 0.25, metalness: 0.85 }),
dome: std({ color: '#7fe8ff', roughness: 0.05, transparent: true, opacity: 0.45 }),
alien: std({ color: '#7be35a', roughness: 0.5 }),
rocket: std({ color: '#f5f5f8', roughness: 0.35 }),
window: std({ color: '#7fe8ff', emissive: '#1a7fa0', emissiveIntensity: 0.6, roughness: 0.1 }),
fake: new T.MeshStandardMaterial({ map: this.tex.brick, bumpMap: this.tex.brickBump, bumpScale: 3, roughness: 0.88, transparent: true, opacity: 1 }),
lock: std({ color: '#4d8dff', emissive: '#123a9a', emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }),
houseWall: std({ color: '#f3e2c4', roughness: 0.85 }),
roof: std({ color: '#d9483b', roughness: 0.6 }),
homeDoor: std({ color: '#2e6f95', roughness: 0.5 }),
windowLit: std({ color: '#ffe7a3', emissive: '#ffb640', emissiveIntensity: 1.2, roughness: 0.4 }),
bush: std({ color: '#4fbf5a', roughness: 0.7 }),
mat: std({ color: '#b5543a', roughness: 0.95 }),
frog: std({ color: '#5fd35a', roughness: 0.35 }),
frogLight: std({ color: '#d8f7a8', roughness: 0.4 }),
bossHull: std({ color: '#ff5a6e', roughness: 0.3, metalness: 0.6 }),
flagOff: std({ color: '#8a8f9c', roughness: 0.7 }),
flagOn: std({ color: '#3fd26a', emissive: '#0f6a2a', emissiveIntensity: 0.6, roughness: 0.5 }),
shot: new T.MeshBasicMaterial({ color: '#ff6a3a' }),
bolt: new T.MeshBasicMaterial({ color: '#a8f4ff' }),
grass: std({ color: '#5cb84a', roughness: 0.85 }),
grassDark: std({ color: '#3f9636', roughness: 0.9 }),
rock: std({ color: '#4c5068', roughness: 0.85 }),
crystal: std({ color: '#c3a8ff', emissive: '#5a36c8', emissiveIntensity: 0.8, roughness: 0.12, metalness: 0.2, flatShading: true }),
window: std({ color: '#c8eeff', emissive: '#4ab8ff', emissiveIntensity: 1.2, roughness: 0.3 }),
lampGlass: std({ color: '#e0f6ff', emissive: '#7fd0ff', emissiveIntensity: 2.2, roughness: 0.2 }),
vineDark: std({ color: '#2c8a3a', roughness: 0.6 }),
leafFlat: std({ color: '#62d052', roughness: 0.55, side: T.DoubleSide }),
petal: std({ color: '#ffd0e4', roughness: 0.5 }),
homeStone: std({ color: '#a39b90', roughness: 0.92 }),
homeDoorLight: std({ color: '#3f88b4', roughness: 0.45 }),
mailbox: std({ color: '#2f6fd0', roughness: 0.4, metalness: 0.3 }),
lamps: ['#ff4d6d', '#ffd23f', '#4dd6ff'].map((c) => new T.MeshBasicMaterial({ color: c }))
};
const V = (a, b) => new T.Vector2(a, b);
this.g = {
box: new T.BoxGeometry(1, 1, 1),
oct: new T.OctahedronGeometry(0.22, 0),
sphere: new T.SphereGeometry(1, 24, 16),
half: new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
cone: new T.ConeGeometry(1, 1, 12),
cyl: new T.CylinderGeometry(1, 1, 1, 16),
torus: new T.TorusGeometry(0.15, 0.05, 10, 28),
handle: new T.TorusGeometry(0.08, 0.025, 8, 16, Math.PI),
cup: new T.LatheGeometry([V(0, 0), V(0.17, 0), V(0.17, 0.035), V(0.05, 0.06), V(0.04, 0.17), V(0.07, 0.21), V(0.2, 0.28), V(0.24, 0.42), V(0.25, 0.5), V(0.21, 0.5), V(0.19, 0.33), V(0, 0.28)], 28),
puff: new T.IcosahedronGeometry(1, 0),
roof: (() => { const r = new T.ConeGeometry(1.42, 0.8, 4); r.rotateY(Math.PI / 4); return r; })(),
plane: new T.PlaneGeometry(1, 1),
vine: (() => { const pts = []; for (let i = 0; i <= 24; i++) { const k = i / 24, a = k * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a) * 0.035, k - 0.5, Math.sin(a) * 0.035)); } return new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.026, 6, false); })(),
leaf: (() => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.06, 0.02, 0.09, 0.09, 0, 0.17); sh.bezierCurveTo(-0.09, 0.09, -0.06, 0.02, 0, 0); return new T.ShapeGeometry(sh, 6); })()
};
}

mesh(geo, mat, s, p, parent) {
const o = new this.T.Mesh(geo, mat);
if (s) o.scale.set(s[0], s[1], s[2]);
if (p) o.position.set(p[0], p[1], p[2]);
o.castShadow = true;
o.receiveShadow = true;
if (parent) parent.add(o);
return o;
}

glow(color, size, opacity) {
const T = this.T;
const s = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity ?? 0.8 }));
s.scale.set(size, size, 1);
return s;
}


makeBlaster() {
const T = this.T, g = this.g, M = this.mesh.bind(this), m = this.m, hm = this.hm;
const grp = new T.Group();
M(g.box, hm.packWhite, [0.3, 0.12, 0.1], [0, 0.03, 0], grp);
M(g.box, hm.packRed, [0.3, 0.03, 0.104], [0, 0.068, 0], grp);
const b = M(g.cyl, m.steel, [0.035, 0.16, 0.035], [0.22, 0.03, 0], grp); b.rotation.z = Math.PI / 2;
for (const ox of [0.17, 0.24]) { const r = M(g.cyl, hm.packRed, [0.046, 0.02, 0.046], [ox, 0.03, 0], grp); r.rotation.z = Math.PI / 2; }
const tip = M(g.sphere, hm.plasma, [0.03, 0.03, 0.03], [0.305, 0.03, 0], grp); tip.castShadow = false;
const cell = M(g.cyl, hm.plasma, [0.028, 0.1, 0.028], [-0.03, 0.1, 0], grp); cell.rotation.z = Math.PI / 2; cell.castShadow = false;
const grip = M(g.box, m.steelDark, [0.07, 0.15, 0.08], [-0.09, -0.07, 0], grp); grip.rotation.z = 0.25;
return grp;
}

makeSpacePack() {
const T = this.T, g = this.g, M = this.mesh.bind(this), hm = this.hm;
const grp = new T.Group(), flames = [];
M(g.box, hm.packWhite, [0.24, 0.2, 0.06], [0, 0.02, 0.02], grp);
M(g.sphere, hm.plasma, [0.028, 0.028, 0.012], [0, 0.07, 0.055], grp).castShadow = false;
for (const s of [1, -1]) {
M(g.cyl, hm.packWhite, [0.075, 0.28, 0.075], [s * 0.085, 0, -0.04], grp);
M(g.sphere, hm.packWhite, [0.075, 0.06, 0.075], [s * 0.085, 0.14, -0.04], grp);
M(g.cyl, hm.packRed, [0.079, 0.04, 0.079], [s * 0.085, 0.06, -0.04], grp);
M(g.cyl, this.m.steelDark, [0.05, 0.05, 0.05], [s * 0.085, -0.165, -0.04], grp);
const f = M(g.cone, hm.plasma, [0.05, 0.2, 0.05], [s * 0.085, -0.29, -0.04], grp); f.rotation.x = Math.PI; f.castShadow = false;
const fc = M(g.cone, hm.plasmaCore, [0.025, 0.1, 0.025], [s * 0.085, -0.23, -0.04], grp); fc.rotation.x = Math.PI; fc.castShadow = false;
flames.push(f, fc);
}
return { grp, flames };
}

makeHero() {
const T = this.T, g = this.g, M = this.mesh.bind(this);
const P = (o) => new T.MeshPhysicalMaterial(o), C = (h) => new T.Color(h);
const tx = (w, h, fn, rep) => {
const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); }
return t;
};
const noise = (x, w, h, amt) => { const d = x.getImageData(0, 0, w, h); for (let k = 0; k < d.data.length; k += 4) { const n = (Math.random() - 0.5) * amt; d.data[k] += n; d.data[k + 1] += n; d.data[k + 2] += n; } x.putImageData(d, 0, 0); };
const denim = tx(64, 64, (x, w, h) => {
x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
x.strokeStyle = 'rgba(20,40,90,0.16)'; x.lineWidth = 1;
for (let k = -h; k < w; k += 3) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h, h); x.stroke(); }
noise(x, w, h, 22);
}, 3);
const printTex = tx(1024, 512, (x, w, h) => {
x.fillStyle = '#f5f5f2'; x.fillRect(0, 0, w, h);
const cx = w * 0.25 + 20, cy = h * 0.52;
x.fillStyle = '#ef8a2e'; x.beginPath(); x.arc(cx, cy, 46, 0, 6.28); x.fill();
x.strokeStyle = '#3a2416'; x.lineWidth = 5; x.stroke();
x.beginPath(); x.moveTo(cx - 46, cy); x.lineTo(cx + 46, cy); x.moveTo(cx, cy - 46); x.lineTo(cx, cy + 46); x.stroke();
x.beginPath(); x.arc(cx - 62, cy, 46, -0.75, 0.75); x.stroke(); x.beginPath(); x.arc(cx + 62, cy, 46, Math.PI - 0.75, Math.PI + 0.75); x.stroke();
x.fillStyle = '#8cc4dc'; x.font = '800 74px "Barlow Condensed", system-ui, sans-serif'; x.textAlign = 'center';
x.fillText('02', w * 0.25 + 40, h * 0.38);
noise(x, w, h, 8);
});
const plaid = tx(64, 64, (x, w, h) => {
x.fillStyle = '#f1ecdc'; x.fillRect(0, 0, w, h);
for (let k = 0; k < h; k += 16) { x.fillStyle = '#5f9150'; x.fillRect(0, k + 2, w, 8); x.fillStyle = 'rgba(40,80,40,0.25)'; x.fillRect(0, k + 9, w, 1); }
noise(x, w, h, 14);
}, 1);
plaid.repeat.set(1, 2.2);
const hm = (this.hm = {
skin: P({ color: '#d9a27c', roughness: 0.52, sheen: 0.5, sheenColor: C('#f0b090'), sheenRoughness: 0.5, emissive: '#3a1404', emissiveIntensity: 0.05 }),
skinDeep: P({ color: '#bb7f5c', roughness: 0.55 }),
nose: P({ color: '#d29372', roughness: 0.45, sheen: 0.4, sheenColor: C('#f0a080') }),
cheek: new T.MeshStandardMaterial({ color: '#d86a62', roughness: 0.7, transparent: true, opacity: 0.32, depthWrite: false }),
freckle: new T.MeshStandardMaterial({ color: '#c0765a', roughness: 0.8 }),
shirt: P({ color: '#f5f5f2', map: printTex, transparent: false, roughness: 0.85, sheen: 1, sheenColor: C('#ffffff'), sheenRoughness: 0.6 }),
button: P({ color: '#fbfaf4', roughness: 0.3, clearcoat: 0.8 }),
denim: P({ color: '#5f86bd', map: denim, roughness: 0.86, sheen: 0.6, sheenColor: C('#b8cdf0'), sheenRoughness: 0.5 }),
cuff: P({ color: '#86a6d6', map: denim, roughness: 0.86 }),
hair: P({ color: '#4a3528', roughness: 0.95, sheen: 0.3, sheenColor: C('#7a5a44'), sheenRoughness: 0.8 }),
hairLight: P({ color: '#2a1e17', roughness: 0.95 }),
shorts: P({ color: '#b9a17c', roughness: 0.9, sheen: 0.4, sheenColor: C('#e8d8b8'), sheenRoughness: 0.6 }),
shortsHem: P({ color: '#a68d69', roughness: 0.9 }),
trim: P({ color: '#9cc8e8', roughness: 0.85, sheen: 0.6, sheenColor: C('#e0f0ff') }),
collar: P({ color: '#9cc8e8', roughness: 0.85 }),
pocket: P({ color: '#3d6a3e', roughness: 0.82 }),
flop: P({ color: '#3a2a24', roughness: 0.7 }),
flopStrap: P({ color: '#e0302b', roughness: 0.45, clearcoat: 0.4 }),
shoe: P({ color: '#22252c', roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4 }),
sole: P({ color: '#f6f2ea', roughness: 0.7 }),
sock: P({ color: '#ffffff', roughness: 0.9 }),
eye: P({ color: '#ffffff', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
irisRim: P({ color: '#1e1008', roughness: 0.2, clearcoat: 1 }),
iris: P({ color: '#4a2a14', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, emissive: '#1a0a02', emissiveIntensity: 0.2 }),
pupil: P({ color: '#0d0909', roughness: 0.1, clearcoat: 1 }),
shine: new T.MeshBasicMaterial({ color: '#ffffff' }),
brow: P({ color: '#22150e', roughness: 0.7 }),
mouth: P({ color: '#8a3a34', roughness: 0.5 }),
tongue: P({ color: '#ff7d88', roughness: 0.45 }),
packWhite: P({ color: '#f2f4f8', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
packRed: P({ color: '#e3382d', roughness: 0.35, clearcoat: 0.8 }),
strap: P({ color: '#3a4250', roughness: 0.7 }),
plasma: new T.MeshBasicMaterial({ color: '#8fe6ff', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }),
plasmaCore: new T.MeshBasicMaterial({ color: '#ffffff' })
});
hm.shirtPrint = hm.shirt.clone(); hm.shirt.map = null; hm.shirt.needsUpdate = true;
for (const k in hm) hm[k].name = k;
const root = new T.Group(), body = new T.Group();
root.name = 'ritam'; body.name = 'body';
root.add(body);
root.scale.setScalar(0.86);
const hips = new T.Group(); hips.position.y = 0.36; body.add(hips);
M(g.sphere, hm.shorts, [0.185, 0.13, 0.155], [0, 0.03, 0], hips);
const leg = (s) => {
const hip = new T.Group(); hip.position.set(s * 0.082, 0, 0); hips.add(hip);
M(g.cyl, hm.shorts, [0.085, 0.13, 0.082], [0, -0.05, 0], hip);
M(g.cyl, hm.shortsHem, [0.088, 0.022, 0.085], [0, -0.115, 0], hip);
M(g.box, hm.shortsHem, [0.014, 0.07, 0.055], [s * 0.086, -0.06, 0], hip);
M(g.cyl, hm.shorts, [0.07, 0.06, 0.07], [0, -0.14, 0], hip);
const knee = new T.Group(); knee.position.y = -0.16; hip.add(knee);
M(g.sphere, hm.shorts, [0.068, 0.05, 0.068], [0, 0, 0], knee);
M(g.cyl, hm.shorts, [0.064, 0.12, 0.066], [0, -0.06, 0], knee);
M(g.cyl, hm.shortsHem, [0.06, 0.03, 0.062], [0, -0.13, 0], knee);
M(g.box, hm.shortsHem, [0.016, 0.07, 0.06], [s * 0.07, -0.02, 0.004], hip);
M(g.box, hm.shorts, [0.018, 0.012, 0.062], [s * 0.072, 0.018, 0.004], hip);
const foot = new T.Group(); foot.position.y = -0.15; knee.add(foot);
M(g.sphere, hm.shoe, [0.07, 0.058, 0.12], [0, 0, 0.035], foot);
M(g.sphere, hm.sole, [0.075, 0.025, 0.125], [0, -0.035, 0.035], foot);
M(g.sphere, hm.sole, [0.06, 0.04, 0.06], [0, -0.004, 0.1], foot);
for (const sx of [1, -1]) M(g.sphere, hm.sole, [0.012, 0.03, 0.06], [sx * 0.066, 0.004, 0.02], foot);
for (const lz of [0.035, 0.06, 0.085]) M(g.box, hm.sole, [0.05, 0.008, 0.01], [0, 0.05, lz], foot).rotation.x = -0.35;
return { hip, knee, foot };
};
const legL = leg(1), legR = leg(-1);
const torso = new T.Group(); torso.position.y = 0.06; hips.add(torso);
M(g.sphere, hm.shirtPrint, [0.2, 0.205, 0.175], [0, 0.21, 0], torso);
M(g.sphere, hm.shirt, [0.2, 0.11, 0.17], [0, 0.06, 0], torso);
const col = M(g.torus, hm.collar, [0.5, 0.42, 0.5], [0, 0.39, 0.01], torso); col.rotation.x = Math.PI / 2;

M(g.cyl, hm.skin, [0.064, 0.08, 0.064], [0, 0.41, 0], torso);
const arm = (s) => {
const sh = new T.Group(); sh.position.set(s * 0.185, 0.33, 0); torso.add(sh);
M(g.sphere, hm.trim, [0.074, 0.084, 0.074], [0, -0.025, 0], sh);
M(g.cyl, hm.trim, [0.066, 0.026, 0.066], [0, -0.075, 0], sh);
M(g.cyl, hm.skin, [0.04, 0.08, 0.04], [0, -0.1, 0], sh);
const el = new T.Group(); el.position.y = -0.13; sh.add(el);
M(g.sphere, hm.skin, [0.041, 0.041, 0.041], [0, 0, 0], el);
M(g.cyl, hm.skin, [0.039, 0.09, 0.039], [0, -0.05, 0], el);
const hand = new T.Group(); hand.position.y = -0.11; el.add(hand);
M(g.sphere, hm.skin, [0.058, 0.064, 0.05], [0, -0.01, 0], hand);
M(g.sphere, hm.skin, [0.022, 0.032, 0.022], [-s * 0.04, 0.012, 0.03], hand);
return { sh, el, hand };
};
const armL = arm(1), armR = arm(-1);
const gun = this.makeBlaster();
gun.scale.setScalar(0.6); gun.position.set(0, -0.05, 0.03); gun.rotation.z = -Math.PI / 2;
armR.hand.add(gun); gun.visible = false;

const head = new T.Group(); head.position.y = 0.67; head.scale.setScalar(1.05); torso.add(head);
M(g.sphere, hm.skin, [0.34, 0.32, 0.31], [0, 0, 0], head);
M(g.sphere, hm.skin, [0.28, 0.22, 0.27], [0, -0.09, 0.03], head);
M(g.sphere, hm.skin, [0.1, 0.07, 0.08], [0, -0.21, 0.19], head);
for (const s of [1, -1]) {
M(g.sphere, hm.skin, [0.078, 0.108, 0.05], [s * 0.345, -0.03, -0.01], head);
M(g.sphere, hm.skin, [0.13, 0.11, 0.12], [s * 0.165, -0.105, 0.16], head);
M(g.sphere, hm.skinDeep, [0.036, 0.06, 0.02], [s * 0.365, -0.03, 0.012], head);
M(g.sphere, hm.cheek, [0.085, 0.05, 0.02], [s * 0.2, -0.11, 0.262], head).castShadow = false;
for (let k = 0; k < 0; k++) {
const fx = 0.15 + hash(k, s + 3) * 0.1, fy = -0.06 - hash(s + 5, k) * 0.07;
const fz = 0.31 * Math.sqrt(Math.max(0, 1 - (fx / 0.34) ** 2 - (fy / 0.32) ** 2)) + 0.004;
M(g.sphere, hm.freckle, [0.0075, 0.0075, 0.004], [s * fx, fy, Math.max(fz, 0.236)], head).castShadow = false;
}
}
M(g.sphere, hm.nose, [0.05, 0.042, 0.046], [0, -0.088, 0.3], head);
const eyes = [], lids = [], brows = [];
for (const s of [1, -1]) {
const eg = new T.Group(); eg.position.set(s * 0.12, 0.004, 0.238); eg.scale.setScalar(0.9); head.add(eg);
M(g.sphere, hm.eye, [0.108, 0.132, 0.066], [0, 0, 0], eg);
const look = new T.Group(); eg.add(look);
M(g.sphere, hm.irisRim, [0.09, 0.106, 0.03], [0, -0.004, 0.04], look);
M(g.sphere, hm.iris, [0.082, 0.097, 0.032], [0, -0.004, 0.044], look);
M(g.sphere, hm.pupil, [0.05, 0.058, 0.02], [0, -0.004, 0.064], look);
M(g.sphere, hm.shine, [0.03, 0.034, 0.01], [0.03, 0.04, 0.074], look).castShadow = false;
M(g.sphere, hm.shine, [0.013, 0.013, 0.006], [-0.026, -0.038, 0.072], look).castShadow = false;
const lidS = new T.Group(); lidS.scale.set(0.116, 0.14, 0.074); eg.add(lidS);
const lid = M(g.half, hm.skin, null, [0, 0, 0], lidS); lid.rotation.x = -1.55;
eyes.push({ eg, look }); lids.push(lid);
const b = M(g.box, hm.brow, [0.085, 0.018, 0.02], [s * 0.125, 0.165, 0.25], head);
b.rotation.x = -0.5; brows.push(b);
}
M(g.sphere, hm.hair, [0.352, 0.322, 0.322], [0, 0.06, -0.06], head);
const tuft = new T.Group(); tuft.position.set(0.02, 0.3, 0.12); head.add(tuft);
const mouthG = new T.Group(); mouthG.position.set(0, -0.158, 0.276); head.add(mouthG);
const softSmile = M(g.torus, hm.mouth, [0.36, 0.3, 0.3], [0, 0.012, 0.004], mouthG); softSmile.rotation.set(0, 0, Math.PI + 0.12); softSmile.castShadow = false;
softSmile.geometry = new T.TorusGeometry(0.15, 0.035, 10, 28, Math.PI - 0.24);
const smile = new T.Group(); mouthG.add(smile);
const lip = M(g.half, hm.mouth, [0.068, 0.048, 0.026], [0, 0, 0], smile); lip.rotation.z = Math.PI; lip.castShadow = false;
M(g.box, hm.sock, [0.1, 0.014, 0.008], [0, -0.008, 0.02], smile).castShadow = false;
M(g.sphere, hm.tongue, [0.032, 0.014, 0.012], [0, -0.032, 0.014], smile).castShadow = false;
for (const sx of [1, -1]) M(g.sphere, hm.skin, [0.022, 0.016, 0.016], [sx * 0.074, 0.006, 0.0], smile);
const mouthO = new T.Group(); mouthG.add(mouthO);
M(g.sphere, hm.mouth, [0.048, 0.044, 0.028], [0, 0, 0], mouthO);
M(g.sphere, hm.tongue, [0.03, 0.017, 0.018], [0, -0.024, 0.012], mouthO);
mouthO.visible = false;
const sp = this.makeSpacePack();
sp.grp.position.set(0, 0.2, -0.19); torso.add(sp.grp); sp.grp.visible = false;
for (const s of [1, -1]) {
M(g.box, hm.strap, [0.034, 0.24, 0.016], [s * 0.09, 0.03, 0.36], sp.grp).rotation.x = -0.12;
M(g.box, hm.strap, [0.034, 0.016, 0.38], [s * 0.09, 0.15, 0.17], sp.grp);
}
return { root, body, hips, torso, head, legL, legR, armL, armR, eyes, lids, brows, smile, softSmile, mouthO, tuft, gun, jet: sp.grp, flames: sp.flames };
}

makeMob(kind) {
const T = this.T, m = this.m, g = this.g, M = this.mesh.bind(this);
const root = new T.Group(), body = new T.Group();
root.add(body);
const e = { root, body, kind };
const eyes = (parent, y, z, s) => {
for (const sx of [1, -1]) {
M(g.sphere, m.eye, [0.085 * s, 0.1 * s, 0.05 * s], [sx * 0.12 * s, y, z], parent);
M(g.sphere, m.pupil, [0.05 * s, 0.06 * s, 0.03 * s], [sx * 0.12 * s, y - 0.01, z + 0.04 * s], parent);
}
};
if (kind === 'flyer' || kind === 'boss') {
M(g.sphere, m.saucer, [0.46, 0.12, 0.46], [0, 0, 0], body);
M(g.half, m.dome, [0.23, 0.22, 0.23], [0, 0.07, 0], body);
M(g.sphere, m.alien, [0.12, 0.12, 0.12], [0, 0.15, 0], body);
eyes(body, 0.17, 0.09, 0.55);
e.lamps = [];
for (let i = 0; i < 8; i++) {
const a = (i / 8) * Math.PI * 2;
const l = M(g.sphere, m.lamps[i % 3], [0.035, 0.035, 0.035], [Math.cos(a) * 0.43, -0.01, Math.sin(a) * 0.43], body);
l.castShadow = false;
e.lamps.push(l);
}
const gl = this.glow('#7fe8ff', 1.1, 0.35); gl.position.set(0, -0.2, 0); body.add(gl);
if (kind === 'boss') {
root.scale.setScalar(2.5);
for (const s of [1, -1]) {
const hn = M(g.cone, m.red, [0.04, 0.12, 0.04], [s * 0.08, 0.28, 0], body);
hn.rotation.z = -s * 0.4;
const br = M(g.box, m.pupil, [0.08, 0.015, 0.02], [s * 0.066, 0.215, 0.1], body);
br.rotation.z = s * 0.45;
}
M(g.torus, m.bossHull, [3, 3, 1.2], [0, -0.03, 0], body).rotation.x = Math.PI / 2;
const rg = this.glow('#ff5a6e', 1.2, 0.4); rg.position.set(0, -0.15, 0); body.add(rg);
}
} else if (kind === 'hopper') {
M(g.sphere, m.frog, [0.32, 0.26, 0.3], [0, 0.28, 0], body);
M(g.sphere, m.frogLight, [0.22, 0.16, 0.12], [0, 0.22, 0.2], body);
for (const s of [1, -1]) {
M(g.sphere, m.frog, [0.11, 0.11, 0.11], [s * 0.14, 0.52, 0.08], body);
M(g.sphere, m.eye, [0.075, 0.08, 0.05], [s * 0.14, 0.54, 0.16], body);
M(g.sphere, m.pupil, [0.04, 0.05, 0.03], [s * 0.14, 0.54, 0.2], body);
M(g.sphere, m.frog, [0.12, 0.05, 0.16], [s * 0.2, 0.04, 0.08], body);
M(g.sphere, m.blush, [0.05, 0.025, 0.02], [s * 0.2, 0.34, 0.25], body);
}
M(g.sphere, m.mouth, [0.12, 0.02, 0.02], [0, 0.3, 0.29], body);
} else if (kind === 'vertical') {
M(g.cyl, m.rocket, [0.17, 0.5, 0.17], [0, 0, 0], body);
const nose = M(g.cone, m.red, [0.17, 0.25, 0.17], [0, 0.37, 0], body);
for (let i = 0; i < 3; i++) {
const f = M(g.box, m.red, [0.03, 0.18, 0.14], [0, -0.2, 0], body);
f.rotation.y = (i / 3) * Math.PI * 2;
f.position.set(Math.sin(f.rotation.y) * 0.17, -0.2, Math.cos(f.rotation.y) * 0.17);
}
M(g.sphere, m.window, [0.1, 0.1, 0.05], [0, 0.07, 0.15], body);
eyes(body, 0.08, 0.19, 0.45);
e.flame = M(g.cone, m.flameB, [0.1, 0.25, 0.1], [0, -0.38, 0], body);
e.flame.rotation.x = Math.PI; e.flame.castShadow = false;
void nose;
} else {
M(g.sphere, m.blob, [0.38, 0.32, 0.34], [0, 0.32, 0], body);
M(g.sphere, m.blobDark, [0.1, 0.06, 0.12], [0.16, 0.04, 0.06], body);
M(g.sphere, m.blobDark, [0.1, 0.06, 0.12], [-0.16, 0.04, 0.06], body);
eyes(body, 0.42, 0.27, 1);
M(g.cyl, m.blobDark, [0.015, 0.18, 0.015], [0, 0.7, 0], body);
M(g.sphere, m.orb, [0.05, 0.05, 0.05], [0, 0.8, 0], body);
M(g.sphere, m.mouth, [0.08, 0.03, 0.02], [0, 0.26, 0.32], body);
}
return e;
}


clearLevel() {
for (const ch of [...this.level.children]) {
this.level.remove(ch);
if (ch.isInstancedMesh) ch.dispose();
if (ch.userData.ownsGeo && ch.geometry) ch.geometry.dispose();
ch.traverse && ch.traverse((o) => { if (o !== ch && o.userData && o.userData.ownsGeo && o.geometry) o.geometry.dispose(); });
if (ch.userData.ownsMaterial) { ch.material.map && ch.material.map.dispose(); ch.material.bumpMap && ch.material.bumpMap.dispose(); ch.material.dispose(); }
}
}

wx(c) { return c + 0.5; }
wy(r) { return ROWS - 1 - r + 0.5; }

buildLevel(grid, game, edit) {
const T = this.T, g = this.g, m = this.m, M = this.mesh.bind(this);
this.clearLevel();
this.items = []; this.waters = []; this.fires = []; this.doors = []; this.vines = []; this.flags = []; this.fakes = []; this.homeHinge = null; this.homeT = 0; this.lightSrc = []; this.torches = []; this.chimney = null; this.bird = null; this.homeAnim = null;
const cols = grid[0].length;
const walls = [];
let start = null;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < cols; c++) {
const ch = grid[r][c];
if (ch === '#') walls.push([r, c]);
if (ch === 'P') start = { r, c };
}
if (!start && game.start) start = game.start;

const th = this.theme(Math.max(0, Math.min(3, game.world != null ? game.world : (game.themeOf ? game.themeOf(game.levelIndex || 0) : Math.floor((game.levelIndex || 0) / 5)))));
this.th = th;
this.scene.background.set(th.bg); this.hemi.color.set(th.sky); this.hemi.groundColor.set(th.ground); this.key.color.set(th.key); this.rim.color.set(th.rim);
m.fake.map = th.wallTex.map; m.fake.bumpMap = th.wallTex.bump; m.fake.needsUpdate = true;
m.houseWall.color.set(th.house);
const fl = (this.flavor = this.flavorFor(game));
if (fl.key) this.key.color.set(fl.key);
this.key.intensity = this.keyBase = Math.max(2.0, (fl.keyI || 2.3) * 1.05);
this.fcam = null;
if (fl.bg) this.scene.background.set(fl.bg);
if (fl.sky) this.hemi.color.set(fl.sky);
if (fl.ground) this.hemi.groundColor.set(fl.ground);
this.bgBase = this.scene.background.clone();
this.heroTint = new T.Color('#ffffff').lerp(new T.Color(fl.key || '#ffffff'), 0.3).multiplyScalar(Math.min(1, 0.8 + (fl.keyI || 2.3) * 0.08));
this.setWeather(fl.fx);
const im = new T.InstancedMesh(g.box, th.wallMat, Math.max(1, walls.length));
const mt = new T.Matrix4();
walls.forEach(([r, c], i) => { mt.makeTranslation(this.wx(c), this.wy(r), 0); im.setMatrixAt(i, mt); });
im.count = walls.length;
im.castShadow = im.receiveShadow = true;
this.level.add(im);

const bt = th.backTex.map.clone();
bt.needsUpdate = true;
bt.repeat.set(cols, ROWS);
const bb = th.backTex.bump.clone();
bb.needsUpdate = true;
bb.repeat.set(cols, ROWS);
const backMat = new T.MeshStandardMaterial({ color: th.backTint || '#ffffff', map: bt, bumpMap: bb, bumpScale: 2, roughness: th.metal ? 0.6 : 0.95, metalness: th.metal ? 0.35 : 0 });
const back = new T.Mesh(g.plane, backMat);
back.scale.set(cols, ROWS, 1);
back.position.set(cols / 2, ROWS / 2, -0.5);
back.receiveShadow = true;
back.userData.ownsMaterial = true;
this.level.add(back);
this.buildDecor(grid, cols, walls, th);
this.buildFlavor(grid, cols, fl);
this.walkable = (r, c) => c > 0 && c < cols - 1 && grid[r] && grid[r][c] === '#' && grid[r - 1] && grid[r - 1][c] === '.';
this.buildCritters(grid, cols, th);

for (let r = 0; r < ROWS; r++) for (let c = 0; c < cols; c++) {
const ch = grid[r][c];
if (ch === '.' || ch === '#' || ch === 'P') continue;
const x = this.wx(c), y = this.wy(r), ph = hash(r, c) * 6.28;
const grp = new T.Group();
grp.position.set(x, y, 0);
this.level.add(grp);
const item = (color, spin) => this.items.push({ r, c, ch, obj: grp, y, ph, color, spin });
switch (ch) {
case '~': {
const w = M(g.box, m.water, [1, 0.78, 0.96], [0, -0.11, 0], grp);
w.castShadow = false;
this.waters.push({ obj: w, ph: c * 0.7 });
break;
}
case '^': {
M(g.box, m.coal, [0.9, 0.14, 0.8], [0, -0.43, 0], grp);
const cones = [];
[[0, 0.62, 0.3, m.flameA], [-0.2, 0.42, 0.18, m.flameA], [0.2, 0.46, 0.18, m.flameA], [0, 0.44, 0.2, m.flameB], [0, 0.26, 0.12, m.flameC]].forEach(([ox, h, rr, mat]) => {
const f = M(g.cone, mat, [rr, h, rr], [ox, -0.36 + h / 2, 0], grp);
f.castShadow = false;
cones.push({ f, h, ox });
});
const gl = this.glow('#ff7a30', 1.8, 0.55); gl.position.set(0, -0.1, 0.3); grp.add(gl);
this.fires.push({ cones, ph, gl });
this.lightSrc.push({ x, y: y - 0.1, z: 0.5, color: '#ff8a3a', base: 5, flick: true });
break;
}
case '*': M(g.oct, m.diamond, [1, 1.35, 1], [0, 0, 0], grp); grp.add(this.glow('#5ef0ff', 0.7, 0.35)); item('#8ff6ff', 1); break;
case 'r': M(g.oct, m.ruby, [1.05, 0.9, 1.05], [0, 0, 0], grp); grp.add(this.glow('#ff3b62', 0.7, 0.35)); item('#ff7a92', 1); break;
case 'o': M(g.sphere, m.orb, [0.16, 0.16, 0.16], [0, 0, 0], grp); grp.add(this.glow('#c04dff', 0.7, 0.4)); item('#d99bff', 0); break;
case 'i': {
M(g.torus, m.gold, [1, 1, 1], [0, 0, 0], grp);
M(g.oct, m.diamond, [0.3, 0.4, 0.3], [0, 0.2, 0], grp);
item('#ffe08a', 1);
break;
}
case 'c': {
const ring = new T.CylinderGeometry(0.2, 0.18, 0.14, 12, 1, true);
M(ring, m.gold, [1, 1, 1], [0, -0.05, 0], grp).material.side = T.DoubleSide;
for (let i = 0; i < 5; i++) {
const a = (i / 5) * Math.PI * 2;
M(g.cone, m.gold, [0.05, 0.13, 0.05], [Math.cos(a) * 0.18, 0.08, Math.sin(a) * 0.18], grp);
M(g.sphere, m.ruby, [0.03, 0.03, 0.03], [Math.cos(a) * 0.2, -0.05, Math.sin(a) * 0.2], grp);
}
grp.add(this.glow('#ffd23f', 0.8, 0.35));
item('#ffe08a', 1);
break;
}
case '$': {
M(g.box, m.gold, [0.34, 0.12, 0.2], [-0.12, -0.36, 0], grp);
M(g.box, m.gold, [0.34, 0.12, 0.2], [0.12, -0.36, 0], grp);
M(g.box, m.gold, [0.34, 0.12, 0.2], [0, -0.24, 0], grp);
grp.add(this.glow('#ffd23f', 1, 0.35));
this.items.push({ r, c, ch, obj: grp, y, ph, color: '#ffe08a', spin: 0, still: true });
break;
}
case 'T': {
const cup = new T.Group(); cup.position.y = -0.3; grp.add(cup);
M(g.cup, m.gold, [1, 1, 1], [0, 0, 0], cup);
for (const s of [1, -1]) { const h = M(g.handle, m.gold, [1, 1.2, 1], [s * 0.25, 0.36, 0], cup); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; }
grp.add(this.glow('#ffcf5a', 1.8, 0.6));
item('#ffe08a', 0.5);
this.lightSrc.push({ x, y, z: 0.6, color: '#ffd27a', base: 3, item: this.items[this.items.length - 1] });
break;
}
case 'D': {
M(g.box, m.woodDark, [0.12, 1.66, 0.32], [-0.43, 0.33, 0], grp);
M(g.box, m.woodDark, [0.12, 1.66, 0.32], [0.43, 0.33, 0], grp);
M(g.box, m.woodDark, [1.0, 0.12, 0.34], [0, 1.16, 0], grp);
M(g.box, m.wood, [0.74, 0.14, 0.05], [0, 1.03, 0.12], grp);
M(g.box, m.gold, [0.32, 0.06, 0.04], [0, 1.16, 0.18], grp);
M(g.box, m.homeStone, [1.04, 0.05, 0.4], [0, -0.475, 0.04], grp);
const inner = M(g.box, m.doorGlow, [0.74, 1.46, 0.06], [0, 0.23, -0.08], grp);
const hinge = new T.Group(); hinge.position.set(-0.37, 0.23, 0.05); grp.add(hinge);
const panel = M(g.box, m.wood, [0.74, 1.46, 0.08], [0.37, 0, 0], hinge);
for (const oy of [-0.5, 0, 0.5]) M(g.box, m.steelDark, [0.74, 0.05, 0.1], [0.37, oy, 0], hinge);
M(g.sphere, m.gold, [0.045, 0.045, 0.045], [0.64, -0.1, 0.06], hinge);
const gl = this.glow('#ffc865', 3, 0.7); gl.position.set(0, 0.3, 0.3); gl.visible = false; grp.add(gl);
void panel;
this.doors.push({ hinge, gl, inner, open: 0 });
this.lightSrc.push({ x, y, z: 0.6, color: '#ffc26a', base: 4, door: this.doors[this.doors.length - 1] });
break;
}
case 'X': {
const b = new T.Mesh(g.box, m.fake);
b.castShadow = b.receiveShadow = true;
grp.add(b);
this.fakes.push({ r, c });
break;
}
case 'k': {
M(g.torus, m.gold, [0.9, 0.9, 0.9], [0, 0.12, 0], grp);
M(g.box, m.gold, [0.05, 0.3, 0.05], [0, -0.1, 0], grp);
M(g.box, m.gold, [0.1, 0.04, 0.05], [0.05, -0.21, 0], grp);
M(g.box, m.gold, [0.08, 0.04, 0.05], [0.04, -0.13, 0], grp);
grp.add(this.glow('#ffd23f', 1.1, 0.5));
item('#ffe08a', 1);
break;
}
case 'L': {
M(g.box, m.lock, [0.96, 0.96, 0.96], [0, 0, 0], grp);
M(g.cyl, m.steelDark, [0.07, 0.04, 0.07], [0, 0.06, 0.49], grp).rotation.x = Math.PI / 2;
M(g.box, m.steelDark, [0.05, 0.14, 0.03], [0, -0.06, 0.49], grp);
this.items.push({ r, c, ch, obj: grp, y, ph, color: '#8fb8ff', spin: 0, still: true });
break;
}
case '-': case '!': {
M(g.box, m.wood, [2, 0.375, 0.9], [0.5, 0.31, 0], grp);
M(g.box, m.gold, [2.04, 0.06, 0.94], [0.5, 0.48, 0], grp);
break;
}
case 'F': case 'f': {
M(g.cyl, m.steelDark, [0.14, 0.06, 0.14], [-0.2, -0.47, 0], grp);
M(g.cyl, m.steel, [0.035, 0.95, 0.035], [-0.2, 0, 0], grp);
M(g.sphere, m.gold, [0.06, 0.06, 0.06], [-0.2, 0.49, 0], grp);
const flag = M(g.box, m.flagOff, [0.36, 0.22, 0.03], [-0.02, -0.2, 0], grp);
const gl = this.glow('#7dff8a', 1.3, 0); gl.position.set(0, 0.2, 0.2); grp.add(gl);
this.flags.push({ flag, gl, r, c, on: false });
break;
}
case 'J': {
const sp = this.makeSpacePack();
sp.flames.forEach((f) => { f.visible = false; });
sp.grp.scale.setScalar(1.35); sp.grp.rotation.y = Math.PI; grp.add(sp.grp);
grp.add(this.glow('#7fe0ff', 1.1, 0.4));
item('#bff0ff', 0.6);
break;
}
case 'G': {
const bl = this.makeBlaster(); bl.scale.setScalar(1.25); grp.add(bl);
grp.add(this.glow('#8fe6ff', 1.0, 0.4));
item('#bff0ff', 0.6);
break;
}
case '|': {
M(g.vine, m.vine, null, [0, 0, 0.1], grp);
M(g.vine, m.vineDark, null, [0, 0, 0.1], grp).rotation.y = Math.PI;
const leaves = [];
for (let i = 0; i < 4; i++) {
const side = i % 2 ? 1 : -1, piv = new T.Group();
piv.position.set(side * 0.03, -0.4 + i * 0.25, 0.13);
grp.add(piv);
const l = M(g.leaf, m.leafFlat, [1.15, 1.15, 1.15], [0, 0, 0], piv);
l.rotation.set(-0.35, side * 0.5, -side * (1.0 + hash(r * 3 + i, c) * 0.5));
leaves.push({ piv, ph: hash(r, c + i) * 6.28, side });
}
if (hash(c * 7, r) > 0.7) {
const fl = new T.Group(); fl.position.set(0.06, 0.1, 0.17); grp.add(fl);
for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; M(g.sphere, m.petal, [0.035, 0.035, 0.015], [Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0], fl); }
M(g.sphere, m.gold, [0.02, 0.02, 0.015], [0, 0, 0.01], fl);
}
this.vines.push({ r, c, leaves, rustle: 0 });
break;
}
case 'm': case 'w': case 'u': case 'h': case 'B': {
if (!edit) break;
const e = this.makeMob({ m: 'walker', w: 'vertical', u: 'flyer', h: 'hopper', B: 'boss' }[ch]);
e.root.position.set(0, ch === 'm' || ch === 'h' ? -0.5 : 0, 0);
grp.add(e.root);
break;
}
}
}

this.buildTorches(grid, cols, th);
if (start) this.buildHome(start);
this.cols = cols;
this.mergeStatic();
}

buildDecor(grid, cols, walls, th) {
const T = this.T, g = this.g, m = this.m;
const solid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < cols && grid[r][c] === '#';
const place = (geo, mat, list, shadow) => {
if (!list.length) return;
const dm = new T.InstancedMesh(geo, mat, list.length), q = new T.Object3D();
list.forEach((d, i) => { q.position.set(d[0], d[1], d[2]); q.rotation.set(d[6] || 0, d[7] || 0, d[8] || 0); q.scale.set(d[3], d[4], d[5]); q.updateMatrix(); dm.setMatrixAt(i, q.matrix); });
dm.castShadow = !!shadow; dm.receiveShadow = true;
this.level.add(dm);
};
if (th.name === 'forest') {
const slabs = [], tufts = [];
for (const [r, c] of walls) if (r > 0 && !solid(r - 1, c)) {
slabs.push([this.wx(c), this.wy(r) + 0.47, 0, 1.02, 0.09, 1.02]);
for (let k = 0; k < 4; k++) {
const hx = hash(r * 5 + k, c), hz = hash(c * 3 + k, r);
tufts.push([this.wx(c) - 0.45 + hx * 0.9, this.wy(r) + 0.56, 0.18 + hz * 0.3, 0.035, 0.1 + hz * 0.1, 0.035, (hx - 0.5) * 0.5, 0, (hz - 0.5) * 0.6]);
}
}
place(g.box, m.grass, slabs, false);
place(g.cone, m.grassDark, tufts, false);
}
if (th.name === 'caves') {
const stal = [], crys = [];
for (const [r, c] of walls) if (r + 1 < ROWS && grid[r + 1][c] !== '#' && hash(r, c * 2) > 0.4) {
const hh = 0.2 + hash(c, r) * 0.3;
stal.push([this.wx(c) + (hash(r * 2, c) - 0.5) * 0.5, this.wy(r) - 0.5 - hh / 2, (hash(c, r * 3) - 0.5) * 0.4, 0.07 + hash(c * 5, r) * 0.06, hh, 0.07, Math.PI, 0, 0]);
}
for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < cols - 1; c++) if (grid[r][c] === '.' && solid(r + 1, c) && hash(r * 11, c * 7) > 0.86) {
for (let k = 0; k < 3; k++) crys.push([this.wx(c) + (hash(c + k, r) - 0.5) * 0.5, this.wy(r) - 0.44, -0.38 - k * 0.02, 0.4, 0.8 + hash(r + k, c) * 0.7, 0.4, 0, hash(c, r + k) * 3, (hash(r, c * 3 + k) - 0.5) * 0.6]);
}
place(g.cone, m.rock, stal, true);
place(g.oct, m.crystal, crys, false);
for (let i = 0; i < crys.length; i += 3) { const d = crys[i], gl = this.glow('#b49cff', 0.9, 0.3); gl.position.set(d[0], d[1] + 0.1, d[2] + 0.06); this.level.add(gl); }
}
if (th.metal) {
const wins = [];
for (let r = 2; r < ROWS - 2; r += 2) for (let c = 2; c < cols - 3; c += 3) if (grid[r][c] === '.' && grid[r][c + 1] === '.' && hash(r * 13, c) > 0.7) wins.push([c + 1, this.wy(r), -0.48, 0.8, 0.34, 0.02]);
place(g.box, m.window, wins, false);
}
}

buildTorches(grid, cols, th) {
const T = this.T, g = this.g, m = this.m, M = this.mesh.bind(this);
for (let c = 7; c < cols - 3; c += 9) {
const r = 3;
if (grid[r][c] !== '.' || grid[r + 1][c] !== '.' || grid[r - 1][c] === '#') continue;
const grp = new T.Group();
grp.position.set(this.wx(c), this.wy(r), -0.42);
this.level.add(grp);
if (th && th.metal) {
M(g.box, m.steelDark, [0.24, 0.1, 0.08], [0, -0.13, 0.02], grp);
M(g.box, m.steelDark, [0.06, 0.06, 0.16], [0, -0.13, 0.1], grp);
const bulb = M(g.sphere, m.lampGlass, [0.09, 0.09, 0.09], [0, -0.02, 0.17], grp); bulb.castShadow = false;
M(g.cyl, m.steelDark, [0.11, 0.03, 0.11], [0, 0.07, 0.17], grp);
const gl = this.glow('#7fd0ff', 1.5, 0.5); gl.position.set(0, -0.02, 0.28); grp.add(gl);
this.lightSrc.push({ x: this.wx(c), y: this.wy(r), z: 0.1, color: '#8fd4ff', base: 3, flick: false });
continue;
}
M(g.box, m.steelDark, [0.08, 0.3, 0.06], [0, -0.1, 0], grp);
M(g.box, m.steelDark, [0.06, 0.06, 0.22], [0, 0, 0.1], grp);
M(g.cyl, m.steelDark, [0.08, 0.1, 0.08], [0, 0.06, 0.2], grp);
const f1 = M(g.cone, m.flameB, [0.07, 0.22, 0.07], [0, 0.2, 0.2], grp); f1.castShadow = false;
const f2 = M(g.cone, m.flameC, [0.04, 0.12, 0.04], [0, 0.16, 0.2], grp); f2.castShadow = false;
const gl = this.glow('#ff9a40', 1.4, 0.5); gl.position.set(0, 0.2, 0.25); grp.add(gl);
this.torches.push({ f1, f2, gl, ph: c });
this.lightSrc.push({ x: this.wx(c), y: this.wy(r) + 0.2, z: 0.1, color: '#ff9a4a', base: 3, flick: true });
}
}

homeTextures() {
if (this.homeTex) return this.homeTex;
const T = this.T;
const mk = (w, h, fn, wrap) => {
const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
if (wrap) t.wrapS = t.wrapT = T.RepeatWrapping;
return t;
};
const plaster = mk(256, 256, (x, w, h) => {
x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
for (let k = 0; k < 70; k++) { x.fillStyle = 'rgba(120,100,80,' + (Math.random() * 0.05).toFixed(3) + ')'; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 3 + Math.random() * 10, Math.random() * 3, 0, 6.28); x.fill(); }
const gr = x.createLinearGradient(0, h * 0.72, 0, h); gr.addColorStop(0, 'rgba(120,100,80,0)'); gr.addColorStop(1, 'rgba(120,100,80,0.24)');
x.fillStyle = gr; x.fillRect(0, 0, w, h);
x.strokeStyle = 'rgba(90,80,70,0.35)'; x.lineWidth = 0.8;
for (let k = 0; k < 6; k++) { let px = Math.random() * w, py = Math.random() * h * 0.8; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 5; q++) { px += (Math.random() - 0.5) * 14; py += 4 + Math.random() * 8; x.lineTo(px, py); } x.stroke(); }
const d = x.getImageData(0, 0, w, h);
for (let k = 0; k < d.data.length; k += 4) { const n = (Math.random() - 0.5) * 16; d.data[k] += n; d.data[k + 1] += n; d.data[k + 2] += n; }
x.putImageData(d, 0, 0);
}, true);
const plate = mk(256, 96, (x, w, h) => {
x.fillStyle = '#f7f1e3'; x.fillRect(0, 0, w, h);
x.strokeStyle = '#2e6f95'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
x.fillStyle = '#2e6f95'; x.font = '700 56px "Barlow Condensed", system-ui, sans-serif';
x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('RITAM', w / 2, h / 2 + 3);
});
const tile = new T.CylinderGeometry(1, 1, 1, 10, 1, true, 0, Math.PI);
tile.rotateX(Math.PI / 2); tile.rotateZ(Math.PI / 2);
const std = (o) => new T.MeshStandardMaterial(o);
return (this.homeTex = {
plaster, tile, pot: new T.CylinderGeometry(1, 0.72, 1, 14),
tileMat: std({ color: '#ffffff', roughness: 0.72, side: T.DoubleSide }),
terracotta: std({ color: '#b65a3c', roughness: 0.85 }),
plateMat: std({ map: plate, roughness: 0.6 }),
rubber: std({ color: '#1f1f25', roughness: 0.9 }),
flowerRed: std({ color: '#e8283c', roughness: 0.5, emissive: '#5a0010', emissiveIntensity: 0.15 }),
flowerPink: std({ color: '#ff5f9a', roughness: 0.5, emissive: '#5a1030', emissiveIntensity: 0.12 }),
foliage: std({ color: '#4f9a3c', roughness: 0.75 }),
foliageDark: std({ color: '#2f6e2c', roughness: 0.8 }),
soil: std({ color: '#4a3020', roughness: 1 }),
interior: std({ color: '#3a2a22', roughness: 0.9 }),
bird: std({ color: '#3c5a52', roughness: 0.6 }),
beak: std({ color: '#f0a020', roughness: 0.5 }),
cream: std({ color: '#f4ecd8', roughness: 0.6 }),
straw: std({ color: '#d9b56a', roughness: 0.9 }),
scooter: std({ color: '#d8322e', roughness: 0.3, metalness: 0.25 }),
catFur: std({ color: '#e8954a', roughness: 0.8 }),
catWhite: std({ color: '#fbf3e6', roughness: 0.8 }),
catEye: std({ color: '#a8e86a', emissive: '#3a6a10', emissiveIntensity: 0.5, roughness: 0.2 }),
catNose: std({ color: '#ff9aa8', roughness: 0.5 }),
wingA: std({ color: '#ffd34a', emissive: '#5a3a00', emissiveIntensity: 0.2, roughness: 0.5, side: T.DoubleSide }),
wingB: std({ color: '#7fc8ff', emissive: '#0a3a5a', emissiveIntensity: 0.2, roughness: 0.5, side: T.DoubleSide }),
bug: std({ color: '#2a2a30', roughness: 0.6 })
});
}

buildHome(start) {
const T = this.T, g = this.g, m = this.m, M = this.mesh.bind(this), ht = this.homeTextures();
if (m.houseWall.map !== ht.plaster) { m.houseWall.map = ht.plaster; m.houseWall.needsUpdate = true; }
const HS = 1.4;
const home = new T.Group();
home.position.set(start.c + 0.5, this.wy(start.r) - 0.5, -0.3);
home.scale.setScalar(HS);
this.level.add(home);
const anim = (this.homeAnim = { shutters: [], plants: [], wins: [], butterflies: [], lantern: null, cat: null, home });
const H = 1.45, Ha = 0.95, Dp = 0.42, fz = Dp / 2, x0 = -0.95, x1 = 0.8, W = x1 - x0, cx = (x0 + x1) / 2;
M(g.box, m.homeStone, [W + 0.04, 0.1, Dp + 0.04], [cx, 0.05, 0], home);
M(g.box, m.houseWall, [W, H - 0.1, Dp], [cx, 0.1 + (H - 0.1) / 2, 0], home);
M(g.box, m.homeStone, [0.55, 0.08, Dp], [-1.215, 0.04, -0.03], home);
M(g.box, m.houseWall, [0.53, Ha - 0.08, Dp - 0.06], [-1.215, 0.08 + (Ha - 0.08) / 2, -0.03], home);

const tiles = [];
const roof = (a, b, zB, yB, zF, yF, step, ridge) => {
const dz = zF - zB, dy = yB - yF, len = Math.hypot(dz, dy), ang = Math.atan2(dy, dz);
const rows = Math.max(1, Math.round(len / 0.17)), tl = len / rows;
for (let xx = a; xx <= b + 1e-6; xx += step) for (let r = 0; r < rows; r++) {
const k = (r + 0.5) / rows;
tiles.push([xx, yB - dy * k + 0.022, zB + dz * k, step * 0.56, step * 0.44, tl * 1.14, ang]);
}
const sl = M(g.box, ht.terracotta, [b - a + step, 0.03, len + 0.02], [(a + b) / 2, (yB + yF) / 2 - 0.005, (zB + zF) / 2], home);
sl.rotation.x = ang;
if (ridge) M(g.cyl, ht.terracotta, [0.045, b - a + step + 0.04, 0.045], [(a + b) / 2, yB + 0.025, zB], home).rotation.z = Math.PI / 2;
return { dz, dy };
};
const mr = roof(x0 - 0.06, x1 + 0.06, -0.26, H + 0.42, fz + 0.15, H - 0.03, 0.095, true);
roof(-1.5, -0.98, -0.24, Ha + 0.28, fz + 0.1, Ha - 0.03, 0.095, true);
roof(-0.36, 0.36, fz + 0.01, 1.2, fz + 0.27, 1.1, 0.09, false);
const tm = new T.InstancedMesh(ht.tile, ht.tileMat, tiles.length), q = new T.Object3D(), col = new T.Color();
const pal = ['#c4603c', '#b0523a', '#d27448', '#9c4a36', '#c86a46', '#a85a40'];
tiles.forEach((d, k) => {
q.position.set(d[0], d[1], d[2]); q.rotation.set(d[6], 0, (hash(k, 3) - 0.5) * 0.06); q.scale.set(d[3], d[4], d[5]); q.updateMatrix();
tm.setMatrixAt(k, q.matrix);
tm.setColorAt(k, col.set(pal[Math.floor(hash(k, 11) * pal.length)]).multiplyScalar(0.9 + hash(k, 5) * 0.2));
});
tm.castShadow = tm.receiveShadow = true;
home.add(tm);
if (!ht.side) {
const slope = mr.dy / mr.dz, yAt = (z) => (H - 0.03) + (fz + 0.15 - z) * slope - H;
const sh = new T.Shape(); sh.moveTo(-fz, 0); sh.lineTo(fz, 0); sh.lineTo(fz, yAt(fz)); sh.lineTo(-fz, yAt(-fz)); sh.closePath();
ht.side = new T.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
}
for (const sx of [x0 + 0.03, x1]) { const sm = new T.Mesh(ht.side, m.houseWall); sm.rotation.y = -Math.PI / 2; sm.position.set(sx, H, 0); sm.castShadow = sm.receiveShadow = true; home.add(sm); }
M(g.cyl, m.steel, [0.022, W + 0.1, 0.022], [cx, H - 0.07, fz + 0.17], home).rotation.z = Math.PI / 2;
M(g.cyl, m.steel, [0.018, H - 0.14, 0.018], [x1 + 0.02, (H - 0.14) / 2 + 0.07, fz + 0.06], home);

M(g.box, m.houseWall, [0.17, 0.62, 0.17], [0.45, H + 0.5, -0.12], home);
M(g.box, ht.terracotta, [0.24, 0.035, 0.24], [0.45, H + 0.82, -0.12], home);
M(g.roof, ht.terracotta, [0.12, 0.12, 0.12], [0.45, H + 0.88, -0.12], home);
this.chimney = { x: start.c + 0.5 + 0.45 * HS, y: this.wy(start.r) - 0.5 + (H + 0.86) * HS, z: -0.3 - 0.12 * HS };
M(g.cyl, m.steelDark, [0.007, 0.6, 0.007], [0.52, H + 1.12, -0.12], home);
M(g.box, m.steelDark, [0.32, 0.008, 0.008], [0.52, H + 1.22, -0.12], home);
M(g.box, m.steelDark, [0.22, 0.008, 0.008], [0.52, H + 1.32, -0.12], home);
M(g.box, m.steelDark, [0.008, 0.2, 0.008], [0.6, H + 1.36, -0.12], home).rotation.z = 0.7;
const bird = new T.Group(); bird.position.set(-0.45, H + 0.5, -0.25); home.add(bird);
M(g.sphere, ht.bird, [0.05, 0.038, 0.034], [0, 0, 0], bird).rotation.z = 0.25;
const bh = new T.Group(); bh.position.set(0.045, 0.035, 0); bird.add(bh);
M(g.sphere, ht.bird, [0.03, 0.03, 0.028], [0, 0, 0], bh);
M(g.cone, ht.beak, [0.011, 0.032, 0.011], [0.035, -0.002, 0], bh).rotation.z = -Math.PI / 2;
for (const sz of [1, -1]) M(g.sphere, m.pupil, [0.006, 0.006, 0.004], [0.014, 0.008, sz * 0.024], bh);
M(g.box, ht.bird, [0.05, 0.01, 0.026], [-0.065, 0.012, 0], bird).rotation.z = 0.45;
const wings = [];
for (const sz of [1, -1]) { const wp = new T.Group(); wp.position.set(0, 0.02, sz * 0.03); bird.add(wp); M(g.sphere, ht.bird, [0.045, 0.008, 0.03], [-0.01, 0, sz * 0.025], wp); wp.rotation.x = sz * 0.15; wings.push({ wp, sz }); }
this.bird = { grp: bird, head: bh, wings, x: -0.45, y: H + 0.5, z: -0.25, hop: 0, fly: 0, cool: 0 };

for (const sx of [-0.34, 0.34]) M(g.box, m.homeDoor, [0.06, 1.02, 0.06], [sx, 0.53, fz + 0.01], home);
M(g.box, m.homeDoor, [0.74, 0.06, 0.06], [0, 1.04, fz + 0.01], home);
const inside = M(g.box, new T.MeshStandardMaterial({ color: '#b07448', emissive: '#5a2e12', emissiveIntensity: 0.55, roughness: 0.9 }), [0.62, 0.96, 0.02], [0, 0.55, fz - 0.06], home); inside.castShadow = false;
M(g.box, ht.interior, [0.16, 0.5, 0.02], [0.17, 0.42, fz - 0.045], home);
for (const sy of [0.3, 0.45, 0.6]) M(g.box, ht.cream, [0.16, 0.012, 0.03], [0.17, sy, fz - 0.04], home);
M(g.box, ht.interior, [0.13, 0.15, 0.012], [-0.13, 0.75, fz - 0.045], home);
M(g.box, ht.cream, [0.09, 0.11, 0.012], [-0.13, 0.75, fz - 0.04], home);
const hinge = new T.Group(); hinge.position.set(-0.31, 0.53, fz + 0.025); home.add(hinge);
M(g.box, m.homeDoor, [0.6, 0.95, 0.035], [0.3, 0, 0], hinge);
for (let k = 0; k < 10; k++) M(g.box, m.homeDoorLight, [0.5, 0.03, 0.018], [0.3, -0.39 + k * 0.087, 0.022], hinge).rotation.x = 0.5;
M(g.sphere, m.gold, [0.03, 0.03, 0.03], [0.54, -0.02, 0.04], hinge);
for (const sx of [-0.33, 0.33]) M(g.box, m.woodDark, [0.03, 0.03, 0.2], [sx, 1.08, fz + 0.1], home).rotation.x = -0.6;
M(g.box, m.homeStone, [0.82, 0.07, 0.3], [0, 0.035, fz + 0.13], home);
M(g.box, m.mat, [0.5, 0.014, 0.2], [0, 0.077, fz + 0.13], home);

const wx = -0.6, wy = 0.9;
M(g.box, m.windowLit, [0.34, 0.36, 0.02], [wx, wy, fz + 0.004], home);
for (const [bw, bh2, ox, oy] of [[0.4, 0.035, 0, 0.195], [0.4, 0.035, 0, -0.195], [0.035, 0.42, 0.185, 0], [0.035, 0.42, -0.185, 0], [0.34, 0.02, 0, 0], [0.02, 0.36, 0, 0]]) M(g.box, m.homeDoor, [bw, bh2, 0.035], [wx + ox, wy + oy, fz + 0.015], home);
for (const sd of [-1, 1]) {
const hg = new T.Group(); hg.position.set(wx + sd * 0.2, wy, fz + 0.02); hg.rotation.y = sd * 0.55; home.add(hg); anim.shutters.push({ hg, sd });
M(g.box, m.homeDoor, [0.18, 0.4, 0.02], [sd * 0.09, 0, 0], hg);
for (let k = 0; k < 7; k++) M(g.box, m.homeDoorLight, [0.14, 0.022, 0.014], [sd * 0.09, -0.15 + k * 0.05, 0.014], hg).rotation.x = 0.5;
}
M(g.box, ht.cream, [0.56, 0.028, 0.15], [wx, wy + 0.27, fz + 0.07], home).rotation.x = 0.16;
M(g.box, ht.terracotta, [0.4, 0.07, 0.09], [wx, wy - 0.25, fz + 0.06], home);
for (let k = 0; k < 7; k++) {
const fx = wx - 0.17 + k * 0.057;
M(g.sphere, ht.foliage, [0.04, 0.034, 0.034], [fx, wy - 0.2, fz + 0.07], home);
M(g.sphere, k % 3 ? ht.flowerRed : ht.flowerPink, [0.024, 0.024, 0.024], [fx + 0.012, wy - 0.17 + (k % 2) * 0.02, fz + 0.09], home);
}
const wg = this.glow('#ffc865', 0.7, 0.18); wg.position.set(wx, wy, fz + 0.12); home.add(wg); anim.wins.push(wg);

M(g.box, m.windowLit, [0.16, 0.18, 0.02], [-1.215, 0.62, fz - 0.055], home);
for (const [bw, bh2, ox, oy] of [[0.2, 0.025, 0, 0.1], [0.2, 0.025, 0, -0.1], [0.025, 0.22, 0.09, 0], [0.025, 0.22, -0.09, 0]]) M(g.box, m.homeDoor, [bw, bh2, 0.03], [-1.215 + ox, 0.62 + oy, fz - 0.045], home);
M(g.box, ht.plateMat, [0.26, 0.095, 0.014], [0.52, 0.86, fz + 0.008], home);
M(g.box, m.steelDark, [0.16, 0.05, 0.026], [0.52, 0.7, fz + 0.012], home);
M(g.box, m.pupil, [0.11, 0.008, 0.01], [0.52, 0.705, fz + 0.026], home);
M(g.box, m.steelDark, [0.02, 0.02, 0.14], [-0.86, 1.36, fz + 0.08], home);
const lp = new T.Group(); lp.position.set(-0.86, 1.35, fz + 0.15); home.add(lp);
M(g.cyl, m.steelDark, [0.004, 0.08, 0.004], [0, -0.04, 0], lp);
M(g.cyl, ht.cream, [0.04, 0.09, 0.04], [0, -0.13, 0], lp);
M(g.cyl, m.windowLit, [0.032, 0.07, 0.032], [0, -0.13, 0.005], lp);
M(g.cone, m.steelDark, [0.05, 0.04, 0.05], [0, -0.065, 0], lp);
const lg = this.glow('#ffc865', 0.8, 0.3); lg.position.set(0, -0.13, 0.1); lp.add(lg);
anim.lantern = { lp, lg };
M(g.cyl, m.wood, [0.012, 0.78, 0.012], [-1.3, 0.4, fz + 0.0], home).rotation.z = 0.18;
M(g.cone, ht.straw, [0.06, 0.16, 0.03], [-1.37, 0.06, fz + 0.0], home).rotation.z = Math.PI + 0.18;

const potAt = (px, r, bush) => {
const pz = fz + 0.08;
M(ht.pot, ht.terracotta, [r, r * 1.15, r], [px, r * 0.575, pz], home);
M(g.cyl, ht.terracotta, [r * 1.08, r * 0.18, r * 1.08], [px, r * 1.12, pz], home);
M(g.cyl, ht.soil, [r * 0.95, 0.01, r * 0.95], [px, r * 1.2, pz], home);
const plant = new T.Group(); plant.position.set(px, r * 1.2, pz); home.add(plant);
anim.plants.push({ g: plant, ph: px * 7, amp: bush ? 0.06 : 0.09 });
const home0 = home; void home0;
const n = bush ? 10 : 4, hgt = bush ? r * 2.6 : r * 0.9;
for (let k = 0; k < n; k++) {
const a = hash(px * 10, k) * 6.28, rr = hash(k, px * 7) * r * (bush ? 1.2 : 0.7);
M(g.sphere, k % 3 ? ht.foliage : ht.foliageDark, [r * 0.55, r * 0.46, r * 0.5], [Math.cos(a) * rr, r * 0.1 + hash(k * 3, px) * hgt, Math.sin(a) * rr * 0.5], plant);
}
for (let k = 0; k < n * 2; k++) {
const a = hash(px * 3, k + 9) * 6.28, rr = hash(k + 4, px * 5) * r * (bush ? 1.3 : 0.8);
M(g.sphere, bush && k % 2 ? ht.flowerPink : ht.flowerRed, [r * 0.17, r * 0.17, r * 0.17], [Math.cos(a) * rr, r * 0.3 + hash(k * 7, px) * hgt * 1.1, 0.02 + Math.abs(Math.sin(a)) * rr * 0.5], plant).castShadow = false;
}
};
potAt(-0.92, 0.075, false); potAt(-0.76, 0.095, false); potAt(-0.43, 0.07, false); potAt(0.45, 0.085, false); potAt(0.66, 0.11, true);

for (const [sy, sr, sh2] of [[0.26, 0.14, 0.22], [0.5, 0.12, 0.18], [0.7, 0.08, 0.12]]) M(g.sphere, ht.foliageDark, [sr, sh2, sr * 0.8], [0.98, sy, -0.12], home);
const sc = new T.Group(); sc.position.set(1.2, 0, 0.0); home.add(sc);
for (const wx2 of [-0.17, 0.16]) {
const wh = M(g.cyl, ht.rubber, [0.07, 0.035, 0.07], [wx2, 0.07, 0], sc); wh.rotation.x = Math.PI / 2;
const hb = M(g.cyl, m.steel, [0.035, 0.04, 0.035], [wx2, 0.07, 0], sc); hb.rotation.x = Math.PI / 2;
}
M(g.sphere, ht.scooter, [0.14, 0.09, 0.085], [-0.13, 0.19, 0], sc);
M(g.box, m.steelDark, [0.2, 0.03, 0.09], [0.02, 0.12, 0], sc);
M(g.box, ht.scooter, [0.05, 0.27, 0.1], [0.14, 0.24, 0], sc).rotation.z = -0.25;
M(g.sphere, ht.cream, [0.065, 0.025, 0.06], [0.16, 0.12, 0], sc);
M(g.sphere, m.shoe || ht.rubber, [0.1, 0.03, 0.065], [-0.13, 0.285, 0], sc);
M(g.cyl, m.steel, [0.012, 0.06, 0.012], [0.19, 0.37, 0], sc);
M(g.cyl, m.steel, [0.01, 0.16, 0.01], [0.19, 0.4, 0], sc).rotation.x = Math.PI / 2;
M(g.sphere, m.windowLit, [0.025, 0.025, 0.02], [0.22, 0.38, 0], sc);
M(g.box, ht.cream, [0.012, 0.05, 0.07], [-0.27, 0.2, 0], sc);
M(g.sphere, ht.scooter, [0.07, 0.03, 0.06], [0.16, 0.15, 0], sc);

const cat = new T.Group(); cat.position.set(-1.22, 1.09, 0.06); home.add(cat);
M(g.sphere, ht.catFur, [0.07, 0.075, 0.06], [0, 0.07, 0], cat);
M(g.sphere, ht.catWhite, [0.04, 0.05, 0.03], [0, 0.07, 0.04], cat);
for (const sx of [1, -1]) M(g.sphere, ht.catWhite, [0.022, 0.016, 0.03], [sx * 0.035, 0.006, 0.045], cat);
const ch = new T.Group(); ch.position.set(0, 0.17, 0.01); cat.add(ch);
M(g.sphere, ht.catFur, [0.058, 0.05, 0.05], [0, 0, 0], ch);
M(g.sphere, ht.catWhite, [0.03, 0.022, 0.02], [0, -0.018, 0.04], ch);
M(g.sphere, ht.catNose, [0.008, 0.006, 0.006], [0, -0.006, 0.05], ch);
const catEyes = [];
for (const sx of [1, -1]) {
M(g.cone, ht.catFur, [0.022, 0.04, 0.016], [sx * 0.034, 0.05, -0.004], ch).rotation.z = -sx * 0.3;
const ce = M(g.sphere, ht.catEye, [0.011, 0.013, 0.006], [sx * 0.022, 0.006, 0.045], ch); catEyes.push(ce);
M(g.sphere, m.pupil, [0.004, 0.011, 0.004], [sx * 0.022, 0.006, 0.05], ch);
for (const wy of [-0.01, -0.02]) M(g.box, ht.catWhite, [0.045, 0.002, 0.002], [sx * 0.05, wy, 0.04], ch).rotation.z = sx * (wy + 0.015) * 8;
}
const tail = new T.Group(); tail.position.set(0, 0.03, -0.05); cat.add(tail);
const segs = [];
let parent = tail;
for (let k = 0; k < 5; k++) { const sg = new T.Group(); sg.position.set(0, k ? 0.03 : 0, k ? -0.008 : 0); parent.add(sg); M(g.sphere, k === 4 ? ht.catWhite : ht.catFur, [0.016, 0.022, 0.016], [0, 0.012, 0], sg); segs.push(sg); parent = sg; }
anim.cat = { grp: cat, head: ch, eyes: catEyes, segs, blink: 0, x: start.c + 0.5 - 1.22 * HS };
[[0.62, 0.5, ht.wingA], [-0.7, 0.4, ht.wingB]].forEach(([bx, by, wm], k) => {
const bf = new T.Group(); home.add(bf);
M(g.cyl, ht.bug, [0.005, 0.04, 0.005], [0, 0, 0], bf);
const wl = [];
for (const sx of [1, -1]) { const wp = new T.Group(); bf.add(wp); const w1 = M(g.sphere, wm, [0.03, 0.026, 0.003], [sx * 0.03, 0.008, 0], wp); const w2 = M(g.sphere, wm, [0.02, 0.016, 0.003], [sx * 0.022, -0.016, 0], wp); w1.castShadow = w2.castShadow = false; wl.push({ wp, sx }); }
anim.butterflies.push({ bf, wl, cx: bx, cy: by, cz: fz + 0.22, ph: k * 2.1 });
});
this.homePos = { x: start.c + 0.5, y: this.wy(start.r) - 0.5 };
const dg = this.glow('#ffd28a', 0.85, 0.16); dg.position.set(0, 0.55, fz - 0.03); home.add(dg);
this.homeHinge = hinge;
this.homeT = 0;
this.lightSrc.push({ x: start.c + 0.5, y: this.wy(start.r) + 0.6, z: -0.15, color: '#ffc27a', base: 1.3, flick: true });
this.lightSrc.push({ x: start.c + 0.5 - 0.86 * HS, y: this.wy(start.r) - 0.5 + 1.22 * HS, z: 0.2, color: '#ffc27a', base: 2, flick: true });
}

updatePlatforms(game, edit) {
const list = game.platforms || [];
if (list !== this.platArr) {
for (const o of this.platMeshes || []) this.scene.remove(o);
this.platMeshes = list.map(() => {
const grp = new this.T.Group();
this.mesh(this.g.box, this.m.wood, [2, 0.375, 0.9], [0, 0, 0], grp);
this.mesh(this.g.box, this.m.gold, [2.04, 0.06, 0.94], [0, 0.17, 0], grp);
for (const s of [-0.7, 0, 0.7]) this.mesh(this.g.sphere, this.m.steel, [0.05, 0.05, 0.03], [s, 0, 0.46], grp);
this.scene.add(grp);
return grp;
});
this.platArr = list;
}
list.forEach((pl, i) => {
const o = this.platMeshes[i];
o.visible = !edit;
o.position.set((pl.x + pl.w / 2) / TILE, ROWS - (pl.y + 6) / TILE, 0);
});
}


particle(x, y, z, vx, vy, vz, color, size, life, grav) {
const T = this.T;
let p = this.partPool.pop();
if (!p) {
p = new T.Mesh(this.g.puff, new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }));
this.scene.add(p);
}
p.visible = true;
p.material.color.set(color);
p.position.set(x, y, z);
p.userData = { vx, vy, vz, life: 0, max: life, size, grav: grav ?? 0 };
p.scale.setScalar(size);
this.parts.push(p);
}

burst(pos, color, n) {
for (let i = 0; i < n; i++) {
const a = Math.random() * Math.PI * 2, s = 0.03 + Math.random() * 0.06;
this.particle(pos.x, pos.y, pos.z + 0.2, Math.cos(a) * s, Math.sin(a) * s + 0.03, (Math.random() - 0.5) * 0.04, color, 0.04 + Math.random() * 0.04, 30 + Math.random() * 20, -0.002);
}
}

dust(x, y, n) {
for (let i = 0; i < n; i++) this.particle(x + (Math.random() - 0.5) * 0.4, y + 0.05, 0.2 + Math.random() * 0.2, (Math.random() - 0.5) * 0.04, 0.01 + Math.random() * 0.01, 0, '#f1ece6', 0.06 + Math.random() * 0.05, 24 + Math.random() * 10, 0);
}

fx(name, game) {
const p = game.player, x = (p.x + p.w / 2) / TILE, y = ROWS - (p.y + p.h) / TILE;
const a = this.a;
if (name === 'jump') { a.squash = -0.3; a.squashV = 0; a.tuftV -= 0.25; this.dust(x, y, 6); }
else if (name === 'trophy') { a.squash = -0.22; a.cheer = 55; a.happy = 70; this.burst({ x, y: y + 0.6, z: 0 }, '#ffe08a', 24); }
else if (name === 'door') this.burst({ x, y: y + 0.5, z: 0 }, '#fff0a8', 30);
else if (name === 'pickup' || name === 'gem' || name === 'coin' || name === 'prize') a.happy = 28;
else if (name === 'kill') a.happy = 22;
else if (name === 'shoot') {
a.shoot = 14;
this.particle(x + p.face * 0.55, y + 0.52, 0.2, p.face * 0.01, 0, 0, '#c8f6ff', 0.15, 7, 0);
this.particle(x + p.face * 0.55, y + 0.52, 0.2, p.face * 0.02, 0.004, 0, '#ffffff', 0.07, 6, 0);
}
}

setResolution(s) {
this.gl.setSize(Math.round(1280 * s), Math.round(640 * s), false);
}

mergeStatic() {
const T = this.T, level = this.level, dyn = new Set();
const add = (v, d) => {
if (!v || d > 3) return;
if (v.isObject3D) { dyn.add(v); return; }
if (Array.isArray(v)) { for (const x of v) add(x, d + 1); return; }
if (typeof v === 'object') for (const k in v) if (k !== 'home') add(v[k], d + 1);
};
[this.items, this.waters, this.fires, this.doors, this.vines, this.flags, this.torches, this.flavorAnim, this.critters, this.homeAnim, this.bird, this.homeHinge].forEach((v) => add(v, 0));
level.updateMatrixWorld(true);
const inv = new T.Matrix4().copy(level.matrixWorld).invert(), groups = new Map(), victims = [];
level.traverse((o) => {
if (!o.isMesh || o.isInstancedMesh || !o.visible || Array.isArray(o.material) || o.material.transparent) return;
const gm = o.geometry;
if (!gm.index || !gm.attributes.normal || !gm.attributes.uv || gm.morphAttributes.position) return;
for (let p = o; p && p !== level; p = p.parent) if (dyn.has(p) || !p.visible) return;
const key = o.material.uuid + (o.castShadow ? 's' : '') + (o.receiveShadow ? 'r' : '');
if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
groups.get(key).list.push(o);
});
const m4 = new T.Matrix4(), n3 = new T.Matrix3(), v = new T.Vector3();
let merged = 0;
for (const G of groups.values()) {
if (G.list.length < 2) continue;
let nv = 0, ni = 0;
for (const o of G.list) { nv += o.geometry.attributes.position.count; ni += o.geometry.index.count; }
const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
let vo = 0, io = 0;
for (const o of G.list) {
const gm = o.geometry, P = gm.attributes.position, N = gm.attributes.normal, U = gm.attributes.uv, I = gm.index;
m4.multiplyMatrices(inv, o.matrixWorld); n3.getNormalMatrix(m4);
for (let i = 0; i < P.count; i++) {
v.fromBufferAttribute(P, i).applyMatrix4(m4); pos.set([v.x, v.y, v.z], (vo + i) * 3);
v.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i);
}
for (let i = 0; i < I.count; i++) idx[io + i] = I.getX(i) + vo;
vo += P.count; io += I.count;
victims.push(o); merged++;
}
const geo = new T.BufferGeometry();
geo.setAttribute('position', new T.BufferAttribute(pos, 3));
geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
geo.setIndex(new T.BufferAttribute(idx, 1));
geo.computeBoundingSphere();
const mesh = new T.Mesh(geo, G.mat);
mesh.castShadow = G.cast; mesh.receiveShadow = G.recv; mesh.userData.ownsGeo = true; mesh.name = 'static_' + (G.mat.name || 'mat');
level.add(mesh);
}
for (const o of victims) { o.parent && o.parent.remove(o); if (o.userData.ownsGeo) o.geometry.dispose(); }
this.mergedCount = merged;
}

async loadHeroModel(url) {
const T = this.T;
try {
const ab = (url && url.then ? await url : null) || await (await fetch(typeof url === 'string' ? url : './dave/ritam-model.glb')).arrayBuffer(), dv = new DataView(ab);
const jl = dv.getUint32(12, true), j = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 20, jl))), b0 = 28 + jl;
const A = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType]; return new C(ab, b0 + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * n); };
const pr = j.meshes[0].primitives[0], geo = new T.BufferGeometry();
geo.setAttribute('position', new T.BufferAttribute(A(pr.attributes.POSITION), 3));
geo.setAttribute('normal', new T.BufferAttribute(A(pr.attributes.NORMAL), 3));
geo.setAttribute('uv', new T.BufferAttribute(A(pr.attributes.TEXCOORD_0), 2));
geo.setIndex(new T.BufferAttribute(A(pr.indices), 1));
{
const pa = geo.attributes.position.array, nvx = pa.length / 3, BINS = 60, Y0 = -0.8, Y1 = 0.46;
const lists = Array.from({ length: BINS }, () => []), thr = new Float32Array(BINS).fill(9);
for (let i = 0; i < nvx; i++) { const y = pa[i * 3 + 1]; if (y < Y0 || y >= Y1) continue; lists[Math.floor(((y - Y0) / (Y1 - Y0)) * BINS)].push(Math.abs(pa[i * 3])); }
for (let b = 0; b < BINS; b++) {
const L = lists[b].sort((p, q) => p - q); let best = 0, at = 9;
for (let k = 1; k < L.length; k++) if (L[k - 1] > 0.12 && L[k] < 0.52 && L[k] - L[k - 1] > best) { best = L[k] - L[k - 1]; at = (L[k] + L[k - 1]) / 2; }
const yc = Y0 + ((b + 0.5) / BINS) * (Y1 - Y0);
thr[b] = best > 0.012 ? at : yc > 0.18 ? 0.27 : 9;
}
const aw = new Float32Array(nvx);
for (let i = 0; i < nvx; i++) { const y = pa[i * 3 + 1]; if (y < Y0 || y >= Y1) continue; aw[i] = Math.abs(pa[i * 3]) > thr[Math.floor(((y - Y0) / (Y1 - Y0)) * BINS)] ? 1 : 0; }
geo.setAttribute('armW', new T.BufferAttribute(aw, 1));
}
const ibv = j.bufferViews[j.images[0].bufferView];
const bmp = await createImageBitmap(new Blob([new Uint8Array(ab, b0 + (ibv.byteOffset || 0), ibv.byteLength)], { type: 'image/jpeg' }));
const tc = document.createElement('canvas'); tc.width = bmp.width; tc.height = bmp.height;
const tx = tc.getContext('2d'); tx.drawImage(bmp, 0, 0);
const id = tx.getImageData(0, 0, tc.width, tc.height), px = id.data;
for (let i = 0; i < px.length; i += 4) {
const R = px[i] / 255, G = px[i + 1] / 255, B = px[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, dd = mx - mn;
if (dd < 0.06 || mx !== R) continue;
const s = dd / (1 - Math.abs(2 * l - 1)), hue = ((G - B) / dd) * 60;
if (hue < -14 || hue > 27 || s < 0.2 || s > 0.96 || l < 0.1 || l > 0.68) continue;
const k = Math.min(1, (27 - hue) / 5) * Math.min(1, (s - 0.2) / 0.08) * Math.min(1, (0.68 - l) / 0.06);
const nl = l + (0.58 - l) * 0.5, ns = 0.34 + (s - 0.5) * 0.15, nh = (29 + (hue - 12) * 0.15) / 360;
const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns, p2 = 2 * nl - q;
const f = (tt) => { tt = (tt + 1) % 1; return tt < 1 / 6 ? p2 + (q - p2) * 6 * tt : tt < 0.5 ? q : tt < 2 / 3 ? p2 + (q - p2) * (2 / 3 - tt) * 6 : p2; };
px[i] += (f(nh + 1 / 3) * 255 - px[i]) * k; px[i + 1] += (f(nh) * 255 - px[i + 1]) * k; px[i + 2] += (f(nh - 1 / 3) * 255 - px[i + 2]) * k;
}
tx.putImageData(id, 0, 0);
const tex = new T.CanvasTexture(tc); tex.flipY = false; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0, side: T.DoubleSide });
const U = { uLegL: { value: 0 }, uLegR: { value: 0 }, uArmL: { value: 0 }, uArmR: { value: 0 } };
mat.onBeforeCompile = (sh) => {
Object.assign(sh.uniforms, U);
sh.vertexShader = 'attribute float armW;\nuniform float uLegL, uLegR, uArmL, uArmR;\nvec3 rX(vec3 p, vec3 c, float a){ p -= c; float co = cos(a), si = sin(a); return vec3(p.x, co * p.y - si * p.z, si * p.y + co * p.z) + c; }\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
float wLeg = smoothstep(-0.16, -0.32, transformed.y) * (1.0 - armW);
float sd = smoothstep(-0.09, 0.09, transformed.x);
vec3 lp = rX(transformed, vec3(0.0, -0.22, 0.0), mix(uLegL, uLegR, sd));
float wArm = armW * smoothstep(0.46, 0.3, transformed.y);
float sa = step(0.0, transformed.x);
vec3 ap = rX(transformed, vec3(0.0, 0.36, 0.0), mix(uArmL, uArmR, sa));
transformed = mix(mix(transformed, lp, wLeg), ap, wArm);`);
};
const mesh = new T.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'ritam_model';
geo.computeBoundingBox(); const bb = geo.boundingBox;
mesh.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
const root = new T.Group(), turn = new T.Group(); root.add(turn); turn.add(mesh); root.visible = false;
this.scene.add(root);
const bottle = new T.Group(); bottle.position.set(mesh.position.x, 0.36 + mesh.position.y, mesh.position.z); turn.add(bottle);
const bt = this.makeBottle(); bt.position.set(0.42, -0.6, 0.1); bt.rotation.x = 0.25; bottle.add(bt); bottle.visible = false;
this.model = { root, turn, mesh, U, bottle, s: 1.3 / (bb.max.y - bb.min.y), yaw: 0 };
} catch (e) { console.warn('Ritam model failed to load', e); }
}

makeBottle() {
const T = this.T, g = new T.Group();
const M = (o) => new T.MeshStandardMaterial(o);
const glass = new T.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.4, depthWrite: false });
const milk = M({ color: '#fbf7ee', roughness: 0.35 }), ring = M({ color: '#6cb8ff', roughness: 0.3 }), teat = M({ color: '#ffd59a', roughness: 0.45 }), heart = M({ color: '#ff7aa8', roughness: 0.5 });
const cyl = (r1, r2, h, m, y) => { const o = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 20), m); o.position.y = y; g.add(o); return o; };
cyl(0.044, 0.044, 0.11, milk, -0.025); cyl(0.05, 0.05, 0.16, glass, 0); cyl(0.054, 0.054, 0.035, ring, 0.095);
const t = new T.Mesh(new T.SphereGeometry(0.028, 16, 12), teat); t.scale.y = 1.45; t.position.y = 0.13; g.add(t);
const lb = new T.Mesh(new T.CircleGeometry(0.02, 16), heart); lb.position.set(0, 0.005, 0.0505); g.add(lb);
g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.name = 'bupam'; } });
return g;
}

duckFactor(game, p) {
if (p.climb || !game.solidAt) return 1;
for (let d = 0; d <= 13; d++) if (game.solidAt(p.x + 5, p.y - d - 1, p.w - 10, 1)) return Math.max(0.7, (29 + d) / 41.6);
return 1;
}

setLite(on) {
this.lite = !!on;
if (this.weather) this.setWeather(this.weather);
}
setShadows(on) {
this.shadows = !!on;
this.gl.shadowMap.enabled = this.shadows;
this.key.castShadow = this.shadows;
this.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => { mm.needsUpdate = true; }); } });
}

dispose() {
this.clearLevel();
this.gl.dispose();
}


draw(game, opts = {}) {
const edit = !!opts.edit, t = game.frame, grid = edit ? game.raw : game.map;
if (edit) {
const sig = game.levelIndex + '|' + grid.map((r) => r.join('')).join('');
if (sig !== this.sig) { this.sig = sig; this.buildLevel(grid, game, true); this.builtMap = null; }
} else if (game.map !== this.builtMap) {
this.buildLevel(grid, game, false);
this.builtMap = game.map;
this.sig = '';
}

this.updateWorld(game, grid, t, edit);
if (edit) this.poseEditHero(game);
else this.updateHero(game, t);
this.updateMobs(game, t, edit);
this.updatePlatforms(game, edit);
this.updateProjectiles(game);
this.updateParticles();
const cam = this.updateCamera(game, edit);
this.updateLights(game, t, edit);
this.updateMotes(game, t, edit);
this.updateFlavor(game, t, edit);
this.updateCritters(game, t, edit);
this.gl.render(this.scene, cam);
this.drawOverlay(game, cam, edit);
}

updateWorld(game, grid, t, edit) {
for (const it of this.items) {
if (it.gone) continue;
if (!edit && grid[it.r][it.c] !== it.ch) {
it.gone = true;
this.level.remove(it.obj);
this.burst(it.obj.position, it.color, 16);
continue;
}
if (it.still) continue;
it.obj.rotation.y = t * 0.04 * it.spin + it.ph;
it.obj.position.y = it.y + Math.sin(t / 18 + it.ph) * 0.07;
}
for (const w of this.waters) w.obj.position.y = -0.11 + Math.sin(t * 0.06 + w.ph) * 0.03;
for (const f of this.fires) {
f.cones.forEach((c, i) => {
const k = 1 + Math.sin(t * 0.3 + f.ph + i * 1.7) * 0.12 + Math.sin(t * 0.71 + i) * 0.06;
c.f.scale.y = c.h * k;
c.f.position.y = -0.36 + (c.h * k) / 2;
c.f.position.x = c.ox + Math.sin(t * 0.2 + f.ph + i) * 0.02;
});
f.gl.material.opacity = 0.45 + Math.sin(t * 0.4 + f.ph) * 0.1;
if (!edit && Math.random() < 0.03) {
const p = f.gl.parent.position;
this.particle(p.x + (Math.random() - 0.5) * 0.4, p.y, 0.2, (Math.random() - 0.5) * 0.01, 0.02 + Math.random() * 0.02, 0, '#ffb04a', 0.025, 40 + Math.random() * 30, 0);
}
}
const open = game.hasTrophy || edit;
for (const d of this.doors) {
d.open += ((open ? 1 : 0) - d.open) * 0.08;
d.hinge.rotation.y = -d.open * 1.9;
d.gl.visible = d.open > 0.05;
d.gl.material.opacity = 0.7 * d.open;
d.inner.visible = d.open > 0.02;
}
for (const f of this.flags) {
const on = edit || grid[f.r][f.c] === 'f';
if (on !== f.on) {
f.on = on;
f.flag.material = on ? this.m.flagOn : this.m.flagOff;
if (on && !edit) this.burst(f.flag.parent.position, '#9dffa8', 18);
}
f.flag.position.y += ((on ? 0.3 : -0.2) - f.flag.position.y) * 0.1;
f.flag.rotation.y = Math.sin(t * 0.12 + f.c) * 0.35;
f.gl.material.opacity = on ? 0.35 + Math.sin(t * 0.1) * 0.1 : 0;
}
if (this.fakes.length) {
const p = game.player, pc = Math.floor((p.x + p.w / 2) / TILE), pr = Math.floor((p.y + p.h / 2) / TILE);
const near = !edit && this.fakes.some((f) => Math.abs(f.c - pc) <= 1 && Math.abs(f.r - pr) <= 1);
const fm = this.m.fake, target = edit ? 0.6 : (near ? 0.28 : 1);
fm.opacity += (target - fm.opacity) * 0.15;
fm.depthWrite = fm.opacity > 0.95;
}
if (this.homeHinge) {
this.homeT++;
const k = edit ? 1 : Math.min(1, Math.max(0, this.homeT - 10) / 40);
this.homeHinge.rotation.y = -1.75 * (1 - Math.pow(1 - k, 3));
}
const hp = this.homePos, pl = game.player, pwx = (pl.x + pl.w / 2) / TILE;
if (this.bird) {
const b = this.bird;
if (b.cool > 0) b.cool--;
if (!edit && b.fly <= 0 && b.cool <= 0 && hp && Math.abs(pwx - hp.x) < 1.6 && Math.abs(pl.vx) > 0.5) { b.fly = 240; b.cool = 900; }
if (b.fly > 0) {
b.fly--;
const u = 1 - b.fly / 240, e = Math.sin(u * Math.PI);
b.grp.position.set(b.x + Math.sin(u * Math.PI * 2) * 1.1, b.y + e * 1.4, b.z + Math.sin(u * Math.PI * 2) * 0.3);
b.grp.rotation.y = Math.cos(u * Math.PI * 2) > 0 ? 0 : Math.PI;
for (const w of b.wings) w.wp.rotation.x = w.sz * (0.2 + Math.abs(Math.sin(t * 0.9)) * 1.3);
b.head.rotation.set(0, 0, 0.15);
} else {
b.grp.position.set(b.x, b.y, b.z); b.grp.rotation.y = 0;
for (const w of b.wings) w.wp.rotation.x = w.sz * 0.15;
b.head.rotation.z = Math.sin(t * 0.07) > 0.85 ? -0.6 : Math.sin(t * 0.03) * 0.15;
b.head.rotation.y = Math.sin(t * 0.011) * 0.6;
if (!edit && b.hop <= 0 && Math.random() < 0.004) b.hop = 20;
if (b.hop > 0) { b.hop--; b.grp.position.y = b.y + Math.sin((b.hop / 20) * Math.PI) * 0.06; for (const w of b.wings) w.wp.rotation.x = w.sz * 0.9; }
}
}
const A = this.homeAnim;
if (A) {
for (const sh of A.shutters) sh.hg.rotation.y = sh.sd * (0.55 + Math.sin(t * 0.021 + sh.sd) * 0.07 + Math.sin(t * 0.053) * 0.02);
for (const p of A.plants) { p.g.rotation.z = Math.sin(t * 0.03 + p.ph) * p.amp; p.g.rotation.x = Math.sin(t * 0.023 + p.ph) * p.amp * 0.4; }
for (const w of A.wins) w.material.opacity = 0.32 + Math.sin(t * 0.09 + w.id) * 0.03 + Math.random() * 0.03;
if (A.lantern) { A.lantern.lp.rotation.z = Math.sin(t * 0.045) * 0.14; A.lantern.lp.rotation.x = Math.sin(t * 0.031) * 0.06; A.lantern.lg.material.opacity = 0.5 + Math.random() * 0.08; }
if (A.cat) {
const c = A.cat;
const look = hp ? clamp((pwx - c.x) * 0.35, -0.9, 0.9) : 0;
c.head.rotation.y += (look - c.head.rotation.y) * 0.06;
c.head.rotation.z = Math.sin(t * 0.02) * 0.08;
c.segs.forEach((sg, k) => { sg.rotation.z = Math.sin(t * 0.06 - k * 0.6) * 0.35; sg.rotation.x = -0.35 - k * 0.05; });
if (c.blink > 0) c.blink--; else if (Math.random() < 0.006) c.blink = 8;
for (const e of c.eyes) e.scale.y = c.blink > 0 ? 0.002 : 0.013;
c.grp.scale.y = 1 + Math.sin(t * 0.05) * 0.015;
}
for (const b of A.butterflies) {
const k = t * 0.012 + b.ph;
b.bf.position.set(b.cx + Math.sin(k) * 0.35, b.cy + Math.sin(k * 1.7) * 0.14 + Math.sin(t * 0.25) * 0.015, b.cz + Math.cos(k * 1.3) * 0.08);
b.bf.rotation.z = Math.cos(k) * 0.4;
const f = Math.sin(t * 0.7 + b.ph) * 1.1;
for (const w of b.wl) w.wp.rotation.y = w.sx * f;
}
}
if (this.chimney && !edit && this.homeT % 14 === 0) {
const c = this.chimney;
this.particle(c.x + (Math.random() - 0.5) * 0.06, c.y, c.z, 0.004 + Math.random() * 0.003, 0.009 + Math.random() * 0.004, 0, '#e6e2de', 0.07 + Math.random() * 0.05, 110, 0);
}
{
const p = game.player, pc = (p.x + p.w / 2) / TILE, pr = (p.y + p.h / 2) / TILE;
for (const v of this.vines) {
const near = !edit && Math.abs(v.c + 0.5 - pc) < 1 && Math.abs(v.r + 0.5 - pr) < 1.3;
v.rustle = v.rustle * 0.93 + (near && (p.climb ? Math.abs(p.vy) > 0.1 : Math.abs(p.vx) > 0.5) ? 0.08 : 0);
const amp = 0.07 + Math.min(0.55, v.rustle);
for (const l of v.leaves) l.piv.rotation.z = Math.sin(t * (0.05 + v.rustle * 0.2) + l.ph) * amp * l.side;
if (v.rustle > 0.3 && Math.random() < 0.02) this.particle(v.c + 0.5 + (Math.random() - 0.5) * 0.3, ROWS - v.r - 0.5, 0.2, (Math.random() - 0.5) * 0.01, -0.006, 0, '#6fd65a', 0.03, 60, 0);
}
}
for (const tc of this.torches) {
const k = 1 + Math.sin(t * 0.35 + tc.ph) * 0.12 + Math.random() * 0.06;
tc.f1.scale.y = 0.22 * k; tc.f2.scale.y = 0.12 * k;
tc.gl.material.opacity = 0.42 + Math.sin(t * 0.3 + tc.ph) * 0.08;
}
}

poseEditHero(game) {
const h = this.hero;
let s = null;
for (let r = 0; r < ROWS && !s; r++) for (let c = 0; c < game.cols; c++) if (game.raw[r][c] === 'P') { s = { r, c }; break; }
h.root.visible = !!s;
if (!s) return;
h.root.position.set(s.c + 0.5, ROWS - 1 - s.r, 0.05);
h.root.rotation.set(0, 0.55, 0);
if (this.sprite) {
h.root.visible = false;
if (this.model) this.model.root.visible = false;
const S = this.sprite; S.mesh.visible = true; S.blob.visible = true;
S.mesh.position.set(s.c + 0.5, ROWS - 1 - s.r - (S.footDrop || 0), 0.12); S.mesh.scale.set(1, 1, 1); S.mesh.rotation.set(0, 0, 0);
S.blob.position.set(s.c + 0.5, ROWS - 1 - s.r + 0.02, 0.1); S.blob.scale.set(0.62, 0.26, 1);
}
h.body.scale.set(1, 1, 1);
h.jet.visible = false; h.gun.visible = false;
for (const L of [h.legL, h.legR]) { L.hip.rotation.x = 0; L.knee.rotation.x = 0.1; L.foot.rotation.x = 0; }
h.armL.sh.rotation.set(0.06, 0, 0.14); h.armR.sh.rotation.set(0.06, 0, -0.14); h.armL.el.rotation.x = h.armR.el.rotation.x = -0.3;
h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0);
for (const l of h.lids) l.rotation.x = -1.55;
h.smile.visible = false; h.softSmile.visible = true; h.mouthO.visible = false;
this.a.pose = null;
}

updateHero(game, t) {
const a = this.a, h = this.hero, p = game.player, dead = game.mode === 'dead' || game.mode === 'dying', playing = game.mode === 'playing';
h.root.visible = !(p.inv > 0 && (t >> 2) % 2 === 0);
const px = (p.x + p.w / 2) / TILE, py = ROWS - (p.y + p.h) / TILE;
const jet = game.jetOn && game.fuel > 0, air = !(p.ground || p.climb || jet);
const speed = Math.abs(p.vx), moving = speed > 0.2 && p.ground && !p.climb;
if (p.ground && !a.prevGround && a.prevVy > 2.5 && playing) {
a.squash = 0.34 * Math.min(1, a.prevVy / 9); a.squashV = 0; a.land = 12;
this.dust(px, py, 5);
}
if (p.ground && playing && p.face !== a.prevFace && Math.abs(a.prevVx) > 1.6) { a.skid = 12; this.dust(px, py, 6); }
a.prevFace = p.face; a.prevVx = p.vx; a.prevGround = p.ground; a.prevVy = p.vy;
a.squashV += -a.squash * 0.28; a.squashV *= 0.72; a.squash += a.squashV;
for (const k of ['land', 'skid', 'happy', 'cheer', 'shoot']) if (a[k] > 0) a[k]--;
a.idle = moving || air || p.climb || jet || !playing ? 0 : a.idle + 1;
if (--a.nextBlink <= 0) { a.blink = 8; a.nextBlink = 90 + Math.random() * 160; }
if (a.blink > 0) a.blink--;
if (dead) { if (a.deathAt == null) { a.deathAt = game.frame; a.dx = px; a.dy = py; } } else a.deathAt = null;

a.cx = p.climb && !dead ? a.cx + (Math.floor(px) + 0.5 - a.cx) * 0.3 : px;
let x = a.cx, y = py, spin = 0;
if (dead && a.deathAt != null) { const e = game.frame - a.deathAt; x = a.dx; y = a.dy + (9 * e - 0.32 * e * e) / TILE; spin = e * 0.14; }
a.climbZ += ((p.climb && !dead ? 0.3 : 0.05) - a.climbZ) * 0.2;
h.root.position.set(x, y, a.climbZ);
const yawT = p.climb && !dead ? Math.PI : (a.idle > 40 ? p.face * 0.45 : p.face * 0.85);
a.yaw += (yawT - a.yaw) * 0.2;

const sq = dead ? 0 : clamp(a.squash + (air ? -Math.min(0.14, Math.abs(p.vy) * 0.018) : 0), -0.3, 0.36);
h.body.scale.set(1 + sq * 0.9, 1 - sq, 1 + sq * 0.9);
const w = p.walk * 2.2, sw = Math.sin(w), cw = Math.cos(w);
const P = { lh: 0, lk: 0.1, rh: 0, rk: 0.1, lf: 0, rf: 0, ls: 0.06, le: -0.3, lz: 0.14, rs: 0.06, re: -0.3, rz: -0.14, lean: 0, twist: 0, bob: 0, hx: 0, hy: 0, roll: 0 };
if (dead) Object.assign(P, { ls: -2.8, rs: -2.8, lz: 0.4, rz: -0.4, lh: -0.5, rh: 0.5, lk: 0.6, rk: 0.6 });
else if (p.climb) {
if (Math.abs(p.vy) > 0.1) a.climbPh += Math.abs(p.vy) * 0.11;
const k = Math.sin(a.climbPh);
Object.assign(P, {
ls: -2.75 + k * 0.45, le: -0.45 - Math.max(0, k) * 0.7, lz: 0.22,
rs: -2.75 - k * 0.45, re: -0.45 - Math.max(0, -k) * 0.7, rz: -0.22,
lh: -0.45 - Math.max(0, -k) * 0.6, lk: 0.75 + Math.max(0, -k) * 0.7,
rh: -0.45 - Math.max(0, k) * 0.6, rk: 0.75 + Math.max(0, k) * 0.7,
lean: 0.1, twist: k * 0.08, bob: Math.cos(a.climbPh) * 0.02, hx: -0.28, roll: k * 0.05
});
} else if (jet) Object.assign(P, { lh: 0.25, lk: 0.6, rh: 0.1, rk: 0.4, ls: -0.35, le: -1.7, lz: 0.25, rs: -0.35, re: -1.7, rz: -0.25, lean: 0.12 + speed * 0.05, hx: -0.12 });
else if (air) {
if (p.vy < 0) Object.assign(P, { lh: -1.0, lk: 1.3, rh: 0.35, rk: 0.45, ls: -2.7, le: -0.2, lz: 0.2, rs: 0.5, re: -0.7, rz: -0.35, lean: 0.06, hx: -0.18 });
else { const fl = Math.sin(t * 0.55) * 0.25; Object.assign(P, { lh: -0.45, lk: 0.8, rh: -0.15, rk: 0.35, ls: -0.9 + fl, le: -0.5, lz: 1.15, rs: -0.9 - fl, re: -0.5, rz: -1.15, lean: -0.04, hx: p.vy > 6 ? 0.15 : 0.05 }); }
} else if (a.skid > 0) Object.assign(P, { lh: -0.8, lk: 0.1, rh: 0.4, rk: 0.9, ls: -1.2, le: -0.4, lz: 0.6, rs: -1.2, re: -0.4, rz: -0.6, lean: -0.35, hx: 0.1 });
else if (moving) {
const sp = Math.min(1, speed / 2.6);
Object.assign(P, {
lh: sw * 0.95 * sp, rh: -sw * 0.95 * sp, lk: 0.15 + Math.max(0, -cw) * 1.35 * sp, rk: 0.15 + Math.max(0, cw) * 1.35 * sp,
ls: -sw * 0.95 * sp, rs: sw * 0.95 * sp, le: -1.1, re: -1.1, lz: 0.12, rz: -0.12,
lean: 0.14 * sp, twist: sw * 0.16 * sp, bob: Math.abs(sw) * 0.045 * sp, hx: 0.04
});
if (Math.sign(sw) !== Math.sign(a.prevPh) && speed > 1.6 && playing) this.dust(px - p.face * 0.15, py, 1);
a.prevPh = sw;
} else {
const br = Math.sin(t * 0.055);
Object.assign(P, { bob: br * 0.008, ls: 0.06 + br * 0.03, rs: 0.06 - br * 0.03 });
if (a.idle > 240) P.hy = Math.sin((a.idle - 240) * 0.018) * 0.55;
if (a.idle > 480) P.rf = Math.sin(t * 0.35) > 0 ? -0.45 : 0;
}
if (a.land > 0 && !air && !p.climb && !jet) { const k = a.land / 12; P.lk += 0.9 * k; P.rk += 0.9 * k; P.lh -= 0.45 * k; P.rh -= 0.45 * k; P.lean += 0.15 * k; }
if (a.cheer > 0 && !air && !p.climb) Object.assign(P, { ls: -2.9, rs: -2.9, lz: 0.35, rz: -0.35, le: -0.2, re: -0.2, hx: -0.15 });
if (a.shoot > 0 && !p.climb) Object.assign(P, { rs: -1.45, re: -0.1, rz: -0.05 });
const C = a.pose || (a.pose = Object.assign({}, P));
const kk = moving ? 0.55 : 0.3;
for (const k in P) C[k] += (P[k] - C[k]) * kk;
for (const [L, hh, kn, ff] of [[h.legL, C.lh, C.lk, C.lf], [h.legR, C.rh, C.rk, C.rf]]) {
L.hip.rotation.x = hh; L.knee.rotation.x = kn; L.foot.rotation.x = -(hh + kn) * 0.55 + ff;
}
h.armL.sh.rotation.set(C.ls, 0, C.lz); h.armL.el.rotation.x = C.le;
h.armR.sh.rotation.set(C.rs, 0, C.rz); h.armR.el.rotation.x = C.re;
h.hips.position.y = 0.36 + C.bob;
h.torso.rotation.set(C.lean, C.twist, 0);
h.root.rotation.set(0, a.yaw, spin * p.face + C.roll);
h.head.rotation.set(C.hx - C.lean * 0.5 + (p.climb ? 0 : clamp(p.vy * 0.012, -0.1, 0.12)), C.hy - C.twist * 0.7, 0);

const scared = (air && p.vy > 6.5) || dead;
let lid = -1.55, browY = 0.012, browR = -0.2;
if (a.happy > 0 || a.cheer > 0) { lid = -0.75; browY = 0.022; browR = -0.25; }
if (scared) { browR = 0.38; browY = 0.01; lid = -1.45; }
if (a.shoot > 0) { browR = -0.08; lid = -1.2; }
if (a.blink > 0 && !dead) lid = 1.45 - Math.abs(a.blink - 4) * 0.5;
if (dead) lid = 0.95;
a.lid += (lid - a.lid) * 0.45;
for (const l of h.lids) l.rotation.x = a.lid;
h.brows.forEach((b, i) => { const sg = i === 0 ? 1 : -1; b.position.y = 0.165 + browY; b.rotation.z = -sg * browR; });
const gy = air ? (p.vy < 0 ? 0.012 : -0.012) : 0;
const gx = a.idle > 240 ? Math.sin((a.idle - 240) * 0.018) * 0.02 : 0;
for (const e of h.eyes) e.look.position.set(gx, gy, 0);
const open = air || dead || a.cheer > 0 || jet;
const grinning = !open && (a.happy > 0 || a.cheer > 0);
h.smile.visible = grinning; h.softSmile.visible = !open && !grinning; h.mouthO.visible = open;
const grin = a.happy > 0 || a.cheer > 0 ? 1.15 : 0.92;
h.smile.scale.set(grin, grin, 1);
h.mouthO.scale.setScalar(a.cheer > 0 ? 1.15 : scared ? 1.0 : 0.62);
const tt = clamp(p.vy * 0.07, -0.5, 0.6) + speed * 0.08;
a.tuftV += (tt - a.tuft) * 0.16; a.tuftV *= 0.8; a.tuft += a.tuftV;
h.tuft.rotation.x = a.tuft * 0.35; h.tuft.position.y = 0.3 + a.tuftV * 0.04;
h.gun.visible = (game.hasGun || game.ammo > 0) && !dead;
h.jet.visible = (game.fuel > 0 || jet) && !dead;
h.flames.forEach((f, i) => { f.visible = jet; if (jet) f.scale.y = (i % 2 ? 0.1 : 0.2) * (0.85 + Math.sin(t * 0.9 + i) * 0.15 + Math.random() * 0.15); });
if (jet && t % 3 === 0) this.particle(x - p.face * 0.2, y + 0.15, -0.1, (Math.random() - 0.5) * 0.01, -0.03, 0, '#bfefff', 0.06, 22, 0);
if (this.sprite) {
const S = this.sprite, vis = h.root.visible;
h.root.visible = false;
S.mesh.visible = vis;
const sp = moving ? Math.min(1, Math.abs(p.vx) / 2.6) : 0, ph = p.walk * 2.2, sw = Math.sin(ph), cw = Math.cos(ph), br = Math.sin(t * 0.06);
const idle = a.idle || 0, still = !moving && !air && !p.climb && !jet && !dead;
const waving = still && idle > 360 && idle % 720 < 120;
const hopT = still && idle > 240 ? (idle + 300) % 640 : 999, hop = hopT < 22 ? Math.sin((hopT / 22) * Math.PI) * 0.18 : 0;
const hh = a.happy > 12 && !air ? Math.sin(((28 - a.happy) / 16) * Math.PI) : 0;
const bob = moving ? Math.abs(sw) * 0.1 * sp : br * 0.014 + hop + Math.max(0, hh) * 0.14;
const st = dead ? 0 : sq;
S.mesh.position.set(x, y + bob - 0.02 - (S.footDrop || 0), 0.12);
const turnT = moving ? 0.84 : air && !p.climb ? 0.9 : 1;
S.turn = (S.turn || 1) + (turnT - (S.turn || 1)) * 0.18;
const stretch = air && !jet && !p.climb && !dead ? clamp(-p.vy * 0.014, -0.07, 0.1) : 0;
const stepSq = moving ? Math.abs(Math.cos(ph)) * 0.06 * sp : 0;
S.mesh.scale.set((1 + st * 0.8 - stretch * 0.6 + stepSq * 0.5) * S.turn * (p.face < 0 ? -1 : 1), 1 - st + stretch - stepSq, 1);
S.duck = (S.duck || 1) + (this.duckFactor(game, p) - (S.duck || 1)) * 0.35; S.mesh.scale.y *= S.duck;
let lean = 0;
if (dead) lean = spin;
else if (p.climb) lean = Math.sin(a.climbPh) * 0.05;
else if (a.skid > 0) lean = p.face * 0.22;
else if (air && !jet) lean = clamp(-p.vx * 0.04, -0.14, 0.14) + p.face * clamp(p.vy * -0.012, -0.08, 0.08);
else lean = clamp(-p.vx * 0.055, -0.17, 0.17) + (moving ? Math.sin(ph * 2) * 0.02 * sp : 0);
S.lean = (S.lean || 0) + (lean - (S.lean || 0)) * 0.25;
S.mesh.rotation.set(0, 0, S.lean);
const Q = S.parts;
if (S.bottle) S.bottle.visible = !!this.bupam && !p.climb;
if (S.face) {
const F = S.face;
let ex = 'open';
if (dead) ex = 'ohBlink';
else if (a.happy > 0 || a.cheer > 0) ex = 'happy';
else if ((air && !p.climb) || jet || a.skid > 0) ex = a.blink > 0 ? 'ohBlink' : 'oh';
else if (a.blink > 0) ex = 'blink';
if (ex !== F.cur) { F.cur = ex; F.mesh.material.map = F.tex[ex]; }
}
if (S.mats && this.heroTint && S.tint !== this.heroTint) { S.tint = this.heroTint; for (const mt of S.mats) mt.color.copy(this.heroTint); }
if (Q.legL) {
let lL = 0, lR = 0, aL = 0.06 + br * 0.03, aR = -0.06 - br * 0.03, hd = br * 0.03, ts = 1 + br * 0.012;
let kL = 0, kR = 0, eL = 0.12, eR = -0.12;
if (dead) { lL = 0.6; lR = -0.6; aL = -2.6; aR = 2.6; kL = -0.6; kR = -0.6; }
else if (p.climb) { const c2 = Math.sin(a.climbPh); aL = -2.6 + c2 * 0.4; aR = 2.6 + c2 * 0.4; lL = 0.3 * c2; lR = -0.3 * c2; kL = -0.4 - Math.max(0, c2) * 0.6; kR = -0.4 - Math.max(0, -c2) * 0.6; eL = -0.6; eR = 0.6; hd = 0; }
else if (jet) { const dg = Math.sin(t * 0.09); lL = 0.15 + dg * 0.2; lR = 0.3 - dg * 0.2; kL = -0.5; kR = -0.3; aL = -0.7; aR = 0.9; eL = 0.6; eR = 0.8; hd = -0.06; }
else if (air) {
if (p.vy < 0) { lL = 0.35; lR = -0.25; kL = -1.15; kR = -0.6; aL = -2.3; aR = 2.3; eL = -0.3; eR = 0.3; hd = -0.08; }
else { const fl = Math.sin(t * 0.45) * 0.25; lL = 0.1; lR = -0.05; kL = -0.25; kR = -0.15; aL = -1.35 + fl; aR = 1.35 - fl; eL = 0.3; eR = -0.3; hd = 0.04; }
} else if (a.skid > 0) { lL = 0.65; lR = -0.25; kL = 0; kR = -0.5; aL = -0.9; aR = 1.4; eL = 0.4; eR = 0.5; hd = 0.08; }
else if (moving) {
lL = sw * 0.72 * sp; lR = -sw * 0.72 * sp;
kL = -Math.max(0, -cw) * 1.25 * sp; kR = -Math.max(0, cw) * 1.25 * sp;
aL = -sw * 0.85 * sp; aR = -sw * 0.85 * sp * -1; eL = 0.9 * sp; eR = 0.9 * sp;
hd = -0.05 + Math.abs(sw) * 0.06; ts = 1 - Math.abs(sw) * 0.02;
} else {
if (idle > 200) hd = Math.sin(idle * 0.018) * 0.1 + Math.sin(idle * 0.007) * 0.05;
if (waving) { const wv = Math.sin(t * 0.42); aR = 2.55 + wv * 0.3; eR = 0.5 + wv * 0.45; hd = -0.06; }
if (still && idle > 520 && !waving) kR = Math.sin(t * 0.3) > 0.2 ? -0.35 : 0;
if (hop > 0.02) { aL = -0.9; aR = 0.9; kL = kR = -0.4; }
}
if (a.land > 0 && !air) { const q = a.land / 12; kL -= 0.7 * q; kR -= 0.7 * q; lL += 0.35 * q; lR += 0.35 * q; aL -= 0.5 * q; aR += 0.5 * q; ts *= 1 - 0.06 * q; }
if (hh > 0 && !moving) { aR = 2.6; eR = 0.2; }
if (a.cheer > 0 && !air) { const c3 = Math.sin(t * 0.5) * 0.25; aL = -2.7 + c3; aR = 2.7 - c3; eL = -0.2; eR = 0.2; }
if (a.shoot > 0 && !p.climb) { aR = 1.55; eR = 0.05; }
hd -= S.lean * 0.4;
const lerp = (o, v, k2) => { o.rotation.z += (v - o.rotation.z) * k2; };
const kk = moving || air ? 0.55 : 0.3;
lerp(Q.legL, lL, kk); lerp(Q.legR, lR, kk); lerp(Q.armL, aL, kk); lerp(Q.armR, aR, kk); lerp(Q.head, hd, 0.22);
if (Q.legLLo) { lerp(Q.legLLo, kL, kk); lerp(Q.legRLo, kR, kk); lerp(Q.armLLo, eL, kk * 0.85); lerp(Q.armRLo, eR, kk * 0.85); }
if (Q.torso) Q.torso.scale.y += (ts - Q.torso.scale.y) * 0.4;
}
S.blob.visible = vis && !dead;
S.blob.position.set(x, y + 0.02, 0.1);
const bs = p.ground || p.climb ? 1 : 0.6;
S.blob.scale.set(0.62 * bs, 0.26 * bs, 1);
S.blob.material.opacity = p.ground ? 0.28 : 0.12;
if (jet && t % 2 === 0) this.particle(x - p.face * 0.12, y + 0.55, 0.0, (Math.random() - 0.5) * 0.01, -0.035, 0, '#9fe6ff', 0.07, 20, 0);
}
const MD = this.model;
if (MD) {
const vis = this.sprite ? this.sprite.mesh.visible : h.root.visible;
if (!this.useModel) { MD.root.visible = false; if (this.requestSprite) this.requestSprite(); }
else {
if (this.sprite) this.sprite.mesh.visible = false;
h.root.visible = false; MD.root.visible = vis;
const sp = moving ? Math.min(1, Math.abs(p.vx) / 2.6) : 0, ph = p.walk * 2.2;
const bob = moving ? Math.abs(Math.sin(ph)) * 0.09 * sp : Math.sin(t * 0.06) * 0.012;
MD.root.position.set(x, y + bob - 0.02, 0.15);
const yawT = dead ? MD.yaw : p.climb ? Math.PI : a.idle > 40 ? Math.sin(a.idle * 0.012) * 0.4 : p.face * 0.75;
MD.yaw += (yawT - MD.yaw) * 0.18;
MD.turn.rotation.set(game.sip > 0 ? -0.12 : game.tired && !air && !p.climb ? 0.09 : 0, game.sip > 0 ? MD.yaw * 0.4 : MD.yaw, 0);
const st = dead ? 0 : sq, lean = this.sprite && this.sprite.lean != null ? this.sprite.lean : 0;
MD.root.scale.set(MD.s * (1 + st * 0.8), MD.s * (1 - st), MD.s * (1 + st * 0.8));
MD.duck = (MD.duck || 1) + (this.duckFactor(game, p) - (MD.duck || 1)) * 0.35;
MD.root.scale.y *= MD.duck; MD.root.scale.x *= 1 + (1 - MD.duck) * 0.25;
MD.root.rotation.set(0, 0, dead ? spin : lean + (moving ? Math.sin(ph) * 0.05 * sp : 0));
let lL = 0, lR = 0, aL = Math.sin(t * 0.06) * 0.03, aR = -aL;
if (dead) { lL = lR = -0.3; aL = -2.2; aR = -2.2; }
else if (p.climb) { const c2 = Math.sin(a.climbPh); aL = -2.2 - c2 * 0.6; aR = -2.2 + c2 * 0.6; lL = -0.3 - Math.max(0, -c2) * 0.55; lR = -0.3 - Math.max(0, c2) * 0.55; }
else if (jet) { lL = lR = -0.2; aL = -0.5; aR = -0.5; }
else if (air) { if (p.vy < 0) { lL = lR = 0.08; aL = aR = -1.9; } else { const fl = Math.sin(t * 0.35) * 0.2; lL = lR = -0.06; aL = -0.85 + fl; aR = -0.85 - fl; } }
else if (moving) { const sw = Math.sin(ph); lL = sw * 0.5 * sp; lR = -lL; aL = -sw * 0.7 * sp; aR = -aL; }
else if (a.cheer > 0 || a.happy > 12) { aL = -2.5; aR = -2.5; }
if (a.land > 0 && !air) { const q = a.land / 12; lL -= 0.25 * q; lR -= 0.25 * q; }
if (this.bupam && !moving && !air && !p.climb && !dead && a.idle > 200 && a.idle % 420 < 120) aR = -2.05;
if (game.tired && !air && !p.climb && !dead) { aL *= 0.4; aR *= 0.4; lL *= 0.85; lR *= 0.85; }
if (game.sip > 0) { aR = -2.4; aL = 0.12; lL = lR = 0; }
const k2 = moving ? 0.5 : p.climb ? 0.35 : air ? 0.3 : 0.22;
MD.U.uLegL.value += (lL - MD.U.uLegL.value) * k2; MD.U.uLegR.value += (lR - MD.U.uLegR.value) * k2;
MD.U.uArmL.value += (aL - MD.U.uArmL.value) * k2; MD.U.uArmR.value += (aR - MD.U.uArmR.value) * k2;
MD.bottle.visible = !!this.bupam && !p.climb; MD.bottle.rotation.x = MD.U.uArmR.value;
if (game.tired && !game.sip && t % 34 === 0) this.particle(x + 0.2 * p.face, y + 1.2, 0.35, 0.003 * p.face, -0.012, 0, '#9fdcff', 0.05, 34, 0);
if (game.sip > 0 && t % 5 === 0) this.particle(x + 0.12 * p.face, y + 1.08, 0.35, (Math.random() - 0.5) * 0.006, 0.013, 0, '#ffffff', 0.035, 26, 0);
if (game.sip === 1) this.burst({ x, y: y + 1.1, z: 0.3 }, '#fff4e2', 14);
if (p.climb && !dead) MD.root.position.y += Math.abs(Math.cos(a.climbPh)) * 0.025;
}
}
}

updateMobs(game, t, edit) {
const seen = new Set();
for (const mo of game.monsters) {
let e = this.mobs.get(mo);
if (!e) { e = this.makeMob(mo.kind || (mo.vert ? 'vertical' : 'walker')); this.scene.add(e.root); this.mobs.set(mo, e); }
seen.add(mo);
e.root.visible = !edit;
if (edit) continue;
const cx = (mo.x + mo.w / 2) / TILE, cy = ROWS - (mo.y + mo.h / 2) / TILE;
if (e.kind === 'walker') {
const hop = Math.abs(Math.sin(mo.t * 3.2)) * 0.12, contact = 1 - Math.min(1, hop / 0.05);
e.root.position.set(cx, ROWS - (mo.y + mo.h) / TILE + hop, 0);
e.body.scale.set(1 + contact * 0.12, 1 - contact * 0.12, 1 + contact * 0.12);
e.root.rotation.y = mo.dir > 0 ? 0.6 : -0.6;
} else if (e.kind === 'hopper') {
e.root.position.set(cx, ROWS - (mo.y + mo.h) / TILE, 0);
const st = clamp(-mo.vy * 0.04, -0.2, 0.25);
e.body.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
e.root.rotation.y = mo.dir > 0 ? 0.6 : -0.6;
} else if (e.kind === 'vertical') {
e.root.position.set(cx, cy, 0);
e.root.rotation.y = Math.sin(t * 0.03) * 0.4;
e.flame.visible = mo.dir < 0;
e.flame.scale.y = 0.22 + Math.random() * 0.08;
} else {
e.root.position.set(cx, cy, 0);
e.body.rotation.y = t * 0.05;
e.body.rotation.z = -mo.dir * 0.12;
const charging = mo.charge > 0;
e.lamps.forEach((l, i) => { l.visible = charging || ((t >> 3) + i) % 3 !== 0; });
e.body.scale.setScalar(charging ? 1 + Math.sin(t * 0.9) * 0.1 : 1);
if (e.kind === 'boss') e.root.visible = !(mo.hurt > 0 && (t >> 2) % 2 === 0);
}
}
for (const [mo, e] of this.mobs) {
if (seen.has(mo)) continue;
this.scene.remove(e.root);
this.mobs.delete(mo);
if (game.monsters === this.a.mArr) this.burst(e.root.position, e.kind === 'boss' ? '#ffd23f' : e.kind === 'flyer' ? '#9ff0ff' : e.kind === 'hopper' ? '#b5f59a' : '#c9a0ff', e.kind === 'boss' ? 70 : 22);
}
this.a.mArr = game.monsters;
}

pooled(pool, list, geo, mat, scale) {
while (pool.length < list.length) {
const o = new this.T.Mesh(geo, mat);
o.scale.set(scale[0], scale[1], scale[2]);
o.add(this.glow(mat.color.getStyle(), 0.6 / scale[0] * 0.08, 0.7));
this.scene.add(o);
pool.push(o);
}
pool.forEach((o, i) => { o.visible = i < list.length; });
}

updateProjectiles(game) {
const bullets = game.bullets || [], shots = game.enemyShots || [];
this.pooled(this.boltPool, bullets, this.g.sphere, this.m.bolt, [0.16, 0.05, 0.05]);
bullets.forEach((b, i) => { const o = this.boltPool[i]; o.position.set((b.x + 4) / TILE, ROWS - (b.y + 3) / TILE, 0.12); o.rotation.z = Math.atan2(-(b.vy || 0), b.vx != null ? b.vx : b.dir); });
this.pooled(this.shotPool, shots, this.g.sphere, this.m.shot, [0.08, 0.08, 0.08]);
shots.forEach((s, i) => { const o = this.shotPool[i]; o.position.set(s.x / TILE, ROWS - s.y / TILE, 0.1); o.scale.setScalar(0.07 + Math.sin(game.frame * 0.5) * 0.015); });
}

updateParticles() {
for (const p of this.parts) {
const u = p.userData;
u.life++;
p.position.x += u.vx; p.position.y += u.vy; p.position.z += u.vz;
u.vy += u.grav;
u.vx *= 0.96; u.vy *= 0.96;
const k = u.life / u.max;
p.material.opacity = 1 - k;
p.scale.setScalar(u.size * (1 + k * 0.6));
p.rotation.x += 0.1; p.rotation.y += 0.13;
}
const alive = [];
for (const p of this.parts) {
if (p.userData.life < p.userData.max) alive.push(p);
else { p.visible = false; this.partPool.push(p); }
}
this.parts = alive;
}

updateCamera(game, edit) {
const camX = (game.cam || 0) / TILE;
if (edit) {
const o = this.ortho;
o.left = camX; o.right = camX + VIEW_COLS; o.top = ROWS; o.bottom = 0;
o.updateProjectionMatrix();
this.aimLight(camX + VIEW_COLS / 2);
return o;
}
const sh = game.shake > 0 ? (Math.random() - 0.5) * 0.14 : 0, c = this.persp, p = game.player;
const boss = game.monsters && game.monsters.some((m) => m.kind === 'boss');
const D = boss ? 17 : (game.jetOn ? 14.5 : 13), halfH = D * Math.tan((15 * Math.PI) / 180), halfW = halfH * 2;
const cols = game.cols || 40;
const px = (p.x + p.w / 2) / TILE, py = ROWS - (p.y + p.h / 2) / TILE;
const fc = this.fcam || (this.fcam = { x: px, y: py + 0.8, d: D, look: 0 });
fc.look += (p.face * 1.6 - fc.look) * 0.04;
const tx = Math.max(halfW - 0.1, Math.min(cols - halfW + 0.1, px + fc.look));
const ty = Math.max(halfH - 0.15, Math.min(ROWS - halfH + 0.15, py + 0.8));
if (game.mode !== 'playing' && game.mode !== 'dying' && game.mode !== 'paused') { fc.x += (tx - fc.x) * 0.2; fc.y += (ty - fc.y) * 0.2; }
else { fc.x += (tx - fc.x) * 0.09; fc.y += (ty - fc.y) * 0.06; }
fc.d += (D - fc.d) * 0.05;
c.position.set(fc.x + sh, fc.y + 0.9 + sh, fc.d);
c.lookAt(fc.x, fc.y, 0);
this.aimLight(fc.x);
if (this.heroLight) this.heroLight.position.set(px + p.face * 0.25, py + 0.75, 2.4);
return c;
}

aimLight(cx) {
const x = Math.round(cx * 2) / 2;
this.key.position.set(x + 5, 13, 11);
this.key.target.position.set(x, 3, 0);
this.key.target.updateMatrixWorld();
}


toScreen(x, y, z, cam) {
const v = this.v.set(x, y, z).project(cam);
return [((v.x + 1) / 2) * this.OW, ((1 - v.y) / 2) * this.OH];
}

drawOverlay(game, cam, edit) {
const o = this.o;
o.clearRect(0, 0, this.OW, this.OH);
if (edit) {
const camX = (game.cam || 0) / TILE, step = this.OW / VIEW_COLS;
o.strokeStyle = 'rgba(255,255,255,0.35)'; o.lineWidth = 1;
o.beginPath();
for (let c = Math.ceil(camX); c <= camX + VIEW_COLS; c++) { const x = (c - camX) * step; o.moveTo(x + 0.5, 0); o.lineTo(x + 0.5, this.OH); }
for (let r = 0; r <= ROWS; r++) { const y = r * (this.OH / ROWS); o.moveTo(0, y + 0.5); o.lineTo(this.OW, y + 0.5); }
o.stroke();
return;
}
if (!this.vig) {
const vg = o.createRadialGradient(this.OW / 2, this.OH / 2, this.OH * 0.3, this.OW / 2, this.OH / 2, this.OW * 0.62);
vg.addColorStop(0, 'rgba(10,6,20,0)'); vg.addColorStop(1, 'rgba(10,6,20,0.3)');
this.vig = vg;
}
o.fillStyle = this.vig; o.fillRect(0, 0, this.OW, this.OH);
o.textAlign = 'center'; o.lineJoin = 'round';
for (const q of game.pops) {
const [sx, sy] = this.toScreen(q.x / TILE, ROWS - q.y / TILE, 0.6, cam);
const sc = q.life > 47 ? 1 + (q.life - 47) * 0.07 : 1;
o.save(); o.translate(sx, sy); o.scale(sc, sc);
o.globalAlpha = Math.min(1, q.life / 20);
o.font = '700 16px "Barlow Condensed", system-ui, sans-serif';
o.strokeStyle = '#1a1030'; o.lineWidth = 4; o.strokeText(q.text, 0, 0);
o.fillStyle = q.tone === 'hit' ? '#ff7a8a' : (q.tone === 'prize' ? '#ffd23f' : '#8ff6ff');
o.fillText(q.text, 0, 0);
o.restore();
}
o.textAlign = 'left';
if (game.banner && game.banner.life > 0 && (game.mode === 'playing' || game.mode === 'dying')) this.drawBanner(game.banner);
const boss = game.monsters.find((mm) => mm.kind === 'boss');
if (boss) {
const w = 220, x = this.OW / 2 - w / 2, y = this.OH - 24, seg = w / boss.maxHp;
o.fillStyle = 'rgba(18,13,34,0.82)';
o.fillRect(x - 8, y - 17, w + 16, 32);
o.font = '700 11px "Barlow Condensed", system-ui, sans-serif';
o.fillStyle = '#ffb3bd';
o.textAlign = 'left';
o.fillText('BOSS SAUCER', x, y - 5);
for (let i = 0; i < boss.maxHp; i++) {
o.fillStyle = i < boss.hp ? '#ff5a6e' : 'rgba(255,255,255,0.15)';
o.fillRect(x + i * seg + 1, y, seg - 2, 7);
}
}
}

drawBanner(b) {
const o = this.o;
o.save();
o.font = '700 17px "Barlow Condensed", system-ui, sans-serif';
o.letterSpacing = '2px';
const w = o.measureText(b.text).width + 64, x = this.OW / 2 - w / 2, y = 56, h = 30;
o.globalAlpha = Math.min(1, b.life / 25);
o.fillStyle = 'rgba(18,13,34,0.82)';
o.beginPath(); o.rect(x, y, w, h); o.fill();
this.cup(x + 18, y + 7); this.cup(x + w - 30, y + 7);
o.fillStyle = '#ffd23f'; o.textAlign = 'center';
o.fillText(b.text, this.OW / 2 + 1, y + 22);
o.restore();
}

cup(x, y) {
const o = this.o;
o.fillStyle = '#ffd23f';
o.beginPath(); o.moveTo(x, y); o.lineTo(x + 12, y); o.lineTo(x + 9, y + 8); o.lineTo(x + 3, y + 8); o.closePath(); o.fill();
o.fillRect(x + 5, y + 8, 2, 4); o.fillRect(x + 2, y + 12, 8, 2);
}
}



return { Ritam3DRenderer };
})();
const __gen = (() => {
const { DaveEngine, TILE } = __eng;


const ROWS = 10, SEG = 12;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function blank(W) { const m = []; for (let r = 0; r < ROWS; r++) { const row = []; for (let c = 0; c < W; c++) row.push(r === 0 || r === ROWS - 1 || c === 0 || c === W - 1 ? '#' : '.'); m.push(row); } return m; }
function H(m) { const W = m[0].length; const put = (r, c, ch) => { if (r > 0 && r < ROWS && c > 0 && c < W - 1) m[r][c] = ch; }; return { put, plat: (r, c, w) => { for (let i = 0; i < w; i++) put(r, c + i, '#'); } }; }

const TEMPLATES = {
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

function compose(seed, world, opts = {}) {
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

function playtest(rows0) {
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
function playthrough(rows, opts) {
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
function generateLevel(seed, opts = {}) {
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



return { TEMPLATES, compose, playtest, playthrough, generateLevel };
})();
const __mus = (() => {

function createMusic() {
let ctx = null, master = null, noise = null, timer = null, step = 0, nextT = 0, world = 0, target = 0.5, muted = false, prev = 0;
const SONGS = [
{ bpm: 116, root: 60, prog: [0, 7, 9, 5], minor: false, scale: [0, 2, 4, 7, 9] },
{ bpm: 100, root: 57, prog: [0, 5, 3, 7], minor: true, scale: [0, 3, 5, 7, 10] },
{ bpm: 92, root: 55, prog: [0, 8, 3, 7], minor: true, scale: [0, 2, 3, 7, 8] },
{ bpm: 132, root: 62, prog: [0, 5, 9, 7], minor: false, scale: [0, 2, 4, 7, 9] }
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const tone = (type, freq, t, dur, vol, slide) => {
const o = ctx.createOscillator(), g = ctx.createGain();
o.type = type; o.frequency.setValueAtTime(freq, t);
if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
};
const hat = (t, vol) => {
const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06);
};
const tick = () => {
if (!ctx) return;
const level = muted ? 0 : target;
master.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.25);
if (level === 0) { nextT = ctx.currentTime + 0.05; return; }
const S = SONGS[world] || SONGS[0], dt = 60 / S.bpm / 4;
while (nextT < ctx.currentTime + 0.15) {
const bar = Math.floor(step / 16) % 4, st = step % 16, ch = S.root + S.prog[bar], t = nextT;
if (st === 0 || st === 8) tone('sine', 120, t, 0.18, 0.5, 45);
if (st === 4 || st === 12) hat(t, 0.06);
if (st % 2 === 0 && st !== 4 && st !== 12) hat(t, 0.025);
if (st === 0 || st === 6 || st === 8 || st === 14) tone('triangle', hz(ch - 24 + (st === 6 ? 7 : 0)), t, dt * 1.8, 0.32);
if (st % 2 === 0 && rnd() < (st % 4 === 0 ? 0.9 : 0.55)) {
const deg = S.scale[(prev = Math.max(0, Math.min(S.scale.length * 2 - 1, prev + Math.floor(rnd() * 5) - 2))) % S.scale.length];
tone('square', hz(ch + 12 + deg + (prev >= S.scale.length ? 12 : 0)), t, dt * 1.4, 0.07);
}
if (st === 0) for (const k of [0, S.minor ? 3 : 4, 7]) tone('sine', hz(ch + k), t, dt * 14, 0.035);
step++; nextT += dt;
if (step % 64 === 0) seed = 7 + world * 131;
}
};
return {
unlock() {
if (ctx) { ctx.resume && ctx.resume(); return; }
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
ctx = new AC(); master = ctx.createGain(); master.gain.value = 0;
const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
nextT = ctx.currentTime + 0.1;
timer = setInterval(tick, 30);
},
update(mode, w, m) {
muted = !!m;
if (w != null && w !== world) { world = Math.max(0, Math.min(3, w)); seed = 7 + world * 131; }
target = mode === 'playing' || mode === 'dying' ? 1 : mode === 'paused' ? 0.3 : mode === 'edit' ? 0 : 0.5;
},
stop() { if (timer) clearInterval(timer); timer = null; if (ctx) ctx.close(); ctx = null; }
};
}



return { createMusic };
})();
export const eng = __eng, inp = __inp, lv = __lv, r3 = __r3, gen = __gen, mus = __mus;
