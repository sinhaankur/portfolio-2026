'use client';
/**
 * Helion Drift — root component. Title screen over a live scene, then
 * flight, docking, map and pause. Mount it full-screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { DriftSim, loadSave, clearSave } from './sim';
import { InputManager } from './input';
import { AudioEngine } from './audio';
import { loadSettings, type Runtime, type Settings } from './runtime';
import { DriftScene } from './scene';
import { Hud, HUD_CSS, StationScreen, PauseMenu } from './hud';

type Screen = 'title' | 'flight';

function makeRuntime(settings: Settings, fresh: boolean, prev?: Runtime): Runtime {
  const save = fresh ? null : loadSave();
  const input = prev?.input ?? new InputManager(settings);
  const audio = prev?.audio ?? new AudioEngine();
  audio.volume = settings.volume;
  return {
    sim: new DriftSim(save), input, audio, fx: null, camera: null, origin: new THREE.Vector3(), shake: 0, shieldFlash: 0,
    settings, hudEvents: [], viewport: { w: 1, h: 1 }, fps: 60,
  };
}

export default function HelionDrift({ onReady, onExit }: { onReady?: () => void; onExit?: () => void }) {
  const [hasSave] = useState(() => !!loadSave());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [session, setSession] = useState(0);
  const rtRef = useRef<Runtime | null>(null);
  if (!rtRef.current) rtRef.current = makeRuntime(settings, false);
  const rt = rtRef.current;
  const [screen, setScreen] = useState<Screen>('title');
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [docked, setDocked] = useState<boolean>(true);
  const wrap = useRef<HTMLDivElement>(null);
  const readySent = useRef(false);
  const touch = useMemo(() => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false), []);

  // input wiring
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    if (touch) { rt.input.mode = 'touch'; rt.input.touchDevice = true; }
    rt.input.attach(el);
    return () => rt.input.detach();
  }, [rt, touch]);

  const flying = screen === 'flight' && !paused && !mapOpen && !docked;
  useEffect(() => {
    rt.input.enabled = flying;
    rt.sim.paused = screen === 'flight' && (paused || mapOpen);
    if (!flying) rt.input.releaseLock();
  }, [rt, flying, screen, paused, mapOpen]);

  useEffect(() => {
    rt.input.onPause = () => { if (screen === 'flight' && !docked) { if (mapOpen) setMapOpen(false); else setPaused((p) => !p); } };
    rt.input.onMap = () => { if (screen === 'flight' && !docked && !paused) setMapOpen((m) => !m); };
    rt.input.onUnlock = () => { if (screen === 'flight' && !docked && !mapOpen) setPaused(true); };
  }, [rt, screen, docked, mapOpen, paused]);

  // follow docked state from the sim
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = !!rt.sim.ship.dockedAt;
      setDocked((cur) => (cur === d ? cur : d));
    }, 150);
    return () => window.clearInterval(id);
  }, [rt, session]);

  // pause when the tab is hidden; save on the way out
  useEffect(() => {
    const vis = () => { if (document.hidden) { if (screen === 'flight' && !docked) setPaused(true); rt.audio.suspend(); } else rt.audio.resume(); };
    const unload = () => { if (screen === 'flight' && rt.sim.ship.dockedAt) rt.sim.persist(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('beforeunload', unload);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('beforeunload', unload); };
  }, [rt, screen, docked]);

  useEffect(() => () => rt.audio.dispose(), [rt]);

  const start = useCallback((fresh: boolean) => {
    rt.audio.start();
    if (fresh) {
      clearSave();
      rtRef.current = makeRuntime(settings, true, rt);
      setSession((s) => s + 1);
    } else if (settings.quality !== rt.settings.quality) {
      rtRef.current = makeRuntime(settings, false, rt);
      setSession((s) => s + 1);
    }
    setScreen('flight');
    setPaused(false);
    rt.audio.blip('ui');
  }, [rt, settings]);

  const launch = useCallback(() => {
    const r = rtRef.current!;
    r.audio.start();
    r.sim.undock();
    r.input.centre();
    setDocked(false);
    if (!touch) r.input.requestLock();
  }, [touch]);

  const resume = useCallback(() => {
    setPaused(false);
    if (!touch) rtRef.current!.input.requestLock();
  }, [touch]);

  const quit = useCallback(() => {
    const r = rtRef.current!;
    if (r.sim.ship.dockedAt) r.sim.persist();
    setPaused(false);
    setMapOpen(false);
    setScreen('title');
  }, []);

  const current = rtRef.current!;
  // QA hook — only with ?hd-debug in the URL (used by automated play-tests)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('hd-debug')) (window as unknown as { __hd: Runtime }).__hd = current;
  }, [current]);
  const onFrame = useCallback(() => {
    current.onFrameHud?.();
    if (!readySent.current) { readySent.current = true; onReady?.(); }
  }, [current, onReady]);

  const save = current.sim.save;
  return (
    <div ref={wrap} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000', overflow: 'hidden', touchAction: 'none' }}>
      <style>{HUD_CSS}</style>
      <Canvas
        key={session}
        gl={{ logarithmicDepthBuffer: true, antialias: current.settings.quality === 'high', powerPreference: 'high-performance', alpha: false }}
        dpr={current.settings.quality === 'high' ? [1, 2] : [0.7, 1.25]}
        camera={{ fov: 62, near: 0.3, far: 6e6, position: [0, 3, 14] }}
        onCreated={({ gl }) => { gl.setClearColor('#000000'); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <DriftScene rt={current} onFrame={onFrame} />
      </Canvas>

      {screen === 'title' && (
        <div className="hd-root" style={{ pointerEvents: 'auto' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(4,3,2,.88) 0%, rgba(4,3,2,.5) 45%, rgba(4,3,2,0) 75%)' }} />
          <div style={{ position: 'absolute', left: 'max(20px, 6vw)', top: '50%', transform: 'translateY(-50%)', maxWidth: 520 }}>
            <div className="hd-label" style={{ color: '#e2a516' }}>Ankur Sinha · Lab</div>
            <h1 className="hd-h1" style={{ fontSize: 'clamp(44px, 8vw, 84px)', lineHeight: 0.95, margin: '10px 0 14px' }}>Helion Drift</h1>
            <p style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', letterSpacing: 0, fontSize: 16, lineHeight: 1.6, opacity: 0.85, margin: '0 0 22px' }}>
              Fly the real Solar System — every planet where it is today. Refuel at stations, survey worlds, mine the belt, and take down the hostile bases hiding in the rubble.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {hasSave && <button className="hd-btn primary" onClick={() => start(false)}>Continue · {save.credits.toLocaleString()} cr</button>}
              <button className={`hd-btn${hasSave ? '' : ' primary'}`} onClick={() => start(true)}>{hasSave ? 'New game' : 'Start'}</button>
              {onExit && <button className="hd-btn" onClick={onExit}>Back to the Lab</button>}
            </div>
            <div style={{ marginTop: 22, opacity: 0.6, lineHeight: 1.8 }}>
              {touch ? 'Touch controls · works with a gamepad too' : 'Mouse + keyboard · or plug in a gamepad'} · saves when you dock
            </div>
          </div>
        </div>
      )}

      {screen === 'flight' && (
        <>
          <Hud rt={current} onPause={() => setPaused(true)} onOpenMap={() => setMapOpen(true)} mapOpen={mapOpen} onCloseMap={() => setMapOpen(false)} touch={touch} />
          {docked && !paused && <div className="hd-root"><StationScreen key={session} rt={current} onLaunch={launch} /></div>}
          {paused && <div className="hd-root"><PauseMenu rt={current} settings={settings} setSettings={setSettings} onResume={resume} onQuit={quit} /></div>}
        </>
      )}
    </div>
  );
}
