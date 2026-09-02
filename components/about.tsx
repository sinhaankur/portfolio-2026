"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  DialGlyph,
  PrototypeGlyph,
  ReversibleGlyph,
  SeamGlyph,
} from "./principle-glyphs"
import type { ComponentType } from "react"

/**
 * Philosophy section — was a horizontal marquee of single-line statements
 * driven by page-scroll. That was the design problem: the type was moving
 * while the reader was trying to read it, each line was wider than the
 * viewport, and every other statement was rendered as an outline-only
 * shape, sacrificing legibility for style.
 *
 * Replaced with a calm numbered manifesto. Each principle has:
 *   - a claim (the original short statement, rebalanced for parity)
 *   - one or two sentences of warrant (why the principle holds)
 *   - a "tested in" tag naming the projects where it's load-bearing
 *
 * Fades up per item on enter (no horizontal motion). Respects
 * prefers-reduced-motion by skipping the per-item delay.
 */

type ReadingLevel = "deep" | "plain" | "simple"

type Principle = {
  number: string
  /** title per reading level */
  title: Record<ReadingLevel, string>
  /** body per reading level */
  body: Record<ReadingLevel, string>
  appliedIn: string
  /** Per-principle line-art glyph — sits in the number column.
   *  Encodes the *idea*, not a generic icon: the seam, the dial,
   *  the reversibility axis, the prototype viewport. */
  Glyph: ComponentType<{ className?: string }>
}

// Each principle is written at three levels the reader can choose:
//   deep   — the original, intense voice (the default; the edge stays)
//   plain  — warm and clear, no jargon, same idea
//   simple — one honest sentence anyone gets
const principles: Principle[] = [
  {
    number: "01",
    title: {
      deep: "The seam is the design.",
      plain: "I design the moment you decide.",
      simple: "I design the hand-off between you and the AI.",
    },
    body: {
      deep: "The moment of decision, override, and trust — where a human meets an AI agent — that's the surface I work on. Not the model, not the wrapper. The seam.",
      plain: "When an AI does something for you, there's a moment where you decide to trust it, correct it, or stop it. That moment is what I design — not the AI itself, but the part where you and it meet.",
      simple: "The most important part isn't the AI — it's the moment where you're in control of it. That's what I work on.",
    },
    appliedIn: "Unhosted · the Universe Engine · agentic-AI prototypes",
    Glyph: SeamGlyph,
  },
  {
    number: "02",
    title: {
      deep: "Uncertainty must be legible.",
      plain: "You should see how sure the AI is.",
      simple: "The AI should show you when it's guessing.",
    },
    body: {
      deep: "An AI's claim is only trustworthy if you can read how sure it is — and the basis must be checkable. Confidence without calibration is a lie with a UI on top.",
      plain: "You can only trust an answer if you can see how confident the system really is — and check why. An AI that sounds certain but isn't is just a nice-looking mistake.",
      simple: "If the AI isn't sure, it should tell you — clearly. Confident and wrong is the worst combination.",
    },
    appliedIn: "approval gates · diff-review surfaces",
    Glyph: DialGlyph,
  },
  {
    number: "03",
    title: {
      deep: "Reversibility is the policy axis.",
      plain: "The real question is: can you undo it?",
      simple: "Everything the AI does should be undoable.",
    },
    body: {
      deep: "Not \"safety\" — that's a category, not a control. The right question is: can the human undo what the agent just did, within how many seconds? That's the real surface area.",
      plain: "\"Is it safe?\" is too vague to design for. The useful question is simpler: if the AI just did something, can you take it back — and how quickly? That's what I build around.",
      simple: "Mistakes are fine if you can undo them fast. So I make sure you always can.",
    },
    appliedIn: "reversibility chips · audit trails",
    Glyph: ReversibleGlyph,
  },
  {
    number: "04",
    title: {
      deep: "Prototypes are the argument.",
      plain: "I build the thing to prove the point.",
      simple: "I make it real instead of just describing it.",
    },
    body: {
      deep: "I write my own code because a prototype is the only design document that can't be ignored. Ship the argument, then defend it in production.",
      plain: "Instead of writing a document about how something should work, I build a working version. A real prototype is much harder to argue with — and I write the code myself so it actually runs.",
      simple: "I'd rather build a working version than write a report about it. So I write my own code and ship it.",
    },
    appliedIn: "Every Lab project · every case study",
    Glyph: PrototypeGlyph,
  },
]

const LEVELS: { id: ReadingLevel; label: string; hint: string }[] = [
  { id: "deep", label: "Deep", hint: "My own words — dense, no compromises" },
  { id: "plain", label: "Plain", hint: "Warm and clear, no jargon" },
  { id: "simple", label: "Simple", hint: "One honest line each" },
]

const LEVEL_KEY = "reading-level-v1"

export function About() {
  const prefersReducedMotion = useReducedMotion()
  // The childhood photo is hidden until the visitor chooses to peek — it's not
  // in the DOM (so it never loads or shows as a first image) until `revealed`.
  const [revealed, setRevealed] = useState(false)

  // Reading level: the visitor picks how the principles are written. "Deep" is
  // Ankur's own dense voice (the default — the edge stays). "Plain" is warm and
  // clear; "Simple" is one honest line each. Remembered on-device.
  const [level, setLevel] = useState<ReadingLevel>("deep")
  useEffect(() => {
    const saved = localStorage.getItem(LEVEL_KEY)
    if (saved === "deep" || saved === "plain" || saved === "simple") setLevel(saved)
  }, [])
  const chooseLevel = (next: ReadingLevel) => {
    setLevel(next)
    try {
      localStorage.setItem(LEVEL_KEY, next)
    } catch {
      /* private mode — ignore */
    }
  }

  const fadeUp = (i: number) => ({
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    whileInView: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" } as const,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.7,
      delay: prefersReducedMotion ? 0 : i * 0.08,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  })

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative py-24 md:py-32"
    >
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-14 md:mb-20 max-w-3xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            03 — PHILOSOPHY
          </p>
          <h2
            id="about-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            Four principles I keep returning to.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            Not a manifesto, not a thesis. Four operating principles that
            decide what I build, how I ship it, and what I refuse to
            compromise on.
          </p>

          {/* Reading-level toggle. I write dense on purpose — this lets a reader
              dial it down without me losing my voice. Choice is remembered. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              How should I say it?
            </span>
            <div
              role="radiogroup"
              aria-label="Reading level for the principles below"
              className="inline-flex items-center rounded-full border border-border bg-secondary/30 p-1"
            >
              {LEVELS.map((lv) => {
                const active = lv.id === level
                return (
                  <button
                    key={lv.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseLevel(lv.id)}
                    data-cursor-hover
                    title={lv.hint}
                    className={`relative rounded-full px-3.5 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active
                        ? "text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="reading-level-pill"
                        transition={{ type: "spring", stiffness: 400, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-foreground"
                      />
                    )}
                    <span className="relative">{lv.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <p className="mt-2.5 font-sans text-[13px] text-muted-foreground/90 max-w-xl leading-relaxed">
            {LEVELS.find((l) => l.id === level)?.hint}.
          </p>
        </motion.div>

        {/* Origin — the through-line from that kid at the CRT to the work now.
            The photo is HIDDEN by default (never loads / never a first image);
            the visitor peeks at it deliberately. Caption is Ankur's to refine. */}
        <motion.figure
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 md:mb-24 grid md:grid-cols-[minmax(0,20rem)_1fr] gap-6 md:gap-10 items-center"
        >
          {/* Left: the reveal slot — a prompt until clicked, then the photo. */}
          <div className="relative aspect-[1400/980] overflow-hidden rounded-xl border border-border bg-secondary/20">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                data-cursor-hover
                aria-label="Reveal the childhood photo — where it started, 2004"
                className="group absolute inset-0 grid place-items-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {/* faint blurred stand-in so the slot isn't empty, but no photo loads */}
                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_35%,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_60%)]" />
                <span className="relative flex flex-col items-center gap-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-accent/50 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-foreground/70 group-hover:text-foreground transition-colors">
                    Peek at where it started
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground/70">&apos;04</span>
                </span>
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  key="photo"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  {/* Only mounted after the click, so it never loads first. */}
                  <img
                    src="/img/about/journey-2004.webp"
                    alt="Ankur as a boy at a CRT computer, 2004"
                    loading="lazy"
                    decoding="async"
                    width={1400}
                    height={980}
                    className="h-full w-full object-cover [filter:saturate(0.92)]"
                  />
                  <figcaption className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-linear-to-t from-black/70 to-transparent font-mono text-[9px] tracking-[0.18em] uppercase text-white/80">
                    <span>Where it started</span>
                    <span className="tabular-nums">&apos;04</span>
                  </figcaption>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-3">
              The through-line
            </p>
            <p className="font-display text-xl md:text-2xl font-light italic leading-[1.3] text-foreground/90 max-w-xl">
              Same kid, same instinct — sit at the machine, poke at it until it
              does something, then make it better.
            </p>
            <p className="mt-4 font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-xl">
              Two decades later the machine is bigger and the questions are
              harder, but the loop hasn&apos;t changed: build the thing, learn
              from it, ship it. Everything below grew out of that.
            </p>
          </div>
        </motion.figure>

        {/* Principles — single column, generously spaced. Each is a row with
            number on the left, claim + warrant + "applied in" on the right. */}
        <ol className="space-y-12 md:space-y-16">
          {principles.map((p, i) => (
            <motion.li key={p.number} {...fadeUp(i)} className="group">
              <div className="grid grid-cols-[3.5rem_1fr] md:grid-cols-[6rem_1fr] gap-4 md:gap-10 items-start">
                {/* Number + tick mark + per-principle glyph. The glyph
                    visualises the *idea* (seam, dial, reversibility axis,
                    prototype viewport) — not a generic decorative icon. */}
                <div className="pt-2 md:pt-3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="block w-3 h-px bg-accent shrink-0" />
                    <span className="font-mono text-[10px] md:text-xs tracking-widest text-accent">
                      {p.number}
                    </span>
                  </div>
                  <p.Glyph
                    className="
                      mt-3 md:mt-4 w-9 md:w-12 h-9 md:h-12
                      text-foreground/55 group-hover:text-accent
                      transition-colors duration-500
                    "
                  />
                </div>

                {/* Claim + warrant + applied. Text swaps with the reading level;
                    keyed so it cross-fades rather than snapping. */}
                <div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h3
                      key={`${p.number}-title-${level}`}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="font-display text-2xl md:text-3xl lg:text-4xl font-light tracking-[-0.01em] leading-[1.15] text-foreground"
                    >
                      {p.title[level]}
                    </motion.h3>
                  </AnimatePresence>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={`${p.number}-body-${level}`}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="mt-4 md:mt-5 font-sans text-base md:text-lg text-foreground/80 leading-relaxed max-w-2xl"
                    >
                      {p.body[level]}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-4 md:mt-5 font-mono text-[10px] md:text-xs tracking-widest uppercase text-muted-foreground">
                    Applied in · {p.appliedIn}
                  </p>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>

        {/* Closing rule */}
        <motion.div
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 md:mt-24 origin-left"
        >
          <div className="h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent" />
        </motion.div>
      </div>
    </section>
  )
}
