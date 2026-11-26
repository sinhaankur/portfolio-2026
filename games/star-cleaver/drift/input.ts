/**
 * Input: keyboard + mouse (virtual-stick flight), gamepad (Steam-ready layout)
 * and touch (set by the on-screen controls). Produces one Controls per frame.
 */
import { emptyControls, type Controls } from './sim';
import type { Settings } from './runtime';

export type InputMode = 'kbm' | 'pad' | 'touch';

export class InputManager {
  keys = new Set<string>();
  private pressed = new Set<string>(); // edge-triggered this frame
  mouse = { x: 0, y: 0, buttons: 0, inside: false };
  /** virtual stick in [-1,1]², driven by mouse movement while pointer-locked */
  stick = { x: 0, y: 0 };
  locked = false;
  mode: InputMode = 'kbm';
  touch = { steerX: 0, steerY: 0, fire: false, boost: false, throttle: null as number | null };
  private touchEdges = new Set<string>();
  private padPrev: boolean[] = [];
  private el: HTMLElement | null = null;
  settings: Settings;
  enabled = true;
  /** coarse-pointer device: taps send synthetic mouse events — ignore them for mode/lock */
  touchDevice = false;
  /** becomes true if a pointer-lock request is refused */
  allowFreeMouse = false;
  onPause: (() => void) | null = null;
  onMap: (() => void) | null = null;
  /** fired when the browser drops pointer lock on its own (Esc) */
  onUnlock: (() => void) | null = null;

  constructor(settings: Settings) { this.settings = settings; }

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', this.blur);
    el.addEventListener('mousemove', this.mm);
    el.addEventListener('mousedown', this.md);
    window.addEventListener('mouseup', this.mu);
    el.addEventListener('contextmenu', this.cm);
    document.addEventListener('pointerlockchange', this.plc);
    document.addEventListener('pointerlockerror', this.ple);
    el.addEventListener('mouseenter', this.me);
    el.addEventListener('mouseleave', this.ml);
  }

  detach() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('mouseup', this.mu);
    document.removeEventListener('pointerlockchange', this.plc);
    document.removeEventListener('pointerlockerror', this.ple);
    const el = this.el;
    if (el) {
      el.removeEventListener('mousemove', this.mm);
      el.removeEventListener('mousedown', this.md);
      el.removeEventListener('contextmenu', this.cm);
      el.removeEventListener('mouseenter', this.me);
      el.removeEventListener('mouseleave', this.ml);
    }
    this.releaseLock();
  }

  requestLock() {
    if (!this.el || this.locked) return;
    try {
      const p = this.el.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => { this.allowFreeMouse = true; });
    } catch { /* unsupported */ }
  }
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  private kd = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.code;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (!this.keys.has(k)) this.pressed.add(k);
    this.keys.add(k);
    if (this.mode !== 'touch' || /^Key[WASDQE]$|^Arrow/.test(k)) this.mode = 'kbm';
    if (k === 'Escape' || k === 'KeyP') this.onPause?.();
    if (k === 'KeyM') this.onMap?.();
  };
  private ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private blur = () => { this.keys.clear(); this.mouse.buttons = 0; };
  private me = () => { this.mouse.inside = true; };
  private ml = () => { this.mouse.inside = false; };
  private mm = (e: MouseEvent) => {
    if (this.touchDevice && !this.locked) return;
    this.mode = 'kbm';
    if (this.locked) {
      const s = 0.0026 * this.settings.sensitivity;
      this.stick.x = Math.max(-1, Math.min(1, this.stick.x + e.movementX * s));
      this.stick.y = Math.max(-1, Math.min(1, this.stick.y + e.movementY * s));
      const l = Math.hypot(this.stick.x, this.stick.y);
      if (l > 1) { this.stick.x /= l; this.stick.y /= l; }
    } else if (this.el) {
      const r = this.el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    }
  };
  private md = (e: MouseEvent) => {
    if (this.touchDevice) return;
    this.mode = 'kbm';
    this.mouse.buttons |= 1 << e.button;
    if (e.button === 2) this.pressed.add('Mouse2');
    if (!this.locked && e.button === 0 && this.enabled) this.requestLock();
  };
  private mu = (e: MouseEvent) => { this.mouse.buttons &= ~(1 << e.button); };
  private cm = (e: Event) => e.preventDefault();
  private ple = () => { this.allowFreeMouse = true; };
  private plc = () => {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.el;
    if (!this.locked) { this.stick.x = 0; this.stick.y = 0; if (was) this.onUnlock?.(); }
  };

  touchPress(name: 'torpedo' | 'cruise' | 'dock' | 'target' | 'stop') { this.touchEdges.add(name); this.mode = 'touch'; }

  /** Recentre the virtual stick (e.g. after docking or the map). */
  centre() { this.stick.x = 0; this.stick.y = 0; }

  private curve(v: number, dead = 0.06) {
    const a = Math.abs(v);
    if (a < dead) return 0;
    const t = (a - dead) / (1 - dead);
    return Math.sign(v) * Math.pow(t, 1.5);
  }

  poll(): Controls {
    const c = emptyControls();
    if (!this.enabled) { this.pressed.clear(); this.touchEdges.clear(); return c; }
    const k = this.keys;
    const inv = this.settings.invertY ? -1 : 1;

    // ---- keyboard + mouse
    let pitch = 0, yaw = 0;
    if (this.locked) { yaw = -this.curve(this.stick.x); pitch = -this.curve(this.stick.y) * inv; }
    else if (this.mouse.inside && this.mode === 'kbm' && this.allowFreeMouse) {
      // pointer lock refused (iframe / browser policy): steer by cursor position instead
      yaw = -this.curve(this.mouse.x, 0.14); pitch = -this.curve(this.mouse.y, 0.14) * inv;
    }
    if (k.has('ArrowLeft')) yaw += 1;
    if (k.has('ArrowRight')) yaw -= 1;
    if (k.has('ArrowUp')) pitch -= 1 * inv;
    if (k.has('ArrowDown')) pitch += 1 * inv;
    c.pitch = pitch; c.yaw = yaw;
    c.roll = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    c.strafeX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    c.strafeY = (k.has('KeyR') ? 1 : 0) - (k.has('KeyV') ? 1 : 0);
    c.throttleDelta = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    c.allStop = this.pressed.has('KeyX');
    c.boost = k.has('ShiftLeft') || k.has('ShiftRight');
    c.fire = !!(this.mouse.buttons & 1 && (this.locked || this.allowFreeMouse)) || k.has('Space');
    c.torpedo = this.pressed.has('Mouse2') || this.pressed.has('KeyG');
    c.cruise = this.pressed.has('KeyC');
    c.dock = this.pressed.has('KeyF');
    c.targetNearest = this.pressed.has('KeyT');
    c.cycleTarget = this.pressed.has('Tab');
    c.cycleNav = this.pressed.has('KeyN') ? 1 : this.pressed.has('KeyB') ? -1 : 0;

    // ---- gamepad (standard mapping)
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    if (pad) {
      const ax = (i: number) => pad.axes[i] ?? 0;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const val = (i: number) => pad.buttons[i]?.value ?? 0;
      const edge = (i: number) => btn(i) && !this.padPrev[i];
      const any = pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a) > 0.25);
      if (any) this.mode = 'pad';
      if (this.mode === 'pad') {
        c.yaw = -this.curve(ax(0), 0.12);
        c.pitch = -this.curve(ax(1), 0.12) * inv;
        c.strafeX = this.curve(ax(2), 0.18);
        c.throttleDelta = -this.curve(ax(3), 0.18);
        c.roll = (btn(4) ? 1 : 0) - (btn(5) ? 1 : 0);
        c.fire = val(7) > 0.35;
        c.boost = val(6) > 0.35;
        c.dock = edge(0);
        c.allStop = edge(1);
        c.cruise = edge(2);
        c.targetNearest = edge(3);
        c.torpedo = edge(11) || edge(10);
        c.cycleNav = edge(15) ? 1 : edge(14) ? -1 : 0;
        if (edge(12)) this.onMap?.();
        if (edge(9)) this.onPause?.();
      }
      this.padPrev = pad.buttons.map((b) => b.pressed);
    }

    // ---- touch
    if (this.mode === 'touch') {
      c.yaw = -this.curve(this.touch.steerX, 0.08);
      c.pitch = -this.curve(this.touch.steerY, 0.08) * inv;
      c.fire = this.touch.fire;
      c.boost = this.touch.boost;
      if (this.touch.throttle != null) c.throttleSet = this.touch.throttle;
      const e = this.touchEdges;
      c.torpedo = e.has('torpedo'); c.cruise = e.has('cruise'); c.dock = e.has('dock'); c.targetNearest = e.has('target'); c.allStop = e.has('stop');
    }

    this.pressed.clear();
    this.touchEdges.clear();
    return c;
  }
}
