import type { GameState, GameEntity, ActionCommand, GameEvent } from './types';
import type { EntityManager } from './entity-manager';
import type { CollisionSystem } from './collision-system';

/**
 * Game Loop: Core simulation step for defender game.
 * Pure TypeScript, consumed by React via hooks.
 *
 * Pattern: Single update function called every frame.
 * Driven by R3F's useFrame, respects timeWarpRef.current.
 */
export class GameLoop {
  private entityManager: EntityManager;
  private collisionSystem: CollisionSystem;
  private gameState: GameState;

  constructor(entityManager: EntityManager, collisionSystem: CollisionSystem, initialState: GameState) {
    this.entityManager = entityManager;
    this.collisionSystem = collisionSystem;
    this.gameState = initialState;
  }

  /**
   * Keep simulation state aligned with external UI state transitions.
   * This prevents the loop from running on a stale snapshot when React
   * has already moved phases (e.g. briefing -> ignition).
   */
  setState(nextState: GameState) {
    this.gameState = nextState;
  }

  /**
   * Main update loop: call once per frame from useFrame.
   *
   * @param deltaTime Frame delta in seconds (already scaled by time warp)
   * @param updateAI Optional: callback to get AI actions for enemies
   */
  update(
    deltaTime: number,
    updateAI?: (
      entity: GameEntity,
      context: { gameState: GameState; entityManager: EntityManager }
    ) => Promise<ActionCommand>
  ): GameState {
    this.gameState.simTime += deltaTime;

    // --- Phase-specific logic ---
    switch (this.gameState.phase) {
      case 'ignition':
        this.updateIgnition(deltaTime);
        break;
      case 'combat':
        this.updateCombat(deltaTime, updateAI);
        break;
      case 'charging':
        this.updateCharging(deltaTime);
        break;
      case 'firing':
        this.updateFiring(deltaTime);
        break;
      case 'victory':
        this.updateVictory(deltaTime);
        break;
      case 'defeat':
        this.updateDefeat(deltaTime);
        break;
      case 'briefing':
        // Briefing is UI-only, no gameplay
        break;
      case 'title':
        // Title screen, no gameplay
        break;
      case 'upgrade':
        // Upgrade screen, no gameplay
        break;
      case 'paused':
        // Paused, no updates
        break;
    }

    // Return a fresh state reference so React state updates are not skipped
    // when internal simulation mutates the same object in place.
    return {
      ...this.gameState,
    };
  }

  /**
   * Ignition phase: ship startup sequence.
   * Auto-transitions to combat after sequence completes.
   */
  private updateIgnition(deltaTime: number) {
    const ignitionDuration = 3.5; // seconds
    const elapsed = this.gameState.simTime - (this.gameState.ignitionStartTime ?? 0);

    // Allow player to practice flight controls during ignition
    this.updateEntity(this.gameState.playerEntity, deltaTime);

    // Auto-transition to combat when ignition completes
    if (elapsed > ignitionDuration) {
      this.gameState.phase = 'combat';
      this.gameState.waveStartTime = this.gameState.simTime;
    }
  }

  /**
   * Combat phase: main gameplay loop.
   */
  private updateCombat(deltaTime: number, updateAI?: any) {
    // Update player position/velocity
    this.updateEntity(this.gameState.playerEntity, deltaTime);

    // Update enemies with basic AI movement
    this.gameState.enemies.forEach((enemy) => {
      if (!enemy.active) return;

      // Basic enemy AI: move toward player or planet based on type
      const playerPos = this.gameState.playerEntity.position;
      const enemyPos = enemy.position;

      // Calculate direction to player
      const distToPlayer = Math.sqrt(
        (playerPos.x - enemyPos.x) ** 2 +
        (playerPos.y - enemyPos.y) ** 2 +
        (playerPos.z - enemyPos.z) ** 2
      );

      // Different behaviors based on enemy type
      const enemyType = (enemy.metadata?.type as string) || 'fighter';
      const moveSpeed = enemy.metadata?.speed ?? 8;

      if (enemyType === 'swarm') {
        // Swarm: go straight for planet at (0, 0, -20)
        const targetPos = { x: 0, y: 0, z: -20 };
        const dir = this.getDirection(enemyPos, targetPos);
        enemy.velocity.x = dir.x * moveSpeed;
        enemy.velocity.y = dir.y * moveSpeed;
        enemy.velocity.z = dir.z * moveSpeed;
      } else if (enemyType === 'sniper') {
        // Sniper: maintain distance, strafe around player
        const targetDistance = 40;
        const dir = this.getDirection(enemyPos, playerPos);
        if (distToPlayer < targetDistance) {
          // Too close, back up
          enemy.velocity.x = -dir.x * moveSpeed * 0.7;
          enemy.velocity.y = -dir.y * moveSpeed * 0.7;
          enemy.velocity.z = -dir.z * moveSpeed * 0.7;
        } else if (distToPlayer > targetDistance + 10) {
          // Too far, move closer
          enemy.velocity.x = dir.x * moveSpeed * 0.5;
          enemy.velocity.y = dir.y * moveSpeed * 0.5;
          enemy.velocity.z = dir.z * moveSpeed * 0.5;
        } else {
          // Strafe: move perpendicular to player
          const rightVec = {
            x: Math.sin((this.gameState.simTime + enemy.id.charCodeAt(0)) * 2),
            y: 0,
            z: Math.cos((this.gameState.simTime + enemy.id.charCodeAt(0)) * 2),
          };
          enemy.velocity.x = rightVec.x * moveSpeed * 0.8;
          enemy.velocity.y = rightVec.y * moveSpeed * 0.8;
          enemy.velocity.z = rightVec.z * moveSpeed * 0.8;
        }
      } else {
        // Fighter/default: charge at player
        const dir = this.getDirection(enemyPos, playerPos);
        enemy.velocity.x = dir.x * moveSpeed;
        enemy.velocity.y = dir.y * moveSpeed;
        enemy.velocity.z = dir.z * moveSpeed;
      }

      // Update position
      this.updateEntity(enemy, deltaTime);

      // AI decision (async, deferred for later)
      if (updateAI) {
        updateAI(enemy, { gameState: this.gameState, entityManager: this.entityManager });
      }
    });

    // Update projectiles
    this.gameState.projectiles.forEach((projectile) => {
      this.updateEntity(projectile, deltaTime);
      // Check collisions
      this.checkProjectileCollisions(projectile);
    });

    // Update allies (if any)
    this.gameState.allies.forEach((ally) => {
      this.updateEntity(ally, deltaTime);
    });

    // Check leaks: enemies reaching the planet
    this.checkLeaks();

    // Check wave completion
    this.checkWaveCompletion();

    // Check defeat condition
    if (this.gameState.defendingPlanetHealth <= 0) {
      this.gameState.phase = 'defeat';
    }
  }

  /**
   * Charging phase: player is holding fire button.
   */
  private updateCharging(deltaTime: number) {
    this.gameState.chargeLevel = Math.min(this.gameState.maxCharge, this.gameState.chargeLevel + deltaTime * this.gameState.chargeRate);
  }

  /**
   * Firing phase: beam is visible, resolving hits.
   */
  private updateFiring(deltaTime: number) {
    // Beam duration is 220ms; once it expires, back to combat
    const firingDuration = 0.22;
    if (this.gameState.simTime - (this.gameState.waveStartTime || 0) > firingDuration) {
      this.gameState.phase = 'combat';
      this.gameState.chargeLevel = 0;
    }
  }

  /**
   * Victory phase: wave cleared, advance or show upgrade screen.
   */
  private updateVictory(deltaTime: number) {
    // Delay before transition (for UI show/hide)
    const victoryDuration = 2.0;
    if (this.gameState.simTime - (this.gameState.waveStartTime || 0) > victoryDuration) {
      if (this.gameState.wave >= 4) {
        // All 4 waves cleared
        if (this.gameState.worldIndex >= 6) {
          // Game won (all 7 worlds)
          this.gameState.phase = 'title';
        } else {
          // Next world
          this.gameState.worldIndex++;
          this.gameState.wave = 1;
          this.gameState.phase = 'briefing';
        }
      } else {
        // Next wave
        this.gameState.wave++;
        this.gameState.phase = 'briefing';
      }
    }
  }

  /**
   * Defeat phase: planet destroyed.
   */
  private updateDefeat(deltaTime: number) {
    const defeatDuration = 3.0;
    if (this.gameState.simTime - (this.gameState.waveStartTime || 0) > defeatDuration) {
      // Restart world
      this.gameState.wave = 1;
      this.gameState.phase = 'briefing';
    }
  }

  /**
   * Calculate normalized direction from one position to another.
   */
  private getDirection(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.01) return { x: 0, y: 0, z: 0 };
    return { x: dx / dist, y: dy / dist, z: dz / dist };
  }

  /**
   * Generic entity update: position, velocity, rotation.
   */
  private updateEntity(entity: GameEntity, deltaTime: number) {
    // Integrate velocity into position
    entity.position.x += entity.velocity.x * deltaTime;
    entity.position.y += entity.velocity.y * deltaTime;
    entity.position.z += entity.velocity.z * deltaTime;

    // Apply basic drag (optional, tunable)
    const dragFactor = 0.98;
    entity.velocity.x *= dragFactor;
    entity.velocity.y *= dragFactor;
    entity.velocity.z *= dragFactor;
  }

  /**
   * Check if projectile hit any enemy.
   */
  private checkProjectileCollisions(projectile: GameEntity) {
    // Simple sphere overlap
    const hits = this.collisionSystem.sphereOverlap(
      { x: projectile.position.x, y: projectile.position.y, z: projectile.position.z },
      projectile.radius,
      projectile.id
    );

    hits.forEach((hit) => {
      if (hit.team === 'enemy') {
        // Deal damage
        const damage = projectile.metadata?.damage ?? 10;
        hit.health -= damage;

        // Record event
        this.gameState.events.push({
          type: 'entity_damaged',
          source: projectile.id,
          target: hit.id,
          amount: damage,
          timestamp: this.gameState.simTime,
        });

        if (hit.health <= 0) {
          // Enemy died
          hit.active = false;
          const scoreReward = projectile.metadata?.scoreReward ?? 100;
          this.gameState.score += scoreReward * this.gameState.comboMultiplier;

          this.gameState.events.push({
            type: 'entity_killed',
            source: projectile.id,
            target: hit.id,
            amount: scoreReward,
            timestamp: this.gameState.simTime,
          });
        }

        // Projectile consumed
        projectile.active = false;
      }
    });
  }

  /**
   * Check if any enemies reached the planet.
   */
  private checkLeaks() {
    // Simplified: if enemy is close to origin, it leaked
    const leakRadius = 5; // scene units
    const leaked = this.gameState.enemies.filter((enemy) => {
      const dist = Math.sqrt(
        enemy.position.x ** 2 + enemy.position.y ** 2 + enemy.position.z ** 2
      );
      return dist < leakRadius;
    });

    leaked.forEach((enemy) => {
      enemy.active = false;
      this.gameState.leaksThisWave++;
      const DAMAGE_PER_LEAK = 0.18;
      this.gameState.defendingPlanetHealth -= DAMAGE_PER_LEAK;

      this.gameState.events.push({
        type: 'entity_damaged',
        target: this.gameState.defendingPlanetId,
        amount: DAMAGE_PER_LEAK,
        timestamp: this.gameState.simTime,
      });
    });
  }

  /**
   * Check if wave is complete (all enemies destroyed or leaked).
   */
  private checkWaveCompletion() {
    const allEnemiesGone = this.gameState.enemies.every((e) => !e.active);
    if (allEnemiesGone && this.gameState.enemies.length > 0) {
      this.gameState.phase = 'victory';
      this.gameState.waveStartTime = this.gameState.simTime;

      const waveBonus = 250 * this.gameState.comboMultiplier;
      this.gameState.score += waveBonus;

      this.gameState.events.push({
        type: 'wave_cleared',
        amount: waveBonus,
        timestamp: this.gameState.simTime,
      });
    }
  }

  /**
   * Fire action: create projectile, transition to firing phase.
   */
  fireWeapon(chargeLevel: number) {
    // Use player's current velocity direction (aim direction) for projectile
    const playerVelLength = Math.sqrt(
      this.gameState.playerEntity.velocity.x ** 2 +
      this.gameState.playerEntity.velocity.y ** 2 +
      this.gameState.playerEntity.velocity.z ** 2
    );

    let fireDir = { x: 0, y: 0, z: 1 }; // Default: forward
    if (playerVelLength > 0.1) {
      // Use normalized player velocity as fire direction
      fireDir = {
        x: this.gameState.playerEntity.velocity.x / playerVelLength,
        y: this.gameState.playerEntity.velocity.y / playerVelLength,
        z: this.gameState.playerEntity.velocity.z / playerVelLength,
      };
    }

    const projectileSpeed = 40 + chargeLevel * 20; // Speed based on charge

    // Create projectile entity
    const projectile: GameEntity = {
      id: `projectile_${Date.now()}`,
      position: {
        x: this.gameState.playerEntity.position.x,
        y: this.gameState.playerEntity.position.y,
        z: this.gameState.playerEntity.position.z,
      },
      velocity: {
        x: fireDir.x * projectileSpeed,
        y: fireDir.y * projectileSpeed,
        z: fireDir.z * projectileSpeed,
      },
      rotation: { x: 0, y: 0, z: 0 },
      health: 1,
      maxHealth: 1,
      radius: 0.2,
      team: 'player',
      type: 'projectile',
      active: true,
      metadata: {
        damage: 10 + chargeLevel * 40,
        scoreReward: 100,
      },
    };

    this.entityManager.register(projectile);
    this.gameState.projectiles.push(projectile);
    this.gameState.phase = 'firing';
    this.gameState.waveStartTime = this.gameState.simTime;
  }

  /**
   * Spawn enemies for current wave.
   */
  spawnWaveEnemies(enemyFactory: (config: any) => GameEntity) {
    const config = this.gameState.waveConfig;
    config.enemyTypes.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        const enemy = enemyFactory({
          type,
          wave: this.gameState.wave,
          position: {
            x: Math.random() * 20 - 10,
            y: Math.random() * 20 - 10,
            z: Math.random() * 10 + 50,
          },
        });
        this.entityManager.register(enemy);
        this.gameState.enemies.push(enemy);
      }
    });
  }

  /**
   * Get current state (for React binding).
   */
  getState(): GameState {
    return this.gameState;
  }

  /**
   * Set state (for React binding).
   */
  setState(state: Partial<GameState>) {
    Object.assign(this.gameState, state);
  }
}

/**
 * Create a fresh game loop for a new session.
 */
export function createGameLoop(
  entityManager: EntityManager,
  collisionSystem: CollisionSystem,
  initialState: GameState
): GameLoop {
  return new GameLoop(entityManager, collisionSystem, initialState);
}
