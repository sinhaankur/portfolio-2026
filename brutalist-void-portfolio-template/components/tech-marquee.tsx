"use client"

import { motion } from "framer-motion"

type StackGroup = { label: string; items: string[] }
const stack: StackGroup[] = [
  {
    label: "Frontend",
    items: ["React 19", "TypeScript", "Next.js", "Tailwind v4", "Framer Motion", "Three.js"],
  },
  {
    label: "Native",
    items: ["SwiftUI", "Jetpack Compose", "Tauri", "Electron"],
  },
  {
    label: "Languages",
    items: ["TypeScript", "Python", "Rust", "Go", "Swift", "Kotlin"],
  },
  {
    label: "AI & runtime",
    items: ["Claude", "Anthropic SDK", "MCP", "llama.cpp", "Ollama", "On-device AI"],
  },
  {
    label: "Design",
    items: ["Figma", "FigJam", "Storybook", "Token Studio"],
  },
]

type Belief = { title: string; body: string }
const beliefs: Belief[] = [
  {
    title: "Human-in-the-loop",
    body: "Every consequential action passes through a human before it lands. Not a checkbox — a designed surface.",
  },
  {
    title: "Legibility over confidence",
    body: "The model's uncertainty is part of the interface. If it can't be checked, it can't be trusted.",
  },
  {
    title: "Reversibility is the axis",
    body: "Recovery cost — not 'safety' — is what should decide when an action pauses for review.",
  },
  {
    title: "Recourse by default",
    body: "Every action has a documented, accessible way to undo, appeal, or escalate.",
  },
  {
    title: "Interfaces are policy",
    body: "What a UI makes easy is the team's real position. Surface defaults are governance defaults.",
  },
  {
    title: "The prototype is the argument",
    body: "I write my own React/TS, SwiftUI, Compose. Hand-off happens with the contract already in code.",
  },
]

export function TechMarquee() {
  return (
    <section
      id="stack"
      aria-labelledby="stack-heading"
      className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border"
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* Header — same shape as Lab / Works / Usability */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16 md:mb-20 max-w-4xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            07 — STACK &amp; BELIEFS
          </p>
          <h2
            id="stack-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em]"
          >
            What I work with — and what I work toward.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
            The tools are interchangeable. The beliefs aren't. The stack column
            is the surface; the beliefs column is the substrate.
          </p>
        </motion.div>

        {/* Two-column body — Stack left, Beliefs right */}
        <div className="grid gap-12 md:gap-16 lg:grid-cols-[1fr_1.2fr]">
          {/* STACK */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-baseline gap-3 mb-8">
              <span aria-hidden="true" className="block w-10 h-px bg-accent" />
              <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Stack
              </h3>
            </div>

            <dl className="space-y-7">
              {stack.map((group) => (
                <div key={group.label} className="grid gap-3 md:grid-cols-[8rem_1fr] md:items-baseline">
                  <dt className="font-mono text-[11px] tracking-widest uppercase text-foreground/85">
                    {group.label}
                  </dt>
                  <dd>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="
                            font-mono text-[11px] tracking-wider
                            px-2.5 py-1 border border-border rounded-full
                            text-foreground/75 bg-background
                            hover:text-foreground hover:border-accent/60
                            transition-colors duration-300
                          "
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* BELIEFS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-baseline gap-3 mb-8">
              <span aria-hidden="true" className="block w-10 h-px bg-accent" />
              <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Beliefs
              </h3>
            </div>

            <ol className="border-t border-border">
              {beliefs.map((b, i) => (
                <li
                  key={b.title}
                  className="
                    grid grid-cols-[2.5rem_1fr] gap-4 py-5
                    border-b border-border
                    transition-colors duration-300
                    hover:bg-secondary/30
                  "
                >
                  <span className="font-mono text-[10px] tracking-widest text-accent pt-1.5">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="font-sans text-lg md:text-xl text-foreground leading-snug">
                      {b.title}
                    </p>
                    <p className="mt-1.5 font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-prose">
                      {b.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
