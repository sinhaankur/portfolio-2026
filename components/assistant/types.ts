/**
 * Assistant UI message shape. Kept separate from the SDK's MessageParam
 * so React renders don't have to traverse the SDK's discriminated
 * unions, and so we can model "in-flight" states (streaming, tool
 * running) cleanly.
 */

export type AssistantUIBlock =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error" }

export type UIMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string
      role: "assistant"
      blocks: AssistantUIBlock[]
      /** True while the model is mid-turn (streaming or running a tool). */
      pending: boolean
    }

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}
