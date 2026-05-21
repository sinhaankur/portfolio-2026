"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, Github } from "lucide-react"

type Product = {
  name: string
  tagline: string
  blurb: string
  stack: string[]
  href: string
  status?: string
  highlight?: string
}

const products: Product[] = [
  {
    name: "WatchTower",
    tagline: "Self-hosted deployment platform",
    blurb:
      "Operator-facing tooling for container auto-updates, multi-node deployment, and guided host operations across your own machines. Integrations dashboard for six interconnected tools (Podman, Nginx, Tailscale, Cloudflare, Coolify, Watchdog) so one operator can see live status and recover any of them.",
    stack: ["Python", "Electron", "VS Code ext", "PyPI"],
    href: "https://github.com/sinhaankur/WatchTower",
    highlight: "4★ on GitHub · ships to 6 distribution channels",
  },
  {
    name: "GovLens",
    tagline: "Context-aware overlay for government portals",
    blurb:
      "Chrome extension that activates on 25+ national gov TLDs. Surfaces translation (100+ languages), structural navigation, a 0–100 usability score across 8 axes, and a region-aware jargon explainer. Three-engine translation cascade — on-device AI → free Google Translate → premium Claude (BYOK) — shows which engine will answer before you click.",
    stack: ["Chrome ext", "On-device AI", "Claude SDK"],
    href: "https://github.com/sinhaankur/GovLens",
    highlight: "25+ TLDs · 100+ languages · 8-axis usability score",
  },
  {
    name: "EMPATHEIA",
    tagline: "Multi-modal AI companion (offline-first)",
    blurb:
      "Next.js + AI SDK PWA. Camera-based facial-expression detection feeds mood-aware tone adaptation. Hybrid intelligence fallback: if the model runtime fails, empathy-map quadrants still update via deterministic sentiment + keyword heuristics — the user never sees a dead surface.",
    stack: ["Next.js", "AI SDK", "face-api.js", "Ollama"],
    href: "https://github.com/sinhaankur/ideal-giggle",
    highlight: "PWA · offline-first · graceful degradation",
  },
]

const trilogyMention = {
  title: "The Human–AI trilogy",
  body: "Helm, Human-in-the-Loop (Sentinel), and Recourse — three faces of the same problem: AI claims become trustworthy only when their uncertainty is legible and their basis is checkable. Connected code prototypes (React 19 / TypeScript / Tailwind v4) with a deliberate shared vocabulary.",
  links: [
    { label: "Helm", href: "https://sinhaankur.github.io/Helm/" },
    { label: "Sentinel", href: "https://sinhaankur.github.io/Human-in-the-Loop/" },
    { label: "Recourse", href: "https://sinhaankur.github.io/Recourse/" },
  ],
}

export function Lab() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section
      id="lab"
      aria-labelledby="lab-heading"
      className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-20 md:mb-24 max-w-4xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            05 — THE LAB
          </p>
          <h2
            id="lab-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em]"
          >
            What I build when nobody's asking.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
            I code my own prototypes — React/TS, SwiftUI, Compose, Tauri,
            Electron, Next.js. The prototype <em>is</em> the design argument.
            Hand-off to engineering happens with the contract already in code.
          </p>
        </motion.div>

        {/* Flagship: Unhosted */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 md:mb-16"
        >
          <Link
            href="/lab/unhosted"
            data-cursor-hover
            aria-label="Unhosted — read the case study"
            className="
              group relative block overflow-hidden
              border border-border rounded-2xl
              bg-card hover:border-accent/60 transition-colors duration-500
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
            "
          >
            {/* Concentric ring backdrop */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none flex items-center justify-end opacity-[0.08] group-hover:opacity-[0.14] transition-opacity duration-700"
            >
              <div className="relative w-130 h-130 max-w-[80vw] max-h-[80vw] -mr-32 md:-mr-20">
                <div className="absolute inset-0 rounded-full border border-foreground" />
                <div className="absolute inset-[15%] rounded-full border border-foreground" />
                <div className="absolute inset-[35%] rounded-full border border-foreground" />
              </div>
            </div>

            <div className="relative grid md:grid-cols-[1fr_auto] gap-8 md:gap-12 p-8 md:p-12 lg:p-14">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span className="font-mono text-[10px] tracking-[0.3em] uppercase px-2.5 py-1 border border-accent text-accent rounded-full">
                    Flagship · Currently building
                  </span>
                  <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/80 rounded-full">
                    CLI v0.0.34
                  </span>
                  <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/80 rounded-full">
                    Apache 2.0
                  </span>
                </div>

                <h3 className="font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-[-0.02em] leading-[1.02] text-foreground">
                  Unhosted — <span className="italic">AI that lives where you do.</span>
                </h3>

                <p className="mt-6 max-w-2xl font-sans text-base md:text-lg text-foreground/85 leading-relaxed">
                  Frontier-class AI inference on hardware you own. Pool your
                  machines — and optionally your friends', and optionally a
                  public swarm of strangers' GPUs — into one inference cluster.
                  Three trust modes; the radius is the product.
                </p>

                {/* Mini trust-mode strip */}
                <ul className="mt-8 grid grid-cols-3 gap-2 max-w-2xl text-left">
                  {[
                    { name: "LOCAL", price: "Free forever" },
                    { name: "TRUSTED", price: "Free forever" },
                    { name: "PUBLIC", price: "Pay-per-use" },
                  ].map((m) => (
                    <li
                      key={m.name}
                      className="px-3 py-2.5 border border-border rounded-md bg-background/60"
                    >
                      <p className="font-mono text-[10px] tracking-[0.25em] text-accent">
                        {m.name}
                      </p>
                      <p className="mt-1 font-mono text-[10px] tracking-wider text-foreground/70">
                        {m.price}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex md:flex-col items-end justify-between gap-4 md:gap-6 md:pt-1">
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="text-muted-foreground group-hover:text-accent transition-colors"
                  aria-hidden="true"
                >
                  <ArrowUpRight className="w-7 h-7 md:w-8 md:h-8" />
                </motion.div>
                <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground group-hover:text-foreground transition-colors text-right">
                  Read the
                  <br />
                  case study →
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Supporting open-source products */}
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-6">
          Supporting open-source work
        </p>
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3 mb-20">
          {products.map((product, index) => (
            <motion.a
              key={product.name}
              href={product.href}
              target="_blank"
              rel="noreferrer noopener"
              data-cursor-hover
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.6,
                delay: index * 0.08,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              className="
                group relative flex flex-col p-7 md:p-8
                border border-border rounded-xl
                bg-card hover:border-accent/50
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                overflow-hidden
              "
              aria-label={`${product.name} on GitHub — opens in a new tab`}
            >
              <div
                aria-hidden="true"
                className="
                  absolute -top-24 -right-24 w-48 h-48 rounded-full
                  bg-accent opacity-0 group-hover:opacity-[0.08]
                  blur-3xl transition-opacity duration-500
                "
              />

              <div className="relative flex items-start justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Github className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Open source
                  </span>
                </div>
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { rotate: 45 }}
                  transition={{ duration: 0.3 }}
                  className="text-muted-foreground group-hover:text-foreground transition-colors"
                  aria-hidden="true"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </motion.div>
              </div>

              <h3 className="relative font-sans text-2xl md:text-3xl font-light tracking-tight text-foreground mb-2">
                {product.name}
              </h3>
              <p className="relative font-mono text-[11px] md:text-xs tracking-wider uppercase text-accent mb-4">
                {product.tagline}
              </p>
              <p className="relative font-sans text-sm text-foreground/80 leading-relaxed mb-5 flex-1">
                {product.blurb}
              </p>

              {product.highlight && (
                <p className="relative font-mono text-[10px] tracking-wider text-foreground/90 mb-4 pb-4 border-b border-border">
                  {product.highlight}
                </p>
              )}

              <ul className="relative flex gap-1.5 flex-wrap">
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

        {/* Human-AI trilogy callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative border-t border-b border-border py-12 md:py-16"
        >
          <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:items-start">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Supporting work
              </p>
              <h3 className="font-sans text-2xl md:text-3xl font-light tracking-tight italic">
                {trilogyMention.title}
              </h3>
            </div>
            <div>
              <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed mb-6 max-w-2xl">
                {trilogyMention.body}
              </p>
              <ul className="flex gap-3 flex-wrap">
                {trilogyMention.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-cursor-hover
                      className="
                        inline-flex items-center gap-2 px-4 py-2
                        border border-border rounded-full
                        font-mono text-[11px] tracking-widest uppercase
                        text-foreground/85 hover:text-foreground hover:border-accent/60
                        transition-colors duration-300
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-2 focus-visible:ring-offset-background
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
