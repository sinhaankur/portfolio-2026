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

type Product = {
  name: string
  tagline: string
  blurb: string
  stack: string[]
  href: string
  highlight?: string
}

const products: Product[] = [
  {
    name: "WatchTower",
    tagline: "Self-hosted deployment platform",
    blurb:
      "Operator-facing tooling for container auto-updates, multi-node deployment, and guided host operations across your own machines. One operator can see live status across six interconnected tools and recover any of them.",
    stack: ["Python", "Electron", "VS Code", "PyPI"],
    href: "https://github.com/sinhaankur/WatchTower",
    highlight: "Ships across 6 distribution channels",
  },
  {
    name: "GovLens",
    tagline: "Context-aware overlay for government portals",
    blurb:
      "Chrome extension that activates on 25+ national gov TLDs. Translation, structural navigation, a 0–100 usability score, and a region-aware jargon explainer. A three-engine translation cascade tells you which engine will answer before you click.",
    stack: ["Chrome ext", "On-device AI", "Claude SDK"],
    href: "https://github.com/sinhaankur/GovLens",
    highlight: "25+ TLDs · 100+ languages",
  },
  {
    name: "EMPATHEIA",
    tagline: "Multi-modal AI companion, offline-first",
    blurb:
      "Next.js + AI SDK PWA. Camera-based facial-expression detection feeds mood-aware tone adaptation. Hybrid fallback: if the model runtime fails, deterministic sentiment + keyword heuristics keep the empathy map updating — the user never sees a dead surface.",
    stack: ["Next.js", "AI SDK", "face-api.js", "Ollama"],
    href: "https://github.com/sinhaankur/ideal-giggle",
    highlight: "PWA · graceful degradation",
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
          <h2
            id="lab-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            How I'm learning AI — by building it.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            Self-directed experiments, not client work. Each is a way to learn
            the human–AI seam hands-on — the design argument shipped as working
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

        {/* Universe Engine Assistant — AI lab entry. Frames the engine
            as a canvas and the assistant as the new piece. The engine
            itself is already the hero, so this card is about the LLM
            front-end, not the renderer. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/universe-assistant"
            data-cursor-hover
            aria-label="Universe Engine Assistant — read the case study"
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
                AI · Live demo
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                Claude · Tool use
              </span>
            </div>

            <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
              Universe Engine Assistant — <span className="italic">talk to the sky.</span>
            </h3>

            <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
              Natural-language queries against the same 3D scene from the
              hero. Thirteen tools — eight read the dataset, five steer the
              camera and time. Browser-direct Anthropic streaming, prompt
              caching on a 30&nbsp;KB injected dataset, BYO-key static-site
              setup. No backend.
            </p>

            <div className="mt-7 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/85 group-hover:text-accent transition-colors">
              Try it + read the case study
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

        {/* Cognitive Twin Agent — architecture-first lab case study.
            Private repository, public blueprint. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/cognitive-twin"
            data-cursor-hover
            aria-label="Cognitive Twin Agent — read the case study"
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
                Architecture · In progress
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                Private repo
              </span>
            </div>

            <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
              Cognitive Twin Agent — <span className="italic">decision style, not just prompts.</span>
            </h3>

            <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
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
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/optical-flow"
            data-cursor-hover
            aria-label="Optical Flow — live feature tracking in the browser"
            className="
              group relative block overflow-hidden
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-7 md:p-10 lg:p-12
            "
          >
            {/* a scatter of faint dots in the corner — a nod to the effect */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-40 md:opacity-60 transition-transform duration-700 group-hover:scale-105"
              style={{ background: "radial-gradient(circle, rgba(255,180,120,0.4), rgba(80,200,255,0.18) 50%, transparent 72%)" }}
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                  Live · Computer vision
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                  Built from scratch
                </span>
              </div>

              <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
                Optical Flow — <span className="italic">watch yourself become data.</span>
              </h3>

              <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
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

        {/* Celestial — Blender renders of real worlds */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className="mb-14 md:mb-16"
        >
          <Link
            href="/lab/celestial"
            data-cursor-hover
            aria-label="Celestial — photoreal Mars & Moon rendered in Blender"
            className="
              group relative block overflow-hidden
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              p-7 md:p-10 lg:p-12
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
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 border border-border text-foreground/85 rounded-full">
                  Blender · 3D
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/75 rounded-full">
                  Open data
                </span>
              </div>

              <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.05] text-foreground">
                Celestial — <span className="italic">real worlds, rendered true.</span>
              </h3>

              <p className="mt-5 max-w-2xl font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
                The Sun and every planet, modelled in Blender from real NASA/USGS
                data — photoreal and interactive. Rotate each world in your browser;
                editable scenes and renders, open for anyone.
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

        {/* Supporting open-source products — single eyebrow lifted from
            each card to the section level. Cards are now leaner: name,
            tagline, blurb, optional highlight, stack tags. No per-card
            mini-header repeating "Open source". */}
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground inline-flex items-center gap-2">
            <Github className="w-3 h-3" aria-hidden="true" />
            Supporting open-source
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
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-display text-xl md:text-2xl font-light tracking-[-0.01em] text-foreground">
                  {product.name}
                </h3>
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="text-muted-foreground group-hover:text-foreground transition-colors mt-1.5"
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

        {/* Trilogy — slim inline strip rather than its own bordered band.
            Three small chips linking to the live demos. */}
      </div>
    </section>
  )
}
