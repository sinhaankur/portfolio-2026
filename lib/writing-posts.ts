/**
 * writing-posts — data-driven SHORT blog posts.
 *
 * Long-form essays get their own hand-built route (e.g. /writing/universe-engine).
 * Short posts live here as data and render through the shared [slug] template —
 * so a new short note is a few paragraphs, not a new page component.
 *
 * Voice: terse, concrete, first-person, honest. No marketing. Each post is a
 * short lead + a few small sections.
 */

export type PostSection = { heading?: string; body: string }

export type ShortPost = {
  slug: string
  title: string
  date: string // ISO
  blurb: string
  lead: string
  sections: PostSection[]
  /** Optional link back to the live thing the post is about. */
  live?: { href: string; label: string }
}

export const SHORT_POSTS: ShortPost[] = [
  {
    slug: "dna-deep-time",
    title: "Your DNA, as a walk through deep time",
    date: "2026-07-25",
    blurb:
      "A log-scaled timeline from human origins ~300,000 years ago to today, with each chapter your DNA passed through pinned at its real date.",
    lead:
      "The DNA page now opens its Origins tab with a single timeline: from the emergence of modern humans in Africa to you, today. The trick is the scale — 300,000 years on one line — and keeping every date real.",
    sections: [
      {
        heading: "Why log time",
        body:
          "On a linear axis, everything interesting — the Neolithic, the Bronze Age, the variants you personally carry — crushes into the last fraction of a percent. Log time spreads the recent, dense chapters out so you can actually read them, while still fitting deep time on the same line.",
      },
      {
        heading: "Three layers, one axis",
        body:
          "The shared human arc (out of Africa, ice-age dispersals, the Neolithic) is drawn for everyone. On top of it sit the chapters your own ancestry-informative variants trace, each placed at the date that variant arose. And when a real ancestry breakdown is available, it layers the actual era-by-era composition on — heritage, not a precise verdict.",
      },
      {
        heading: "Personal data stays personal",
        body:
          "The real percentages can't be reproduced from a raw DNA file — they come from a proprietary ancestry analysis — and they're personal, so they never ship in the public code. They load from a local-only file that git is told to ignore; the public site shows the general educational arc. Same rule as the rest of the DNA page: your genome never leaves your browser.",
      },
    ],
    live: { href: "/dna", label: "The DNA page" },
  },
  {
    slug: "dna-tools",
    title: "Four small DNA tools",
    date: "2026-07-25",
    blurb:
      "A cM Explainer, an ethnicities map, a chromosome browser, and AutoClusters — interactive, and honest about what they can and can't tell you.",
    lead:
      "I built the four genealogy tools people actually reach for, each as a working, interactive thing rather than a screenshot — and each careful about the difference between a probability and a verdict.",
    sections: [
      {
        heading: "cM Explainer",
        body:
          "Enter the DNA you share with a match, in centimorgans. Because DNA recombines differently every generation, one amount fits several relationships at once — so instead of pretending to give a single answer, it shows the whole candidate set ranked by fit, from the community Shared cM Project's real ranges.",
      },
      {
        heading: "Ethnicities map",
        body:
          "Which ancestries are common where, and where each is concentrated. Deliberately continental-scale — that's the resolution population genetics actually supports — with no fake per-person precision.",
      },
      {
        heading: "Chromosome browser + AutoClusters",
        body:
          "The chromosome browser paints the segments you share with matches across all 23 chromosomes; where several matches overlap on the same spot, that's a cue toward a shared ancestor. AutoClusters groups matches who also match each other into likely family branches. Both need match data, which a raw file doesn't contain — so they run on a clearly-labelled demo publicly, and on your real export locally.",
      },
    ],
    live: { href: "/dna/tools", label: "DNA tools" },
  },
  {
    slug: "cinematic-descent",
    title: "Making the home page one continuous descent",
    date: "2026-07-25",
    blurb:
      "The landing galaxy now persists behind the scroll, so the opening reads as one fall through space instead of a hero that snaps off into flat sections.",
    lead:
      "The home page used to be a full-screen galaxy that scrolled away into ordinary sections. Now the galaxy stays — the principle lines of the intro pass over the live sky, which then dissolves as the readable content arrives.",
    sections: [
      {
        heading: "One engine, promoted to a backdrop",
        body:
          "The trick was not mounting a second 3D scene (that would be two heavy engines fighting for the GPU). The single galaxy the hero already runs is promoted to a fixed backdrop that stays pinned while you scroll into the act break, then fades out on a scroll-driven opacity before the text sections — so words never fight the stars.",
      },
      {
        heading: "The layering has to be exact",
        body:
          "For a fixed element to persist behind later sections, the hero can't create a stacking context that traps it, and the content below has to sit on an opaque surface so the faded sky doesn't bleed through. Small CSS rules, but they're the difference between a seamless descent and a mess. Explore mode still works, and reduced-motion keeps the sky still.",
      },
    ],
    live: { href: "/", label: "The home page" },
  },
  {
    slug: "real-glb-bodies",
    title: "Building real space bodies in Blender, honestly",
    date: "2026-07-25",
    blurb:
      "Comet 67P, 'Oumuamua, the Helix Nebula, and TRAPPIST-1's seven worlds — modelled from real data, and labelled as inference where the real shape isn't known.",
    lead:
      "The universe engine is moving from procedural blobs to real Blender models, one body at a time. The interesting constraint isn't the modelling — it's deciding when you're allowed to.",
    sections: [
      {
        heading: "Only 67P gets a real comet shape",
        body:
          "Of every comet in the engine, exactly one has ever been 3D-mapped by a spacecraft: 67P, by ESA's Rosetta. So it gets a real bilobed 'rubber duck' nucleus. Every other comet keeps a generic irregular rock — because inventing a specific shape for a nucleus no one has ever imaged would be a guess dressed as fact, which the engine's whole rule forbids.",
      },
      {
        heading: "Inference, labelled as inference",
        body:
          "'Oumuamua was never resolved as a disk; its extreme brightness swings imply an elongated cigar, so it gets one — but the caption says the shape is inferred from its light curve, because it is. TRAPPIST-1's seven planets get surfaces by type (hot bare rock to icy snowball) from their measured radius and insolation, not invented detail. The Helix Nebula, being gas rather than a surface, is built from translucent emissive shells so it glows instead of reading as plastic.",
      },
    ],
    live: { href: "/lab/celestial", label: "The Satellite Engine" },
  },
  {
    slug: "adaptive-quality",
    title: "Using the machine you're actually on",
    date: "2026-07-25",
    blurb:
      "A capable desktop now renders a richer sky at native resolution; a phone stays smooth. Same scene, scaled to the hardware.",
    lead:
      "One quality setting is always wrong for someone — too heavy for a phone, too timid for a gaming desktop. The engine detects the device tier and scales to fit, in both directions.",
    sections: [
      {
        heading: "An 'ultra' tier for real GPUs",
        body:
          "On a clear high-end machine — a discrete RTX or Radeon, or an Apple Max/Ultra, backed up by core count and memory — the engine now renders at up to 3× device pixels (crisp, native-resolution stars) and a denser decorative field: the Milky Way's arms go from 30,000 to 42,000 points. A phone stays on a light, smooth profile.",
      },
      {
        heading: "Guesses get checked",
        body:
          "The tier starts as a guess from hardware signals, but a live frame-rate probe is the ground truth: if the scene actually runs slow, it steps the tier down. It only ever downgrades — never optimistically up — so a machine that can't hold the frames never gets stuck stuttering.",
      },
    ],
    live: { href: "/", label: "The galaxy" },
  },
]

export function getShortPost(slug: string): ShortPost | undefined {
  return SHORT_POSTS.find((p) => p.slug === slug)
}
