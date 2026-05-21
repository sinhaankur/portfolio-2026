"use client"

/**
 * Section 07 — Stack.
 *
 * Was 'Stack & Beliefs' — a two-column layout where the Beliefs column
 * duplicated the four principles in section 03 (Philosophy). Both
 * sections were saying "human-in-the-loop, legibility, reversibility,
 * prototype-is-the-argument" in different words.
 *
 * Resolved by deleting the Beliefs column. Section is now Stack-only —
 * just the toolbox, full width, more breathing room. Philosophy lives
 * upstream in section 03; this section is intentionally just-the-tools.
 *
 * Filename is kept as `tech-marquee.tsx` for historical reasons. There
 * is no marquee. The export is `TechMarquee` — still imported under
 * that name on the home page.
 */

import { motion } from "framer-motion"

type StackGroup = { label: string; items: string[]; description?: string }

const stack: StackGroup[] = [
  {
    label: "Frontend",
    description: "Where most of the prototyping happens.",
    items: ["React 19", "TypeScript", "Next.js", "Tailwind v4", "Framer Motion", "Three.js"],
  },
  {
    label: "Native",
    description: "When the surface needs to feel native.",
    items: ["SwiftUI", "Jetpack Compose", "Tauri", "Electron"],
  },
  {
    label: "Languages",
    description: "What I write directly — not via Copilot.",
    items: ["TypeScript", "Python", "Rust", "Go", "Swift", "Kotlin"],
  },
  {
    label: "AI & runtime",
    description: "Where the agent-side of the interface lives.",
    items: ["Claude", "Anthropic SDK", "MCP", "llama.cpp", "Ollama", "On-device AI"],
  },
  {
    label: "Design",
    description: "Specs and tokens, when the prototype isn't enough.",
    items: ["Figma", "FigJam", "Storybook", "Token Studio"],
  },
]

export function TechMarquee() {
  return (
    <section
      id="stack"
      aria-labelledby="stack-heading"
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
            07 — STACK
          </p>
          <h2
            id="stack-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            The toolbox.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            What I reach for, by job. The tools are interchangeable; the
            principles (above, in 03) are not.
          </p>
        </motion.div>

        {/* Five stack groups stacked vertically. Each is a label + short
            description + a chip cluster of tools. Reads as a clear inventory
            rather than a dense two-column blob. */}
        <dl className="space-y-10 md:space-y-12">
          {stack.map((group, i) => (
            <motion.div
              key={group.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 md:grid-cols-[10rem_1fr] gap-4 md:gap-10 items-start"
            >
              <dt>
                <div className="flex items-baseline gap-2">
                  <span aria-hidden="true" className="block w-3 h-px bg-accent shrink-0" />
                  <span className="font-mono text-[10px] md:text-xs tracking-[0.18em] uppercase text-foreground/85">
                    {group.label}
                  </span>
                </div>
                {group.description && (
                  <p className="mt-2 font-sans text-xs md:text-sm text-muted-foreground leading-snug max-w-xs">
                    {group.description}
                  </p>
                )}
              </dt>
              <dd>
                <ul className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="
                        font-mono text-[11px] tracking-wider
                        px-2.5 py-1 border border-border rounded-full
                        text-foreground/80 bg-background
                        hover:text-foreground hover:border-accent/60
                        transition-colors duration-300
                      "
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  )
}
