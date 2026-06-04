# Star Cleaver AAA Component Standards

This document defines production-grade standards for Star Cleaver.

Note: This is an AAA-style standard inspired by widely used game-industry practices for open-world and action games. It is not a reverse-engineered proprietary GTA implementation.

## 1. Core Rule

Every section and component must satisfy all four gates:

1. Design readability gate
2. Performance budget gate
3. Input/response gate
4. QA regression gate

A feature is not complete until all four pass.

## 2. Component Contract

Each gameplay component must declare:

1. Purpose: one sentence describing player-facing intent
2. Inputs: user input, game state, metadata dependencies
3. Outputs: state writes and visual/audio effects
4. Budgets: CPU, GPU, memory, and frame-time impact
5. Failure modes: what can break and fallback behavior

## 3. Performance Standards

## 3.1 Frame Targets

1. Desktop high tier: sustain 60 FPS at 1080p target
2. Desktop ultra tier: sustain 60 FPS with no frame spikes over 25 ms
3. Mobile/touch mode: sustain stable 30+ FPS with no camera hitching

## 3.2 Budget Rules

1. No per-frame object allocation in hot loops
2. Reuse vectors/quaternions/material refs in useFrame
3. Bound particle counts by graphics profile
4. Keep additive/transparency layers minimal in central view cone

## 3.3 Camera Stability

1. Camera profile values must come from centralized tuning maps
2. No scattered magic numbers in camera logic
3. Flight, briefing, and inspect phases use explicit profiles

## 4. Input and Flight Feel Standards

1. Inputs must produce visible response within 1 frame under normal load
2. Brake-to-stop must be deterministic and testable
3. Flight assist ON and OFF must have clearly distinct dynamics
4. Keyboard, mouse, and touch controls must have equivalent intent mapping

## 5. Visual Standards

1. Unified scale contract for ship, station, and orbital placement
2. Material coherence: hull, station, and VFX must share a defined style language
3. Glow and bloom must not wash out silhouette readability
4. Foreground contrast must preserve target readability at all camera distances

## 6. HUD and UX Standards

1. Critical info visible within 200 ms scan:
   - Speed
   - Heading
   - Assist mode
   - Throttle/brake state
   - Hazard severity
2. Text density must stay low in active flight mode
3. Mobile hints must be concise and action-first
4. Debug overlays must be optional and not overlap primary affordances

## 7. Audio Standards

1. Engine audio tied to speed + throttle + boost with smooth interpolation
2. No clipping or abrupt gain jumps during assist toggles/boost transitions
3. Important events have unique chimes and clear priority hierarchy

## 8. Asset Standards

1. Model orientation and gameplay forward axis must be aligned by contract
2. Texture detail should avoid flat surfaces while keeping memory controlled
3. Authoring assumptions (scale, axis, pivots) must be documented in-engine

## 9. QA Standards

Each merged change should pass:

1. Build success (pnpm build)
2. Zero diagnostics in touched files
3. Visual check in:
   - Briefing/station inspect
   - Ignition
   - Exploration
4. Control check:
   - Assist ON vs OFF behavior
   - Brake-to-stop from cruise speed

## 10. Definition of Done for Any New Section

A section is done only when:

1. It uses centralized tuning/contracts (no duplicate constants)
2. It passes perf and readability budgets
3. It includes fallback behavior
4. It survives the QA checklist without regressions

## 11. Rollout Sequence

1. Scale and camera contracts (completed baseline)
2. Flight dynamics and assist behavior hardening
3. HUD readability and affordance cleanup
4. Station/mission scene detail + contrast balancing
5. Performance profiling and budget locks per graphics tier

## 12. Current Ownership Map

1. Flight dynamics and camera: games/star-cleaver/engine/game-canvas.tsx
2. HUD clarity and affordance: games/star-cleaver/engine/hud.tsx
3. Ship material/scale contracts: games/star-cleaver/engine/player-ship-model.tsx
4. Mission orbital layout: games/star-cleaver/engine/mission-layout.ts

Use this file as the quality contract before implementing or reviewing any Star Cleaver component change.
