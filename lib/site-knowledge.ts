/**
 * Site knowledge — the grounded brain behind the "Ask the guide" orb.
 *
 * This is the DETERMINISTIC core: it understands a visitor's question (intent +
 * the entity they mean), then returns a real fact and a link to the RIGHT page —
 * never a generic roster. "oracle work" lands on /works/oracle, not The Lab.
 *
 * Design, matching the project's "deterministic core, LLM for phrasing" rule:
 *   - Every entry is grounded in a real route + a true one-liner about the work.
 *   - Matching is entity-aware (aliases, weighted, word-boundary) so a specific
 *     name beats a broad topic ("oracle" wins over the generic "work" roster).
 *   - The tiny on-device LLM (webllm-engine) can phrase these facts more warmly
 *     when the visitor opts in, but the FACTS and LINKS come from here, so the
 *     answer is always correct and grounded even with no model at all.
 *
 * Adding a page the guide should know: add one entry below. No other edits.
 */

export type SiteAnswer = {
  /** The grounded answer text (a real, true sentence). */
  text: string
  /** The page it links to (a real route). */
  href?: string
  /** The link label. */
  cta?: string
}

type Entry = SiteAnswer & {
  /** Stable id (for telemetry / dedupe). */
  id: string
  /** The canonical thing this entry is about, for the LLM context line. */
  topic: string
  /** Strong aliases — an exact match here strongly selects this entry. Lowercase. */
  names: string[]
  /** Broader topic words — weaker signal, used to disambiguate / catch-all. */
  topics?: string[]
}

// ── The grounded catalogue ────────────────────────────────────────────────────
// Ordered roughly by how specific → how broad; specificity wins via scoring, not
// order, but keeping it readable helps when editing.
const ENTRIES: Entry[] = [
  // ——— Case studies (the WORK) ———
  {
    id: "oracle",
    topic: "the Oracle case study",
    names: ["oracle"],
    topics: ["work", "case study", "enterprise", "product design"],
    text: "At Oracle, Ankur designed enterprise product experiences — turning dense, high-stakes workflows into interfaces people could actually move through. It's a full product-design case study.",
    href: "/works/oracle",
    cta: "Oracle case study",
  },
  {
    id: "deloitte",
    topic: "the Deloitte case study",
    names: ["deloitte"],
    topics: ["work", "case study", "consulting", "product design"],
    text: "At Deloitte, Ankur worked on product design across client engagements — research, flows and interface systems delivered under real constraints. There's a full case study.",
    href: "/works/deloitte",
    cta: "Deloitte case study",
  },
  {
    id: "snowtint",
    topic: "the Snowtint case study",
    names: ["snowtint", "snow tint"],
    topics: ["work", "case study", "product design", "brand"],
    text: "Snowtint is a product-design case study — the full arc from problem to shipped interface.",
    href: "/works/snowtint",
    cta: "Snowtint case study",
  },
  {
    id: "rage",
    topic: "the Rage case study",
    names: ["rage"],
    topics: ["work", "case study", "product design"],
    text: "Rage is a product-design case study walking through the real design decisions end to end.",
    href: "/works/rage",
    cta: "Rage case study",
  },
  {
    id: "work",
    topic: "the product-design work overview",
    names: ["work", "works", "case studies", "portfolio", "experience", "job", "career"],
    topics: ["design", "product"],
    text: "The product-design work spans four real case studies — Oracle, Deloitte, Snowtint and Rage — plus The Lab of experiments you can use. Ask me about any one of them.",
    href: "/#works",
    cta: "See the work",
  },

  // ——— Vera / on-device AI ———
  {
    id: "vera",
    topic: "Vera, the on-device AI companion",
    names: ["vera", "companion", "cognitive twin", "twin", "download vera"],
    topics: ["on-device ai", "assistant", "private ai", "local ai", "download"],
    text: "Vera is a private, on-device AI companion for macOS — an on-device twin of a loved one, with its own brain (feeling and memory computed locally), a warm neural voice, and sealed privacy. Open source, free to download.",
    href: "/lab/cognitive-twin",
    cta: "Meet Vera",
  },

  // ——— The engines ———
  {
    id: "universe",
    topic: "the Universe / Satellite Engine",
    names: ["universe engine", "satellite engine", "satellites", "satellite", "celestial", "solar system", "orbit", "orbits"],
    topics: ["space", "sky", "stars", "nasa", "engine", "planets"],
    text: "The Satellite Engine is a real-time, date-accurate solar system with 18,600+ real satellite orbits, Mars and Moon imaging, and live space data — built entirely from real NASA/JPL/ESA data and running in your browser. It also hosts an on-device AI copilot.",
    href: "/lab/celestial",
    cta: "Open the engine",
  },
  {
    id: "waves",
    topic: "The Waves — the living ocean",
    names: ["waves", "wave", "ocean", "sea", "water"],
    topics: ["gerstner", "tides", "procedural"],
    text: "The Waves is Ankur's own real-time procedural ocean — Gerstner waves under a real sun and moon, driven by tides, wind and climate, all computed on-device. There's a full-screen living sea and a page on the math behind it.",
    href: "/waves",
    cta: "Explore the sea",
  },
  {
    id: "big-bang",
    topic: "the cosmic timeline (Big Bang)",
    names: ["big bang", "cosmic timeline", "timeline of the universe"],
    topics: ["cosmology", "history of the universe"],
    text: "The Big Bang page is a real-time cosmic timeline — Planck epoch to today, through the first stars, Earth forming, oceans, life and us, every element Blender-baked.",
    href: "/lab/big-bang",
    cta: "The cosmic timeline",
  },

  // ——— Math, made visible ———
  {
    id: "math",
    topic: "the Mathematics-made-visible series",
    names: ["math", "mathematics", "equations", "equation"],
    topics: ["visualization", "interactive math"],
    text: "Mathematics, made visible — original interactive visualizations of real math: π, Euler's identity, Fourier epicycles, the golden ratio, and the math behind the waves and the universe.",
    href: "/math",
    cta: "See the math",
  },
  {
    id: "pi",
    topic: "π (Pie) — how π is calculated",
    names: ["pi", "pie", "π", "circle"],
    topics: ["irrational", "archimedes", "leibniz"],
    text: "Pie shows how π is actually calculated and why it never resolves — a harmonograph whose irrational π-ratio never closes, beside live Archimedes, Leibniz and Monte-Carlo convergence.",
    href: "/lab/pi",
    cta: "Open Pie",
  },
  {
    id: "rag",
    topic: "what a RAG system is",
    names: ["rag", "retrieval augmented generation", "retrieval-augmented"],
    topics: ["embeddings", "vector search", "ai teaching"],
    text: "The RAG page explains Retrieval-Augmented Generation — chunk, embed, retrieve, generate — beside the real code of a small, fully on-device RAG engine.",
    href: "/rag",
    cta: "What is RAG?",
  },
  {
    id: "llm",
    topic: "how a language model works",
    names: ["llm", "language model", "how ai works", "transformer", "attention", "tokens"],
    topics: ["neural network", "ai teaching"],
    text: "The LLM page walks through how a language model actually works — tokens, embeddings, attention, layers, next-token — beside the real code of an LLM Internals Lab.",
    href: "/llm",
    cta: "How an LLM works",
  },

  // ——— Craft / framework / skills ———
  {
    id: "usability",
    topic: "the Usability Engine and Experience Framework",
    names: ["usability", "framework", "heuristics", "laws of ux", "experience framework"],
    topics: ["ux", "cognition", "design principles"],
    text: "There's a live Usability Engine and a Universal Experience Framework — the Laws of UX and cognition with interactive demos you can play with.",
    href: "/framework",
    cta: "The framework",
  },
  {
    id: "skills",
    topic: "skills, stack and the craft library",
    names: ["skills", "stack", "tools", "craft", "library", "capabilities", "tech stack", "what can you do", "what can he do", "abilities"],
    topics: ["discipline", "expertise"],
    text: "There's a skills matrix and a craft library — nine disciplines, each with the real tools and proof links to real work.",
    href: "/library",
    cta: "Skills & craft",
  },
  {
    id: "lab",
    topic: "The Lab of experiments",
    names: ["lab", "experiments", "projects", "open source", "the lab"],
    topics: ["side projects", "research"],
    text: "The Lab is Ankur's collection of real, usable experiments — the Satellite Engine, the Waves, the math visualizers, on-device AI, games and more. Each one is a thing you can actually open.",
    href: "/lab",
    cta: "The Lab",
  },
  {
    id: "about",
    topic: "who Ankur is",
    names: ["who", "ankur", "about", "you", "him", "he", "designer", "engineer", "hire", "contact"],
    topics: ["bio", "background"],
    text: "Ankur is a UX designer and engineer-by-degree who builds what he designs — product design at Oracle and Deloitte, plus a lab of human-in-the-loop AI tools you can actually use.",
    href: "/about",
    cta: "About Ankur",
  },
]

// Pronoun / filler words that carry no entity signal — ignored when matching.
const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "about", "tell", "me", "show",
  "what", "whats", "what's", "who", "how", "your", "you", "do", "does", "of",
  "on", "in", "to", "and", "or", "for", "with", "i", "want", "see", "know",
  "can", "could", "would", "please", "work", "works", // 'work' is handled as a topic, not a selector
])

/** Normalize a query to comparable tokens. */
function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
}

/** Does `name` appear in `q` as a whole word / phrase? */
function phraseHit(q: string, name: string): boolean {
  if (name.includes(" ")) return q.includes(name)
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u")
  return re.test(q)
}

/**
 * Score every entry against the query and return the best match (or null).
 * Scoring is entity-first: an alias/name phrase hit is worth far more than a
 * topic word, so "oracle work" selects Oracle (name hit, +10) over the generic
 * "work" overview (topic hit, +2). Ties break toward the more specific entry
 * (fewer, more precise names).
 */
export function matchSiteEntry(query: string): { entry: Entry; score: number } | null {
  const q = ` ${query.toLowerCase().trim()} `
  const qTokens = new Set(tokens(query).filter((t) => !STOP.has(t)))

  let best: Entry | null = null
  let bestScore = 0

  for (const entry of ENTRIES) {
    let score = 0
    // Strong: an alias/name phrase present in the query.
    for (const name of entry.names) {
      if (phraseHit(q, name)) {
        // Longer, more specific phrases score higher ("satellite engine" > "pi").
        score += 10 + Math.min(6, name.split(" ").length * 2)
      }
    }
    // Weaker: topic words present as tokens.
    for (const topic of entry.topics ?? []) {
      if (topic.includes(" ") ? q.includes(topic) : qTokens.has(topic)) score += 2
    }
    // Tie-breaker: prefer the more specific entry (narrower name set).
    const specificity = 1 / (entry.names.length + 1)

    if (score > bestScore || (score === bestScore && score > 0 && best && specificity > 1 / (best.names.length + 1))) {
      bestScore = score
      best = entry
    }
  }

  if (!best || bestScore === 0) return null
  return { entry: best, score: bestScore }
}

/** The grounded answer for a query, or the honest no-match fallback. */
export function answerFromSite(query: string): SiteAnswer & { topic: string } {
  const m = matchSiteEntry(query)
  if (m) {
    const { text, href, cta, topic } = m.entry
    return { text, href, cta, topic }
  }
  return {
    topic: "general guidance",
    text: "I can point you to the real thing — try Oracle, Deloitte, Vera, the Satellite Engine, the Waves, the math, or the skills.",
    href: "/lab",
    cta: "Browse The Lab",
  }
}

/**
 * Build a grounded CONTEXT block for the on-device LLM: the top matching entries'
 * real facts. The model is told to phrase an answer using ONLY these facts, so it
 * stays truthful and always has the right link to offer. Returns the context plus
 * the single best link to surface under the phrased reply.
 */
export function groundingFor(query: string): { context: string; link?: SiteAnswer } {
  const q = ` ${query.toLowerCase().trim()} `
  const scored = ENTRIES.map((entry) => {
    let score = 0
    for (const name of entry.names) if (phraseHit(q, name)) score += 10 + Math.min(6, name.split(" ").length * 2)
    for (const topic of entry.topics ?? []) if (q.includes(topic)) score += 2
    return { entry, score }
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (!scored.length) {
    return {
      context: "(no direct match — Ankur's site covers: product-design case studies at Oracle/Deloitte/Snowtint/Rage, Vera the on-device AI, the Satellite Engine, the Waves ocean, interactive math, and a skills/craft library.)",
      link: { text: "", href: "/lab", cta: "Browse The Lab" },
    }
  }

  const context = scored
    .map((s) => `- ${s.entry.topic}: ${s.entry.text}`)
    .join("\n")
  const top = scored[0].entry
  return { context, link: { text: top.text, href: top.href, cta: top.cta } }
}
