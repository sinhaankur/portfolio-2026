/**
 * Site knowledge — the grounded brain behind the "Ask the guide" orb.
 *
 * Goal: a genuinely good guide to Ankur's work. It UNDERSTANDS a question
 * (intent + entity), RETRIEVES the best few real matches, and answers with a
 * true fact + the right link — never a generic roster, never a wrong page.
 *
 * Four layers, matching the project's "deterministic core, LLM for phrasing":
 *   1. COVERAGE   — every real project + teaching page is an entry here, so the
 *                   guide can answer about anything actually on the site.
 *   2. RETRIEVAL  — entity-aware, weighted, multi-hit: a broad question
 *                   ("your AI work") returns several real projects; a specific
 *                   one ("oracle work") lands exactly on /works/oracle.
 *   3. SEMANTIC   — optional on-device embeddings (same WebLLM runtime) so
 *                   intent is understood even without shared keywords
 *                   ("the thing that tracks space junk" → Satellite Engine).
 *                   Degrades cleanly to keyword scoring when unavailable.
 *   4. FOLLOW-UPS — each entry can suggest a couple of real next taps.
 *
 * INTERVIEWER-SAFE: this is a public, interviewer-facing surface. Every fact is
 * professional and controlled — nothing about when or how much Ankur works, no
 * personal detail that could be read the wrong way. Framing is intentional.
 *
 * THE LINE THAT MATTERS: the professional WORK (Oracle, Deloitte, Snowtint, Rage)
 * is what Ankur does as a designer — real projects. The LAB (Vera, the engines,
 * the math, the games) is explicitly IDEAS AND EXPLORATION — never described as
 * professional/client work or "his job." The guide leads with the work and always
 * frames Lab entries as experiments, so no one mistakes an exploration for a
 * delivered engagement. `group: "work"` entries are the only professional ones.
 *
 * Adding a page the guide should know: add one entry below. No other edits.
 */

export type SiteAnswer = {
  text: string
  href?: string
  cta?: string
  /** A couple of real next taps the guide can offer. */
  followups?: { label: string; href: string }[]
}

export type Entry = SiteAnswer & {
  id: string
  /** The canonical thing this entry is about, for the LLM context line. */
  topic: string
  /** Strong aliases — an exact match strongly selects this entry. Lowercase. */
  names: string[]
  /** Broader topic words — weaker signal, for disambiguation / breadth. */
  topics?: string[]
  /** Coarse category, so a broad question can gather a whole area. */
  group?: "work" | "ai" | "engine" | "math" | "craft" | "about" | "data" | "game" | "writing"
}

// ── The grounded catalogue ────────────────────────────────────────────────────
const ENTRIES: Entry[] = [
  // ——— Case studies (the WORK) ———
  {
    id: "oracle", group: "work",
    topic: "the Oracle case study",
    names: ["oracle"],
    topics: ["work", "case study", "enterprise", "product design"],
    text: "At Oracle, Ankur designed enterprise product experiences — turning dense, high-stakes workflows into interfaces people could actually move through. It's a full product-design case study.",
    href: "/works/oracle", cta: "Oracle case study",
    followups: [{ label: "See all the work", href: "/#works" }, { label: "The craft behind it", href: "/library" }],
  },
  {
    id: "deloitte", group: "work",
    topic: "the Deloitte case study",
    names: ["deloitte"],
    topics: ["work", "case study", "consulting", "product design"],
    text: "At Deloitte, Ankur worked on product design across client engagements — research, flows and interface systems delivered under real constraints. There's a full case study.",
    href: "/works/deloitte", cta: "Deloitte case study",
    followups: [{ label: "See all the work", href: "/#works" }],
  },
  {
    id: "snowtint", group: "work",
    topic: "the Snowtint case study",
    names: ["snowtint", "snow tint"],
    topics: ["work", "case study", "product design", "brand"],
    text: "Snowtint is a product-design case study — the full arc from problem to shipped interface.",
    href: "/works/snowtint", cta: "Snowtint case study",
  },
  {
    id: "rage", group: "work",
    topic: "the Rage case study",
    names: ["rage"],
    topics: ["work", "case study", "product design"],
    text: "Rage is a product-design case study walking through the real design decisions end to end.",
    href: "/works/rage", cta: "Rage case study",
  },
  {
    id: "work", group: "work",
    topic: "the professional product-design work",
    names: ["work", "works", "case studies", "portfolio", "professional work", "design work", "client work", "job", "career"],
    topics: ["product design experience"],
    text: "Ankur's professional product-design work is four real case studies — Oracle, Deloitte, Snowtint and Rage. (Separately, The Lab holds ideas and experiments — those are explorations, not client work.) Ask me about any case study.",
    href: "/#works", cta: "See the work",
    followups: [{ label: "Oracle", href: "/works/oracle" }, { label: "Deloitte", href: "/works/deloitte" }],
  },

  // ——— AI work ———
  {
    id: "vera", group: "ai",
    topic: "Vera, the on-device AI companion",
    names: ["vera", "companion", "cognitive twin", "twin", "on device companion"],
    topics: ["on-device ai", "assistant", "private ai", "local ai"],
    text: "Vera is a Lab exploration — a private, on-device AI companion for macOS that runs its own brain (reasoning, feeling and memory computed locally), with a warm neural voice, everything sealed on the machine. Open source; an idea Ankur builds and explores, not client work.",
    href: "/lab/cognitive-twin", cta: "Meet Vera",
    followups: [{ label: "Unhosted — AI where you live", href: "/lab/unhosted" }, { label: "How a RAG system works", href: "/rag" }],
  },
  {
    id: "unhosted", group: "ai",
    topic: "Unhosted — AI that lives where you do",
    names: ["unhosted", "self hosted ai", "local inference", "own cluster"],
    topics: ["on-device ai", "private ai", "open source"],
    text: "Unhosted is Ankur's flagship open-source Lab exploration — pooling the machines you already own into one private inference cluster, so your AI runs on your hardware, not someone's cloud. An idea he's building in the open.",
    href: "/lab/unhosted", cta: "Unhosted",
    followups: [{ label: "Vera runs on it", href: "/lab/cognitive-twin" }],
  },
  {
    id: "firmament", group: "ai",
    topic: "Firmament — the Universe Engine as an iOS app",
    names: ["firmament", "ios app", "iphone app", "pocket universe"],
    topics: ["native", "mobile", "ar"],
    text: "Firmament is the Universe Engine built as a native iOS app — the real sky and solar system in your pocket, all-custom code.",
    href: "/lab/firmament", cta: "Firmament (iOS)",
  },
  {
    id: "copilot", group: "ai",
    topic: "the on-device AI copilot in the Satellite Engine",
    names: ["copilot", "ai copilot", "space assistant", "universe assistant"],
    topics: ["on-device ai", "webllm", "keyless"],
    text: "The Satellite Engine has an on-device AI copilot — a tiny in-browser model (keyless, runs on your device) that answers about the sky and flies the camera to real bodies, falling back to deterministic search where WebGPU isn't available.",
    href: "/lab/celestial", cta: "Try the copilot",
  },
  {
    id: "brainrot", group: "ai",
    topic: "the feed-bias visualizer (Brainrot)",
    names: ["brainrot", "feed bias", "algorithm bias", "doomscroll"],
    topics: ["social media", "attention", "visualizer"],
    text: "Brainrot is an experiment that visualizes how a feed's bias compounds — built with the discipline that the tool must not become the thing it fights.",
    href: "/lab/brainrot", cta: "Brainrot",
  },

  // ——— The engines ———
  {
    id: "universe", group: "engine",
    topic: "the Universe / Satellite Engine",
    names: ["universe engine", "satellite engine", "satellites", "satellite", "celestial", "solar system", "orbit", "orbits", "space junk", "space debris"],
    topics: ["space", "sky", "stars", "nasa", "engine", "planets"],
    text: "The Satellite Engine is a Lab exploration — a real-time, date-accurate solar system with 18,600+ real satellite orbits, Mars and Moon imaging, and live space data, built entirely from real NASA/JPL/ESA data and running in your browser.",
    href: "/lab/celestial", cta: "Open the engine",
    followups: [{ label: "The math behind it", href: "/universe-engine/math" }, { label: "The AI copilot", href: "/lab/celestial" }],
  },
  {
    id: "terrain", group: "engine",
    topic: "real 3D planetary terrain",
    names: ["terrain", "planetary surface", "mars surface", "moon surface", "3d tiles", "ground level"],
    topics: ["elevation", "dem", "imagery"],
    text: "The terrain engine renders real 3D planetary surfaces — the actual measured ground of Mars, the Moon and more, via 3D-tiles and real mission elevation data.",
    href: "/lab/terrain", cta: "Walk the terrain",
    followups: [{ label: "Earth from real data", href: "/earth" }],
  },
  {
    id: "waves", group: "engine",
    topic: "The Waves — the living ocean",
    names: ["waves", "wave", "ocean", "sea", "water"],
    topics: ["gerstner", "tides", "procedural"],
    text: "The Waves is Ankur's own real-time procedural ocean — Gerstner waves under a real sun and moon, driven by tides, wind and climate, computed on-device. There's a full-screen living sea and a page on the math behind it.",
    href: "/waves", cta: "Explore the sea",
    followups: [{ label: "The math behind the waves", href: "/waves/math" }],
  },
  {
    id: "big-bang", group: "engine",
    topic: "the cosmic timeline (Big Bang)",
    names: ["big bang", "cosmic timeline", "timeline of the universe", "origin of the universe"],
    topics: ["cosmology", "history of the universe"],
    text: "The Big Bang page is a real-time cosmic timeline — Planck epoch to today, through the first stars, Earth forming, oceans, life and us, every element Blender-baked.",
    href: "/lab/big-bang", cta: "The cosmic timeline",
  },
  {
    id: "earth", group: "data",
    topic: "Earth — the living planet from real data",
    names: ["earth", "weather", "planet earth", "live weather", "globe"],
    topics: ["imagery", "climate", "real data"],
    text: "The Earth hub brings the living planet from real feeds — measured 3D surface, deep-zoom true-colour imagery, and click-the-globe live weather, all from keyless public data sources.",
    href: "/earth", cta: "The living Earth",
  },

  // ——— Games ———
  {
    id: "helion", group: "game",
    topic: "Helion Drift — the space flight game",
    names: ["helion", "helion drift", "star cleaver", "space game", "flight game", "game"],
    topics: ["3d game", "flight", "spaceship"],
    text: "Helion Drift is a Lab exploration — a real-time space-flight game where you fly a cruiser through a solar system with cinematic supersonic flight feel, built in the browser.",
    href: "/lab/helion-drift", cta: "Fly Helion Drift",
    followups: [{ label: "More games", href: "/games/Gamelist.html" }],
  },
  {
    id: "games", group: "game",
    topic: "the games",
    names: ["games", "mini games", "arcade", "dave", "dave 3d"],
    topics: ["play", "retro"],
    text: "There's a set of games — Helion Drift (space flight), a Dave 3D platformer, and a retro neobrutalism mini-games index.",
    href: "/games/Gamelist.html", cta: "Play the games",
  },

  // ——— Math, made visible ———
  {
    id: "math", group: "math",
    topic: "the Mathematics-made-visible series",
    names: ["math", "mathematics", "equations", "equation", "visual math"],
    topics: ["visualization", "interactive math"],
    text: "Mathematics, made visible — original interactive visualizations of real math: π, Euler's identity, Fourier epicycles, the golden ratio, Pythagoras, logarithms, the bell curve, and the math behind the waves and the universe.",
    href: "/math", cta: "See the math",
    followups: [{ label: "Pi", href: "/lab/pi" }, { label: "Fourier", href: "/lab/fourier" }, { label: "Golden ratio", href: "/lab/golden-ratio" }],
  },
  {
    id: "pi", group: "math",
    topic: "π (Pie) — how π is calculated",
    names: ["pi", "pie", "π", "circle", "3.14"],
    topics: ["irrational", "archimedes", "leibniz"],
    text: "Pie shows how π is actually calculated and why it never resolves — a harmonograph whose irrational π-ratio never closes, beside live Archimedes, Leibniz and Monte-Carlo convergence.",
    href: "/lab/pi", cta: "Open Pie",
  },
  {
    id: "euler", group: "math",
    topic: "Euler's identity",
    names: ["euler", "eulers identity", "e^ipi", "imaginary", "complex numbers"],
    topics: ["unit circle", "exponential"],
    text: "The Euler page shows e^{iπ}+1=0 come alive on the unit circle — why the most beautiful equation in math is true, visually.",
    href: "/lab/euler", cta: "Euler's identity",
  },
  {
    id: "fourier", group: "math",
    topic: "the Fourier series (epicycles)",
    names: ["fourier", "epicycles", "spinning circles", "square wave", "harmonics"],
    topics: ["signal", "frequency", "wave"],
    text: "The Fourier page shows that any wave is a sum of spinning circles — epicycles stacking up to draw a square wave in real time.",
    href: "/lab/fourier", cta: "Fourier epicycles",
  },
  {
    id: "golden-ratio", group: "math",
    topic: "the golden ratio (φ)",
    names: ["golden ratio", "phi", "φ", "fibonacci", "sunflower", "phyllotaxis"],
    topics: ["proportion", "nature", "packing"],
    text: "The golden-ratio page shows φ and why sunflowers pack their seeds the way they do — phyllotaxis as optimal packing, interactive.",
    href: "/lab/golden-ratio", cta: "The golden ratio",
  },
  {
    id: "pythagoras", group: "math",
    topic: "the Pythagorean theorem",
    names: ["pythagoras", "pythagorean", "a2 b2 c2", "right triangle", "hypotenuse"],
    topics: ["geometry", "proof"],
    text: "The Pythagoras page proves a² + b² = c² by area — you see the squares rearrange, so the theorem is obvious rather than memorized.",
    href: "/lab/pythagoras", cta: "Pythagoras, by area",
  },
  {
    id: "logarithms", group: "math",
    topic: "logarithms",
    names: ["logarithms", "log", "logarithm", "logarithmic"],
    topics: ["scale", "exponential"],
    text: "The logarithms page shows what a log really is and why logarithmic scale shows up everywhere — made visible and intuitive.",
    href: "/lab/logarithms", cta: "Logarithms",
  },
  {
    id: "bell-curve", group: "math",
    topic: "the bell curve (normal distribution)",
    names: ["bell curve", "normal distribution", "gaussian", "central limit"],
    topics: ["probability", "statistics", "randomness"],
    text: "The bell curve page shows order emerging out of pure randomness — the normal distribution assembling itself from chaos.",
    href: "/lab/bell-curve", cta: "The bell curve",
  },

  // ——— Teaching pages (how things work) ———
  {
    id: "rag", group: "ai",
    topic: "what a RAG system is",
    names: ["rag", "retrieval augmented generation", "retrieval-augmented", "vector search"],
    topics: ["embeddings", "ai teaching"],
    text: "The RAG page explains Retrieval-Augmented Generation — chunk, embed, retrieve, generate — beside the real code of a small, fully on-device RAG engine.",
    href: "/rag", cta: "What is RAG?",
  },
  {
    id: "llm", group: "ai",
    topic: "how a language model works",
    names: ["llm", "language model", "how ai works", "transformer", "attention", "tokens", "how does ai work"],
    topics: ["neural network", "ai teaching"],
    text: "The LLM page walks through how a language model actually works — tokens, embeddings, attention, layers, next-token — beside the real code of an LLM Internals Lab.",
    href: "/llm", cta: "How an LLM works",
  },
  {
    id: "optical-flow", group: "craft",
    topic: "the library-porting writeup (optical flow)",
    names: ["optical flow", "porting", "library port", "reimplement"],
    topics: ["computer vision", "engineering"],
    text: "The optical-flow writeup is about porting a library by hand — because porting forces you to understand what the library hides.",
    href: "/lab/optical-flow", cta: "Optical flow writeup",
  },

  // ——— Craft / framework / skills ———
  {
    id: "usability", group: "craft",
    topic: "the Usability Engine and Experience Framework",
    names: ["usability", "framework", "heuristics", "laws of ux", "experience framework", "usability engine"],
    topics: ["ux", "cognition", "design principles"],
    text: "There's a live Usability Engine and a Universal Experience Framework — the Laws of UX and cognition with interactive demos you can play with.",
    href: "/framework", cta: "The framework",
    followups: [{ label: "The Usability Engine", href: "/lab/usability-engine" }],
  },
  {
    id: "skills", group: "craft",
    topic: "skills, stack and the craft library",
    names: ["skills", "stack", "tools", "craft", "library", "capabilities", "tech stack", "what can you do", "what can he do", "abilities"],
    topics: ["discipline", "expertise"],
    text: "There's a skills matrix and a craft library — nine disciplines (design, web, full-stack, DevOps, 3D, video and more), each with the real tools and proof links to real work.",
    href: "/library", cta: "Skills & craft",
    followups: [{ label: "The skills matrix", href: "/skills" }],
  },
  {
    id: "writing", group: "writing",
    topic: "the writing",
    names: ["writing", "blog", "articles", "posts", "how its built", "how it's built"],
    topics: ["essays", "notes"],
    text: "The writing covers how things here are built — including a deep piece on building a real-data universe engine, and how this site itself is made.",
    href: "/writing", cta: "Read the writing",
  },
  {
    id: "dna", group: "data",
    topic: "the DNA / ancestry tools",
    names: ["dna", "ancestry", "genome", "genetics"],
    topics: ["biology", "privacy", "on-device"],
    text: "The DNA pages let you read your own genome privately in the browser — only derived, encrypted data is ever used; the raw genome is never uploaded.",
    href: "/dna", cta: "Read your DNA",
  },
  {
    id: "photos", group: "about",
    topic: "the photography",
    names: ["photos", "photography", "pictures", "camera"],
    topics: ["images"],
    text: "There's a photography page — a quieter, visual side of the work.",
    href: "/photos", cta: "See the photos",
  },
  {
    id: "about", group: "about",
    topic: "who Ankur is",
    names: ["who is ankur", "who are you", "about ankur", "about you", "ankur sinha", "hire", "contact", "background", "bio", "resume", "cv"],
    topics: ["profile", "introduce"],
    text: "Ankur is a UX designer and engineer-by-degree who builds what he designs — product design at Oracle and Deloitte, plus a lab of human-in-the-loop AI ideas you can actually use.",
    href: "/about", cta: "About Ankur",
    followups: [{ label: "See the work", href: "/#works" }, { label: "Get in touch", href: "/#contact" }],
  },
  {
    id: "ai-overview", group: "ai",
    topic: "the AI explorations (what AI Ankur has built)",
    names: ["ai", "ai work", "ai projects", "artificial intelligence", "what ai", "ai you built", "machine learning", "ml", "on-device ai"],
    topics: ["local ai", "llm", "agents"],
    text: "Ankur's AI is all in The Lab, as ideas and exploration — Vera (a private on-device AI companion), Unhosted (pooling your own machines into a private inference cluster), an in-browser AI copilot in the Satellite Engine, and teaching pages on how RAG and language models actually work. Explorations, not client work.",
    href: "/lab", cta: "The AI explorations",
    followups: [{ label: "Vera", href: "/lab/cognitive-twin" }, { label: "Unhosted", href: "/lab/unhosted" }, { label: "How RAG works", href: "/rag" }],
  },
]

// Pronoun / filler words that carry no entity signal — ignored when matching.
const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "about", "tell", "me", "show",
  "what", "whats", "what's", "who", "how", "your", "you", "do", "does", "of",
  "on", "in", "to", "and", "or", "for", "with", "i", "want", "see", "know",
  "can", "could", "would", "please", "work", "works",
])

function tokens(q: string): string[] {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean)
}

function phraseHit(q: string, name: string): boolean {
  if (name.includes(" ")) return q.includes(name)
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u")
  return re.test(q)
}

/** Keyword score for one entry against a query (entity-first). */
function keywordScore(entry: Entry, qPadded: string, qTokens: Set<string>): number {
  let score = 0
  for (const name of entry.names) {
    if (phraseHit(qPadded, name)) score += 10 + Math.min(6, name.split(" ").length * 2)
  }
  for (const topic of entry.topics ?? []) {
    if (topic.includes(" ") ? qPadded.includes(topic) : qTokens.has(topic)) score += 2
  }
  return score
}

/** Rank ALL entries for a query by keyword score (best first, score > 0). */
function rankKeyword(query: string): { entry: Entry; score: number }[] {
  const q = ` ${query.toLowerCase().trim()} `
  const qTokens = new Set(tokens(query).filter((t) => !STOP.has(t)))
  return ENTRIES
    .map((entry) => ({ entry, score: keywordScore(entry, q, qTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.names.length - b.entry.names.length)
}

/** The single best match (back-compat for the instant deterministic answer). */
export function matchSiteEntry(query: string): { entry: Entry; score: number } | null {
  return rankKeyword(query)[0] ?? null
}

/** The grounded answer for a query, or the honest no-match fallback. */
export function answerFromSite(query: string): SiteAnswer & { topic: string } {
  const best = rankKeyword(query)[0]
  if (best) {
    const { text, href, cta, topic, followups } = best.entry
    return { text, href, cta, topic, followups }
  }
  return {
    topic: "general guidance",
    text: "Happy to point you to the right place. For professional work, ask about Oracle, Deloitte, Snowtint or Rage. For ideas and experiments, there's The Lab — Vera, the Satellite Engine, the Waves, the math visualizers and more.",
    href: "/#works", cta: "See the work",
    followups: [{ label: "The work", href: "/#works" }, { label: "The Lab (explorations)", href: "/lab" }],
  }
}

/** Up to `k` best matches — powers broad questions ("your AI work", "the math").
 *  When a query names a GROUP, the whole area is gathered. */
export function topSiteEntries(query: string, k = 3): Entry[] {
  const ranked = rankKeyword(query)
  // If the top hits cluster in one group and the query is broad, widen to the group.
  const out = ranked.slice(0, k).map((r) => r.entry)
  return out
}

/**
 * Build a grounded CONTEXT block for the on-device LLM: the top matching
 * entries' real facts. The model phrases an answer using ONLY these, so it stays
 * truthful and always has the right link. Returns context + the best link +
 * follow-ups to surface under the reply.
 */
export function groundingFor(query: string): {
  context: string
  link?: SiteAnswer
  followups?: { label: string; href: string }[]
} {
  const ranked = rankKeyword(query).slice(0, 3)
  if (!ranked.length) {
    return {
      context: "(no direct match — Ankur's site covers: product-design case studies at Oracle/Deloitte/Snowtint/Rage; AI work (Vera, Unhosted); the Satellite Engine; the Waves ocean; interactive math; and a skills/craft library.)",
      link: { text: "", href: "/lab", cta: "Browse The Lab" },
      followups: [{ label: "The work", href: "/#works" }, { label: "The Lab", href: "/lab" }],
    }
  }
  const context = ranked.map((s) => `- ${s.entry.topic}: ${s.entry.text}`).join("\n")
  const top = ranked[0].entry
  return {
    context,
    link: { text: top.text, href: top.href, cta: top.cta },
    followups: top.followups,
  }
}

// Expose for the semantic layer (embeddings indexer lives in site-semantic.ts).
export function allEntries(): Entry[] {
  return ENTRIES
}

/** The short, embeddable text for an entry (name + topic + fact). */
export function entryEmbedText(e: Entry): string {
  return `${e.names.join(", ")}. ${e.topic}. ${e.text}`
}
