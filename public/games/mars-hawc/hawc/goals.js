// Mission goals beyond defend/destroy/hijack, plus support call-ins, pickups, jetpack, views and HAWC death sequences.
import { THREE, clamp, damp } from './lib.js?v=22';
import { rover } from './base.js?v=22';
import { AGENCIES } from './levels.js?v=22';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V();
const MK = { acCd: [0.11, 0.095, 0.08], acDmg: [14, 18, 25], salvo: [4, 6, 8], ammo: [24, 30, 40], mslDmg: [45, 50, 62], lock: [0.7, 0.5, 0.4], rifle: [3, 5, 9], rifleCd: [0.12, 0.1, 0.15], jet: [60, 100, 170], armor: [1, 1.25, 1.5] };
export { MK };
const CELL_S = 140, PTS = { talon: 400, stalker: 600, vulture: 200, boulder: 300 };
const NV_FILTER = 'grayscale(1) sepia(0.85) hue-rotate(62deg) saturate(1.5) contrast(1.28) brightness(0.92)', NV_FOG = new THREE.Color(0x2a2e2c);
export { CELL_S };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const NEW_GOALS = ['lander', 'capture', 'raid', 'escort', 'intercept'];

export function installGoals(Mission) {
  const P_ = Mission.prototype;

  P_.setupGoals = async function () {
    const L = this.L, H = this.H, mk = L.mk || {};
    this.mk = { ac: mk.ac || 1, msl: mk.msl || 1, armor: mk.armor || 1, rifle: mk.rifle || 1, jet: mk.jet || 1 };
    this.support = { strike: L.support?.strike ?? 1, drop: L.support?.drop ?? 1 }; this.used = { strike: 0, drop: 0 };
    this.goal = L.goal || L.type; this.crates = []; this.wrecks = []; this.debris = []; this.capT = 0;
    const P = this.player, m = P.mech, k = this.mk;
    m.maxHp = m.hp = Math.round(m.maxHp * MK.armor[k.armor - 1]);
    P.ammo = MK.ammo[k.msl - 1]; P.jpCap = MK.jet[k.jet - 1]; P.jp = P.jpCap;
    const lo = this.opts.loadout || {};
    P.cells = Math.max(0, (lo.cells ?? 4) - 1); P.cell = 1; P.noPower = false; P.rounds = lo.rounds ?? 800; P.ammo = clamp(lo.missiles ?? P.ammo, 0, P.ammo);
    this.score = 0; this.nv = false; this.nvAmb = new THREE.AmbientLight(0xdcffe4, 0); this.scene.add(this.nvAmb);
    this.agName = AGENCIES[L.side]?.name || 'Union'; this.enemyName = AGENCIES[L.enemy]?.name || 'Darken';
    if (this.goal === 'lander' && this.lander) {
      this.lander.t = -65;
      this.landerS = { kind: 'lander', obj: this.lander.obj, hp: 2600, maxHp: 2600, r: 9, h: 9, alive: true, faction: 'union', name: 'Ore lander', pos: this.lander.obj.position };
      this.structs.push(this.landerS);
    }
    if (this.goal === 'raid' && this.world.base.mine) {
      const mn = this.world.base.mine;
      this.mineS = { kind: 'mine', obj: mn.obj, hp: 2400, maxHp: 2400, r: 9, h: 16, alive: true, faction: 'darken', name: 'Drill rig', pos: new THREE.Vector3(mn.x, H(mn.x, mn.z), mn.z) };
      this.structs.push(this.mineS);
    }
    if (this.goal === 'assault') this.setupAssault();
    if (this.goal === 'capture' || this.goal === 'raid' || this.goal === 'assault') if (this.relay) { this.relay.faction = 'neutral'; this.relay.name = 'Uplink'; }
    if (L.convoy) {
      const path = L.convoy.path; this.convoy = [];
      const dx = path[1][0] - path[0][0], dz = path[1][1] - path[0][1], dl = Math.hypot(dx, dz);
      for (let i = 0; i < L.convoy.n; i++) {
        const rv = rover(); this.scene.add(rv.g);
        const x = path[0][0] - dx / dl * i * 16, z = path[0][1] - dz / dl * i * 16;
        const s = { kind: 'rover', obj: rv.g, rv, hp: 700, maxHp: 700, r: 3.6, h: 3.6, alive: true, faction: L.convoy.faction, name: L.convoy.faction === 'union' ? `Rover ${i + 1}` : `${this.enemyName} rover`, pos: rv.g.position, seg: 0, x, z, yaw: Math.atan2(dx, dz), done: false, n: i };
        rv.g.position.set(x, H(x, z), z); this.structs.push(s); this.convoy.push(s);
      }
      this.convoyGo = L.convoy.faction === 'union' ? 10 : 4; this.ambushI = 0;
    }
    if (L.brief) this.later(1.4, () => this.e.say(L.brief, { who: 'command', interrupt: true }));
  };

  // Who the AI walks on when the player is out of reach
  P_.guardTarget = function (u) {
    const G = this.goal;
    if (G === 'lander') return this.landerS?.alive ? this.landerS : null;
    if (G === 'escort') { let b = null, bd = 1e9; for (const s of this.convoy) if (s.alive && !s.done) { const d = Math.hypot(s.pos.x - u.pos.x, s.pos.z - u.pos.z); if (d < bd) { bd = d; b = s; } } return b; }
    if (G === 'capture' || G === 'raid' || G === 'intercept' || G === 'assault') return null;
    return this.relay?.alive && this.relay.faction === 'union' ? this.relay : null;
  };

  P_.runWaves = function (dt) {
    const L = this.L;
    if (!L.waves) return;
    if (this.waveActive && this.hostiles().length === 0) { this.waveActive = false; this.waveT = 10; this.player.ammo = Math.min(MK.ammo[this.mk.msl - 1], this.player.ammo + 12); this.player.rounds = Math.min(1600, (this.player.rounds || 0) + 150); }
    if (!this.waveActive && this.wave < L.waves.length) {
      this.waveT -= dt;
      if (this.waveT <= 0) { this.spawnGroup(L.waves[this.wave], L.layout.spawnArc); this.wave++; this.waveActive = true; this.e.sfx.alarm(); this.msg(`Contact. Wave ${this.wave} of ${L.waves.length}.`, 5, true); }
    }
  };
  P_.runReinforce = function (dt) {
    const L = this.L;
    if (!L.reinforce || this.reinfN >= L.reinforce.max) return;
    this.reinfT -= dt;
    if (this.reinfT <= 0) { this.reinfT = L.reinforce.every; this.reinfN++; this.spawnGroup(L.reinforce.group, [0, 360]); this.msg(`${this.enemyName} reinforcements inbound`, 5, true); this.e.sfx.alarm(); }
  };

  P_.updateGoal = function (dt) {
    const L = this.L, G = this.goal, f = this.focus();
    if (G === 'lander') {
      if (!this.landerS.alive) return this.end(false, 'Lander lost', 'The ore lander was destroyed on the pad.');
      this.runWaves(dt);
      if (this.lander.t >= 76 && this.lander.t < 100) return this.end(true, 'Lander away', `The lander cleared the pad and is climbing to the Ares Ring.`);
      if (this.lander.t >= 50 && !this.saidT) { this.saidT = true; this.msg('Ten seconds. Clear the pad.', 4, true); }
    } else if (G === 'capture') {
      const c = this.relay.pos, d = Math.hypot(f.x - c.x, f.z - c.z);
      const near = this.hostiles().filter((u) => Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 150).length;
      this.capNear = near;
      if (d < 45 && !near) { this.capT += dt; if (!this.capSaid) { this.capSaid = true; this.msg('Uplink handshake started. Hold position.', 5, true); } }
      else if (d < 45 && near && this.time > (this.capWarn || 0)) { this.capWarn = this.time + 9; this.msg(`${near} defender${near > 1 ? 's' : ''} still near the uplink.`, 4, true); }
      else if (d >= 45 && this.capT > 0) this.capT = Math.max(0, this.capT - dt * 0.5);
      if (this.capT >= 30) return this.end(true, 'Station taken', `${L.site} now answers to ${this.agName}.`);
      this.runReinforce(dt);
    } else if (G === 'assault') { return this.updateAssault(dt);
    } else if (G === 'raid') {
      if (!this.mineS.alive) { this.mineS.obj.userData.dead = true; return this.end(true, 'Mine down', `The ${L.site} drill rig is wrecked. Their ore stops for three sols.`); }
      this.runReinforce(dt);
    } else if (G === 'escort' || G === 'intercept') {
      this.updateConvoy(dt);
      const alive = this.convoy.filter((s) => s.alive), home = this.convoy.filter((s) => s.alive && s.done).length;
      if (G === 'escort') {
        if (!alive.length) return this.end(false, 'Convoy lost', 'All three ore rovers were destroyed.');
        if (alive.every((s) => s.done)) return this.end(true, 'Ore delivered', `${home} of ${this.convoy.length} rovers reached the lander pad.`);
        const lead = alive.reduce((a, s) => (s.seg > a.seg ? s : a), alive[0]), ab = L.ambush || [];
        if (this.ambushI < ab.length && lead.seg >= this.ambushI + 1) {
          const nx = L.convoy.path[Math.min(lead.seg + 1, L.convoy.path.length - 1)];
          for (const [t, role, n] of ab[this.ambushI]) for (let i = 0; i < n; i++) { const a = this.R() * 6.28, r = 120 + this.R() * 80; const u = this.spawn(t, nx[0] + Math.cos(a) * r, nx[1] + Math.sin(a) * r, { role, home: nx }); u.aggro = 0; }
          this.ambushI++; this.e.sfx.alarm(); this.msg('Ambush on the road ahead.', 4, true);
        }
      } else {
        if (home) return this.end(false, 'Shipment got through', `A ${this.enemyName} rover reached its lander.`);
        if (!alive.length) return this.end(true, 'Shipment stopped', `All three ${this.enemyName} rovers destroyed.`);
      }
    }
  };

  P_.updateConvoy = function (dt) {
    const path = this.L.convoy.path, H = this.H;
    if (this.convoyGo > 0) { this.convoyGo -= dt; if (this.convoyGo <= 0) this.msg(this.L.convoy.faction === 'union' ? 'Convoy rolling.' : 'Their convoy is moving.', 3, true); return; }
    for (const s of this.convoy) {
      if (!s.alive || s.done) continue;
      const nxt = path[s.seg + 1], dx = nxt[0] - s.x, dz = nxt[1] - s.z, d = Math.hypot(dx, dz);
      let dy = Math.atan2(dx, dz) - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += dy * Math.min(1, dt * 2);
      let sp = 5.2; for (const o of this.convoy) if (o !== s && o.alive && !o.done && o.n < s.n && Math.hypot(o.pos.x - s.x, o.pos.z - s.z) < 13) sp = 1.5;
      const st = Math.min(d, sp * dt); s.x += Math.sin(s.yaw) * st; s.z += Math.cos(s.yaw) * st;
      for (const w of s.rv.wheels) w.rotation.x += st / 0.58;
      if (d < 3) { s.seg++; if (s.seg >= path.length - 1) { s.done = true; this.msg(`${s.name} at the pad.`, 3, s.faction === 'union'); } }
      const y = H(s.x, s.z), yf = H(s.x + Math.sin(s.yaw) * 2.5, s.z + Math.cos(s.yaw) * 2.5), yb = H(s.x - Math.sin(s.yaw) * 2.5, s.z - Math.cos(s.yaw) * 2.5);
      s.obj.position.set(s.x, y, s.z); s.obj.rotation.set(0, s.yaw, 0); s.obj.rotateX(-Math.atan2(yf - yb, 5));
    }
  };

  P_.goalView = function () {
    const G = this.goal, n = this.hostiles().length;
    if (G === 'lander') { const t = this.lander.t < 0 ? 60 - this.lander.t : Math.max(0, 60 - this.lander.t); return { title: 'Protect the lander', line: `Launch in ${fmt(t)} · ${n} hostile${n === 1 ? '' : 's'}`, steps: [{ text: 'Keep the lander alive', state: 'active' }, { text: 'Launch window', state: this.lander.t >= 60 && this.lander.t < 100 ? 'done' : 'todo' }] }; }
    if (G === 'assault') return this.assaultView();
    if (G === 'capture') { const clear = !this.capNear; return { title: 'Take the station', line: `Uplink ${Math.round(this.capT / 30 * 100)}% · ${this.capNear || 0} defenders near`, steps: [{ text: 'Clear the defenders', state: clear ? 'done' : 'active' }, { text: 'Hold the uplink for 30 s', state: clear ? 'active' : 'todo' }] }; }
    if (G === 'raid') return { title: 'Raid the mine', line: `Drill rig ${Math.round(this.mineS.hp / this.mineS.maxHp * 100)}% · ${n} hostiles`, steps: [{ text: 'Destroy the drill rig', state: this.mineS.alive ? 'active' : 'done' }] };
    if (G === 'escort' || G === 'intercept') {
      const esc = G === 'escort';
      return { title: esc ? 'Escort the ore convoy' : 'Stop the shipment', line: `${this.convoy.filter((s) => s.alive).length} of ${this.convoy.length} rovers running · ${n} hostiles`,
        steps: this.convoy.map((s, i) => ({ text: esc ? `Rover ${i + 1}${s.alive ? (s.done ? ' delivered' : '') : ' lost'}` : `Rover ${i + 1}${s.alive ? '' : ' destroyed'}`, state: esc ? (s.done ? 'done' : s.alive ? 'active' : 'todo') : (s.alive ? 'active' : 'done') })) };
    }
    return null;
  };
  P_.barState = function () {
    const G = this.goal;
    if (G === 'lander' && this.landerS) return { relay: this.landerS.hp / this.landerS.maxHp, barLabel: 'Lander armor' };
    if (G === 'capture' || (G === 'assault' && this.as >= 4)) return { relay: this.capT / 30, barLabel: 'Uplink capture' };
    if (G === 'assault') return { relay: this.emitter.alive ? this.emitter.hp / this.emitter.maxHp : 0, barLabel: 'Shield emitter' };
    if (G === 'raid' && this.mineS) return { relay: this.mineS.hp / this.mineS.maxHp, barLabel: 'Drill rig' };
    if (this.convoy) { const a = this.convoy.reduce((s, r) => s + (r.alive ? r.hp / r.maxHp : 0), 0) / this.convoy.length; return { relay: a, barLabel: G === 'escort' ? 'Convoy armor' : 'Enemy convoy' }; }
    return { relay: this.relay ? this.relay.hp / this.relay.maxHp : null, barLabel: 'Relay integrity' };
  };

  // Level 1: dominance (picket) → catastrophe (rail hit, Striker lost) → gamble (GASHR on foot) → reversal (inside the dome in their armour)
  P_.setupAssault = function () {
    const sh = this.L.layout.shield; this.as = 0; this.asT = 0; this.cookT = 0;
    this.picket = this.units.filter((u) => u !== this.player.mech && Math.hypot(u.pos.x - sh[0], u.pos.z - sh[1]) > sh[2] + 20);
    this.emitter = this.structs.find((s) => s.kind === 'meson'); this.emitter.name = 'Shield emitter'; this.emitter.hp = this.emitter.maxHp = 1800;
    this.striker = this.player.mech;
  };
  P_.spawnGate = function () {
    const sh = this.shield || { x: this.L.layout.shield[0], z: this.L.layout.shield[1], r: this.L.layout.shield[2] }, f = this.focus();
    const a = Math.atan2(f.x - sh.x, f.z - sh.z), x = sh.x + Math.sin(a) * (sh.r + 12), z = sh.z + Math.cos(a) * (sh.r + 12);
    const u = this.spawn('talon', x, z, { role: 'sentry', home: [sh.x + Math.sin(a) * (sh.r + 50), sh.z + Math.cos(a) * (sh.r + 50)] }); u.yaw = a; u.aggro = 0; this.gate = u; return u;
  };
  P_.railHit = function () {
    const P = this.player, m = P.mech, e = this.emitter, src = _a.copy(e.pos).setY(e.pos.y + 24), tgt = m.center(_b).clone(), d = src.distanceTo(tgt);
    this.fire({ owner: 'none', faction: 'darken', pos: src.clone(), dir: tgt.clone().sub(src).normalize(), speed: 700, dmg: 0, color: 0xcfe8ff, w: 1.1, len: 46, life: d / 700 });
    this.e.sfx.lock(); this.fx.flash?.(src, 1400, 0.2, 0xcfe8ff);
    this.later(d / 700, () => {
      const hip = _c.copy(m.pos).setY(m.pos.y + m.height * 0.45);
      this.fx.explode(hip, 1.7); this.fx.sparks(hip, 30, 16); this.e.sfx.boom(2.2, hip.distanceTo(this.camera.position)); this.shake += 1.6; this.slowT = 1.4;
      m.hp = Math.max(1, Math.round(m.maxHp * 0.14)); P.cell = 0; P.cells = 0; P.noPower = true; P.lowWarn = true; m.oneShot('a2ShutdownOverheat', 1); this.e.sfx.alarm();
      this.cookT = 22; this.e.emit('cellswap');
      this.msg('Rail battery under the dome. Your cell bay is breached and the spares are gone.', 6, true);
      this.later(4.5, () => { if (this.player.mech === this.striker && this.player.mode === 'hawc') this.msg('She is finished. Press E and get out. Fire in the cell bay, twenty seconds.', 8, true); });
      this.later(9, () => this.msg('A Talon is walking out of the dome. That is your ride. GASHR it inside 50 metres.', 8, true));
    });
  };
  P_.updateAssault = function (dt) {
    const P = this.player, f = this.focus(), sh = this.L.layout.shield, dC = Math.hypot(f.x - sh[0], f.z - sh[1]), inTalon = P.mode === 'hawc' && P.mech.type === 'talon';
    this.asT += dt;
    if (this.cookT > 0) {
      this.cookT -= dt; const s = this.striker;
      if (s.alive && Math.random() < 0.5) this.fx.fire(_c.copy(s.pos).setY(s.pos.y + s.height * 0.5), 2, 1.1, 2.5);
      if (this.cookT <= 0 && s.alive) { this.kill(s, 'none'); this.msg('The Striker cooked off.', 4); }
    }
    if (this.as === 0) {
      const left = this.picket.filter((u) => u.alive && u.piloted).length;
      if (!left && !this.picketSaid) { this.picketSaid = true; this.asT = 0; this.addPoints(300, 'Picket broken'); this.msg('Picket down. Walk up to the dome.', 5, true); }
      if ((this.picketSaid && this.asT > 7) || dC < 250) {
        this.as = 1; this.spawnGate();
        if (P.mode === 'hawc' && P.mech === this.striker) this.railHit(); else this.msg('A Talon is walking out of the dome. GASHR it inside 50 metres.', 7, true);
      }
    } else if (this.as === 1) { if (P.mode === 'foot' || !this.striker.alive) this.as = 2; }
    else if (this.as === 2) {
      if (inTalon) { this.as = 3; this.msg('You are wearing Darken armour now. Walk through the dome and drop the shield emitter on the north side.', 8, true); return; }
      const ride = this.units.some((u) => u.alive && u.type === 'talon' && (u.piloted ? u.faction === 'darken' : true) && Math.hypot(u.pos.x - sh[0], u.pos.z - sh[1]) < sh[2] + 140);
      if (!ride) { this.respawnT = (this.respawnT ?? 12) - dt; if (this.respawnT <= 0) { this.respawnT = 12; this.spawnGate(); this.msg('Another Talon is walking out of the dome.', 5, true); } }
    } else if (this.as === 3) {
      if (!this.emitter.alive) {
        this.as = 4; this.addPoints(500, 'Shield emitter down');
        this.spawnGroup([['talon', 'rush', 1], ['vulture', 'rush', 2]], [-30, 30]); this.e.sfx.alarm();
        this.msg('Dome is down. Darken relief column from the north. Get on the uplink and hold it.', 8, true);
      } else if (!inTalon) this.as = 2;
    } else if (this.as === 4) {
      const c = this.relay.pos, d = Math.hypot(f.x - c.x, f.z - c.z), near = this.hostiles().filter((u) => Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 150).length;
      this.capNear = near;
      if (d < 45 && !near) { this.capT += dt; if (!this.capSaid) { this.capSaid = true; this.msg('Uplink handshake started. Hold position.', 5, true); } }
      else if (d < 45 && near && this.time > (this.capWarn || 0)) { this.capWarn = this.time + 9; this.msg(`${near} defender${near > 1 ? 's' : ''} still near the uplink.`, 4, true); }
      else if (d >= 45 && this.capT > 0) this.capT = Math.max(0, this.capT - dt * 0.5);
      if (this.capT >= 30) { this.addPoints(800, 'Mine taken intact'); return this.end(true, 'Mine taken', `Coprates answers to ${this.agName} again. The drill rig, the plant and the cell dock are intact${this.stats.stolen ? ', and you walked in wearing their armour' : ''}.`); }
    }
  };
  P_.assaultView = function () {
    const P = this.player, S = this.as, f = this.flags, inTalon = P.mode === 'hawc' && P.mech.type === 'talon';
    const left = this.picket.filter((u) => u.alive && u.piloted).length;
    const st = [['Break the picket', S > 0 && !left || S > 1], ['Get out of the Striker', S >= 2], ['GASHR the gate Talon', !!f.gashr || S >= 3], ['Board the Talon', S >= 3], ['Drop the shield emitter', S >= 4], ['Hold the uplink for 30 s', false]];
    const line = S === 0 ? `${left} picket HAWC${left === 1 ? '' : 's'} · dome ahead` : this.cookT > 0 && this.striker.alive ? `Cell bay fire · ${Math.ceil(this.cookT)} s` : S <= 2 ? 'On foot · find the Talon' : S === 3 ? (P.compromised ? 'IFF compromised' : 'Disguised as Darken') : `Uplink ${Math.round(this.capT / 30 * 100)}% · ${this.capNear || 0} defenders near`;
    let act = false;
    return { title: 'Take the mine', line, steps: st.map(([text, done]) => { const s = done ? 'done' : act ? 'todo' : 'active'; if (!done) act = true; return { text, state: s }; }) };
  };

  // Support: orbital rod (1) and supply drop (2)
  P_.updateSupport = function (dt, inp) {
    const P = this.player;
    if (inp.pressed.has('Digit1')) {
      if (this.used.strike >= this.support.strike) this.msg('No orbital strikes left. Buy more in the war room.', 3);
      else if (!this.aim.point || this.aim.point.distanceTo(this.focus()) > 600) this.msg('Strike needs a ground point under 600 m', 3);
      else {
        this.used.strike++; const pt = this.aim.point.clone();
        this.msg('Ares Ring: rod away. Impact in three seconds.', 4, true); this.e.sfx.lock();
        this.strikeMark = { pt, t: 3 };
        this.fire({ owner: 'player', faction: 'union', pos: pt.clone().setY(pt.y + 900), dir: new THREE.Vector3(0, -1, 0), speed: 300, dmg: 0, color: 0xfff4e0, w: 1.6, len: 60, life: 2.95 });
        this.later(3, () => { this.fx.explode(pt, 3.4); this.later(0.12, () => this.fx.explode(_c.copy(pt).setY(pt.y + 6), 2)); this.splash(pt, 22, 650, 'player'); this.e.sfx.boom(3, pt.distanceTo(this.camera.position)); this.shake += 1.2; this.strikeMark = null; });
      }
    }
    if (inp.pressed.has('Digit2')) {
      if (this.used.drop >= this.support.drop) this.msg('No supply drops left.', 3);
      else { this.used.drop++; const f = this.focus(), a = P.yaw + 0.6; const x = f.x + Math.sin(a) * 14, z = f.z + Math.cos(a) * 14; this.spawnCrate(x, z, 'supply', 90); this.msg('Supply drop inbound, marked on your right.', 4, true); }
    }
    if (this.strikeMark) { this.strikeMark.t -= dt; if (Math.random() < 0.5) this.fx.smoke(_c.copy(this.strikeMark.pt).setY(this.strikeMark.pt.y + 0.5), 1, 0.9, 2, 0.5); }
  };

  // Crates: dropped by wrecks or by the supply lander
  P_.spawnCrate = function (x, z, kind, fall = 0) {
    const g = new THREE.Group(), col = kind === 'cell' ? 0x7dffa0 : kind === 'supply' ? 0x8ec5ff : 0xffc46a;
    if (kind === 'cell') {
      const shell = new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: 0.7, roughness: 0.35 }), glow = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16), shell); body.position.y = 0.95; body.castShadow = true; g.add(body);
      for (const y of [0.45, 1.45]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.16, 16), shell); cap.position.y = y; g.add(cap); }
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.7, 16, 1, true), glow); core.position.y = 0.95; g.add(core);
      for (let i = 0; i < 3; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.14), shell); const an = i * 2.094; rib.position.set(Math.cos(an) * 0.53, 0.95, Math.sin(an) * 0.53); rib.rotation.y = -an; g.add(rib); }
      const pl = new THREE.PointLight(col, 18, 14, 2); pl.position.y = 1.2; g.add(pl);
      g.rotation.z = 0.0;
    } else {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.6), new THREE.MeshStandardMaterial({ color: 0x4c5056, metalness: 0.5, roughness: 0.5, emissive: col, emissiveIntensity: 0.25 })); b.position.y = 0.55; b.castShadow = true; g.add(b);
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); s.position.y = 0.6; g.add(s);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 30, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 15; g.add(beam);
    const y = this.H(x, z); g.position.set(x, y + fall, z); this.scene.add(g);
    this.crates.push({ g, x, z, y, kind, vy: 0, fall: fall > 0, t: 0 });
  };
  P_.updateCrates = function (dt) {
    const P = this.player, f = this.focus();
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i]; c.t += dt; c.g.rotation.y += dt * 0.6; if (c.kind === 'cell' && !c.fall) c.g.position.y = c.y + 0.25 + Math.sin(c.t * 2.2) * 0.18;
      if (c.fall) { c.vy -= 3.71 * dt; c.vy = Math.max(c.vy, -14); c.g.position.y += c.vy * dt; if (Math.random() < 0.6) this.fx.smoke(c.g.position, 1, 0.75, 1.2, 0.2); if (c.g.position.y <= c.y) { c.g.position.y = c.y; c.fall = false; this.fx.dust(c.g.position, 10, 2, 3, 0.4); this.e.sfx.boom(0.4, c.g.position.distanceTo(this.camera.position)); } continue; }
      const d = Math.hypot(f.x - c.x, f.z - c.z);
      if (d < (P.mode === 'hawc' ? 7 : 2.6)) {
        const m = P.mech, picks = c.kind === 'cell' ? ['cell'] : c.kind === 'supply' ? ['armor', 'ammo', 'cell'] : [['armor', 'ammo', 'overcharge', 'gashr'][Math.floor(Math.random() * 4)]];
        const said = [];
        for (const p of picks) {
          if (p === 'armor') { if (P.mode === 'hawc') m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3); else P.hp = 100; said.push('armor patched'); }
          if (p === 'ammo') { P.ammo = MK.ammo[this.mk.msl - 1]; P.rounds = Math.min(1600, (P.rounds || 0) + 300); P.gashr = Math.min(5, P.gashr + 1); said.push('missiles full, +300 rounds'); }
          if (p === 'cell') { if (P.noPower && P.mode === 'hawc') { P.cell = 1; P.noPower = false; P.lowWarn = false; said.push('power cell in, reactor restarting'); } else { P.cells++; said.push(`power cell, ${P.cells} spare`); } this.pickFx?.(c.g.position); }
          if (p === 'gashr') { P.gashr = Math.min(5, P.gashr + 2); said.push('two GASHR canisters'); }
          if (p === 'overcharge') { if (this.mk.ac < 3) { this.mk.ac++; said.push(`autocannon overcharged to Mk ${'I'.repeat(this.mk.ac)}`); } else { P.ammo = MK.ammo[this.mk.msl - 1]; said.push('missiles full'); } }
        }
        this.msg(`${c.kind === 'cell' ? 'Picked up' : 'Crate'}: ${said.join(', ')}.`, 4, true); this.e.sfx.pickup(); this.e.emit('pickup', c.kind);
        this.scene.remove(c.g); this.crates.splice(i, 1);
      } else if (c.t > (c.kind === 'cell' ? 150 : 90)) { this.scene.remove(c.g); this.crates.splice(i, 1); }
    }
  };

  // Power: every HAWC runs on swappable cells
  P_.updatePower = function (dt) {
    const P = this.player; if (P.mode !== 'hawc' || this.state !== 'play') { P.fuelPrev = null; return; }
    const m = P.mech, sp = Math.abs(P.vf), jets = P.fuelPrev != null && P.fuel < P.fuelPrev - 0.01; P.fuelPrev = P.fuel;
    if (!P.noPower) {
      P.cell -= (0.55 + 0.45 * Math.min(1, sp / 6.5) + (sp > 8 ? 0.55 : 0) + (jets ? 1.4 : 0)) / CELL_S * dt;
      if (P.cell <= 0.2 && P.cells === 0 && !P.lowWarn) { P.lowWarn = true; this.msg('Last power cell at 20 percent. Wrecked HAWCs drop cells.', 6, true); this.e.sfx.alarm(); }
      if (P.cell <= 0) {
        if (P.cells > 0) { P.cells--; P.cell = 1; P.lowWarn = false; this.msg(`Cell spent. Fresh cell in, ${P.cells} spare.`, 4); this.e.sfx.clunk(); this.e.emit('cellswap'); }
        else { P.cell = 0; P.noPower = true; m.oneShot('a2ShutdownOverheat', 1); this.e.sfx.alarm(); this.msg('Power cells empty. Find a cell, or press E to climb out.', 7, true); }
      }
    }
    if (P.noPower) P.shutT = Math.max(P.shutT, 0.5);
  };
  // Cell dock at your base: stand still on the pad and the gantry swaps in a full cell (3 per sortie)
  P_.updateHeritage = function () {
    const Hs = this.world.heritage; if (!Hs || this.heritageSaid) return; const f = this.focus();
    if (Math.hypot(f.x - Hs.x, f.z - Hs.z) < 40) { this.heritageSaid = true; this.msg(`Heritage site: ${Hs.title}. Every agency agreed to leave it untouched.`, 7, true); }
  };
  P_.updateDock = function (dt) {
    const D = this.world.base.dock, P = this.player; if (!D) return;
    const m = P.mech, on = P.mode === 'hawc' && Math.hypot(m.pos.x - D.x, m.pos.z - D.z) < D.r && Math.abs(P.vf) < 0.6 && !m.airborne;
    D.busy = on && D.stock > 0 && (P.cell < 0.97 || P.noPower);
    if (on && !this.dockSaid) { this.dockSaid = true; this.msg(D.stock > 0 ? 'On the cell dock. Hold still for a fresh cell.' : 'Cell dock is empty.', 4); }
    if (!on) { this.dockSaid = false; D.prog = 0; return; }
    if (!D.busy) return;
    D.prog = (D.prog || 0) + dt / 4;
    P.prompt = { key: '·', text: `Swapping cell ${Math.round(D.prog * 100)}%` };
    if (D.prog >= 1) { D.prog = 0; D.stock--; P.cell = 1; P.lowWarn = false; if (P.noPower) { P.noPower = false; P.shutT = 0.01; } this.msg(`Fresh cell in. Dock has ${D.stock} left.`, 4, true); this.e.sfx.clunk(); this.e.emit('cellswap'); }
  };
  P_.onKill = function (u) {
    const big = !!(u.def.rig || u.def.gait), pts = PTS[u.type] ?? (big ? 500 : 150);
    this.addPoints(pts, `${u.def.name} destroyed`);
    if (big || Math.random() < 0.35) this.later(2.2, () => this.spawnCrate(u.pos.x - 3, u.pos.z - 4, 'cell'));
  };
  P_.addPoints = function (n, why) { this.score = (this.score || 0) + n; this.pointsFeed = [...(this.pointsFeed || []).slice(-3), { n, why, t: this.time }]; };
  // Night vision: light amplification on the canvas, plus a flat fill so shadows read
  P_.updateNV = function (dt, inp) {
    const n = this.world.night;
    if (inp.pressed.has('KeyN') && this.state !== 'end') { this.nv = !this.nv; this.e.sfx.lock(); this.e.emit('nv', this.nv); }
    if (!this.nvHinted && n > 0.6 && this.state === 'play') { this.nvHinted = true; this.later(2.5, () => { if (!this.nv) this.msg('Dark out here. Press N for night vision.', 6, true); }); }
    const cv = this.e.renderer.domElement, f = this.nv ? NV_FILTER : '';
    if (cv.style.filter !== f) cv.style.filter = f;
    if (this.nvAmb) this.nvAmb.intensity = this.nv ? 0.12 + 0.3 * n : 0;
    if (this.nv) this.e.renderer.toneMappingExposure = this.world.exposure * (0.85 + 0.55 * n);
  };

  // Damage you can read from across the field: sparks, smoke, fire and a limp as armour goes
  P_.damageFx = function (u, dt) {
    if (!u.maxHp || u.hp >= u.maxHp * 0.7) return;
    const k = u.hp / u.maxHp, big = u.def.rig || u.def.gait, P = this.player;
    const at = (h, s = 1.6) => _c.set(u.pos.x + (Math.random() - 0.5) * s, u.pos.y + u.height * h, u.pos.z + (Math.random() - 0.5) * s);
    u.dfx = (u.dfx || 0) - dt; if (u.dfx > 0) return; u.dfx = 0.05;
    if (Math.random() < (k < 0.4 ? 0.5 : 0.18)) this.fx.smoke(at(0.7), 1, k < 0.15 ? 0.05 : 0.14, big ? 2.2 : 1.6, 3.2);
    if (Math.random() < (k < 0.4 ? 0.12 : 0.04)) { this.fx.sparks(at(0.55 + Math.random() * 0.3), 5, 9); }
    if (k < 0.4 && Math.random() < 0.35) this.fx.fire(at(0.62, 1.2), 2, big ? 1.1 : 0.8, 2.5);
    if (k < 0.15 && Math.random() < 0.5) { this.fx.fire(at(0.4 + Math.random() * 0.4, 2), 3, 1.4, 3); if (Math.random() < 0.06) { this.fx.flash(at(0.6), 900, 0.12, 0xff9a50); this.e.sfx.boom?.(0.25, _c.distanceTo(this.camera.position)); } }
    if (u === P.mech) {
      const st = k < 0.15 ? 3 : k < 0.4 ? 2 : 1;
      if (st > (P.dmgStage || 0)) { P.dmgStage = st; this.msg(['', 'Armour below 70 percent. Plating is cracking.', 'Armour below 40 percent. Fire in the torso.', 'Armour critical. Actuators failing, she is limping.'][st], 5, true); if (st >= 2) this.e.sfx.alarm(); }
    }
  };

  // A HAWC going down: staggered blasts, armour plates flying, a burning wreck
  P_.deathSequence = function (u) {
    const big = u.def.rig || u.def.gait, H = this.H, sz = big ? 1 : 0.7, top = u.height * 0.75;
    const at = (h, s) => _a.copy(u.pos).set(u.pos.x + (Math.random() - 0.5) * s, u.pos.y + h, u.pos.z + (Math.random() - 0.5) * s);
    const steps = big ? [[0, 0.6, 0.7], [0.35, 0.8, 0.5], [0.7, 0.5, 0.9], [1.25, 1.0, 0.3], [1.9, 1.9 * sz, 0.45]] : [[0, 1.2, 0.5], [0.4, 0.8, 0.3]];
    for (const [t, s, hf] of steps) this.later(t, () => { const p = at(top * hf + 1, 3).clone(); this.fx.explode(p, s); this.e.sfx.boom(s, p.distanceTo(this.camera.position)); this.shake += 0.25 * s; if (s > 1.2) this.splash(p, 12, 120, 'none'); });
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b2a29, metalness: 0.6, roughness: 0.6 });
    for (let i = 0; i < (big ? 14 : 8); i++) this.later(Math.random() * 1.6, () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4 + Math.random() * 1.1, 0.15 + Math.random() * 0.4, 0.4 + Math.random() * 0.9), mat); m.castShadow = true;
      m.position.copy(at(top * (0.4 + Math.random() * 0.6), 2)); this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 18, 8 + Math.random() * 12, (Math.random() - 0.5) * 18), w = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      this.debris.push({ m, v, w, t: 0, fire: Math.random() < 0.4 });
    });
    this.later(big ? 1.9 : 0.6, () => this.wrecks.push({ u, t: big ? 45 : 25 }));
    if (big && this.player.mode === 'hawc' && u.pos.distanceTo(this.focus()) < 260) this.slowT = 0.9;
  };
  P_.updateWrecks = function (dt) {
    const H = this.H;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.t += dt; d.v.y -= 3.71 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt;
      if (d.fire && d.t < 3 && Math.random() < 0.5) this.fx.smoke(d.m.position, 1, 0.08, 0.8, 0.5);
      const g = H(d.m.position.x, d.m.position.z) + 0.15;
      if (d.m.position.y < g) { d.m.position.y = g; if (Math.abs(d.v.y) > 3) this.fx.dust(d.m.position, 2, 0.5, 1, 0.2); d.v.y *= -0.25; d.v.x *= 0.5; d.v.z *= 0.5; d.w.multiplyScalar(0.5); }
      if (d.t > 30) { this.scene.remove(d.m); this.debris.splice(i, 1); }
    }
    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const w = this.wrecks[i]; w.t -= dt; const p = _b.copy(w.u.pos).setY(w.u.pos.y + 1.5);
      if (Math.random() < 0.45) this.fx.smoke(p, 1, 0.06 + Math.random() * 0.05, 4, 4);
      if (w.t > 25 && Math.random() < 0.3) this.fx.fire ? this.fx.fire(p, 2, 1.2, 2.5) : null;
      if (w.t <= 0) this.wrecks.splice(i, 1);
    }
  };

  P_.updateJetpack = function (dt, inp) {
    const P = this.player, k = inp.keys;
    if (k.has('Space') && P.footAir && P.jp > 0) {
      P.footVy = Math.min(P.footVy + 11 * dt, 6.5); P.jp = Math.max(0, P.jp - 32 * dt); P.jetting = true;
      if (Math.random() < 0.8) this.fx.smoke(_c.copy(P.footPos).setY(P.footPos.y + 0.7), 1, 0.85, 0.5, -1.5);
    } else P.jetting = false;
    if (!P.footAir) P.jp = Math.min(P.jpCap, P.jp + 24 * dt);
  };

  // Camera modes beyond cockpit/chase: far chase and a cinematic tracking shot
  P_.cineCamera = function (cam, dt) {
    const P = this.player, f = this.focus(), H = this.H, inH = P.mode === 'hawc';
    this.aimOrigin = null;
    if (this.state === 'end' && this.result?.won) {
      const a = this.time * 0.25, r = inH ? 26 : 9;
      cam.position.set(f.x + Math.sin(a) * r, 0, f.z + Math.cos(a) * r); cam.position.y = Math.max(H(cam.position.x, cam.position.z) + 2, f.y + (inH ? 9 : 2.5));
      cam.lookAt(_c.copy(f).setY(f.y + (inH ? P.mech.height * 0.6 : 1.2))); return true;
    }
    if (this.view !== 'cine') return false;
    const c = this.cine, d = c ? Math.hypot(c.x - f.x, c.z - f.z) : 0;
    if (!c || d > 85 || d < 10) {
      const a = P.yaw + (Math.random() < 0.5 ? 0.7 : -0.7) * (1 + Math.random() * 0.5), r = inH ? 50 + Math.random() * 25 : 16;
      this.cine = new THREE.Vector3(f.x + Math.sin(a) * r, 0, f.z + Math.cos(a) * r); this.cine.y = H(this.cine.x, this.cine.z) + (inH ? 1.5 + Math.random() * 8 : 1.2);
    }
    cam.position.copy(this.cine);
    cam.lookAt(_c.copy(f).setY(f.y + (inH ? P.mech.height * 0.6 : 1.2)));
    this.aimOrigin = inH ? _a.copy(P.mech.pos).setY(P.mech.pos.y + P.mech.height * 0.86) : _a.copy(P.footPos).setY(P.footPos.y + 1.6);
    return true;
  };
}
