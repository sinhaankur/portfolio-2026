"use client"

import { motion, useReducedMotion } from "framer-motion"

type Item = {
  title: string
  /** Plain-language one-liner: what this is, in a single sentence anyone
   *  can read. Sits above the deeper blurb. */
  plain: string
  blurb: string
  updated: string
  signal: "active" | "draft" | "thread"
  href?: string
}

type Lane = {
  number: string
  name: string
  tagline: string
  description: string
  accent: string
  items: Item[]
}

const lanes: Lane[] = [
  {
    number: "01",
    name: "In Flight",
    tagline: "Building now",
    description:
      "Active builds — committed scope, dated milestones, real users on the other side.",
    accent: "rgb(74, 222, 128)", // green-400
    items: [
      {
        title: "WatchTower — one screen to run my servers",
        plain:
          "A control panel that shows whether all my self-hosted services are up, and fixes them in one click when they're not.",
        blurb:
          "Live status and one-click recovery for the tools that run my stack — Podman, Nginx, Tailscale, Cloudflare, Coolify, Watchdog — so one person can keep the whole thing healthy without a terminal.",
        updated: "Updated 2026-05-19",
        signal: "active",
      },
      {
        title: "This site, rebuilt",
        plain:
          "Rebuilding my portfolio from hand-written HTML into a modern, faster, more accessible site — the one you're reading now.",
        blurb:
          "Moving the old static site to Next.js with a real 3D scene, smooth scrolling, and a stricter accessibility bar. This page is where I prove it works before the rest follows.",
        updated: "Updated 2026-05-21",
        signal: "active",
      },
    ],
  },
  {
    number: "02",
    name: "Cooking",
    tagline: "Prototyping",
    description:
      "Ideas being prototyped. May graduate to In Flight, may quietly die — that's the point.",
    accent: "rgb(250, 204, 21)", // yellow-400
    items: [
      {
        title: "A toolkit for honest AI confidence",
        plain:
          "Reusable UI pieces that let an AI say how sure it is — and flag when it might be making something up — so other teams don't reinvent it.",
        blurb:
          "Packaging the patterns from my AI work — a plain Likely / Unsure / Low scale, a 'this might be a hallucination' flag, and a result bar that shifts as confidence changes — into building blocks any team shipping AI features can reuse.",
        updated: "Sketching since 2026-05-02",
        signal: "draft",
      },
      {
        title: "Calm metrics",
        plain:
          "Asking what product analytics would measure if the goal were 'the user felt in control' instead of 'the user clicked buy'.",
        blurb:
          "A thought experiment: most analytics optimise for conversion. What would a dashboard look like if it tracked whether people felt calm and in control instead?",
        updated: "Sketching since 2026-04-30",
        signal: "draft",
      },
      {
        title: "Undo receipts for AI actions",
        plain:
          "When an AI does something on your behalf, it hands back a clear 'here's how to undo this' — every time.",
        blurb:
          "When an AI agent takes an action for you, it should return a receipt that tells you exactly how to reverse it. Prototyping both the underlying guarantee and the button that exposes it.",
        updated: "Sketching since 2026-05-10",
        signal: "draft",
      },
    ],
  },
  {
    number: "03",
    name: "Researching",
    tagline: "Reading & learning",
    description:
      "Papers, tools, and conversations I'm reading carefully. Not yet design — just attention.",
    accent: "rgb(96, 165, 250)", // blue-400
    items: [
      {
        title: "Looking inside the model to explain it",
        plain:
          "New research can trace why an AI gave an answer. I'm asking what that lets a designer actually show a user.",
        blurb:
          "Researchers are learning to attribute a model's behaviour to specific internal mechanisms. If we can see the 'why', what can we honestly put in front of a user to explain a decision?",
        updated: "Reading list — 2026-Q2",
        signal: "thread",
      },
      {
        title: "When can an automated decision be challenged?",
        plain:
          "Borrowing rules from law: if a computer denies you something, what steps do you deserve to appeal it — and what does that look like on screen?",
        blurb:
          "Administrative law has long answers for when a decision is fair and how it can be contested. Mapping those steps onto the screens people would actually use to challenge an automated 'no'.",
        updated: "Reading list — 2026-Q2",
        signal: "thread",
      },
      {
        title: "Agents that run on your own machine",
        plain:
          "What changes about trust, consent, and undo when the AI runs on your computer instead of a company's server.",
        blurb:
          "When the agent lives on your device rather than someone else's cloud, the rules for consent, recourse, and reversibility shift. Reading carefully on what that changes for design.",
        updated: "Reading list — 2026-Q2",
        signal: "thread",
      },
    ],
  },
]

const signalLegend: { label: string; meaning: string; accent: string }[] = [
  { label: "In Flight", meaning: "Building it now, with a deadline.", accent: "rgb(74, 222, 128)" },
  { label: "Cooking", meaning: "An early sketch — might ship, might not.", accent: "rgb(250, 204, 21)" },
  { label: "Researching", meaning: "Reading about it — not a design yet.", accent: "rgb(96, 165, 250)" },
]

function SignalDot({ signal, accent }: { signal: Item["signal"]; accent: string }) {
  const prefersReducedMotion = useReducedMotion()
  const shouldPulse = signal === "active" && !prefersReducedMotion

  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      {shouldPulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping"
          style={{ background: accent }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: accent }}
      />
    </span>
  )
}

export function UpcomingLanes() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 md:px-10 py-16 md:py-24 space-y-24 md:space-y-32">
      {/* Legend — how to read the three lanes at a glance */}
      <section aria-label="How to read this page" className="mt-0!">
        <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-5">
          How to read this
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {signalLegend.map((s) => (
            <li
              key={s.label}
              className="flex items-start gap-3 rounded-2xl border border-border bg-foreground/2 px-4 py-3.5"
            >
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.accent }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium text-foreground">{s.label}</p>
                <p className="font-sans text-sm text-foreground/65 leading-snug">{s.meaning}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {lanes.map((lane, laneIndex) => (
        <section
          key={lane.name}
          aria-labelledby={`lane-${lane.number}`}
          className="relative"
        >
          {/* Lane header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="grid gap-6 md:grid-cols-[1fr_2fr] mb-12 md:mb-16"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: lane.accent }}
                  aria-hidden="true"
                />
                <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
                  {lane.number} — {lane.tagline.toUpperCase()}
                </p>
              </div>
              <h2
                id={`lane-${lane.number}`}
                className="font-display text-4xl md:text-6xl font-light tracking-[-0.02em] leading-[1.02]"
              >
                {lane.name}
              </h2>
            </div>
            <p className="font-sans text-base md:text-lg text-foreground/80 leading-relaxed self-end max-w-xl">
              {lane.description}
            </p>
          </motion.div>

          {/* Items */}
          <ul className="space-y-0 border-t border-border">
            {lane.items.map((item, itemIndex) => (
              <motion.li
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.6,
                  delay: itemIndex * 0.08,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="border-b border-border"
              >
                <article
                  className="
                    group grid gap-4 py-8 md:py-10
                    md:grid-cols-[auto_1fr_auto] md:items-start
                  "
                >
                  <SignalDot signal={item.signal} accent={lane.accent} />

                  <div className="min-w-0">
                    <h3 className="font-sans text-2xl md:text-4xl font-light tracking-tight text-foreground mb-3">
                      {item.title}
                    </h3>
                    {/* Plain one-liner — the version anyone can read in one pass. */}
                    <p className="font-sans text-base md:text-lg text-foreground/90 leading-relaxed max-w-2xl mb-3">
                      {item.plain}
                    </p>
                    {/* Deeper detail for readers who want the specifics. */}
                    <p className="font-sans text-sm md:text-base text-foreground/60 leading-relaxed max-w-2xl">
                      {item.blurb}
                    </p>
                  </div>

                  <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground md:text-right md:pt-3 whitespace-nowrap">
                    {item.updated}
                  </p>
                </article>
              </motion.li>
            ))}
          </ul>

          {/* Decorative gradient connector between lanes */}
          {laneIndex < lanes.length - 1 && (
            <div
              aria-hidden="true"
              className="absolute -bottom-12 md:-bottom-16 left-1/2 -translate-x-1/2 w-px h-12 md:h-16 bg-linear-to-b from-white/20 to-transparent"
            />
          )}
        </section>
      ))}
    </div>
  )
}
