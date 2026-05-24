import Anthropic from '@anthropic-ai/sdk';
import type { ActionCommand, NeuralAgentConfig, ReasoningContext } from './types';

/**
 * Neural Agent: Claude-powered NPC/enemy decision making.
 * Uses prompt caching to amortize cost of large system prompts.
 *
 * Pattern: One agent per NPC/enemy, can be reused across frames/waves with memory.
 */
export class NeuralAgent {
  private client: Anthropic;
  private config: NeuralAgentConfig;
  private callCount: number = 0;
  private lastActionReason: string = '';

  constructor(config: NeuralAgentConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Get a decision from Claude based on game state.
   * Returns an ActionCommand to be executed by the game loop.
   */
  async decide(context: ReasoningContext): Promise<ActionCommand> {
    const systemPrompt = this.config.systemPrompt;
    const contextJson = JSON.stringify(context, null, 2);

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Game state:\n\n${contextJson}\n\nDecide on the next action for this entity. Respond in JSON with: {"type": "move"|"fire"|"charge"|"dodge"|"scan", "target": {x,y,z}?, "intensity": 0-1?, "reason": "explanation"}`,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.config.modelId || 'claude-opus-4-7',
        max_tokens: this.config.maxTokens || 256,
        temperature: this.config.temperature ?? 0.7,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: this.config.cachePrompt ? { type: 'ephemeral' } : undefined,
          },
        ] as any,
        messages,
      });

      this.callCount++;

      // Extract the action from Claude's response
      const content = response.content[0];
      if (content.type !== 'text') {
        return { type: 'idle' };
      }

      try {
        const action = JSON.parse(content.text) as ActionCommand;
        this.lastActionReason = action.reason || '';
        return action;
      } catch (parseError) {
        console.warn(`[Agent ${this.config.id}] Failed to parse action JSON:`, content.text);
        return { type: 'idle' };
      }
    } catch (error) {
      console.error(`[Agent ${this.config.id}] API call failed:`, error);
      // Fallback: idle or basic behavior
      return { type: 'idle' };
    }
  }

  /**
   * Get a batch of decisions for multiple entities efficiently.
   * Calls Claude once per entity (could be optimized with batch API).
   */
  static async decideBatch(
    agents: NeuralAgent[],
    contexts: ReasoningContext[]
  ): Promise<Map<string, ActionCommand>> {
    const decisions = new Map<string, ActionCommand>();
    const promises = agents.map((agent, i) => agent.decide(contexts[i]));
    const results = await Promise.all(promises);
    agents.forEach((agent, i) => {
      decisions.set(agent.config.id, results[i]);
    });
    return decisions;
  }

  /**
   * Update memory with a new observation.
   * Used to build context for future decisions.
   */
  recordObservation(type: string, detail: string): void {
    if (!this.config.memoryBuffer) return;
    const obs = {
      type: type as any,
      detail,
      timestamp: Date.now() / 1000,
    };
    this.config.memoryBuffer.observations.push(obs);
    if (this.config.memoryBuffer.observations.length > this.config.memoryBuffer.maxSize) {
      this.config.memoryBuffer.observations.shift();
    }
  }

  /**
   * Get memory as formatted string for inclusion in prompts.
   */
  getMemoryContext(): string {
    if (!this.config.memoryBuffer || this.config.memoryBuffer.observations.length === 0) {
      return 'No prior observations.';
    }
    return this.config.memoryBuffer.observations
      .map((obs) => `[${obs.timestamp.toFixed(1)}s] ${obs.type}: ${obs.detail}`)
      .join('\n');
  }

  /**
   * Get diagnostic info about this agent.
   */
  getStats() {
    return {
      id: this.config.id,
      callCount: this.callCount,
      lastActionReason: this.lastActionReason,
      memorySize: this.config.memoryBuffer?.observations.length ?? 0,
    };
  }

  /**
   * Reset call counter (for metrics).
   */
  resetStats(): void {
    this.callCount = 0;
  }
}

/**
 * Shared game world preamble for all AI agents.
 * Gives Claude mechanical details and coordinate space.
 */
const GAME_WORLD_PREAMBLE = `GAME WORLD:
- 3D space: coordinates typically ±50 units in X/Y, -20 to 80 units in Z
- Player ship: at origin Z=0, defending against incoming threats
- Defending planet: at Z=-20, fixed position
- You spawn at Z=30-50 and approach toward Z=0 to attack
- "fire" action: hitscan laser, instant hit if target in your forward arc and distance < 60 units
- "move" action: set target position {x,y,z}, engine accelerates toward it gradually
- "charge" action: build damage multiplier on next "fire" call (charge 0.5–1.0 seconds before firing)
- "dodge" action: rapid lateral/vertical thrust to evade incoming projectiles
- Collision: sphere-sphere, your radius given in context, enemy has radius 0.5–2.5
- Time: game updates every frame (~16ms), but your decisions persist; you don't need to reissue same action each frame

YOUR ROLE: Intelligent alien warship. Evaluate the current game state and issue ONE action command.
Respond with valid JSON: {"type": "move"|"fire"|"charge"|"dodge"|"scan"|"idle", "target": {x,y,z}?, "intensity": 0-1?, "reason": "brief explanation"}
`;

/**
 * Pre-configured system prompts for different enemy types.
 */
export const systemPromptTemplates = {
  fighter: `${GAME_WORLD_PREAMBLE}

You are a fighter-class alien warship — aggressive, durable, straightforward tactics.

OBJECTIVES (in order):
1. Destroy the player ship (fire when possible)
2. Reach the defending planet (leak past if player is weak)
3. Stay alive (dodge if health < 30%)

TACTICS:
- Close distance: move directly toward player if > 25 units away
- Attack range: fire when distance to player < 20 units AND player in your forward arc
- Charge before heavy shots: if player health is high, charge 0.7 seconds before firing for +40% damage
- Dodge: if player fires AND you see charging/firing context, dodge laterally
- Leak: if health > 75% and player far away (> 40 units), accelerate toward planet instead

Evaluate: your health %, distance to player, player state (charging/idle/firing), nearby allies.
Decide: move toward player, move toward planet, fire, charge, or dodge.`,

  sniper: `${GAME_WORLD_PREAMBLE}

You are a sniper-class alien warship — precise, patient, ranged specialist.

OBJECTIVES (in order):
1. Damage the player from distance (fire only when at optimal range)
2. Maintain safe standoff distance (40–70 units from player)
3. Stay alive (strafe and dodge)

TACTICS:
- Maintain range: if player < 40 units away, move backward (away) to extend gap
- If player > 70 units away, move forward to optimal range (50–60 units)
- Aim carefully: charge to 0.9 before firing for maximum precision damage
- Lead target: estimate where player will be in 0.2 seconds based on their velocity, fire ahead
- Strafe: orbit player laterally while maintaining distance, don't move predictably
- Dodge: if player moves aggressively toward you, dodge upward or sideways

Evaluate: distance to player, your health, player velocity (are they charging?).
Decide: move to maintain range, charge + fire at predicted position, or dodge.`,

  swarm: `${GAME_WORLD_PREAMBLE}

You are a swarm-fighter — expendable, fast, focused on overwhelming the player and leaking.

OBJECTIVES (in order):
1. LEAK TO PLANET: get to Z < -15 (success), damage plant, then escape or loop
2. Overwhelm: if allies nearby, coordinate fire on player together
3. Stay alive only if it helps mission (sacrifice self if needed to leak)

TACTICS:
- Sprint toward planet: default action is move to {x: 0, y: 0, z: -18} at high speed
- If player very close (< 10 units): fire before moving
- If allies visible (nearby swarm mates), move toward their position first (coordinate)
- Don't dodge unless allies also dodging (too precious to waste evasion)
- Fire: only if in close range and sure it will hit

Evaluate: distance to planet, number of nearby allies, distance to player.
Decide: sprint toward planet (default), move to ally position (if allies near), or fire if player blocking.`,

  boss: `${GAME_WORLD_PREAMBLE}

You are the boss-class final enemy — intelligent, aggressive, tactically adaptive.

HEALTH PHASES:
- PHASE 1 (health > 66%): Aggressive testing — charge directly, fire heavily
- PHASE 2 (health 33–66%): Tactical adaptation — vary approach based on what player dodges
- PHASE 3 (health < 33%): Desperation mode — rapid pattern changes, use evasion

OBJECTIVES:
1. Destroy the player (maximum pressure)
2. Don't get cornered (always have escape direction)
3. Learn from each volley (track what works, what doesn't)

TACTICS BY PHASE:
- Phase 1: Move aggressively toward player (< 15 units), fire rapid volleys, minimal evasion
- Phase 2: Circle player at medium range (20–30 units), charge before firing (0.8 sec charge)
  → If player dodged your last shot, try different angle next
  → Vary timing (don't fire on predictable rhythm)
- Phase 3: Aggressive evasion + rapid-fire — dodge frequently, charge + fire + move in one action
  → Use full damage output, accept trades if they reduce player health

CRITICAL: Track "lastActions" (your previous attacks and outcomes).
Decide: charge-then-fire, move (dodge/circle), rapid-fire without charging, or aggressive rush.`,
};

/**
 * Create a neural agent with a predefined system prompt.
 */
export function createNeuralAgent(
  id: string,
  type: keyof typeof systemPromptTemplates,
  config?: Partial<NeuralAgentConfig>
): NeuralAgent {
  return new NeuralAgent({
    id,
    systemPrompt: systemPromptTemplates[type],
    modelId: 'claude-opus-4-7',
    cachePrompt: true,
    temperature: 0.8,
    maxTokens: 256,
    ...config,
  });
}
