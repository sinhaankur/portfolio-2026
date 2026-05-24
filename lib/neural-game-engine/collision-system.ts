import * as THREE from 'three';
import type { GameEntity, CollisionHit } from './types';
import type { EntityManager } from './entity-manager';

/**
 * Collision System: Hitscan (raycast) + proximity detection.
 * Uses Three.js Raycaster for accuracy without a full physics engine.
 *
 * Pattern: Three.js primitives, no external physics library.
 * Integrates with EntityManager for entity queries.
 */
export class CollisionSystem {
  private raycaster: THREE.Raycaster;
  private entityManager: EntityManager;
  private meshMap: Map<string, THREE.Mesh> = new Map(); // entity id → mesh for raycasting

  constructor(entityManager: EntityManager) {
    this.raycaster = new THREE.Raycaster();
    this.entityManager = entityManager;
  }

  /**
   * Register a mesh for an entity (for raycasting).
   * Called when the R3F component mounts.
   */
  registerMesh(entityId: string, mesh: THREE.Mesh): void {
    this.meshMap.set(entityId, mesh);
  }

  /**
   * Unregister a mesh when entity is destroyed.
   */
  unregisterMesh(entityId: string): void {
    this.meshMap.delete(entityId);
  }

  /**
   * Hitscan: Fire a ray from origin in direction, return all hit entities.
   * Used for projectiles, weapons, line-of-sight checks.
   *
   * @param origin Start position of ray
   * @param direction Direction vector (should be normalized)
   * @param maxDistance Maximum distance to check (default 1000)
   * @returns Array of hit entities, sorted by distance
   */
  hitscan(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 1000
  ): CollisionHit[] {
    this.raycaster.set(origin, direction.normalize());
    const hits: CollisionHit[] = [];

    // Get all active entity meshes
    const meshes: THREE.Mesh[] = [];
    this.entityManager.getAll().forEach((entity) => {
      const mesh = this.meshMap.get(entity.id);
      if (mesh) meshes.push(mesh);
    });

    // Raycast against all meshes
    const intersects = this.raycaster.intersectObjects(meshes, false);

    intersects.forEach((intersection) => {
      // Find the entity associated with this mesh
      const entity = Array.from(this.entityManager.getAll()).find(
        (e) => this.meshMap.get(e.id) === intersection.object
      );

      if (entity && intersection.distance <= maxDistance) {
        hits.push({
          entity,
          distance: intersection.distance,
          point: intersection.point,
          normal: intersection.face?.normal ?? new THREE.Vector3(0, 0, 1),
        });
      }
    });

    return hits;
  }

  /**
   * Sphere overlap test: Check if sphere overlaps with any entity.
   * Used for collision detection between entities.
   *
   * @param center Center of query sphere
   * @param radius Radius of query sphere
   * @param ignoredEntityId Optional: entity ID to exclude
   * @returns Array of overlapping entities
   */
  sphereOverlap(
    center: THREE.Vector3,
    radius: number,
    ignoredEntityId?: string
  ): GameEntity[] {
    return this.entityManager
      .proximityQuery({ x: center.x, y: center.y, z: center.z }, radius + 1)
      .filter((e) => {
        if (ignoredEntityId && e.id === ignoredEntityId) return false;
        // Check actual sphere-sphere collision
        const dx = e.position.x - center.x;
        const dy = e.position.y - center.y;
        const dz = e.position.z - center.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return distance < radius + e.radius;
      });
  }

  /**
   * Line-of-sight check: Is target visible from origin?
   * True if no obstacles between origin and target center.
   *
   * @param origin Position of observer
   * @param target Target entity
   * @param obstacleTeams Teams to treat as obstacles (default ['enemy', 'ally'])
   * @returns True if line of sight is clear
   */
  hasLineOfSight(
    origin: THREE.Vector3,
    target: GameEntity,
    obstacleTeams: GameEntity['team'][] = ['enemy', 'ally']
  ): boolean {
    const targetPos = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
    const direction = targetPos.clone().sub(origin).normalize();
    const distance = origin.distanceTo(targetPos);

    const hits = this.hitscan(origin, direction, distance);
    // If we hit anything other than the target itself, LOS is blocked
    return !hits.some((hit) => hit.entity.id !== target.id && obstacleTeams.includes(hit.entity.team));
  }

  /**
   * Predict collision: Given entity velocity, will it collide?
   * Simplified: move entity by velocity, check for overlaps.
   *
   * @param entity Entity to test
   * @param timeStep Delta time for movement simulation
   * @returns Colliding entities (if any)
   */
  predictCollision(entity: GameEntity, timeStep: number): GameEntity[] {
    const nextPos = {
      x: entity.position.x + entity.velocity.x * timeStep,
      y: entity.position.y + entity.velocity.y * timeStep,
      z: entity.position.z + entity.velocity.z * timeStep,
    };
    return this.sphereOverlap(
      new THREE.Vector3(nextPos.x, nextPos.y, nextPos.z),
      entity.radius,
      entity.id
    );
  }

  /**
   * Get all entities visible from a position (within a cone).
   * Used for AI field-of-view calculations.
   *
   * @param center Observer position
   * @param direction View direction
   * @param visionRange Maximum distance
   * @param visionAngle Half-angle of vision cone in radians
   * @returns Visible entities
   */
  getVisibleEntities(
    center: THREE.Vector3,
    direction: THREE.Vector3,
    visionRange: number,
    visionAngle: number = Math.PI / 4 // 90° total (45° half-angle)
  ): GameEntity[] {
    return this.entityManager
      .proximityQuery({ x: center.x, y: center.y, z: center.z }, visionRange)
      .filter((e) => {
        // Check if entity is within cone
        const toEntity = new THREE.Vector3(e.position.x - center.x, e.position.y - center.y, e.position.z - center.z);
        const angle = Math.acos(toEntity.normalize().dot(direction.normalize()));
        return angle < visionAngle;
      });
  }

  /**
   * Clear all registered meshes (for scene cleanup).
   */
  clear(): void {
    this.meshMap.clear();
  }
}

/**
 * Create a fresh collision system for a game session.
 */
export function createCollisionSystem(entityManager: EntityManager): CollisionSystem {
  return new CollisionSystem(entityManager);
}
