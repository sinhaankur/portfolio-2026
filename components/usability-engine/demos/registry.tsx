"use client"

/**
 * Demo registry — central lookup from DemoKey to React component.
 *
 * Each interactive demo lives in its own file under `demos/<name>.tsx`
 * and is registered here under a stable string key. Heuristics in
 * `heuristics.ts` reference a key; the HeuristicCard component looks
 * up the renderer here. Adding a new demo is two steps:
 *   1. write demos/<name>.tsx exporting a component
 *   2. add an entry below
 */

import type { ComponentType } from "react"
import type { DemoKey } from "../types"
import { VisibilityStatusDemo } from "./visibility-status-demo"
import { ErrorPreventionDemo } from "./error-prevention-demo"
import { UndoDemo } from "./undo-demo"
import { RecognitionDemo } from "./recognition-demo"

export const demoRegistry: Record<DemoKey, ComponentType> = {
  "visibility-status": VisibilityStatusDemo,
  "error-prevention": ErrorPreventionDemo,
  undo: UndoDemo,
  recognition: RecognitionDemo,
}
