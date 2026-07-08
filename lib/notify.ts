/**
 * notify — a small, shared, opt-in notification helper (ntfy) for all of
 * Ankur's products: the portfolio site, Anita/build agents, Kelo, Node2.io,
 * and future ones. Build it once, reuse everywhere.
 *
 * Uses ntfy (https://ntfy.sh) — publish an HTTP POST to a topic, subscribers
 * with the ntfy app get a push. No accounts, open-source, self-hostable.
 *
 * PRIVACY IS BUILT IN, not optional:
 *   • On the public ntfy.sh server, a topic is PUBLIC — anyone who knows the
 *     topic name can read it. So `sensitive: true` payloads REFUSE to send to a
 *     public server and require a self-hosted `server` — this enforces Kelo's
 *     SECURITY.md rule (nothing personal leaves to a public place) in code.
 *   • Notifications are OPT-IN: nothing sends unless a topic is configured
 *     (env / explicit arg). No topic = no-op, never an error.
 */

export type NotifyPriority = "min" | "low" | "default" | "high" | "urgent"

export interface NotifyOptions {
  /** The message body. Keep it free of personal data on public servers. */
  message: string
  /** Short title shown above the message. */
  title?: string
  /** ntfy topic to publish to. Falls back to NTFY_TOPIC env. */
  topic?: string
  /** ntfy server base URL. Falls back to NTFY_SERVER env, else https://ntfy.sh
   *  (public). A self-hosted URL is REQUIRED when `sensitive` is true. */
  server?: string
  /** Optional access token for a protected/self-hosted server (Bearer). */
  token?: string
  priority?: NotifyPriority
  /** Emoji/tag shortcodes ntfy renders, e.g. ["white_check_mark"]. */
  tags?: string[]
  /** Optional click-through URL for the notification. */
  click?: string
  /** Marks the payload as containing personal/sensitive data (health, money,
   *  identity). Refuses to send to a public ntfy.sh — self-host required. */
  sensitive?: boolean
}

const PUBLIC_SERVER = "https://ntfy.sh"

export interface NotifyResult {
  sent: boolean
  reason?: string
}

/** Is this server the public ntfy.sh (or any *.ntfy.sh), where topics are
 *  readable by anyone who knows the name? */
export function isPublicServer(server: string): boolean {
  try {
    const host = new URL(server).hostname.toLowerCase()
    return host === "ntfy.sh" || host.endsWith(".ntfy.sh")
  } catch {
    return true // unparseable → treat as public (fail safe)
  }
}

/**
 * Send a notification. Returns { sent } — never throws for a missing topic
 * (opt-in: no topic means the user hasn't turned notifications on).
 */
export async function notify(opts: NotifyOptions): Promise<NotifyResult> {
  const topic = opts.topic ?? process.env.NTFY_TOPIC
  if (!topic) return { sent: false, reason: "no topic configured (opt-in)" }

  const server = opts.server ?? process.env.NTFY_SERVER ?? PUBLIC_SERVER

  // Privacy guard: sensitive payloads must never touch a public server.
  if (opts.sensitive && isPublicServer(server)) {
    return {
      sent: false,
      reason:
        "refused: sensitive notification cannot go to a public ntfy server — set NTFY_SERVER to a self-hosted instance",
    }
  }

  const headers: Record<string, string> = {}
  if (opts.title) headers["Title"] = opts.title
  if (opts.priority) headers["Priority"] = opts.priority
  if (opts.tags?.length) headers["Tags"] = opts.tags.join(",")
  if (opts.click) headers["Click"] = opts.click
  const token = opts.token ?? process.env.NTFY_TOKEN
  if (token) headers["Authorization"] = `Bearer ${token}`

  const url = `${server.replace(/\/$/, "")}/${encodeURIComponent(topic)}`
  try {
    const res = await fetch(url, { method: "POST", headers, body: opts.message })
    if (!res.ok) return { sent: false, reason: `ntfy responded ${res.status}` }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: `ntfy request failed: ${(e as Error).message}` }
  }
}
