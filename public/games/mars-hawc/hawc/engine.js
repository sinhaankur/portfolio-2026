import { THREE } from './lib.js?v=18';
import { makePost } from './post.js?v=18';
import { onProgress, resetProgress } from './assets.js?v=18';
import { Sfx } from './audio.js?v=18';
import { GlobeView } from './globe.js?v=18';
import { HangarView } from './hangar.js?v=18';
import { Mission } from './mission.js?v=18';
import { MISSIONS } from './levels.js?v=18';

export async function createEngine({ canvas, dom, emit }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let voices = []; const pickVoices = () => { try { voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); } catch (e) {} };
  try { pickVoices(); speechSynthesis.onvoiceschanged = pickVoices; } catch (e) {}
  const say = (text, { who = 'command', interrupt = false } = {}) => {
    if (!E.voiceOn || E.sfx.muted || typeof speechSynthesis === 'undefined') return;
    try {
      if (interrupt) speechSynthesis.cancel(); else if (speechSynthesis.pending) return;
      const u = new SpeechSynthesisUtterance(text.replace(/\[(\w)\]/g, '$1').replace(/·/g, ','));
      const pref = { command: /Daniel|Google UK English Male|Arthur|Alex|Male/i, pilot: /Samantha|Google US English|Karen|Female/i, narrator: /Daniel|Arthur|Google UK English Male|Fred/i, founder: /Fred|Alex|Aaron/i }[who];
      u.voice = voices.find((v) => pref && pref.test(v.name)) || voices[0] || null;
      u.rate = who === 'narrator' ? 0.92 : 1.04; u.pitch = who === 'narrator' ? 0.8 : who === 'founder' ? 1.15 : 0.92; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  };
  const E = {
    voiceOn: true, say,
    renderer, dom, emit, size: { w: 1, h: 1 }, quality: 1, sfx: new Sfx(),
    input: { keys: new Set(), pressed: new Set(), dx: 0, dy: 0, lmb: false, rmb: false },
    paused: false, locked: false, lockFailed: false,
  };
  const globe = new GlobeView(E), hangar = new HangarView(E);
  let active = null, mission = null, raf = 0, wd = 0, last = performance.now(), dead = false;
  const offProg = onProgress((p) => emit('progress', p));

  let post = null; makePost(renderer).then((p) => { post = p; resize(); });
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    E.size.w = w; E.size.h = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false); post?.setSize(w, h, renderer.getPixelRatio());
    for (const v of [globe, hangar, mission]) v?.resize?.(w, h);
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  const loop = (t) => {
    if (dead) return;
    cancelAnimationFrame(raf); clearTimeout(wd);
    raf = requestAnimationFrame(loop); wd = setTimeout(() => loop(performance.now()), 200);
    t = performance.now(); E.frames = (E.frames || 0) + 1;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    tick(dt);
  };
  const tick = (dt) => {
    if (!active) return;
    if (active === mission) { if (!E.paused) mission.update(dt); else { E.input.dx = E.input.dy = 0; } }
    else active.update(dt);
    if (active === mission) { E.input.dx = 0; E.input.dy = 0; }
    if (active === mission && post && (E.quality ?? 1) > 0.7 && mission.state !== 'loading') post.render(mission.scene, mission.camera, dt, mission.world?.night || 0);
    else renderer.render(active.scene, active.camera);
  };
  setTimeout(() => loop(performance.now()), 0);
  window.__hawc = { E, globe, hangar, renderer, step: (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); }, get active() { return active; }, get mission() { return mission; } };

  const inMission = () => active === mission && mission && !E.paused;
  const onKey = (down) => (ev) => {
    if (!inMission()) return;
    const c = ev.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) ev.preventDefault();
    if (down) { if (c === 'Escape' || c === 'KeyP') { api.pause(); return; } if (c === 'KeyM') { api.setMuted(!E.sfx.muted); emit('muted', E.sfx.muted); } if (!E.input.keys.has(c)) E.input.pressed.add(c); E.input.keys.add(c); }
    else E.input.keys.delete(c);
  };
  const kd = onKey(true), ku = onKey(false);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const blur = () => { E.input.keys.clear(); E.input.lmb = E.input.rmb = false; };
  window.addEventListener('blur', blur);

  let drag = null;
  const onMove = (ev) => {
    if (active === mission) {
      if (document.pointerLockElement === canvas || (E.lockFailed && inMission())) { E.input.dx += ev.movementX || 0; E.input.dy += ev.movementY || 0; }
      return;
    }
    if (drag) { const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY; active?.drag?.(dx, dy); }
  };
  const onDown = (ev) => {
    E.sfx.init();
    if (active === mission) {
      if (!inMission()) return;
      if (document.pointerLockElement !== canvas && !E.lockFailed) { api.requestLock(); return; }
      if (ev.button === 0) { E.input.lmb = true; E.input.pressed.add('lmb'); }
      if (ev.button === 2) { E.input.rmb = true; E.input.pressed.add('rmb'); }
      return;
    }
    drag = { x: ev.clientX, y: ev.clientY }; canvas.style.cursor = 'grabbing';
  };
  const onUp = (ev) => { if (ev.button === 0) E.input.lmb = false; if (ev.button === 2) E.input.rmb = false; drag = null; if (active !== mission) canvas.style.cursor = 'grab'; };
  const onWheel = (ev) => { if (active && active !== mission) { active.zoom?.(ev.deltaY); } };
  const onCtx = (ev) => ev.preventDefault();
  canvas.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: true }); canvas.addEventListener('contextmenu', onCtx);
  const onLock = () => {
    E.locked = document.pointerLockElement === canvas; emit('lock', E.locked);
    if (!E.locked && active === mission && mission && !E.paused && mission.state !== 'end') api.pause();
  };
  const onLockErr = () => { E.lockFailed = true; emit('lock', false); emit('lockfail', true); };
  document.addEventListener('pointerlockchange', onLock); document.addEventListener('pointerlockerror', onLockErr);

  const setActive = (v, exposure = 1) => { active = v; renderer.toneMappingExposure = exposure; canvas.style.cursor = v === mission ? 'crosshair' : 'grab'; resize(); };
  const clearMission = () => { E.sfx?.hum?.(0); if (mission) { mission.dispose(); mission = null; } E.input.keys.clear(); E.input.pressed.clear(); };

  const api = {
    missions: MISSIONS,
    async showMenu() { await globe.load(); globe.setMode('menu'); setActive(globe); },
    async showSelect(id) { await globe.load(); globe.setMode('select'); if (id) globe.focus(id); setActive(globe); },
    focusSite(id) { globe.focus(id); },
    hideSites() { globe.hideMarkers(); },
    async showHangar(type, livery) { globe.hideMarkers(); hangar.load(); setActive(hangar); await hangar.show(type, livery); },
    async showAsset(id) { globe.hideMarkers(); hangar.load(); setActive(hangar); await hangar.showAsset(id); },
    hangarPlay(name) { hangar.play(name); },
    hangarTeardown(on) { return hangar.setTeardown(on); },
    async startMission(id, opts) {
      clearMission(); globe.hideMarkers(); resetProgress();
      const L = typeof id === 'object' ? id : MISSIONS.find((m) => m.id === id);
      emit('progress', { p: 0, label: 'Building ' + L.site });
      const m = L.type === 'flight' ? new (await import('./flight.js?v=18')).FlightMission(E, L, opts) : new Mission(E, L, opts); mission = m;
      await m.load();
      if (mission !== m) return;
      E.paused = false; setActive(m, m.world.exposure); m.resize(E.size.w, E.size.h);
      emit('started', { id, flight: L.type === 'flight' });
    },
    pause() { if (!mission || E.paused) return; E.paused = true; E.input.keys.clear(); E.input.lmb = E.input.rmb = false; if (document.pointerLockElement) document.exitPointerLock(); emit('pause', true); },
    resume() { if (!mission) return; E.paused = false; emit('pause', false); api.requestLock(); },
    requestLock() {
      if (E.lockFailed) return;
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => onLockErr()); } catch (e) { onLockErr(); }
    },
    async quitMission() { clearMission(); E.paused = false; if (document.pointerLockElement) document.exitPointerLock(); E.sfx.wind(0); await api.showSelect(globe.selected); },
    setView(v) { if (mission) mission.view = v === 'fp' ? 'fp' : 'tp'; },
    setMuted(m) { E.sfx.setMuted(m); },
    setCompleted(ids) { globe.setCompleted(ids); },
    async setSites(list) { await globe.load(); globe.setSites(list); },
    setVoice(v) { E.voiceOn = v; if (!v) try { speechSynthesis.cancel(); } catch (e) {} },
    say(t, o) { E.say(t, o); }, hush() { try { speechSynthesis.cancel(); } catch (e) {} },
    setOptions(o) { if (mission) Object.assign(mission.opts, o); },
    setQuality(q) { E.quality = q; },
    uiSound(k) { try { E.sfx.init(); E.sfx[k]?.(); } catch (er) {} },
    dispose() {
      dead = true; cancelAnimationFrame(raf); clearTimeout(wd); ro.disconnect(); offProg();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      document.removeEventListener('pointerlockchange', onLock); document.removeEventListener('pointerlockerror', onLockErr);
      clearMission(); renderer.dispose();
    },
  };
  return api;
}
