"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

const trustModes = [
  {
    name: "LOCAL",
    headline: "Your machines only",
    body: "Pool the computers you already own into a single inference cluster.",
    price: "Free forever",
  },
  {
    name: "TRUSTED",
    headline: "You + your circle",
    body: "Optionally bring in your friends' GPUs. Same endpoint, wider radius.",
    price: "Free forever",
  },
  {
    name: "PUBLIC",
    headline: "Swarm of strangers",
    body: "The safety net. Pay in USDC only when you opt in.",
    price: "Pay-per-use",
  },
]

export function UnhostedFeature() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section
      id="unhosted"
      aria-labelledby="unhosted-heading"
      className="relative py-32 md:py-40 px-6 md:px-12 overflow-hidden"
    >
      {/* Ambient backdrop — three concentric ring glow representing the trust radius */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.07]"
      >
        <div className="w-[800px] h-[800px] max-w-[120vw] max-h-[120vw] rounded-full border border-foreground" />
        <div className="absolute w-[560px] h-[560px] max-w-[80vw] max-h-[80vw] rounded-full border border-foreground" />
        <div className="absolute w-[320px] h-[320px] max-w-[45vw] max-h-[45vw] rounded-full border border-foreground" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-8 flex flex-wrap items-center gap-3"
        >
          <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
            06 — FLAGSHIP
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-accent/40 text-accent rounded-full">
            github.com/unhosted-ai · CLI v0.0.34
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border text-foreground/80 rounded-full">
            Apache 2.0
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          id="unhosted-heading"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="font-display text-5xl md:text-7xl lg:text-8xl font-light tracking-[-0.02em] leading-[1.02] text-balance"
        >
          Unhosted — <span className="italic">AI that lives where you do.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-8 max-w-3xl font-sans text-lg md:text-xl text-foreground/85 leading-relaxed"
        >
          Pool the computers you already own — and optionally your friends',
          and optionally a public swarm of strangers' GPUs — into a single
          inference cluster.{" "}
          <span className="text-foreground">One endpoint.</span> Mac, Linux,
          Windows. CUDA, Metal, ROCm.
        </motion.p>

        {/* Three trust modes */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-16 md:mt-20"
        >
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-6">
            Three trust modes — you decide the radius
          </p>

          <ul className="grid gap-4 md:grid-cols-3">
            {trustModes.map((mode, index) => (
              <motion.li
                key={mode.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: 0.3 + index * 0.08,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="
                  group relative p-6 md:p-8
                  border border-border rounded-lg
                  bg-background/40 backdrop-blur-sm
                  hover:border-accent/50 transition-colors duration-300
                "
              >
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent">
                  {mode.name}
                </span>
                <h3 className="mt-3 font-sans text-2xl font-light tracking-tight text-foreground">
                  {mode.headline}
                </h3>
                <p className="mt-3 font-sans text-sm text-foreground/75 leading-relaxed">
                  {mode.body}
                </p>
                <span className="mt-6 inline-block font-mono text-[10px] tracking-widest uppercase text-foreground/90">
                  {mode.price}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Promise + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="
            mt-16 md:mt-20 p-8 md:p-10
            border-t border-b border-border
            flex flex-col md:flex-row md:items-center justify-between gap-6
          "
        >
          <p className="font-sans text-base md:text-lg text-foreground/85 leading-relaxed max-w-2xl">
            <span className="text-foreground">
              Local and trusted are free forever.
            </span>{" "}
            Public is the safety net you pay for in USDC only when you opt in.
            You can use Unhosted for the rest of your life and never spend a
            dollar.
          </p>

          <motion.a
            href="https://github.com/unhosted-ai"
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            whileHover={prefersReducedMotion ? undefined : { x: 4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="
              inline-flex items-center gap-3 shrink-0
              px-6 py-3 border border-border rounded-full
              font-mono text-xs tracking-widest uppercase
              text-foreground hover:bg-foreground hover:text-background
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              min-h-11
            "
            aria-label="Unhosted on GitHub — opens in a new tab"
          >
            View on GitHub
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
