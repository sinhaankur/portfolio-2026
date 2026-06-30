"use client"

/**
 * MirofishView — renders the /mirofish project write-up in the trading-terminal
 * visual language (mono labels, a stat strip, capability rows). Content comes
 * from content/mirofish.json, so everything here is data-driven — no factual
 * claims are hard-coded.
 */

import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import type { MirofishContent } from "@/lib/mirofish"

export function MirofishView({ content }: { content: MirofishContent }) {
  return (
    <article className="mx-auto max-w-4xl">
      {/* header */}
      <header className="mb-12 border-b border-border pb-8">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
          Project · {content.meta.name}
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-light tracking-[-0.02em] leading-[1.05]">
          {content.meta.name}
        </h1>
        {content.meta.tagline && (
          <p className="mt-4 font-sans text-base md:text-lg text-foreground/70 leading-relaxed max-w-2xl">
            {content.meta.tagline}
          </p>
        )}
      </header>

      {/* stat strip — terminal vibe, tabular figures */}
      {content.stats?.length > 0 && (
        <div className="mb-12 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-md border border-border bg-border">
          {content.stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className="group relative bg-background px-4 py-5"
            >
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
                {s.label}
              </div>
              <div className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-accent tabular-nums">
                {s.value}
              </div>
              <span
                className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-accent/50 transition-transform duration-300 group-hover:scale-x-100"
                aria-hidden
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* summary */}
      {content.summary?.length > 0 && (
        <section className="mb-14">
          {content.summary.map((p, i) => (
            <p
              key={i}
              className="font-sans text-base md:text-lg text-foreground/85 leading-relaxed mb-5 last:mb-0"
            >
              {p}
            </p>
          ))}
        </section>
      )}

      {/* capabilities */}
      {content.capabilities?.length > 0 && (
        <section className="mb-14">
          <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-6">
            What it can do
          </h2>
          <div className="divide-y divide-border border-y border-border">
            {content.capabilities.map((c) => (
              <div
                key={c.title}
                className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-6 py-4"
              >
                <div className="font-display text-lg font-light tracking-[-0.01em] text-foreground">
                  {c.title}
                </div>
                <div className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed">
                  {c.detail}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* architecture */}
      {content.architecture?.length > 0 && (
        <section className="mb-14">
          <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-6">
            How it&apos;s built
          </h2>
          {content.architecture.map((p, i) => (
            <p
              key={i}
              className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed mb-4 last:mb-0"
            >
              {p}
            </p>
          ))}
        </section>
      )}

      {/* caveats */}
      {content.caveats?.length > 0 && (
        <section className="mb-14 rounded-md border border-border bg-secondary/20 px-5 py-5">
          <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Honest limitations
          </h2>
          <ul className="space-y-2.5">
            {content.caveats.map((c, i) => (
              <li
                key={i}
                className="flex gap-3 font-sans text-sm text-foreground/70 leading-relaxed"
              >
                <span className="text-muted-foreground select-none">—</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* links */}
      {content.links && content.links.length > 0 && (
        <section className="flex flex-wrap gap-3">
          {content.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-hover
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/20 px-4 py-2 font-mono text-[11px] tracking-widest uppercase text-foreground/80 hover:border-accent hover:text-accent transition-colors"
            >
              {l.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ))}
        </section>
      )}
    </article>
  )
}
