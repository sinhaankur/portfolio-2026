// Dave / Ritam — game engine. Pure logic, no DOM and no rendering.
// Drive it with setInput() + step(); read engine.* for everything a renderer needs.
//
//   const game = new DaveEngine({ levels: LEVELS, titles: TITLES });
//   game.on.sound = (name) => sfx(name);
//   game.start();
//   function frame() { game.step(); render(game); requestAnimationFrame(frame); }

export const TILE = 32;
export const ROWS = 10;
export const VIEW_COLS = 20;

export const SCORE = { door: 500, monster: 300, trophy: 1000, lifeBonus: 250 };

/** Collectibles: char → { name, score }. */
export const PICKUPS = {
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

export class DaveEngine {
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
    // Energy: running, jumping and climbing tire Ritam out; tired = a little slower (never below
    // the speed the playtest bots verified). A milk break from Bupam refills him.
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
      // Vines: Up + Left/Right (fresh press) jumps off sideways; reaching the top with Up held
      // pops Ritam up and over the edge; when not steering he slides to the vine's centre.
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

    // Hazards use a smaller, forgiving hitbox: only feet and body core count.
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

export default DaveEngine;
