'use client';
/**
 * Helion Drift HUD — DOM overlays over the canvas.
 * Instruments refresh at ~12 Hz from the sim; on-screen markers are written
 * straight to the DOM every frame (no React churn).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Runtime, Settings } from './runtime';
import { saveSettings } from './runtime';
import { UPGRADES, type UpgradeKey, type NavRef } from './sim';
import { AU_UNITS } from './solar';

// ---------------------------------------------------------------- formatting
export function fmtDist(u: number) {
  if (u >= AU_UNITS * 0.05) return `${(u / AU_UNITS).toFixed(u >= AU_UNITS * 10 ? 1 : 2)} AU`;
  if (u >= 1000) return `${(u / 1000).toFixed(1)} k`;
  return `${Math.round(u)} u`;
}
function fmtTime(s: number) {
  if (!isFinite(s) || s <= 0) return '';
  if (s < 60) return `${Math.ceil(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
const cr = (n: number) => `${Math.round(n).toLocaleString()} cr`;

// ---------------------------------------------------------------- styles
export const HUD_CSS = `
.hd-root{position:absolute;inset:0;pointer-events:none;color:#efe6d2;font-family:var(--font-jetbrains),ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.04em;user-select:none;-webkit-user-select:none}
.hd-root *{box-sizing:border-box}
.hd-btn{pointer-events:auto;cursor:pointer;background:rgba(18,16,12,.72);border:1px solid rgba(226,165,22,.45);color:#f3e7cc;font:inherit;letter-spacing:.08em;text-transform:uppercase;padding:10px 14px;min-height:44px;border-radius:10px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background .15s,border-color .15s,transform .1s}
.hd-btn:hover{background:rgba(226,165,22,.16);border-color:rgba(226,165,22,.9)}
.hd-btn:active{transform:scale(.98)}
.hd-btn:disabled{opacity:.38;cursor:default}
.hd-btn.primary{background:#e2a516;color:#17140f;border-color:#e2a516;font-weight:700}
.hd-btn.primary:hover{background:#f1b827}
.hd-panel{background:rgba(12,11,9,.62);border:1px solid rgba(239,230,210,.12);border-radius:12px;padding:10px 12px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.hd-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(239,230,210,.55)}
.hd-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}
.hd-bar>i{display:block;height:100%;border-radius:3px;transition:width .12s linear}
.hd-tl{position:absolute;left:16px;top:14px;display:flex;flex-direction:column;gap:6px;min-width:190px}
.hd-bl{position:absolute;left:16px;bottom:16px;width:230px;display:flex;flex-direction:column;gap:8px}
.hd-bc{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.hd-speed{font-size:34px;font-weight:600;letter-spacing:.02em;line-height:1;text-shadow:0 0 18px rgba(226,165,22,.25)}
.hd-mode{font-size:10px;letter-spacing:.28em;padding:3px 9px;border-radius:999px;border:1px solid rgba(239,230,210,.25)}
.hd-tr{position:absolute;right:16px;top:14px;display:flex;gap:8px;align-items:flex-start}
.hd-target{position:absolute;right:16px;top:74px;width:230px}
.hd-msgs{position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;width:min(520px,70vw)}
.hd-msg{padding:6px 12px;border-radius:8px;background:rgba(12,11,9,.6);border:1px solid rgba(239,230,210,.12);font-size:12px;transition:opacity .4s,transform .4s;text-align:center}
.hd-msg.good{border-color:rgba(125,255,176,.45);color:#c9ffdc}
.hd-msg.warn{border-color:rgba(255,190,80,.55);color:#ffe2a8}
.hd-msg.bad{border-color:rgba(255,90,110,.6);color:#ffc0c8}
.hd-prompt{position:absolute;left:50%;bottom:205px;transform:translateX(-50%);text-align:center}
.hd-key{display:inline-block;min-width:22px;padding:2px 6px;border:1px solid rgba(239,230,210,.5);border-radius:5px;margin:0 3px;font-weight:700}
.hd-cross{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border:1.5px solid rgba(239,230,210,.55);border-radius:50%}
.hd-cross:after{content:'';position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px;border-radius:50%;background:#efe6d2}
.hd-stick{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;border:2px solid #e2a516;opacity:.8}
.hd-mk{position:absolute;left:0;top:0;transform:translate(-9999px,-9999px);white-space:nowrap;will-change:transform}
.hd-mk .lbl{position:absolute;left:14px;top:-7px;font-size:11px;text-shadow:0 1px 4px #000}
.hd-mk .sub{display:block;font-size:10px;opacity:.65}
.hd-dot{width:8px;height:8px;margin:-4px;border-radius:50%}
.hd-brk{width:34px;height:34px;margin:-17px;border:2px solid currentColor;border-radius:4px}
.hd-arrow{width:0;height:0;margin:-8px;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid currentColor}
.hd-lead{width:12px;height:12px;margin:-6px;border:2px solid #ff6b8a;border-radius:50%}
.hd-overlay{position:absolute;inset:0;pointer-events:auto;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(8,7,6,.55),rgba(5,4,3,.88));z-index:5}
.hd-sheet{width:min(920px,94vw);max-height:90vh;overflow:auto;padding:22px;border-radius:16px;background:rgba(14,12,10,.86);border:1px solid rgba(226,165,22,.28);box-shadow:0 30px 80px rgba(0,0,0,.6)}
.hd-h1{font-family:var(--font-fraunces),Georgia,serif;font-size:30px;font-weight:600;letter-spacing:0;margin:0 0 2px;color:#f6ecd6}
.hd-h2{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#e2a516;margin:18px 0 8px}
.hd-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(239,230,210,.08)}
.hd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.hd-card{padding:12px;border-radius:12px;border:1px solid rgba(239,230,210,.12);background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:8px}
.hd-pips{display:flex;gap:4px}.hd-pips i{width:18px;height:5px;border-radius:2px;background:rgba(255,255,255,.14)}.hd-pips i.on{background:#e2a516}
.hd-scan{position:absolute;right:16px;bottom:16px;width:300px;pointer-events:auto}
.hd-hint{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);text-align:center;max-width:min(520px,90vw);font-size:12px;line-height:1.55;padding:9px 14px;opacity:.92}
.hd-touch{position:absolute;inset:0;pointer-events:none}
.hd-joy{position:absolute;left:22px;bottom:110px;width:150px;height:150px;border-radius:50%;border:1.5px solid rgba(239,230,210,.25);background:rgba(10,9,8,.25);pointer-events:auto;touch-action:none}
.hd-joy i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:rgba(226,165,22,.35);border:1.5px solid rgba(226,165,22,.8)}
.hd-tbtns{position:absolute;right:18px;bottom:110px;display:grid;grid-template-columns:repeat(2,64px);gap:10px;pointer-events:auto}
.hd-tbtn{width:64px;height:64px;border-radius:50%;padding:0;font-size:10px;touch-action:none}
.hd-thr{position:absolute;right:170px;bottom:110px;width:44px;height:150px;border-radius:22px;border:1.5px solid rgba(239,230,210,.25);background:rgba(10,9,8,.25);pointer-events:auto;touch-action:none}
.hd-thr i{position:absolute;left:4px;right:4px;bottom:4px;border-radius:18px;background:rgba(226,165,22,.45)}
.hd-map{position:absolute;inset:0;pointer-events:auto;background:rgba(4,4,6,.92);z-index:6}
.hd-map canvas{position:absolute;inset:0;width:100%;height:100%}
.hd-vign{position:absolute;inset:0;pointer-events:none;transition:opacity .2s}
@media (max-width:640px){
  .hd-root{font-size:11px}
  .hd-tl{min-width:0;left:10px;top:10px;gap:3px;max-width:46vw}
  .hd-bl{left:10px;top:84px;bottom:auto;width:42vw;max-width:170px;padding:7px 9px;gap:4px}
  .hd-bl .hd-label{font-size:9px}
  .hd-bc{top:10px;bottom:auto;gap:3px}
  .hd-speed{font-size:22px}
  .hd-tr{right:10px;top:10px}
  .hd-tr .hd-btn{padding:8px 10px}
  .hd-target{right:10px;top:66px;width:44vw;max-width:180px;padding:7px 9px}
  .hd-msgs{top:auto;bottom:345px;width:92vw}
  .hd-msg{font-size:11px;padding:5px 9px}
  .hd-navline{display:none}
  .hd-scan{left:10px;right:10px;width:auto;top:190px;bottom:auto;max-height:34vh;overflow:hidden;padding:9px 11px}
  .hd-scan p{font-size:12px!important;margin:4px 0 6px!important}
  .hd-scan .hd-h1{font-size:18px!important}
  .hd-prompt{bottom:250px}
  .hd-hint{bottom:250px;font-size:11px}
  .hd-joy{left:14px;bottom:22px;width:136px;height:136px}
  .hd-tbtns{right:12px;bottom:22px;grid-template-columns:repeat(2,58px);gap:8px}
  .hd-tbtn{width:58px;height:58px}
  .hd-thr{right:146px;bottom:22px;height:136px}
}
@media (max-width:640px) and (max-height:500px){
  .hd-bl{top:10px;left:auto;right:120px}
  .hd-msgs{bottom:170px}
}
`;

// ---------------------------------------------------------------- instrument snapshot
interface Snap {
  speed: number; throttle: number; mode: string; spool: number; massLocked: boolean;
  hull: number; hullMax: number; shield: number; shieldMax: number; fuel: number; fuelMax: number; heat: number; energy: number;
  credits: number; ore: number; hold: number; torps: number; torpsMax: number;
  location: string; nav: string; navDist: number; navEta: number;
  target: null | { name: string; hp: number; hpMax: number; dist: number; shielded: boolean };
  dockable: string | null; scanning: null | { name: string; t: number };
  alive: boolean; respawn: number; docked: string | null; fps: number; fuelOut: boolean;
}

function snapshot(rt: Runtime): Snap {
  const sim = rt.sim, sh = sim.ship;
  const navPos = sim.navPosition(sim.nav);
  const navDist = navPos ? Math.max(0, navPos.distanceTo(sh.pos)) : 0;
  const v = sh.vel.length();
  const t = sim.targetPos();
  const scanBody = sim.scanProgress ? sim.body(sim.scanProgress.id) : null;
  return {
    speed: v, throttle: sh.throttle,
    mode: sh.cruise === 'on' ? 'CRUISE' : sh.cruise === 'spooling' ? 'SPOOLING' : sh.boosting ? 'BOOST' : sh.fuel <= 0 ? 'RESERVE' : 'FLIGHT',
    spool: sh.cruiseSpool, massLocked: sim.massLocked,
    hull: sh.hull, hullMax: sh.hullMax, shield: sh.shield, shieldMax: sh.shieldMax, fuel: sh.fuel, fuelMax: sh.fuelMax, heat: sh.heat, energy: sh.energy,
    credits: sim.save.credits, ore: sim.save.ore, hold: sim.stats.holdMax, torps: sh.torps, torpsMax: sh.torpsMax,
    location: sim.locationName(), nav: sim.navName(sim.nav), navDist,
    navEta: navPos && v > 1 && sh.vel.dot(navPos.clone().sub(sh.pos).normalize()) > v * 0.7 ? (navDist - sim.navDropDistance(sim.nav)) / v : Infinity,
    target: t ? { name: t.name, hp: t.hp, hpMax: t.hpMax, dist: t.pos.distanceTo(sh.pos), shielded: t.shielded } : null,
    dockable: sim.dockable?.name ?? null,
    scanning: scanBody && sim.scanProgress ? { name: scanBody.name, t: sim.scanProgress.t } : null,
    alive: sh.alive, respawn: sh.respawnIn, docked: sh.dockedAt, fps: rt.fps, fuelOut: sh.fuel <= 0,
  };
}

function Bar({ v, max, color }: { v: number; max: number; color: string }) {
  return <div className="hd-bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`, background: color }} /></div>;
}

// ---------------------------------------------------------------- markers (imperative)
type MarkerKind = 'nav' | 'target' | 'lead' | 'enemy' | 'station' | 'body' | 'base';

class MarkerLayer {
  el: HTMLDivElement;
  pool = new Map<string, HTMLDivElement>();
  used = new Set<string>();
  constructor(el: HTMLDivElement) { this.el = el; }
  get(key: string, kind: MarkerKind) {
    let d = this.pool.get(key);
    if (!d) {
      d = document.createElement('div');
      d.className = 'hd-mk';
      const shape = document.createElement('div');
      shape.className = kind === 'target' || kind === 'nav' ? 'hd-brk' : kind === 'lead' ? 'hd-lead' : 'hd-dot';
      d.appendChild(shape);
      const lbl = document.createElement('div');
      lbl.className = 'lbl';
      d.appendChild(lbl);
      this.el.appendChild(d);
      this.pool.set(key, d);
    }
    this.used.add(key);
    return d;
  }
  begin() { this.used.clear(); }
  end() { for (const [k, d] of this.pool) if (!this.used.has(k)) d.style.transform = 'translate(-9999px,-9999px)'; }
}

const _p = new THREE.Vector3();
const _f = new THREE.Vector3();

function place(layer: MarkerLayer, cam: THREE.PerspectiveCamera, w: number, h: number, world: THREE.Vector3, origin: THREE.Vector3, key: string, kind: MarkerKind, color: string, label: string, sub: string, edge: boolean, alpha = 1) {
  _p.set(world.x - origin.x, world.y - origin.y, world.z - origin.z);
  // behind camera?
  _f.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const toObj = _p.clone().sub(cam.position);
  const behind = toObj.dot(_f) < 0;
  _p.project(cam);
  let x = (_p.x * 0.5 + 0.5) * w, y = (-_p.y * 0.5 + 0.5) * h;
  const on = !behind && x > 0 && x < w && y > 0 && y < h;
  if (!on && !edge) return;
  const d = layer.get(key, kind);
  const shape = d.firstChild as HTMLDivElement;
  const lbl = d.lastChild as HTMLDivElement;
  d.style.color = color;
  d.style.opacity = String(alpha);
  if (on) {
    shape.className = kind === 'target' || kind === 'nav' ? 'hd-brk' : kind === 'lead' ? 'hd-lead' : kind === 'base' ? 'hd-dot' : 'hd-dot';
    shape.style.background = kind === 'target' || kind === 'nav' || kind === 'lead' ? 'transparent' : color;
    shape.style.transform = kind === 'enemy' || kind === 'base' ? 'rotate(45deg)' : '';
    shape.style.borderRadius = kind === 'nav' ? '50%' : kind === 'target' ? '4px' : kind === 'enemy' || kind === 'base' ? '1px' : '50%';
    d.style.transform = `translate(${x}px,${y}px)`;
    lbl.innerHTML = label ? `${label}<span class="sub">${sub}</span>` : '';
    lbl.style.left = x > w - 160 ? 'auto' : '14px';
    lbl.style.right = x > w - 160 ? '14px' : 'auto';
    lbl.style.textAlign = x > w - 160 ? 'right' : 'left';
    lbl.style.top = '-7px';
  } else {
    // pin to the screen edge, pointing toward the object
    let dx = x - w / 2, dy = y - h / 2;
    if (behind) { dx = -dx; dy = -dy; }
    const ang = Math.atan2(dy, dx);
    const m = 34;
    const sx = (w / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(ang))), sy = (h / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(ang)));
    const s = Math.min(sx, sy);
    x = w / 2 + Math.cos(ang) * s; y = h / 2 + Math.sin(ang) * s;
    shape.className = 'hd-arrow';
    shape.style.background = 'transparent';
    shape.style.borderRadius = '0';
    shape.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    d.style.transform = `translate(${x}px,${y}px)`;
    lbl.innerHTML = kind === 'nav' || kind === 'target' ? `${label}<span class="sub">${sub}</span>` : '';
    lbl.style.left = x > w * 0.6 ? 'auto' : '14px';
    lbl.style.right = x > w * 0.6 ? '14px' : 'auto';
    lbl.style.textAlign = x > w * 0.6 ? 'right' : 'left';
    lbl.style.top = y > h * 0.8 ? '-26px' : '-7px';
    return;
  }
}

// ---------------------------------------------------------------- main HUD
export function Hud({ rt, onPause, onOpenMap, mapOpen, onCloseMap, touch }: { rt: Runtime; onPause: () => void; onOpenMap: () => void; mapOpen: boolean; onCloseMap: () => void; touch: boolean }) {
  const [s, setS] = useState<Snap>(() => snapshot(rt));
  const [msgs, setMsgs] = useState<{ id: number; text: string; tone: string; t: number }[]>([]);
  const [scanCard, setScanCard] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hurt, setHurt] = useState(0);
  const markerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const layer = useRef<MarkerLayer | null>(null);
  const msgId = useRef(1);

  // instruments + events at ~12 Hz
  useEffect(() => {
    const id = window.setInterval(() => {
      setS(snapshot(rt));
      const evs = rt.hudEvents.splice(0);
      if (!evs.length) return;
      const now = performance.now();
      const add: { id: number; text: string; tone: string; t: number }[] = [];
      for (const e of evs) {
        if (e.t === 'msg') add.push({ id: msgId.current++, text: e.text, tone: e.tone, t: now });
        if (e.t === 'scan') setScanCard(e.bodyId);
        if (e.t === 'playerHit' && !e.shield) setHurt((h) => Math.min(1, h + 0.25 + e.amount * 0.02));
        if (e.t === 'pickup') add.push({ id: msgId.current++, text: e.kind === 'ore' ? `+${e.amount} ore` : e.kind === 'fuel' ? `+${e.amount} fuel` : `+${e.amount} cr salvage`, tone: 'info', t: now });
      }
      if (add.length) setMsgs((m) => [...m, ...add].slice(-5));
    }, 80);
    return () => window.clearInterval(id);
  }, [rt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      setMsgs((m) => m.filter((x) => now - x.t < 5200));
      setHurt((h) => Math.max(0, h - 0.08));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scanCard) return;
    const id = window.setTimeout(() => setScanCard(null), 9000);
    return () => window.clearTimeout(id);
  }, [scanCard]);

  // first-flight hints, each shown once
  useEffect(() => {
    const id = window.setInterval(() => {
      const sim = rt.sim, tut = sim.save.tutorial, sh = sim.ship;
      if (sh.dockedAt || !sh.alive) { setHint(null); return; }
      const pad = rt.input.mode === 'pad', tch = rt.input.mode === 'touch';
      let h: string | null = null;
      if (!tut.steer) {
        h = pad ? 'Left stick steers · RS up/down throttle · RT fires' : tch ? 'Left pad steers · slider sets throttle · FIRE shoots'
          : rt.input.locked ? 'Mouse steers · W / S throttle · A / D strafe · Q / E roll · Click fires' : 'Click to take the stick — then the mouse steers';
        if (sim.time > 10) tut.steer = true;
      } else if (!tut.firstNav && sim.nav) {
        h = `Course is set for ${sim.navName(sim.nav)}. Press ${pad ? 'X' : tch ? 'CRUISE' : 'C'} to engage the cruise drive.`;
        if (sh.cruise !== 'off') tut.firstNav = true;
      } else if (!tut.map && tut.firstNav && sh.cruise === 'off' && sim.time > 40) {
        h = `${pad ? 'D-pad up' : tch ? 'MAP' : 'M'} opens the system map — pick anywhere to fly to.`;
        if (mapOpen) tut.map = true;
      }
      setHint(h);
    }, 300);
    return () => window.clearInterval(id);
  }, [rt, mapOpen]);

  // per-frame markers
  useEffect(() => {
    if (!markerRef.current) return;
    layer.current = new MarkerLayer(markerRef.current);
    const tick = () => {
      const L = layer.current, cam = rt.camera;
      if (!L || !cam) return;
      cam.updateMatrixWorld();
      const sim = rt.sim, sh = sim.ship, o = rt.origin;
      const w = rt.viewport.w, h = rt.viewport.h;
      L.begin();
      if (!sh.dockedAt && sh.alive) {
        // bodies: labels (moons only near their parent)
        for (const b of sim.bodies) {
          const d = b.pos.distanceTo(sh.pos);
          if (b.kind === 'moon') { const p = sim.body(b.parent!); if (!p || p.pos.distanceTo(sh.pos) > 90_000) continue; }
          if (d < b.radius * 1.4) continue;
          const isNav = sim.nav?.type === 'body' && sim.nav.id === b.id;
          if (isNav) continue;
          place(L, cam, w, h, b.pos, o, 'b-' + b.id, 'body', b.kind === 'star' ? '#ffd27a' : '#cfd8ea', b.name, fmtDist(Math.max(0, d - b.radius)), false, b.kind === 'moon' ? 0.55 : 0.75);
        }
        for (const st of sim.stations) {
          const d = st.pos.distanceTo(sh.pos);
          const isNav = sim.nav?.type === 'station' && sim.nav.id === st.id;
          if (isNav || d > 140_000) continue;
          place(L, cam, w, h, st.pos, o, 's-' + st.id, 'station', '#7dffb0', d < 60_000 ? st.name : '', fmtDist(d), false, 0.85);
        }
        for (const b of sim.bases) {
          if (!b.discovered || b.destroyed) continue;
          const isNav = sim.nav?.type === 'base' && sim.nav.id === b.def.id;
          if (isNav) continue;
          place(L, cam, w, h, b.pos, o, 'x-' + b.def.id, 'base', '#ff5fb8', b.def.name, fmtDist(b.pos.distanceTo(sh.pos)), false, 0.9);
        }
        // hostiles: diamonds, edge arrows for the closest few
        const hostiles = sim.enemies.filter((e) => e.alive && e.pos.distanceToSquared(sh.pos) < 3500 ** 2).sort((a, b) => a.pos.distanceToSquared(sh.pos) - b.pos.distanceToSquared(sh.pos));
        hostiles.slice(0, 24).forEach((e, i) => {
          if (e.id === sim.targetId) return;
          place(L, cam, w, h, e.pos, o, 'e-' + e.id, 'enemy', '#ff4a6a', '', '', i < 5 && e.kind !== 'turret', 0.95);
        });
        // nav target
        const navPos = sim.navPosition(sim.nav);
        if (navPos) {
          const d = navPos.distanceTo(sh.pos);
          place(L, cam, w, h, navPos, o, 'nav', 'nav', '#e2a516', sim.navName(sim.nav), fmtDist(d), true, 1);
        }
        // current target + lead indicator
        const t = sim.targetPos();
        if (t) {
          place(L, cam, w, h, t.pos, o, 'tgt', 'target', '#ff6b8a', t.name, `${fmtDist(t.pos.distanceTo(sh.pos))}`, true, 1);
          const lead = new THREE.Vector3();
          const dist = t.pos.distanceTo(sh.pos);
          if (dist < 2400) {
            const tt = dist / 1100;
            lead.copy(t.pos).addScaledVector(t.vel.clone().sub(sh.vel), tt);
            place(L, cam, w, h, lead, o, 'lead', 'lead', '#ff6b8a', '', '', false, 0.9);
          }
        }
      }
      L.end();
      // virtual stick cursor
      if (stickRef.current) {
        const st = rt.input.stick;
        const show = rt.input.locked && !sh.dockedAt && sh.alive;
        stickRef.current.style.display = show ? 'block' : 'none';
        if (show) stickRef.current.style.transform = `translate(${st.x * Math.min(w, h) * 0.22}px,${st.y * Math.min(w, h) * 0.22}px)`;
      }
    };
    rt.onFrameHud = tick;
    return () => { rt.onFrameHud = undefined; };
  }, [rt]);

  const sim = rt.sim;
  const body = scanCard ? sim.body(scanCard) : null;
  const fuelLow = s.fuel < s.fuelMax * 0.2;

  return (
    <div className="hd-root">
      <div className="hd-vign" style={{ opacity: hurt, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,40,60,.55))' }} />
      <div className="hd-vign" style={{ opacity: Math.max(0, (s.heat - 40) / 80), background: 'radial-gradient(ellipse at center, transparent 45%, rgba(255,140,30,.5))' }} />
      <div ref={markerRef} style={{ position: 'absolute', inset: 0 }} />
      {!s.docked && s.alive && <div className="hd-cross" />}
      <div ref={stickRef} className="hd-stick" style={{ display: 'none' }} />

      {!s.docked && !mapOpen && (
        <>
          <div className="hd-tl">
            <div className="hd-label">{s.location}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{cr(s.credits)}</div>
            <div style={{ opacity: 0.75 }}>Ore {s.ore}/{s.hold} · Torp {s.torps}/{s.torpsMax}</div>
          </div>
          <div className="hd-tr">
            <button className="hd-btn" onClick={onOpenMap} aria-label="System map">Map</button>
            <button className="hd-btn" onClick={onPause} aria-label="Pause">II</button>
          </div>
          <div className="hd-bl hd-panel">
            <div className="hd-label">Hull {Math.ceil(s.hull)}</div><Bar v={s.hull} max={s.hullMax} color={s.hull < s.hullMax * 0.3 ? '#ff4a6a' : '#efe6d2'} />
            <div className="hd-label">Shield {Math.ceil(s.shield)}</div><Bar v={s.shield} max={s.shieldMax} color="#8fe3ff" />
            <div className="hd-label" style={{ color: fuelLow ? '#ffb347' : undefined }}>Fuel {s.fuel.toFixed(1)}</div><Bar v={s.fuel} max={s.fuelMax} color={fuelLow ? '#ff9a2e' : '#e2a516'} />
            {s.heat > 1 && (<><div className="hd-label" style={{ color: '#ff9a2e' }}>Heat {Math.round(s.heat)}%</div><Bar v={s.heat} max={100} color="#ff6a1a" /></>)}
          </div>
          <div className="hd-bc">
            {s.mode === 'SPOOLING' && <div style={{ width: 180 }}><Bar v={s.spool} max={1} color="#8fe3ff" /></div>}
            <div className="hd-speed">{s.speed >= 10000 ? `${(s.speed / 1000).toFixed(1)}k` : Math.round(s.speed)}<span style={{ fontSize: 12, opacity: 0.6, marginLeft: 6 }}>u/s</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="hd-mode" style={{ borderColor: s.mode === 'CRUISE' ? '#8fe3ff' : s.mode === 'BOOST' ? '#e2a516' : s.mode === 'RESERVE' ? '#ff4a6a' : undefined }}>{s.mode}</span>
              {s.massLocked && s.mode !== 'CRUISE' && <span className="hd-mode" style={{ borderColor: '#ff4a6a', color: '#ffb0bd' }}>MASS LOCK</span>}
              {rt.sim.assist && <span className="hd-mode" style={{ borderColor: '#e2a516', color: '#ffe2a8' }}>ASSIST</span>}
            </div>
            {s.mode !== 'CRUISE' && !touch && <div style={{ width: 160 }}><Bar v={Math.max(0, s.throttle)} max={1} color="#efe6d2" /></div>}
            {s.nav && <div className="hd-navline" style={{ opacity: 0.8 }}>→ {s.nav} · {fmtDist(s.navDist)}{s.mode === 'CRUISE' && s.navEta < 600 ? ` · ${fmtTime(s.navEta)}` : ''}</div>}
          </div>
          {s.target && (
            <div className="hd-target hd-panel">
              <div className="hd-label" style={{ color: '#ff8aa3' }}>Target</div>
              <div style={{ fontSize: 14, margin: '2px 0 6px' }}>{s.target.name}</div>
              <Bar v={s.target.hp} max={s.target.hpMax} color={s.target.shielded ? '#ff5fb8' : '#ff4a6a'} />
              <div style={{ marginTop: 6, opacity: 0.75 }}>{fmtDist(s.target.dist)}{s.target.shielded ? ' · core shielded' : ''}</div>
            </div>
          )}
          <div className="hd-prompt">
            {s.dockable && s.alive && <div className="hd-panel" style={{ marginBottom: 8 }}>{touch ? 'Tap DOCK' : <>Press <span className="hd-key">{rt.input.mode === 'pad' ? 'A' : 'F'}</span></>} to dock at {s.dockable}{s.speed > 70 ? ' — slow down first' : ''}</div>}
            {s.scanning && <div className="hd-panel">Surveying {s.scanning.name} · {Math.round(s.scanning.t * 100)}%</div>}
            {s.fuelOut && s.alive && (
              <div className="hd-panel" style={{ pointerEvents: 'auto', marginTop: 8 }}>
                Fuel empty. Reserve thrusters only.{' '}
                <button className="hd-btn" style={{ marginLeft: 8 }} onClick={() => rt.sim.callTow()}>Call a tug</button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="hd-msgs">
        {msgs.map((m) => <div key={m.id} className={`hd-msg ${m.tone}`}>{m.text}</div>)}
      </div>

      {hint && !s.docked && !mapOpen && <div className="hd-hint hd-panel">{hint}</div>}

      {body && !s.docked && (
        <div className="hd-scan hd-panel" onClick={() => setScanCard(null)}>
          <div className="hd-label" style={{ color: '#7dffb0' }}>Survey logged</div>
          <div className="hd-h1" style={{ fontSize: 22 }}>{body.name}</div>
          <p style={{ margin: '6px 0 10px', lineHeight: 1.55, fontFamily: 'var(--font-inter), system-ui, sans-serif', letterSpacing: 0, fontSize: 13, opacity: 0.88 }}>{body.blurb}</p>
          {body.facts.slice(0, touch ? 2 : 5).map((f) => <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.85, padding: '2px 0' }}><span className="hd-label">{f.label}</span><span>{f.value}</span></div>)}
        </div>
      )}

      {!s.alive && (
        <div className="hd-overlay" style={{ background: 'radial-gradient(ellipse at center, rgba(40,6,10,.35), rgba(5,4,3,.75))', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="hd-h1">Ship lost</div>
            <div style={{ opacity: 0.7, marginTop: 8 }}>New hull at {rt.sim.station(rt.sim.save.lastStation)?.name} in {Math.max(0, Math.ceil(s.respawn))}</div>
          </div>
        </div>
      )}

      {touch && !s.docked && s.alive && !mapOpen && <TouchControls rt={rt} onMap={onOpenMap} dockable={!!s.dockable} />}
      {mapOpen && <SystemMap rt={rt} onClose={onCloseMap} />}
    </div>
  );
}

// ---------------------------------------------------------------- touch controls
function TouchControls({ rt, onMap, dockable }: { rt: Runtime; onMap: () => void; dockable: boolean }) {
  const joy = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const thr = useRef<HTMLDivElement>(null);
  const [thrV, setThrV] = useState(0);
  const joyMove = useCallback((e: React.PointerEvent) => {
    const r = joy.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
    const l = Math.hypot(x, y), k = l > 1 ? 1 / l : 1;
    rt.input.touch.steerX = x * k; rt.input.touch.steerY = y * k;
    rt.input.mode = 'touch';
    if (knob.current) knob.current.style.transform = `translate(${x * k * 46}px,${y * k * 46}px)`;
  }, [rt]);
  const joyEnd = useCallback(() => {
    rt.input.touch.steerX = 0; rt.input.touch.steerY = 0;
    if (knob.current) knob.current.style.transform = '';
  }, [rt]);
  const thrMove = useCallback((e: React.PointerEvent) => {
    const r = thr.current!.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    rt.input.touch.throttle = v; rt.input.mode = 'touch';
    setThrV(v);
  }, [rt]);
  const hold = (key: 'fire' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); rt.input.touch[key] = true; rt.input.mode = 'touch'; },
    onPointerUp: () => { rt.input.touch[key] = false; },
    onPointerCancel: () => { rt.input.touch[key] = false; },
  });
  return (
    <div className="hd-touch">
      <div ref={joy} className="hd-joy" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); joyMove(e); }} onPointerMove={(e) => { if (e.buttons || e.pressure) joyMove(e); }} onPointerUp={joyEnd} onPointerCancel={joyEnd}><i ref={knob} /></div>
      <div ref={thr} className="hd-thr" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); thrMove(e); }} onPointerMove={(e) => { if (e.buttons || e.pressure) thrMove(e); }}><i style={{ height: `${Math.max(8, thrV * 100)}%` }} /></div>
      <div className="hd-tbtns">
        <button className="hd-btn hd-tbtn primary" {...hold('fire')}>Fire</button>
        <button className="hd-btn hd-tbtn" {...hold('boost')}>Boost</button>
        <button className="hd-btn hd-tbtn" onClick={() => rt.input.touchPress('cruise')}>Cruise</button>
        <button className="hd-btn hd-tbtn" onClick={() => rt.input.touchPress('target')}>Target</button>
        <button className="hd-btn hd-tbtn" onClick={() => rt.input.touchPress('torpedo')}>Torp</button>
        {dockable ? <button className="hd-btn hd-tbtn primary" onClick={() => rt.input.touchPress('dock')}>Dock</button>
          : <button className="hd-btn hd-tbtn" onClick={onMap}>Map</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- system map
function SystemMap({ rt, onClose }: { rt: Runtime; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<NavRef | null>(null);
  const [zoom, setZoom] = useState<'inner' | 'outer'>(() => (rt.sim.ship.pos.length() / AU_UNITS > 4.5 ? 'outer' : 'inner'));
  const hits = useRef<{ x: number; y: number; r: number; ref: NavRef }[]>([]);

  useEffect(() => {
    rt.input.releaseLock();
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'KeyM') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [rt, onClose]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = ref.current;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      const g = cv.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const sim = rt.sim;
      const cx = W / 2, cy = H / 2 + 10;
      const R = Math.min(W, H) * 0.44;
      const maxAU = zoom === 'inner' ? 3.6 : 40;
      // square-root radial scale keeps the inner system readable
      const scale = (au: number) => Math.sqrt(au / maxAU) * R;
      const toXY = (p: THREE.Vector3) => {
        const au = Math.hypot(p.x, p.z) / AU_UNITS;
        const a = Math.atan2(p.z, p.x);
        const r = scale(au);
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, au };
      };
      hits.current = [];
      // belt band
      g.fillStyle = 'rgba(154,143,128,.10)';
      g.beginPath(); g.arc(cx, cy, scale(3.3), 0, Math.PI * 2); g.arc(cx, cy, scale(2.15), 0, Math.PI * 2, true); g.fill();
      // orbits + planets
      for (const b of sim.bodies) {
        if (b.kind === 'moon') continue;
        const p = toXY(b.pos);
        if (p.au > maxAU * 1.02) continue;
        if (b.kind !== 'star') {
          g.strokeStyle = 'rgba(143,180,255,.16)'; g.lineWidth = 1;
          g.beginPath(); g.arc(cx, cy, scale(p.au), 0, Math.PI * 2); g.stroke();
        }
        const r = b.kind === 'star' ? 9 : b.kind === 'dwarf' ? 3 : Math.max(3.5, Math.min(9, Math.sqrt(b.radius) / 9));
        g.fillStyle = b.kind === 'star' ? '#ffd27a' : b.tint === '#dcdcdc' ? '#6fb2ff' : b.tint;
        if (b.id === 'Earth') g.fillStyle = '#6fb2ff';
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
        const scanned = sim.save.scanned.includes(b.id);
        g.fillStyle = scanned ? 'rgba(239,230,210,.85)' : 'rgba(239,230,210,.5)';
        g.font = '11px ui-monospace, monospace';
        g.fillText(b.name + (scanned ? '' : ' ·'), p.x + r + 4, p.y + 4);
        hits.current.push({ x: p.x, y: p.y, r: Math.max(14, r + 6), ref: { type: 'body', id: b.id } });
      }
      // stations
      for (const st of sim.stations) {
        const p = toXY(st.pos);
        if (p.au > maxAU * 1.02) continue;
        const ox = 0, oy = -12;
        g.fillStyle = '#7dffb0';
        g.fillRect(p.x + ox - 3.5, p.y + oy - 3.5, 7, 7);
        g.font = '10px ui-monospace, monospace';
        g.fillStyle = 'rgba(125,255,176,.8)';
        g.fillText(st.name, p.x + ox + 7, p.y + oy + 3);
        hits.current.push({ x: p.x + ox, y: p.y + oy, r: 12, ref: { type: 'station', id: st.id } });
      }
      // bases
      for (const b of sim.bases) {
        if (!b.discovered && !b.destroyed) continue;
        const p = toXY(b.pos);
        if (p.au > maxAU * 1.02) continue;
        g.save(); g.translate(p.x, p.y + 12); g.rotate(Math.PI / 4);
        g.fillStyle = b.destroyed ? 'rgba(255,95,184,.3)' : '#ff5fb8';
        g.fillRect(-4, -4, 8, 8); g.restore();
        g.fillStyle = b.destroyed ? 'rgba(255,95,184,.4)' : 'rgba(255,95,184,.9)';
        g.font = '10px ui-monospace, monospace';
        g.fillText(b.def.name + (b.destroyed ? ' (destroyed)' : ''), p.x + 9, p.y + 16);
        if (!b.destroyed) hits.current.push({ x: p.x, y: p.y + 12, r: 12, ref: { type: 'base', id: b.def.id } });
      }
      // nav line + player
      const me = toXY(sim.ship.pos);
      const navPos = sim.navPosition(sim.nav);
      if (navPos) {
        const n = toXY(navPos);
        g.strokeStyle = 'rgba(226,165,22,.8)'; g.setLineDash([5, 5]); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(me.x, me.y); g.lineTo(n.x, n.y); g.stroke(); g.setLineDash([]);
      }
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(sim.ship.quat);
      const ha = Math.atan2(fwd.z, fwd.x);
      g.save(); g.translate(me.x, me.y); g.rotate(ha);
      g.fillStyle = '#e2a516';
      g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, 6); g.lineTo(-3, 0); g.lineTo(-6, -6); g.closePath(); g.fill();
      g.restore();
      // hover ring
      if (hover) {
        const h = hits.current.find((q) => q.ref.type === hover.type && q.ref.id === hover.id);
        if (h) { g.strokeStyle = '#e2a516'; g.lineWidth = 2; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke(); }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rt, zoom, hover]);

  const pick = (e: React.PointerEvent, commit: boolean) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: { ref: NavRef; d: number } | null = null;
    for (const h of hits.current) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r && (!best || d < best.d)) best = { ref: h.ref, d };
    }
    setHover(best?.ref ?? null);
    if (commit && best) { rt.sim.setNav(best.ref); onClose(); }
  };

  const navName = hover ? rt.sim.navName(hover) : rt.sim.navName(rt.sim.nav);
  const navPos = hover ? rt.sim.navPosition(hover) : rt.sim.navPosition(rt.sim.nav);
  return (
    <div className="hd-map">
      <canvas ref={ref} onPointerMove={(e) => pick(e, false)} onPointerDown={(e) => pick(e, true)} />
      <div style={{ position: 'absolute', left: 16, top: 14 }}>
        <div className="hd-h1" style={{ fontSize: 24 }}>The Solar System</div>
        <div className="hd-label">Positions are where the planets really are today · tap a destination</div>
      </div>
      <div style={{ position: 'absolute', right: 16, top: 14, display: 'flex', gap: 8 }}>
        <button className="hd-btn" onClick={() => setZoom(zoom === 'inner' ? 'outer' : 'inner')}>{zoom === 'inner' ? 'Outer system' : 'Inner system'}</button>
        <button className="hd-btn primary" onClick={onClose}>Close</button>
      </div>
      {navName && navPos && (
        <div className="hd-panel" style={{ position: 'absolute', left: 16, bottom: 16 }}>
          <div className="hd-label">{hover ? 'Set course' : 'Current course'}</div>
          <div style={{ fontSize: 15, marginTop: 2 }}>{navName}</div>
          <div style={{ opacity: 0.7 }}>{fmtDist(navPos.distanceTo(rt.sim.ship.pos))}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- station screen
export function StationScreen({ rt, onLaunch }: { rt: Runtime; onLaunch: () => void }) {
  const sim = rt.sim;
  const [, force] = useState(0);
  const bump = () => { rt.audio.blip('ui'); force((n) => n + 1); };
  const st = sim.station(sim.ship.dockedAt ?? '')!;
  const sh = sim.ship;
  const fuelNeed = sh.fuelMax - sh.fuel;
  const fuelCost = Math.ceil(fuelNeed * st.fuelPrice);
  const dests = useMemo(() => sim.navList(), [sim]);
  if (!st) return null;
  return (
    <div className="hd-overlay" style={{ background: 'linear-gradient(90deg, rgba(5,4,3,.9) 0%, rgba(5,4,3,.55) 60%, rgba(5,4,3,.2) 100%)', justifyContent: 'flex-start' }}>
      <div className="hd-sheet" style={{ marginLeft: 'max(16px, 4vw)', width: 'min(640px, 94vw)' }}>
        <div className="hd-label" style={{ color: '#7dffb0' }}>Docked · {st.host}</div>
        <div className="hd-h1">{st.name}</div>
        <div style={{ opacity: 0.7, fontFamily: 'var(--font-inter), system-ui', letterSpacing: 0 }}>{st.tagline}</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
          <span><span className="hd-label">Credits</span> {cr(sim.save.credits)}</span>
          <span><span className="hd-label">Ore</span> {sim.save.ore}/{sim.stats.holdMax}</span>
          <span><span className="hd-label">Bases down</span> {sim.save.stats.basesDown}/{sim.bases.length}</span>
          <span><span className="hd-label">Surveyed</span> {sim.save.scanned.length}/{sim.bodies.length}</span>
        </div>

        <div className="hd-h2">Services</div>
        <div className="hd-row"><span>Fuel {sh.fuel.toFixed(0)}/{sh.fuelMax} · {st.fuelPrice} cr/unit</span><button className="hd-btn" disabled={fuelNeed < 0.5 || sim.save.credits < st.fuelPrice} onClick={() => { sim.refuel(); bump(); }}>Refuel {fuelNeed >= 0.5 ? cr(Math.min(fuelCost, sim.save.credits)) : ''}</button></div>
        <div className="hd-row"><span>Hull {Math.ceil(sh.hull)}/{sh.hullMax}</span><button className="hd-btn" disabled={sim.repairCost() <= 0 || sim.save.credits < 3} onClick={() => { sim.repair(); bump(); }}>Repair {sim.repairCost() > 0 ? cr(sim.repairCost()) : ''}</button></div>
        <div className="hd-row"><span>Torpedoes {sh.torps}/{sh.torpsMax} · 60 cr each</span><button className="hd-btn" disabled={sh.torps >= sh.torpsMax || sim.save.credits < 60} onClick={() => { sim.rearm(); bump(); }}>Rearm</button></div>
        <div className="hd-row"><span>Ore · {sim.orePrice()} cr/unit{st.id === 'ceres-depot' ? ' (best price)' : ''}</span><button className="hd-btn" disabled={sim.save.ore <= 0} onClick={() => { sim.sellOre(); bump(); }}>Sell {sim.save.ore > 0 ? cr(sim.save.ore * sim.orePrice()) : ''}</button></div>

        <div className="hd-h2">Shipwright</div>
        <div className="hd-grid">
          {(Object.keys(UPGRADES) as UpgradeKey[]).map((k) => {
            const u = UPGRADES[k];
            const lvl = sim.save.upgrades[k];
            const maxed = lvl >= u.levels.length - 1;
            const cost = maxed ? 0 : u.cost[lvl + 1];
            return (
              <div key={k} className="hd-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{u.label}</b><div className="hd-pips">{u.levels.slice(1).map((_, i) => <i key={i} className={i < lvl ? 'on' : ''} />)}</div></div>
                <div style={{ opacity: 0.65, fontFamily: 'var(--font-inter), system-ui', letterSpacing: 0 }}>{u.desc}</div>
                <button className="hd-btn" disabled={maxed || sim.save.credits < cost} onClick={() => { if (sim.buyUpgrade(k)) bump(); }}>{maxed ? 'Maxed' : `Upgrade · ${cr(cost)}`}</button>
              </div>
            );
          })}
        </div>

        <div className="hd-h2">Course</div>
        <select className="hd-btn" style={{ width: '100%', textTransform: 'none' }} value={sim.nav ? `${sim.nav.type}:${sim.nav.id}` : ''} onChange={(e) => { const [type, id] = e.target.value.split(':'); sim.nav = type ? { type: type as NavRef['type'], id } : null; bump(); }}>
          <option value="">No course</option>
          {dests.filter((d) => !(d.type === 'station' && d.id === st.id)).map((d) => (
            <option key={`${d.type}:${d.id}`} value={`${d.type}:${d.id}`}>{d.type === 'station' ? 'Station · ' : d.type === 'base' ? 'Hostile · ' : ''}{sim.navName(d)} — {fmtDist(sim.navPosition(d)!.distanceTo(sh.pos))}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="hd-btn primary" style={{ flex: 1, fontSize: 14 }} onClick={onLaunch}>Launch</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pause + settings
export function PauseMenu({ rt, onResume, onQuit, settings, setSettings }: { rt: Runtime; onResume: () => void; onQuit: () => void; settings: Settings; setSettings: (s: Settings) => void }) {
  const [tab, setTab] = useState<'main' | 'controls' | 'settings'>('main');
  const upd = (p: Partial<Settings>) => { const n = { ...settings, ...p }; setSettings(n); saveSettings(n); rt.settings = n; rt.input.settings = n; rt.audio.setVolume(n.volume); };
  const st = rt.sim.save.stats;
  return (
    <div className="hd-overlay">
      <div className="hd-sheet" style={{ width: 'min(560px, 94vw)' }}>
        <div className="hd-h1">Paused</div>
        <div style={{ opacity: 0.6 }}>{Math.round(st.distance / AU_UNITS * 10) / 10} AU flown · {st.kills} kills · {st.basesDown} bases down · progress saves when you dock</div>
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          {(['main', 'controls', 'settings'] as const).map((t) => <button key={t} className={`hd-btn${tab === t ? ' primary' : ''}`} onClick={() => setTab(t)}>{t === 'main' ? 'Game' : t}</button>)}
        </div>
        {tab === 'main' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="hd-btn primary" onClick={onResume}>Resume</button>
            <button className="hd-btn" onClick={onQuit}>Quit to title</button>
          </div>
        )}
        {tab === 'controls' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px', lineHeight: 1.7 }}>
            {[
              ['Steer', 'Mouse · Arrows · Left stick'], ['Throttle', 'W / S · RS up/down'], ['Strafe', 'A / D · R / V'], ['Roll', 'Q / E · LB / RB'],
              ['Boost', 'Shift · LT'], ['Fire', 'Click · Space · RT'], ['Torpedo', 'Right-click · G · R3'], ['Target', 'T (ahead) · Tab (cycle) · Y'],
              ['Cruise drive', 'C · X'], ['All stop', 'X key · B'], ['Dock', 'F · A'], ['Course', 'M map · N / B cycle · D-pad'], ['Pause', 'Esc · P · Start'],
            ].map(([a, b]) => <div key={a} style={{ display: 'contents' }}><span className="hd-label" style={{ alignSelf: 'center' }}>{a}</span><span>{b}</span></div>)}
          </div>
        )}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Invert Y</span><input type="checkbox" style={{ width: 22, height: 22, pointerEvents: 'auto' }} checked={settings.invertY} onChange={(e) => upd({ invertY: e.target.checked })} /></label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}><span>Mouse sensitivity</span><input type="range" min={0.4} max={2} step={0.05} style={{ pointerEvents: 'auto', flex: 1, maxWidth: 220 }} value={settings.sensitivity} onChange={(e) => upd({ sensitivity: +e.target.value })} /></label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}><span>Volume</span><input type="range" min={0} max={1} step={0.05} style={{ pointerEvents: 'auto', flex: 1, maxWidth: 220 }} value={settings.volume} onChange={(e) => upd({ volume: +e.target.value })} /></label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Orbit lines</span><input type="checkbox" style={{ width: 22, height: 22, pointerEvents: 'auto' }} checked={settings.showOrbits} onChange={(e) => upd({ showOrbits: e.target.checked })} /></label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Graphics</span>
              <select className="hd-btn" value={settings.quality} onChange={(e) => upd({ quality: e.target.value as Settings['quality'] })}><option value="high">High</option><option value="low">Low (battery)</option></select></label>
            <div style={{ opacity: 0.55, fontSize: 11 }}>Graphics changes apply from the title screen.</div>
          </div>
        )}
      </div>
    </div>
  );
}
