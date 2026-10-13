// Dave — keyboard + touch input. Translates events into engine calls.
//
//   import { bindKeyboard, bindTouch } from './input.js';
//   const unbind = bindKeyboard(game, window);

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
export function bindKeyboard(game, target = window) {
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
export function bindTouch(game, els) {
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
export function createSfx() {
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
