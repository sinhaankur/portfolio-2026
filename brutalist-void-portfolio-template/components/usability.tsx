"use client"

import { motion } from "framer-motion"

type Pillar = {
  number: string
  title: string
  body: string
}

const pillars: Pillar[] = [
  {
    number: "01",
    title: "Code my own prototypes",
    body: "React/TS, SwiftUI, Compose, Tauri, Electron, Next.js. The prototype that makes the design argument unambiguously — handed off with the contract already in code.",
  },
  {
    number: "02",
    title: "Reversibility as the policy axis",
    body: "'Is this safe?' is the wrong binary. What is the recovery cost? — that's the scale, and it's what determines when to pause for the human.",
  },
  {
    number: "03",
    title: "Calibrated language over raw percentages",
    body: "Likely / Unsure / Low — vocabulary the user can actually act on. Numbers progressively-disclose on hover, when they're needed.",
  },
  {
    number: "04",
    title: "Outcome-driven over task-driven",
    body: "Surface the outcome the user actually wants, then let them steer the system there. Workflows are means; outcomes are the end.",
  },
]

const credentials = [
  { label: "HFI Certified Usability Analyst", detail: "CUA" },
  { label: "B.Tech, Computer Science", detail: "BTLIT Bangalore · VTU · 2008–2013" },
  { label: "12+ years shipping product", detail: "Enterprise SaaS · AI surfaces · Native + Web" },
]

export function Usability() {
  return (
    <section
      id="usability"
      aria-labelledby="usability-heading"
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
          06 — HOW I WORK
        </p>
        <h2
          id="usability-heading"
          className="font-sans text-3xl md:text-5xl font-light italic"
        >
          Usability is the litmus test, not the checklist.
        </h2>
        <p className="mt-6 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
          Accessibility, calibrated confidence, and recoverability aren't
          accessories. They're how you tell if enterprise software is actually
          any good.
        </p>
      </motion.div>

      {/* Four pillars */}
      <ul className="grid gap-px bg-border md:grid-cols-2 mb-20 border border-border">
        {pillars.map((pillar, index) => (
          <motion.li
            key={pillar.number}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.6,
              delay: index * 0.08,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="bg-background p-8 md:p-10"
          >
            <p className="font-mono text-[10px] tracking-[0.3em] text-accent mb-4">
              {pillar.number}
            </p>
            <h3 className="font-sans text-2xl md:text-3xl font-light tracking-tight mb-4">
              {pillar.title}
            </h3>
            <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
              {pillar.body}
            </p>
          </motion.li>
        ))}
      </ul>

      {/* Credentials */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="border-t border-border pt-10"
      >
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-6">
          Credentials &amp; foundation
        </p>
        <ul className="grid gap-6 md:grid-cols-3">
          {credentials.map((credential) => (
            <li key={credential.label}>
              <p className="font-sans text-base md:text-lg text-foreground">
                {credential.label}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {credential.detail}
              </p>
            </li>
          ))}
        </ul>
      </motion.div>
      </div>
    </section>
  )
}
