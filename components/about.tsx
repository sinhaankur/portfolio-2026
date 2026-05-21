"use client"

import { motion, useReducedMotion } from "framer-motion"

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

type Principle = {
  number: string
  title: string
  body: string
  appliedIn: string
}

const principles: Principle[] = [
  {
    number: "01",
    title: "The seam is the design.",
    body:
      "The moment of decision, override, and trust — where a human meets an AI agent — that's the surface I work on. Not the model, not the wrapper. The seam.",
    appliedIn: "Helm · Sentinel · Recourse · Unhosted",
  },
  {
    number: "02",
    title: "Uncertainty must be legible.",
    body:
      "An AI's claim is only trustworthy if you can read how sure it is — and the basis must be checkable. Confidence without calibration is a lie with a UI on top.",
    appliedIn: "Helm's approval gate · Sentinel's diff view",
  },
  {
    number: "03",
    title: "Reversibility is the policy axis.",
    body:
      "Not \"safety\" — that's a category, not a control. The right question is: can the human undo what the agent just did, within how many seconds? That's the real surface area.",
    appliedIn: "Helm's reversibility chip · Recourse's audit trail",
  },
  {
    number: "04",
    title: "Prototypes are the argument.",
    body:
      "I write my own code because a prototype is the only design document that can't be ignored. Ship the argument, then defend it in production.",
    appliedIn: "Every Lab project · every case study",
  },
]

export function About() {
  const prefersReducedMotion = useReducedMotion()

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
        </motion.div>

        {/* Principles — single column, generously spaced. Each is a row with
            number on the left, claim + warrant + "applied in" on the right. */}
        <ol className="space-y-12 md:space-y-16">
          {principles.map((p, i) => (
            <motion.li key={p.number} {...fadeUp(i)} className="group">
              <div className="grid grid-cols-[3.5rem_1fr] md:grid-cols-[6rem_1fr] gap-4 md:gap-10 items-start">
                {/* Number + tick mark */}
                <div className="pt-2 md:pt-3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="block w-3 h-px bg-accent shrink-0" />
                    <span className="font-mono text-[10px] md:text-xs tracking-widest text-accent">
                      {p.number}
                    </span>
                  </div>
                </div>

                {/* Claim + warrant + applied */}
                <div>
                  <h3 className="font-display text-2xl md:text-3xl lg:text-4xl font-light tracking-[-0.01em] leading-[1.15] text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-4 md:mt-5 font-sans text-base md:text-lg text-foreground/80 leading-relaxed max-w-2xl">
                    {p.body}
                  </p>
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
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-16 md:mt-24 origin-left"
        >
          <div className="h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent" />
        </motion.div>
      </div>
    </section>
  )
}
