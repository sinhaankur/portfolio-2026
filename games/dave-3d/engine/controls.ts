/**
 * Input state for Dave 3D — keyboard + on-screen touch, read each frame by the
 * player controller. A tiny module-scoped store (no React re-renders in the hot
 * loop), with a `bindKeyboard()` for desktop and setters the touch buttons call.
 */

export type InputState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  jump: boolean
  /** edge-trigger: true for the single frame a jump was pressed */
  jumpPressed: boolean
}

export const input: InputState = {
  forward: false, back: false, left: false, right: false, jump: false, jumpPressed: false,
}

let _jumpWasDown = false
/** Call once per frame (after reading) to compute the jump edge. */
export function tickInput() {
  input.jumpPressed = input.jump && !_jumpWasDown
  _jumpWasDown = input.jump
}

const KEYMAP: Record<string, keyof InputState> = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "back", ArrowDown: "back",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  Space: "jump",
}

/** Attach keyboard listeners; returns a cleanup fn. */
export function bindKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code]
    if (!k) return
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault()
    ;(input as Record<string, boolean>)[k] = true
  }
  const up = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code]
    if (k) (input as Record<string, boolean>)[k] = false
  }
  const blur = () => {
    input.forward = input.back = input.left = input.right = input.jump = false
  }
  window.addEventListener("keydown", down)
  window.addEventListener("keyup", up)
  window.addEventListener("blur", blur)
  return () => {
    window.removeEventListener("keydown", down)
    window.removeEventListener("keyup", up)
    window.removeEventListener("blur", blur)
  }
}

/** Touch buttons call this. */
export function setInput(key: keyof InputState, value: boolean) {
  ;(input as Record<string, boolean>)[key] = value
}

export function resetInput() {
  input.forward = input.back = input.left = input.right = input.jump = false
  input.jumpPressed = false
  _jumpWasDown = false
}
