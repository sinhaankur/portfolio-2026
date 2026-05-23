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

const trilogyLinks = [
  { label: "Helm", href: "https://sinhaankur.github.io/Helm/" },
  { label: "Sentinel", href: "https://sinhaankur.github.io/Human-in-the-Loop/" },
  { label: "Recourse", href: "https://sinhaankur.github.io/Recourse/" },
]

export function Lab() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section
      id="lab"
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
            05 — THE LAB
          </p>
          <h2
            id="lab-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            What I build when nobody's asking.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            Side projects I code in evenings + weekends. Each is the
            design argument shipped as working software.
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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="border-t border-border pt-8 md:pt-10"
        >
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-baseline md:gap-10">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground whitespace-nowrap">
              Human–AI trilogy ·
            </p>
            <div>
              <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed mb-4 max-w-2xl">
                Three connected code prototypes — Helm, Sentinel, Recourse —
                exploring how humans stay in command of AI agents. Shared
                vocabulary, distinct trust surfaces.
              </p>
              <ul className="flex gap-2 flex-wrap">
                {trilogyLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-cursor-hover
                      className="
                        inline-flex items-center gap-1.5 px-3 py-1.5
                        border border-border rounded-full
                        font-mono text-[10px] tracking-widest uppercase
                        text-foreground/85 hover:text-foreground hover:border-accent/60
                        transition-colors duration-300
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                      "
                    >
                      {link.label}
                      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
