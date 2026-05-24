# Star Cleaver Neural Game Engine

## Structure

```
lib/neural-game-engine/
  ├── types.ts              # Core game types
  ├── entity-manager.ts     # Entity registry + queries
  ├── collision-system.ts   # Raycaster-based hitscan + proximity
  ├── game-loop.ts          # Main update loop, phase machine
  ├── ai-agent.ts           # Claude-powered NPC decisions
  └── index.ts              # Exports

lib/ship-generator/
  ├── procedural-ships.ts   # Seed-based ship generation
  └── index.ts              # Exports

games/star-cleaver/engine/
  ├── worlds.ts             # 7 defending worlds + wave configs
  ├── enemies.ts            # Enemy archetypes + AI wiring
  ├── game-state.ts         # Star Cleaver state helpers
  └── game-canvas.tsx       # React integration point
```

## Key Systems

### 1. Entity Manager
Registry for all game objects (ships, projectiles, explosions).
- `register()` — add entity
- `proximityQuerySorted()` — get nearby entities
- `getByTeam()` — filter by team

### 2. Collision System
Three.js Raycaster-based hit detection.
- `hitscan()` — fire a ray, return hits
- `sphereOverlap()` — area overlap test
- `hasLineOfSight()` — visibility check

### 3. Game Loop
Main frame-by-frame update.
- `update(deltaTime)` — runs game logic, phase machine
- Phases: `title → briefing → combat ↔ charging → firing → victory → upgrade`
- Handles leaks, wave completion, damage resolution

### 4. Neural Agent
Claude API integration for enemy AI.
- `decide(context)` — returns `ActionCommand`
- Uses prompt caching for cost efficiency
- System prompts for `fighter`, `sniper`, `swarm`, `boss`

### 5. Ship Generator
Procedural 3D ship creation from primitives.
- No external models, 100% Three.js
- Seed-based for determinism + variety
- Factions: `player`, `alien_basic`, `alien_sniper`, `alien_swarm`, `boss`

## Wiring to React/Next.js

The `game-canvas.tsx` component is the entry point. To mount it:

```tsx
import GameCanvas from '@/games/star-cleaver/engine/game-canvas';

export default function GamePage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GameCanvas />
    </div>
  );
}
```

## Gameplay Feel

The engine is designed to feel smooth and responsive:
- Physics: Simple Euler integration + drag for "floaty" feel (adjustable)
- Controls: WASD (movement, from Universe Engine), Arrow keys (aim), Space (fire charge)
- Movement: Smooth lerping via `k = 1 - exp(-delta * rate)` pattern
- Rendering: Procedural ships + real Universe Engine star field for authenticity

## Next Steps

1. **Polish rendering**: Replace placeholder sphere meshes with actual procedural ships
2. **Audio**: Add Tone.js sound effects (reuse from Emoji Tetris)
3. **HUD**: Build health bar, wave counter, score, charge meter UI
4. **AI tuning**: Test Claude decisions, adjust system prompts for challenging gameplay
5. **Mobile**: Add touch aiming + fire button, test on ≤640px
6. **Deployment**: Move to `cleaver.sinhaankur.com` or integrate into portfolio `/games/`

## Testing Checklist

- [ ] Game loop runs, entities update position
- [ ] Collision detection works (fire projectile, hits enemy)
- [ ] Enemies spawn, health decreases when hit
- [ ] Wave completes when all enemies destroyed
- [ ] Leaks damage planet health
- [ ] Claude API calls work (check logs, API usage)
- [ ] Ship generation creates variety
- [ ] Mobile controls responsive
- [ ] No visual overlaps (halos, ships clipping)
