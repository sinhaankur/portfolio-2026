"use client"

/**
 * DnaLegacyNote — a short editorial section framing the genome as inheritance:
 * a note to the next generation.
 *
 * The prose below is a SCAFFOLD / PLACEHOLDER. Per the project's author-driven
 * + copy-voice conventions, Ankur writes the real words. Replace the paragraphs
 * marked {/* TODO * /} with his own; keep it terse and concrete, no AI gloss.
 */

export function DnaLegacyNote() {
  return (
    <section>
      <div className="flex items-baseline gap-4 mb-6">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          A note, forward
        </h2>
      </div>

      <div className="max-w-2xl rounded-lg border border-border bg-secondary/15 p-6 md:p-8">
        <div className="font-serif text-lg md:text-xl leading-relaxed text-foreground/85 space-y-5">
          {/* TODO(Ankur): replace this placeholder with your own words. */}
          <p className="italic text-muted-foreground">
            [Placeholder — write this in your own voice.]
          </p>
          <p>
            If you&apos;re reading this, some of what&apos;s on this page is also
            in you. Not as a verdict — as a starting point.
          </p>
          <p>
            The genes here are the smallest part of what I&apos;d want to hand
            down. They&apos;re just the part a machine can read.
          </p>
        </div>
        <p className="mt-6 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
          — draft · to be written
        </p>
      </div>
    </section>
  )
}
