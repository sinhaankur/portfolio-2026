"use client"

import { motion, useReducedMotion } from "framer-motion"

type Item = {
  title: string
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
    tagline: "Shipping this quarter",
    description:
      "Active builds — committed scope, dated milestones, real users on the other side.",
    accent: "rgb(74, 222, 128)", // green-400
    items: [
      {
        title: "WatchTower — integrations dashboard",
        blurb:
          "Adding live status and recovery flows for Podman, Nginx, Tailscale, Cloudflare, Coolify, and Watchdog so a single operator can run the whole stack.",
        updated: "Updated 2026-05-19",
        signal: "active",
      },
      {
        title: "Portfolio rebuild — Next.js",
        blurb:
          "Migration of the hand-written static site to a Next.js build with React Three Fiber, Lenis, and a stricter accessibility budget. This page is the proving ground.",
        updated: "Updated 2026-05-21",
        signal: "active",
      },
    ],
  },
  {
    number: "02",
    name: "Cooking",
    tagline: "Early sketches",
    description:
      "Ideas being prototyped. May graduate to In Flight, may quietly die — that's the point.",
    accent: "rgb(250, 204, 21)", // yellow-400
    items: [
      {
        title: "Calibrated-confidence pattern library",
        blurb:
          "Documenting the Likely / Unsure / Low vocabulary, the hallucination chip, and the verdict-rail morph from the trilogy as reusable primitives — shareable across teams shipping AI surfaces.",
        updated: "Sketching since 2026-05-02",
        signal: "draft",
      },
      {
        title: "Calm metrics",
        blurb:
          "A reading exercise: what would product analytics look like if the metric was 'did the user feel in control' rather than 'did they convert'.",
        updated: "Sketching since 2026-04-30",
        signal: "draft",
      },
      {
        title: "Reversibility receipts",
        blurb:
          "Every agentic action returns a 'how to undo this' receipt. Prototyping the contract and the UI affordance together.",
        updated: "Sketching since 2026-05-10",
        signal: "draft",
      },
    ],
  },
  {
    number: "03",
    name: "Researching",
    tagline: "Threads I'm pulling on",
    description:
      "Papers, tools, and conversations I'm reading carefully. Not yet design — just attention.",
    accent: "rgb(96, 165, 250)", // blue-400
    items: [
      {
        title: "Mechanistic interpretability for UI",
        blurb:
          "If we can attribute model behaviour to concrete circuits, what does that buy a designer trying to explain 'why' to a user?",
        updated: "Reading list — 2026-Q2",
        signal: "thread",
      },
      {
        title: "Procedural legitimacy",
        blurb:
          "Borrowing from administrative law: when an automated decision is challenged, what procedural steps are owed? Mapping the design surface for each.",
        updated: "Reading list — 2026-Q2",
        signal: "thread",
      },
      {
        title: "Local-first agents",
        blurb:
          "What changes about consent, recourse, and reversibility when the agent runs on the user's machine instead of someone else's server.",
        updated: "Reading list — 2026-Q2",
        signal: "thread",
      },
    ],
  },
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
                className="font-sans text-4xl md:text-6xl font-light tracking-tight"
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
                    <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed max-w-2xl">
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
