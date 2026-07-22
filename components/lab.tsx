"use client"

/**
 * Section 05 — The Lab.
 *
 * Previous version was dense: the flagship Unhosted card had three
 * metadata chips, a long blurb, a three-up trust-mode strip (duplicate
 * of case-study content), a decorative concentric-ring backdrop visible
 * only on hover, plus both an arrow icon AND a "Read the case study"
 * text. Each product card carried a redundant "Open source" eyebrow
 * with icon. The trilogy callout was a third distinct content block
 * making the section feel like three sections in a trench coat.
 *
 * Tightened to:
 *   - flagship card with one chip cluster, no trust-mode duplication,
 *     no decorative ring, single CTA
 *   - product cards with the "Open source" eyebrow lifted to a single
 *     section-level label, fewer per-card layers
 *   - trilogy callout moved to a slim inline strip rather than its own
 *     bordered band
 */

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, Github } from "lucide-react"

/** Honest per-project status. Drives the small pill in the card's top-right. */
type ProductStatus = "building" | "live" | "exploration"

const STATUS_META: Record<
  ProductStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  // Warm amber — actively in progress.
  building: {
    label: "Building",
    dot: "bg-[#f0b86c]",
    text: "text-[#f0b86c]",
    ring: "border-[#f0b86c]/30 bg-[#f0b86c]/10",
  },
  // Accent green — working / shipped.
  live: {
    label: "Live",
    dot: "bg-accent",
    text: "text-accent",
    ring: "border-accent/30 bg-accent/10",
  },
  // Muted — an experiment, not actively maintained.
  exploration: {
    label: "Exploration",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "border-border bg-secondary/40",
  },
}

type Product = {
  name: string
  tagline: string
  blurb: string
  stack: string[]
  href: string
  highlight?: string
  status?: ProductStatus
}

// HAND-PICKED by Ankur (2026-07-14): this is a curated shelf, not an
// auto-synced GitHub feed. Add or remove entries ONLY on his call.
const products: Product[] = [
  {
    name: "WatchTower",
    tagline: "Self-hosted deployment platform",
    blurb:
      "Operator-facing tooling for container auto-updates, multi-node deployment, and guided host operations across your own machines. One operator can see live status across six interconnected tools and recover any of them.",
    stack: ["Python", "Electron", "VS Code", "PyPI"],
    href: "https://github.com/sinhaankur/WatchTower",
    highlight: "Ships across 6 distribution channels",
    status: "exploration",
  },
  {
    name: "Cognitive Twin",
    tagline: "Digital-twin agent architecture",
    blurb:
      "The public repo behind the blueprint above: local-first context store, behavioral rehearsal, deterministic guardrails. A personal agent that learns decision style, not just prompts — and runs entirely on your machine.",
    stack: ["Python", "Local-first", "Agents"],
    href: "https://github.com/sinhaankur/cognitive-twin-agent",
    highlight: "Blueprint at /lab/cognitive-twin",
    status: "building",
  },
  {
    name: "EMPATHEIA",
    tagline: "Multi-modal AI companion, offline-first",
    blurb:
      "Next.js + AI SDK PWA. Camera-based facial-expression detection feeds mood-aware tone adaptation. Hybrid fallback: if the model runtime fails, deterministic sentiment + keyword heuristics keep the empathy map updating — the user never sees a dead surface.",
    stack: ["Next.js", "AI SDK", "face-api.js", "Ollama"],
    href: "https://github.com/sinhaankur/ideal-giggle",
    highlight: "PWA · graceful degradation",
    status: "building",
  },
]


export function Lab() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section
      aria-labelledby="lab-heading"
      className="relative py-24 md:py-32 px-6 md:px-12 border-t border-border"
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-14 md:mb-20 max-w-3xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            THE LAB — EXPLORATION
          </p>
          {/* h1: this component only renders on the standalone /lab page (moved
              off the home scroll 2026-06-17), where it is the page's title —
              the ScrollCinema overture above is aria-hidden decoration. */}
          <h1
            id="lab-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            How I'm learning AI — by building it.
          </h1>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            Self-directed, <span className="text-foreground">open-source</span>{" "}
            experiments — not client or employer work. Each is a way to learn the
            human–AI seam hands-on: the design argument shipped as working
            software, in evenings and weekends.
          </p>
        </motion.div>

        {/* Flagship: Unhosted — tightened. Single chip cluster, no decorative
            ring, no duplicate trust-mode strip. One headline, one paragraph,
            one CTA. The case study handles the depth. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/unhosted"
            data-cursor-hover
            aria-label="Unhosted — read the case study"
            className="
              group relative block
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-7 md:p-10 lg:p-12
            "
          >
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-accent text-accent rounded-full">
                Flagship · Currently building
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                Apache 2.0
              </span>
            </div>

            <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
              Unhosted — <span className="italic">AI that lives where you do.</span>
            </h3>

            <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
              Frontier-class AI inference on hardware you own. Pool your
              machines — and optionally your friends', and optionally a public
              swarm of strangers' GPUs — into one inference cluster. Three
              trust modes; the radius is the product.
            </p>

            <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
              Read the case study
              <motion.span
                aria-hidden="true"
                whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                transition={{ duration: 0.3 }}
                className="inline-flex"
              >
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </motion.span>
            </div>
          </Link>
        </motion.div>

        {/* Usability Engine — paired flagship card. Same shape as Unhosted
            but with a "Live demo" eyebrow and a slightly quieter accent so
            Unhosted reads as the lead. The case study lives at
            /lab/usability-engine; the live engine still lives at /usability. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/usability-engine"
            data-cursor-hover
            aria-label="Usability Engine — read the case study"
            className="
              group relative block
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-7 md:p-10 lg:p-12
            "
          >
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                Live demo · Open source
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                12 heuristics
              </span>
            </div>

            <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
              Usability Engine — <span className="italic">an audit catalog you can run.</span>
            </h3>

            <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
              Nielsen's 10 rewritten for modern surfaces, plus two extensions
              for AI agents — "Uncertainty must be legible" and "Reversibility
              is the policy axis." Each row carries its audit question, its
              LLM prompt, and where it makes sense, an interactive good-vs-bad
              demo. Local Ollama, opt-in. No backend.
            </p>

            <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
              Read the case study
              <motion.span
                aria-hidden="true"
                whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                transition={{ duration: 0.3 }}
                className="inline-flex"
              >
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </motion.span>
            </div>
          </Link>
        </motion.div>

        {/* Live experiments — the four working demos at GRID weight, so the
            two flagship case studies above keep the lead. One deliberate
            rhythm break instead of six identical full-width slabs in a row
            (the old page scrolled like the same card six times). */}
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Live experiments
          </p>
          <span aria-hidden="true" className="flex-1 h-px bg-border" />
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground/70">4</p>
        </div>
        <div className="grid gap-4 md:gap-5 md:grid-cols-2 mb-14 md:mb-16">

        {/* Cognitive Twin Agent — architecture-first lab case study. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="h-full"
        >
          <Link
            href="/lab/cognitive-twin"
            data-cursor-hover
            aria-label="Cognitive Twin Agent — read the case study"
            className="
              group relative flex h-full flex-col
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-6 md:p-8
            "
          >
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                Architecture · In progress
              </span>
              {/* Repo went public 2026-07 — chip updated from "Private repo". */}
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                Open source
              </span>
            </div>

            <h3 className="font-display text-2xl md:text-3xl font-light tracking-[-0.02em] leading-[1.1] text-foreground">
              Cognitive Twin Agent — <span className="italic">decision style, not just prompts.</span>
            </h3>

            <p className="mt-4 flex-1 font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
              A personal AI operator architecture built around local-first context,
              behavioral rehearsal, and deterministic guardrails. Three-layer
              execution model: persona, tools, and critique loop.
            </p>

            <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
              Read the build blueprint
              <motion.span
                aria-hidden="true"
                whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                transition={{ duration: 0.3 }}
                className="inline-flex"
              >
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </motion.span>
            </div>
          </Link>
        </motion.div>

        {/* Optical Flow — live in-browser computer vision (Shi-Tomasi + Lucas-Kanade) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="h-full"
        >
          <Link
            href="/lab/optical-flow"
            data-cursor-hover
            aria-label="Optical Flow — live feature tracking in the browser"
            className="
              group relative flex h-full flex-col overflow-hidden
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-6 md:p-8
            "
          >
            {/* a scatter of faint dots in the corner — a nod to the effect */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-40 md:opacity-60 transition-transform duration-700 group-hover:scale-105"
              style={{ background: "radial-gradient(circle, rgba(255,180,120,0.4), rgba(80,200,255,0.18) 50%, transparent 72%)" }}
            />
            <div className="relative flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                  Live · Computer vision
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                  Built from scratch
                </span>
              </div>

              <h3 className="font-display text-2xl md:text-3xl font-light tracking-[-0.02em] leading-[1.1] text-foreground">
                Optical Flow — <span className="italic">watch yourself become data.</span>
              </h3>

              <p className="mt-4 flex-1 font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
                Shi-Tomasi corner detection and Lucas-Kanade optical flow,
                ported by hand to TypeScript and run live on your camera —
                you resolve into a cloud of tracked feature points. No OpenCV,
                no server; the classic algorithms, by hand.
              </p>

              <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
                Step into the camera
                <motion.span
                  aria-hidden="true"
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </motion.span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Celestial — live real-time solar-system explorer (real orbits, satellites, data) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="h-full"
        >
          <Link
            href="/lab/celestial"
            data-cursor-hover
            aria-label="Celestial — a live real-time solar system explorer with real satellite orbits, Mars imaging coverage, and live space data"
            className="
              group relative flex h-full flex-col overflow-hidden
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-6 md:p-8
            "
          >
            {/* Mars peeking from the corner */}
            <img
              src="/img/space/mars-globe.webp"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="pointer-events-none absolute -right-16 -top-16 w-56 md:w-72 opacity-40 md:opacity-60 transition-transform duration-700 group-hover:scale-105"
            />
            <div className="relative flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                  Blender · 3D
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                  Open data
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                  AI copilot
                </span>
              </div>

              <h3 className="font-display text-2xl md:text-3xl font-light tracking-[-0.02em] leading-[1.1] text-foreground">
                Celestial — <span className="italic">real worlds, rendered true.</span>
              </h3>

              <p className="mt-4 flex-1 font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
                The Sun and every planet, modelled in Blender from real NASA/USGS
                data — photoreal and interactive, with real satellite orbits and live
                space data. A built-in AI copilot flies the camera in plain language
                (&ldquo;take me to Europa&rdquo;) — keyless, running on a tiny model right
                in your browser.
              </p>

              <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
                Explore the worlds
                <motion.span
                  aria-hidden="true"
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </motion.span>
              </div>
            </div>
          </Link>
        </motion.div>

        </div>
        {/* end Live experiments grid */}

        {/* Big Bang — HIDDEN from the Lab index (2026-06-29): the card oversells
            what the page currently delivers — it doesn't yet showcase the idea.
            The /lab/big-bang route still exists; this only pulls it off the index.
            Restore by removing the `false &&` guard. */}
        {false && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/big-bang"
            data-cursor-hover
            aria-label="Big Bang — the cosmic timeline, real-time and scientifically accurate"
            className="
              group relative block overflow-hidden
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-7 md:p-10 lg:p-12
            "
          >
            {/* a soft radial 'first light' glow in the corner */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 w-72 h-72 rounded-full opacity-50 md:opacity-70 transition-transform duration-700 group-hover:scale-105"
              style={{ background: "radial-gradient(circle, rgba(255,220,160,0.55), rgba(122,77,242,0.25) 45%, transparent 70%)" }}
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                  Real-time · 3D
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                  Cosmology
                </span>
              </div>

              <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
                The Big Bang — <span className="italic">13.8 billion years, to scale.</span>
              </h3>

              <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
                Scrub the whole history of the universe — from the Planck epoch
                (10⁻⁴³ s) to today — across a real, logarithmic cosmic timeline.
                Inflation, the quark soup, first light, the first stars, galaxies:
                each epoch with its true timestamp and temperature, the unknown
                parts honestly marked.
              </p>

              <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
                Watch it unfold
                <motion.span
                  aria-hidden="true"
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </motion.span>
              </div>
            </div>
          </Link>
        </motion.div>
        )}

        {/* From the GitHub — Ankur's hand-picked repo shelf (see the comment
            on `products` above: curated, never auto-synced). Sits last on the
            page by design: flagships → experiments → the code itself. */}
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground inline-flex items-center gap-2">
            <Github className="w-3 h-3" aria-hidden="true" />
            From the GitHub · hand-picked
          </p>
          <span aria-hidden="true" className="flex-1 h-px bg-border" />
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground/70">
            {products.length}
          </p>
        </div>

        <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3 mb-16 md:mb-20">
          {products.map((product, index) => (
            <motion.a
              key={product.name}
              href={product.href}
              target="_blank"
              rel="noreferrer noopener"
              data-cursor-hover
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.55,
                delay: index * 0.07,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              whileHover={prefersReducedMotion ? undefined : { y: -3 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              className="
                group relative flex flex-col p-6 md:p-7
                border border-border rounded-xl
                bg-card hover:border-accent/50
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
              "
              aria-label={`${product.name} on GitHub — opens in a new tab`}
            >
              {/* Status pill — top-right, honest per-project state. */}
              {product.status && (
                <span
                  className={`
                    absolute top-4 right-4 inline-flex items-center gap-1.5
                    rounded-full border px-2 py-0.5
                    font-mono text-[9px] tracking-[0.15em] uppercase
                    ${STATUS_META[product.status].ring}
                    ${STATUS_META[product.status].text}
                  `}
                >
                  <span
                    className={`h-1 w-1 rounded-full ${STATUS_META[product.status].dot} ${product.status === "building" ? "motion-safe:animate-pulse" : ""}`}
                    aria-hidden="true"
                  />
                  {STATUS_META[product.status].label}
                </span>
              )}

              <div className="flex items-center gap-2 mb-4 pr-24">
                <h3 className="font-display text-xl md:text-2xl font-light tracking-[-0.01em] text-foreground">
                  {product.name}
                </h3>
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
                  aria-hidden="true"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </motion.div>
              </div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-3">
                {product.tagline}
              </p>
              <p className="font-sans text-sm text-foreground/80 leading-relaxed mb-5 flex-1">
                {product.blurb}
              </p>

              {product.highlight && (
                <p className="font-mono text-[10px] tracking-wider text-foreground/85 mb-4">
                  · {product.highlight}
                </p>
              )}

              <ul className="flex gap-1.5 flex-wrap">
                {product.stack.map((tech) => (
                  <li
                    key={tech}
                    className="font-mono text-[10px] tracking-wider px-2 py-0.5 border border-border rounded-full text-foreground/65"
                  >
                    {tech}
                  </li>
                ))}
              </ul>
            </motion.a>
          ))}
        </div>

      </div>
    </section>
  )
}
