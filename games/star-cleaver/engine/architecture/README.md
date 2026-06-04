# Helion Drift Mission Director Architecture

This folder contains high-level runtime orchestration utilities used to keep
mission flow and phase behavior centralized.

## Goals

1. Avoid scattered phase checks across rendering/input systems.
2. Keep pre-launch, ignition, and flight transitions deterministic.
3. Provide a single source of truth for game flow rules.

## Current Components

1. `mission-director.ts`
   - Canonical phase helpers
   - Station-inspect eligibility checks
   - Ignition to exploration transition guard
   - Pause state toggle policy

## Intended Expansion

1. Director-level event orchestration (mission events, world-state triggers)
2. System update ordering contracts (input, simulation, presentation)
3. Mode-specific rule sets (briefing, transit, combat)

This structure mirrors AAA-style separation between game-state policy and
view/input implementation without coupling to proprietary game internals.
