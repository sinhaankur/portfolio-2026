/**
 * React 19's JSX types claim the lowercase <line> element for SVG, which
 * clobbers R3F's THREE.Line element typing (`geometry` etc. stop
 * type-checking). Registering the same class under a non-colliding name
 * (<threeLine>) restores real typing; runtime output is identical.
 */
import { extend, type ThreeElement } from "@react-three/fiber"
import { Line } from "three"

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeLine: ThreeElement<typeof Line>
  }
}

extend({ ThreeLine: Line })
