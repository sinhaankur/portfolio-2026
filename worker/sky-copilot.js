/**
 * sky-copilot — a free, GPU-backed LLM endpoint for sinhaankur.com.
 *
 * Runs on Cloudflare Workers AI (free tier: ~10k "neurons"/day on real GPUs),
 * so the site's "explain the sky / what's this satellite" copilot has a capable
 * brain WITHOUT the user needing WebGPU, a key, or any local setup — and without
 * Anthropic. This is the "our own LLM on free compute" piece.
 *
 * ADAPTIVE BY QUOTA + QUALITY (the Unhosted philosophy — degrade, never break):
 * the request names a quality tier; we try the best model for it, and on a quota
 * error (429 / neuron budget exhausted) OR a model error we CASCADE down to a
 * smaller, cheaper model. If every tier is exhausted we return a clean 503 with
 * `fallback: true` so the browser falls back to its deterministic search/fly-to
 * tools. The feature is never dead — it just gets simpler when the free compute
 * is tight.
 *
 * OpenAI-compatible surface (/v1/chat/completions + /v1/models) so it slots into
 * the site's existing provider layer (lib/llm-provider.ts) with zero new client
 * code — it looks like any other OpenAI-compatible endpoint.
 *
 * Deploy:  cd worker && npx wrangler deploy -c wrangler.sky.toml
 */

// Quality tiers → an ordered cascade of Workers AI models (best first). Each
// tier falls through to the next model on quota/model error. All are on the
// free catalog; "best" is heavier (more neurons), "fast" is light + cheap.
// Only models CONFIRMED on this account's Workers AI catalog (verified via
// `wrangler ai models`). "best" is heaviest (most neurons), "fast" is lightest.
// Qwen is kept prominent — it's the same family as our own helmsman-4b fine-tune.
const TIERS = {
  best: [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "@cf/qwen/qwen3.8-27b",
  ],
  balanced: [
    "@cf/qwen/qwen3.8-27b",
    "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.2-lora",
  ],
  fast: [
    "@cf/mistral/mistral-7b-instruct-v0.2-lora",
    "@cf/ibm-granite/granite-4.0-h-micro",
  ],
}
const DEFAULT_TIER = "balanced"

// Only the site may call this — tight allow-list (CORS). Add preview hosts here.
const ALLOWED = new Set([
  "https://www.sinhaankur.com",
  "https://sinhaankur.com",
  "http://localhost:3000",
])

function cors(origin) {
  const allow = ALLOWED.has(origin) ? origin : "https://www.sinhaankur.com"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "86400",
  }
}

const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors(origin), "content-type": "application/json" },
  })

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || ""
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) })
    }

    // GET /v1/models — advertise the tiers as "models" so the provider UI can
    // list them. (The site picks a tier; the Worker picks the actual model.)
    if (request.method === "GET" && url.pathname === "/v1/models") {
      return json(
        { object: "list", data: Object.keys(TIERS).map((id) => ({ id, object: "model", owned_by: "cloudflare-workers-ai" })) },
        200,
        origin,
      )
    }

    // GET /health — a tiny liveness probe (used by the freshness/watchdog world).
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, tiers: Object.keys(TIERS) }, 200, origin)
    }

    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      return json({ error: "not found" }, 404, origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: "bad json" }, 400, origin)
    }

    const messages = Array.isArray(body.messages) ? body.messages : null
    if (!messages) return json({ error: "messages[] required" }, 422, origin)

    // The client sends the tier as `model` (OpenAI field). Unknown → default.
    const tier = TIERS[body.model] ? body.model : DEFAULT_TIER
    const cascade = TIERS[tier]
    const maxTokens = Math.min(Number(body.max_tokens) || 512, 1024)
    const temperature = Number.isFinite(body.temperature) ? body.temperature : 0.6

    let lastErr = null
    for (const model of cascade) {
      try {
        const out = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature })
        const text = out?.response ?? out?.result?.response ?? ""
        if (!text) {
          lastErr = `empty response from ${model}`
          continue
        }
        // OpenAI-compatible envelope so the site's runtime parses it unchanged.
        return json(
          {
            id: `skycopilot-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model, // the ACTUAL model that answered (transparency: which tier fired)
            choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
            usage: out?.usage ?? undefined,
          },
          200,
          origin,
        )
      } catch (e) {
        // Quota (429 / neuron budget) or model error → try the next, cheaper model.
        lastErr = String(e?.message || e).slice(0, 200)
        continue
      }
    }

    // Whole cascade exhausted (quota gone, or all models erroring). Tell the
    // browser to fall back to its deterministic tools — never a dead feature.
    return json(
      { error: "all tiers unavailable", detail: lastErr, fallback: true },
      503,
      origin,
    )
  },
}
