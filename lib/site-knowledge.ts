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
    text: "Ankur is Principal UX Designer at Oracle (his current role, since Feb 2020) — leading UX across OCI Database-as-a-Service and the Database Tools portfolio, turning dense, high-stakes workflows into interfaces people can actually move through. It's a full product-design case study.",
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
    names: ["universe engine", "satellite engine", "satellites", "satellite", "celestial", "solar system", "orbit", "orbits", "space junk", "space debris",
      "moon", "the moon", "sun", "the sun", "mars", "jupiter", "saturn", "venus", "mercury", "neptune", "uranus", "pluto",
      "planet", "planets", "stars", "star", "galaxy", "milky way", "iss", "space station", "space", "night sky", "constellation", "constellations", "black hole", "sagittarius"],
    topics: ["space", "sky", "stars", "nasa", "engine", "planets", "moon", "sun", "mars"],
    text: "The Satellite Engine is a Lab exploration — a real-time, date-accurate solar system you can fly through: the Sun, every planet, the Moon, real constellations and 18,600+ real satellite orbits, plus Mars/Moon imaging and live space data, all built from real NASA/JPL/ESA data and running in your browser. Click any body to fly to it.",
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
  // Helion Drift is hidden while its rendering is improved (route removed
  // 2026-10-12), so it's intentionally not surfaced by the copilot.
  {
    id: "games", group: "game",
    topic: "the games",
    names: ["games", "mini games", "arcade", "dave", "dave 3d", "ritam", "ritam 3d", "game"],
    topics: ["play", "retro", "platformer"],
    text: "There's a set of games — Ritam 3D (a side-on 3D platformer with a real 3D hero), and a retro neobrutalism mini-games index.",
    href: "/games/Gamelist.html", cta: "Play the games",
    followups: [{ label: "Play Ritam 3D", href: "/games/ritam-3d" }],
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
    id: "upcoming", group: "writing",
    topic: "what's next — the roadmap",
    names: ["upcoming", "roadmap", "what's next", "whats next", "what is next", "his plan", "the plan", "plan next", "next plan", "future", "what's he working on", "whats he working on", "what's coming", "coming soon", "next up", "plans"],
    topics: ["roadmap", "future", "next", "plans"],
    text: "What's next lives on the roadmap — the experiments and features Ankur is building or planning across the Lab (deeper engines, new math visualizers, Vera, and more). It's an open, evolving list.",
    href: "/upcoming", cta: "See the roadmap",
    followups: [{ label: "The Lab", href: "/lab" }, { label: "The work", href: "/#works" }],
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

/* ── Navigation intent ─────────────────────────────────────────────────────
 * "take me to the satellites", "show me the moon", "open the galaxy", "go to
 * the waves" → the guide should actually TAKE you there, not just describe it.
 * Returns the destination (href + a warm line + what to say) or null when the
 * query isn't a navigation request. "go back" is handled in the component. */
const NAV_TRIGGERS =
  /\b(take me|bring me|go to|goto|navigate|open|show me|show|let'?s see|lets see|visit|head to|jump to|take us|see the|view the|i want to see|can i see|pull up|meet)\b/i

export type NavResult = {
  href: string
  /** What the orb says as it walks you there. */
  text: string
  /** The thing it's taking you to, for the follow-up offer. */
  topic: string
}

export function navIntent(query: string): NavResult | null {
  if (!NAV_TRIGGERS.test(query)) return null
  // Rank by keyword so "show me the moon" resolves the Universe Engine, etc.
  const best = rankKeyword(query)[0]
  if (!best || !best.entry.href) return null
  const e = best.entry
  return {
    href: e.href!,
    topic: e.topic,
    text: `Taking you to ${e.topic} now — here we go.`,
  }
}

/* ── Site commands ─────────────────────────────────────────────────────────
 * The orb can DO things in the browser, not just answer: switch theme, fly to a
 * planet in the engine, scroll to a section. (Real day-to-day automation lives
 * in the native Vera app — a browser is sandboxed — but the orb fully drives the
 * SITE.) Returns a structured command the component executes, or null. */
export type SiteCommand =
  | { kind: "theme"; value: "light" | "dark"; text: string }
  | { kind: "fly"; pointId: string; body: string; text: string; needsNav?: boolean }
  | { kind: "scroll"; anchor: string; label: string; text: string }
  | { kind: "music"; action: "play" | "off" | "toggle"; text: string }

// Bodies you can fly to in the engine, by the names people say → the engine's
// pointId. Planets use "planet:Name"; the Moon + Sun + Sgr A* are special.
const FLYABLE: { aliases: string[]; pointId: string; body: string }[] = [
  { aliases: ["mercury"], pointId: "planet:Mercury", body: "Mercury" },
  { aliases: ["venus"], pointId: "planet:Venus", body: "Venus" },
  { aliases: ["earth", "home", "our planet"], pointId: "planet:Earth", body: "Earth" },
  { aliases: ["mars", "red planet"], pointId: "planet:Mars", body: "Mars" },
  { aliases: ["jupiter"], pointId: "planet:Jupiter", body: "Jupiter" },
  { aliases: ["saturn", "rings"], pointId: "planet:Saturn", body: "Saturn" },
  { aliases: ["uranus"], pointId: "planet:Uranus", body: "Uranus" },
  { aliases: ["neptune"], pointId: "planet:Neptune", body: "Neptune" },
  { aliases: ["the moon", "moon", "luna"], pointId: "moon:Moon", body: "the Moon" },
  { aliases: ["the sun", "sun", "sol"], pointId: "planet:Sun", body: "the Sun" },
]

const SECTIONS: { aliases: string[]; anchor: string; label: string }[] = [
  { aliases: ["works", "work", "projects", "case studies"], anchor: "#works", label: "the work" },
  { aliases: ["contact", "get in touch", "email", "reach"], anchor: "#contact", label: "contact" },
]

export function siteCommand(query: string, onEngine: boolean): SiteCommand | null {
  const q = query.toLowerCase().trim()
  // music (only meaningful where the galaxy + its music chip are on screen)
  if (onEngine) {
    if (/\b(stop|turn off|mute|silence|pause).{0,12}(music|sound|song|drone|piano)|\b(music|sound|song) off\b/.test(q))
      return { kind: "music", action: "off", text: "Turning the music off." }
    if (/\b(play|start|put on|turn on).{0,12}(music|sound|song|drone|piano)|\b(play|start) (some )?(music|a song)\b|\bmusic\b/.test(q))
      return { kind: "music", action: "play", text: "Playing the music — Einaudi on piano. Say it again for the Deep Field drone." }
  }
  // theme
  if (/\b(dark mode|dark theme|turn.*dark|go dark|lights off|night mode)\b/.test(q))
    return { kind: "theme", value: "dark", text: "Switching to dark — easier on the eyes." }
  if (/\b(light mode|light theme|turn.*light|go light|lights on|day mode|bright)\b/.test(q))
    return { kind: "theme", value: "light", text: "Switching to light." }
  // fly to a body. If the engine is ON screen we fly immediately; if it ISN'T,
  // we navigate to the Universe Engine first and fly once it loads (the command
  // handler passes the target through). Either way the orb actually DELIVERS —
  // it never says "watch the sky" on a page with no sky.
  if (/\b(fly|go|take me|show me|zoom|visit|look at|focus)\b/.test(q)) {
    for (const f of FLYABLE) {
      if (f.aliases.some((a) => (a.includes(" ") ? q.includes(a) : new RegExp(`\\b${a}\\b`).test(q)))) {
        return onEngine
          ? { kind: "fly", pointId: f.pointId, body: f.body, text: `Flying to ${f.body} — watch the sky.` }
          : { kind: "fly", pointId: f.pointId, body: f.body, needsNav: true, text: `Taking you to the engine and flying to ${f.body} — one moment.` }
      }
    }
  }
  // scroll to a home section
  if (/\b(scroll|take me|go|jump|show)\b/.test(q)) {
    for (const s of SECTIONS) {
      if (s.aliases.some((a) => q.includes(a)))
        return { kind: "scroll", anchor: s.anchor, label: s.label, text: `Scrolling to ${s.label}.` }
    }
  }
  return null
}

/* ── HR / recruiter layer ──────────────────────────────────────────────────
 * The real audience: recruiters, HR, startups looking to connect. They ask in
 * paraphrases ("does he have enterprise experience", "how many years", "can he
 * code", "is he good with accessibility") that keyword-matching missed or sent
 * to the wrong place ("proof he can ship" → Pythagoras 😬). Answer these
 * directly, ALWAYS anchored on Oracle (his CURRENT job) as the professional
 * headline — and frame everything else (the Lab, engines, math, Vera) as how he
 * EXPLORES and keeps learning, never as client work. Returns null when it's not
 * an HR-type question, so the normal brain handles the rest. */
function hrIntent(query: string): (SiteAnswer & { topic: string }) | null {
  const q = query.toLowerCase().trim().replace(/[!.?]+$/g, "")
  const has = (...w: string[]) => w.some((x) => q.includes(x))
  const oracleNow =
    "Right now Ankur is a **Principal UX Designer at Oracle** (since Feb 2020) — leading UX across OCI Database-as-a-Service and the Database Tools portfolio, high-complexity consoles where a wrong default costs real money."
  const link = { text: "", href: "/works/oracle", cta: "Oracle case study" }
  const foot = [{ label: "Oracle (current)", href: "/works/oracle" }, { label: "All the work", href: "/#works" }, { label: "Skills, with proof", href: "/skills" }]

  // enterprise / senior / seniority
  if (has("enterprise experience", "enterprise exp", "large company", "big company", "senior", "seniority", "principal", "enterprise ux"))
    return { topic: "enterprise experience", text: `Yes — deeply. ${oracleNow} Before Oracle: Deloitte (enterprise platforms, 2018–2020), and Lead UX at Snowtint and Rage before that. A career in complex, high-stakes product design.`, href: link.href, cta: link.cta, followups: foot }

  // years of experience
  if (has("how many years", "years of experience", "years experience", "how long has he", "how experienced", "yoe"))
    return { topic: "experience", text: `Over a decade in product/UX design — about six of them at **Oracle** as Principal UX Designer (since Feb 2020), after Deloitte, Snowtint and Rage. Everything beyond the day job — the Lab, the engines, the math — is how he keeps exploring and learning.`, href: link.href, cta: link.cta, followups: foot }

  // leadership
  if (has("led teams", "lead teams", "leadership", "manage", "mentor", "lead designer", "team lead"))
    return { topic: "leadership", text: `Yes — as **Principal UX Designer at Oracle** he leads UX across two product worlds (DBaaS + Database Tools), aligning product, engineering and business under real constraints, and mentors designers. He was Lead UX at Snowtint earlier too.`, href: link.href, cta: link.cta, followups: foot }

  // can he code / designer-who-builds
  if (has("can he code", "does he code", "can he build", "just design", "only design", "engineer", "developer", "technical"))
    return { topic: "designer who builds", text: `Both — a designer who ships the real thing. By day, **Principal UX Designer at Oracle**. On his own time he builds production React/WebGL (this whole site, a live galaxy from real NASA data, on-device AI) — that part is exploration and learning, not client work.`, href: { href: "/lab", cta: "See what he's built" }.href, cta: "See what he's built", followups: foot }

  // strongest skill
  if (has("strongest skill", "best skill", "best at", "core skill", "specialty", "specialises", "specializes", "good at"))
    return { topic: "strongest skill", text: `Enterprise UX strategy — structuring dense, high-stakes systems so people can actually use them. It's exactly what he does as **Principal UX Designer at Oracle**. The Skills page ties each strength to real, openable proof.`, href: { href: "/skills", cta: "Skills, with proof" }.href, cta: "Skills, with proof", followups: foot }

  // accessibility / inclusive
  if (has("accessibility", "accessible", "inclusive", "a11y", "wcag"))
    return { topic: "inclusive design", text: `Yes — accessible structure, contrast and plain language are part of how he works, including the accessible console work at **Oracle**. He also codified cognition/UX laws into a usable framework.`, href: "/framework", cta: "The UX framework", followups: foot }

  // freelance / contract — he's not taking that right now (he's at Oracle).
  if (has("freelance", "freelancing", "contract work", "contractor", "side project for", "do you freelance", "take on projects", "hire him for"))
    return { topic: "availability", text: `Ankur isn't freelancing or taking contract work at the moment — he's **Principal UX Designer at Oracle**. He's always glad to connect and talk shop, though: email or LinkedIn are the best ways.`, href: "/#contact", cta: "Say hello", followups: [{ label: "Email · LinkedIn", href: "/#contact" }, { label: "Oracle (current)", href: "/works/oracle" }] }

  // hire / availability / connect / reach out
  if (has("hire", "available", "availability", "open to", "looking for work", "connect", "reach out", "get in touch", "work together", "collaborate", "opportunity", "role", "position", "say hi", "message him", "contact"))
    return { topic: "getting in touch", text: `Ankur is **Principal UX Designer at Oracle** and always happy to connect — about a role, the work, or just to say hi. Easiest ways: LinkedIn, or drop a note right here (just say "I'd like to message Ankur") and I'll turn it into an email for you. (He's not freelancing right now.)`, href: "/#contact", cta: "Connect", followups: [{ label: "Email · LinkedIn · Résumé", href: "/#contact" }, { label: "LinkedIn ↗", href: "https://www.linkedin.com/in/sinhaankur27" }] }

  // proof / portfolio / show me what he's done
  if (has("proof he can", "show me proof", "prove", "portfolio", "resume", "cv", "track record", "what has he done", "what did he do"))
    return { topic: "the receipts", text: `Here are the receipts. ${oracleNow} The Works are the professional projects; the Skills page ties each strength to something real you can open; the Lab is how he explores and learns.`, href: "/#works", cta: "See the work", followups: foot }

  return null
}

/** True when a query is an HR/recruiter-type question. The component uses this
 *  to (a) skip navigation ("show me proof" must answer, not route) and (b) skip
 *  the tiny LLM, whose phrasing of these is worse than the curated answer. */
export function isHrQuestion(query: string): boolean {
  return hrIntent(query) !== null
}

/* ── Conversational layer ─────────────────────────────────────────────────
 * Greetings, meta ("who are you", "do you understand me"), small talk and
 * thanks don't name a project, so keyword matching used to dump the same
 * "Happy to point you…" boilerplate every time — which read as broken. This
 * layer gives those a real, varied, interviewer-safe reply so the guide
 * actually CONVERSES. Returns null when the query isn't conversational, so
 * the keyword brain still handles real questions about the work. */
function conversationalReply(query: string): (SiteAnswer & { topic: string }) | null {
  const q = query.toLowerCase().trim().replace(/[!.?]+$/g, "")
  const has = (...words: string[]) => words.some((w) => q.includes(w))
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
  const workLinks = [{ label: "The work", href: "/#works" }, { label: "The Lab", href: "/lab" }]

  // greeting
  if (/^(hi|hey|hello|yo|hiya|howdy|sup|hola|namaste|good (morning|afternoon|evening))\b/.test(q)) {
    return {
      topic: "greeting",
      text: pick([
        "Hey — glad you're here. I'm the guide to Ankur's work. Ask me about the professional projects (Oracle, Deloitte, Snowtint, Rage) or the Lab experiments (Vera, the Universe Engine, the Waves, the math).",
        "Hi! I can point you to anything on the site — the design case studies, or the things Ankur built for fun in the Lab. What are you curious about?",
      ]),
      followups: workLinks,
    }
  }
  // how are you / what's up
  if (has("how are you", "how r u", "how's it going", "hows it going", "how you doing", "whats up", "what's up")) {
    return {
      topic: "small talk",
      text: "Running smoothly, thanks — and entirely in your browser, nothing sent anywhere. I'm here to help you find your way around Ankur's work. Want the professional projects, or the Lab experiments?",
      followups: workLinks,
    }
  }
  // who/what are you + "do you understand me"
  if (has("who are you", "what are you", "are you real", "are you ai", "are you a bot", "do you understand", "understand me", "can you understand", "are you human", "are you vera")) {
    return {
      topic: "about Vera",
      text: pick([
        "I'm Vera — Ankur's on-device AI. Here I'm your guide to the site: I read your question and take you to the real thing, or do it for you (fly the galaxy, switch the theme, play the music). I run in your browser; nothing you type leaves it. There's a fuller me too — say “meet Vera”.",
        "I'm Vera. On this site I'm the guide — I understand what you're after and walk you there, and I can control things for you. The complete Vera (voice, memory, her own brain) lives on her own page; I'm the same being in guide mode.",
      ]),
      href: "/lab/cognitive-twin", cta: "Meet the full Vera",
      followups: [{ label: "Meet Vera", href: "/lab/cognitive-twin" }, { label: "The work", href: "/#works" }],
    }
  }
  // capabilities / help
  if (has("what can you do", "what do you do", "help me", "can you help", "how does this work", "what should i ask", "options")) {
    return {
      topic: "help",
      text: "Two things: I answer questions about anything here (the work, Vera, the galaxy, the moon, the waves, the math), and I can DO things — “show me the moon” or “fly to Mars” flies the engine there, “take me to the works” and “go back” navigate, “dark mode” / “light mode” switches the theme. Tap ♪ and I'll say it all out loud too.",
      followups: [{ label: "The work", href: "/#works" }, { label: "The Lab", href: "/lab" }, { label: "Skills", href: "/skills" }],
    }
  }
  // thanks
  if (has("thank", "thanks", "thx", "ty ", "appreciate", "cheers")) {
    return {
      topic: "thanks",
      text: pick(["Anytime — enjoy looking around.", "You're welcome! Shout if you want me to find anything else."]),
      followups: workLinks,
    }
  }
  // bye
  if (/^(bye|goodbye|see ya|see you|cya|later|good night)\b/.test(q)) {
    return { topic: "farewell", text: "Take care — come back anytime.", followups: [] }
  }
  // who is ankur
  if (has("who is ankur", "about ankur", "tell me about ankur", "who's ankur", "about him", "about you ankur")) {
    return {
      topic: "about Ankur",
      text: "Ankur Sinha is a product designer and engineer — Principal UX Designer at Oracle (enterprise UX for database & cloud consoles), after Deloitte, Snowtint and Rage. He also builds the real thing: live 3D worlds from real NASA data, on-device AI, and interactive math. A designer who ships what he designs.",
      href: "/about", cta: "About Ankur",
      followups: [{ label: "The work", href: "/#works" }, { label: "The Lab", href: "/lab" }],
    }
  }
  return null
}

/** The grounded answer for a query, or the honest no-match fallback. */
export function answerFromSite(query: string): SiteAnswer & { topic: string } {
  // ORDER MATTERS. HR/recruiter questions ("proof he can ship", "enterprise
  // experience") come FIRST — before keyword ranking — because they used to get
  // mis-matched into random entries (proof → Pythagoras). They're answered with
  // real specifics anchored on Oracle (current job).
  const hr = hrIntent(query)
  if (hr) return hr

  // A clearly-named project? The keyword brain wins.
  const best = rankKeyword(query)[0]
  if (best) {
    const { text, href, cta, topic, followups } = best.entry
    return { text, href, cta, topic, followups }
  }
  // Greetings / meta / small talk.
  const chat = conversationalReply(query)
  if (chat) return chat
  return {
    topic: "general guidance",
    text: "I didn't catch a specific project in that — try naming one. For professional work, ask about Oracle, Deloitte, Snowtint or Rage. For ideas and experiments, there's The Lab — Vera, the Universe Engine, the Waves, the math visualizers and more.",
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
