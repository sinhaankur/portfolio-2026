"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { StaticStarfield } from "./universe-engine/static-starfield"

// Same code-split as the home hero / sky page — the CSS starfield paints
// instantly and the engine blooms in over it.
const UniverseEngine = dynamic(
  () => import("./universe-engine").then((m) => ({ default: m.UniverseEngine })),
  { ssr: false },
)

/**
 * /story — EXPERIMENT B: the alternative home.
 *
 * Hypothesis under test (vs the current home): the site shouldn't describe
 * the work, it should BE the work. One continuous scroll through the real
 * sky — the same engine, never leaving the screen — with each section framed
 * as something built by the same hands that built what you're floating in.
 *
 * Deliberately unlisted (noindex, not in the sitemap): this exists to compare
 * look-and-feel against the production home before deciding anything.
 * All copy is DRAFT — to be rewritten/approved before this ever becomes real.
 */

const CHAPTERS: {
  eyebrow: string
  title: string
  body: string
  cta: { label: string; href: string }
}[] = [
  {
    eyebrow: "01 — the proof",
    title: "This sky is real.",
    body:
      "Every star is at its measured position — 8,900 from the HYG catalog. The clusters resolve into member stars, the galaxies into their true morphology, the black holes carry their published masses. The dust is a photograph. I built the engine that's flying you through it.",
    cta: { label: "Full-screen sky", href: "/sky" },
  },
  {
    eyebrow: "02 — the day job",
    title: "Enterprise UX, shipped.",
    body:
      "Principal UX Designer at Oracle, working at the human–AI seam. 12+ years designing enterprise products — and I build my own working prototypes, not just Figma.",
    cta: { label: "Case studies", href: "/#works" },
  },
  {
    eyebrow: "03 — the lab",
    title: "Where the experiments live.",
    body:
      "Open-source projects, a usability engine, games, a browser. Built end-to-end: design, code, data, ship.",
    cta: { label: "Enter the lab", href: "/lab" },
  },
  {
    eyebrow: "04 — the toolkit",
    title: "Skills without buzzwords.",
    body:
      "A matrix of what I actually use, tied to the projects that prove it.",
    cta: { label: "See the matrix", href: "/skills" },
  },
  {
    eyebrow: "05 — contact",
    title: "Build something real.",
    body: "Toronto, ON. Open to the right problems.",
    cta: { label: "Get in touch", href: "/#contact" },
  },
]

export function StoryExperience() {
  const [engineReady, setEngineReady] = useState(false)

  useEffect(() => {
    const onReady = () => setEngineReady(true)
    window.addEventListener("universe-ready", onReady)
    return () => window.removeEventListener("universe-ready", onReady)
  }, [])

  return (
    <div className="relative bg-[#030308] text-white">
      {/* The sky never leaves the screen — fixed behind every chapter. */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0">
          <StaticStarfield />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-[2000ms] ${engineReady ? "opacity-100" : "opacity-0"}`}
        >
          <UniverseEngine interactive={false} showHud={false} showMusic={false} invert={false} />
        </div>
        {/* Gentle bottom vignette so panel text always clears the brightest sky. */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Experiment tag — quiet, honest, escapable. */}
      <div className="fixed top-5 right-6 z-30">
        <Link
          href="/"
          className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40 hover:text-white/80 transition-colors"
        >
          experiment b · back to home
        </Link>
      </div>

      {/* Chapter 0 — landing. */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center px-6 md:px-16">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/50">
          Ankur Sinha · Toronto
        </p>
        <h1 className="mt-4 font-display font-light tracking-[-0.01em] leading-[1.02] text-5xl md:text-7xl lg:text-8xl">
          Design × Engineering
          <br />
          <span className="italic">× AI</span>
        </h1>
        <p className="mt-6 max-w-md text-sm md:text-base text-white/65 leading-relaxed">
          You&apos;re drifting through the real sky — placed from NASA, ESA and
          HYG data, rendered live. Everything below was built the same way:
          real data, real code, real care.
        </p>
        <p className="absolute bottom-10 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] uppercase text-white/35">
          scroll
        </p>
      </section>

      {/* Chapters — one idea per viewport, sky in between. */}
      {CHAPTERS.map((c) => (
        <section
          key={c.eyebrow}
          className="relative z-10 min-h-[90vh] flex items-end md:items-center px-6 md:px-16 py-24"
        >
          <div className="max-w-lg rounded-2xl border border-white/10 bg-black/45 backdrop-blur-md p-7 md:p-9">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/45">
              {c.eyebrow}
            </p>
            <h2 className="mt-3 font-display font-light text-3xl md:text-4xl leading-[1.1]">
              {c.title}
            </h2>
            <p className="mt-4 text-sm md:text-[15px] text-white/70 leading-relaxed">{c.body}</p>
            <Link
              href={c.cta.href}
              className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-white/85 hover:text-white border-b border-white/25 hover:border-white/70 pb-1 transition-colors"
            >
              {c.cta.label} →
            </Link>
          </div>
        </section>
      ))}

      <footer className="relative z-10 pb-10 text-center">
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/30">
          © Ankur Sinha 2026 · this page is an experiment
        </p>
      </footer>
    </div>
  )
}
