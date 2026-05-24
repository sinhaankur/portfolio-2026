import type { GameEntity, GameState } from './types';

/**
 * Entity Manager: Registry and query system for all game entities.
 * Decoupled from React/R3F — pure entity state mutation.
 *
 * Pattern: Mirrors Universe Engine's data-driven approach.
 * No React, no mesh refs here — just spatial + state data.
 */
export class EntityManager {
  private entities: Map<string, GameEntity> = new Map();
  private idCounter: number = 0;

  /**
   * Register a new entity, auto-generate ID if not provided.
   */
  register(entity: Partial<GameEntity>): GameEntity {
    const id = entity.id || `entity_${this.idCounter++}`;
    const complete: GameEntity = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      maxHealth: 100,
      radius: 1,
      team: 'neutral',
      type: 'ship',
      active: true,
      ...entity,
      id,
    };
    this.entities.set(id, complete);
    return complete;
  }

  /**
   * Get entity by ID.
   */
  get(id: string): GameEntity | null {
    return this.entities.get(id) ?? null;
  }

  /**
   * Update entity state (partial merge).
   */
  update(id: string, partial: Partial<GameEntity>): GameEntity | null {
    const entity = this.entities.get(id);
    if (!entity) return null;
    Object.assign(entity, partial);
    return entity;
  }

  /**
   * Remove entity by ID (cleanup).
   */
  remove(id: string): boolean {
    return this.entities.delete(id);
  }

  /**
   * Get all active entities.
   */
  getAll(): GameEntity[] {
    return Array.from(this.entities.values()).filter((e) => e.active);
  }

  /**
   * Get all entities of a specific type.
   */
  getByType(type: GameEntity['type']): GameEntity[] {
    return Array.from(this.entities.values()).filter((e) => e.active && e.type === type);
  }

  /**
   * Get all entities on a specific team.
   */
  getByTeam(team: GameEntity['team']): GameEntity[] {
    return Array.from(this.entities.values()).filter((e) => e.active && e.team === team);
  }

  /**
   * Query entities within a sphere.
   * Used for proximity detection, area-of-effect abilities, etc.
   */
  proximityQuery(center: { x: number; y: number; z: number }, radius: number): GameEntity[] {
    return Array.from(this.entities.values()).filter((e) => {
      if (!e.active) return false;
      const dx = e.position.x - center.x;
      const dy = e.position.y - center.y;
      const dz = e.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance <= radius;
    });
  }

  /**
   * Query entities within a sphere, returning distance sorted.
   */
  proximityQuerySorted(
    center: { x: number; y: number; z: number },
    radius: number
  ): Array<GameEntity & { distance: number }> {
    const results: Array<GameEntity & { distance: number }> = [];
    Array.from(this.entities.values()).forEach((e) => {
      if (!e.active) return;
      const dx = e.position.x - center.x;
      const dy = e.position.y - center.y;
      const dz = e.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance <= radius) {
        results.push({ ...e, distance });
      }
    });
    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get nearest entity of a given team to a position.
   */
  getNearestByTeam(
    center: { x: number; y: number; z: number },
    team: GameEntity['team'],
    maxDistance?: number
  ): (GameEntity & { distance: number }) | null {
    let nearest: (GameEntity & { distance: number }) | null = null;
    Array.from(this.entities.values()).forEach((e) => {
      if (!e.active || e.team !== team) return;
      const dx = e.position.x - center.x;
      const dy = e.position.y - center.y;
      const dz = e.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (maxDistance && distance > maxDistance) return;
      if (!nearest || distance < nearest.distance) {
        nearest = { ...e, distance };
      }
    });
    return nearest;
  }

  /**
   * Clear all entities (for world reset).
   */
  clear(): void {
    this.entities.clear();
  }

  /**
   * Get all entities as a serializable snapshot.
   */
  serialize(): Record<string, GameEntity> {
    const snapshot: Record<string, GameEntity> = {};
    this.entities.forEach((e, id) => {
      snapshot[id] = { ...e };
    });
    return snapshot;
  }

  /**
   * Restore entities from a snapshot.
   */
  deserialize(snapshot: Record<string, GameEntity>): void {
    this.entities.clear();
    Object.entries(snapshot).forEach(([id, e]) => {
      this.entities.set(id, { ...e });
    });
  }

  /**
   * Get current entity count.
   */
  count(): number {
    return Array.from(this.entities.values()).filter((e) => e.active).length;
  }

  /**
   * Reset ID counter (for new game).
   */
  resetIdCounter(): void {
    this.idCounter = 0;
  }
}

/**
 * Create a fresh entity manager for a new game session.
 */
export function createEntityManager(): EntityManager {
  return new EntityManager();
}
