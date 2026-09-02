"use client"

/**
 * AdaptabilityDemo — feel WHY the audience factors matter, on /framework.
 *
 * A small, ordinary UI card sits inside a "lens" you can toggle: low vision
 * (blur), low contrast, small text, and hand tremor (jitter). Flip them on and
 * the same interface that's trivial for you becomes hard — which is exactly the
 * point: the adaptations in the framework (bigger text, higher contrast, larger
 * targets) aren't niceties, they're what make it usable for a real audience.
 *
 * It's a SIMULATION, honestly labelled — not a substitute for testing with real
 * people, but a fast way to build the intuition. Reduced-motion-safe (the tremor
 * lens is disabled under prefers-reduced-motion). No deps.
 */

import { useState } from "react"
import { useReducedMotion } from "framer-motion"

type Lens = "blur" | "contrast" | "small" | "tremor"

const LENSES: { id: Lens; label: string; note: string }[] = [
  { id: "blur", label: "Low vision", note: "cataract / presbyopia — common with age" },
  { id: "contrast", label: "Low contrast", note: "glare, sunlight, aging eyes" },
  { id: "small", label: "Small text", note: "default type that ignores OS size" },
  { id: "tremor", label: "Hand tremor", note: "motor imprecision — targets must forgive it" },
]

export function AdaptabilityDemo() {
  const reduce = useReducedMotion()
  const [on, setOn] = useState<Record<Lens, boolean>>({ blur: false, contrast: false, small: false, tremor: false })
  const [adapted, setAdapted] = useState(false)

  const toggle = (l: Lens) => setOn((s) => ({ ...s, [l]: !s[l] }))
  const anyOn = Object.values(on).some(Boolean)

  // The lens CSS applied to the sample UI. When "adapted" is on, the design
  // itself compensates (bigger, higher-contrast, larger targets) so the same
  // impairments hurt far less — the framework's point, made visible.
  const filter = [
    on.blur ? (adapted ? "blur(1px)" : "blur(2.4px)") : "",
    on.contrast ? (adapted ? "contrast(0.85)" : "contrast(0.55)") : "",
  ].filter(Boolean).join(" ")

  const tremor = on.tremor && !reduce
  const baseText = on.small && !adapted ? "text-[11px]" : "text-sm"
  const targetSize = adapted ? "min-h-11 px-5 py-3 text-sm" : "min-h-8 px-3 py-1.5 text-[12px]"

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h4 className="font-sans text-sm font-medium text-foreground">Feel the audience factors</h4>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">simulation</span>
      </div>
      <p className="font-sans text-[13px] text-foreground/60 leading-relaxed mb-4">
        Switch on a lens and this ordinary card gets hard to use. Then flip{" "}
        <span className="text-foreground/80">Adapt the design</span> — bigger type,
        higher contrast, larger targets — and watch the same impairment stop
        mattering. That&apos;s the whole idea.
      </p>

      {/* lens toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {LENSES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => toggle(l.id)}
            data-cursor-hover
            aria-pressed={on[l.id]}
            title={l.note}
            className={`rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors ${
              on[l.id]
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* the sample UI, under the lens */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-background/70 p-5">
        <div
          className={tremor ? "motion-safe:animate-[fw-tremor_0.12s_infinite_alternate]" : ""}
          style={{ filter: filter || undefined }}
        >
          <div className={`${baseText} ${on.contrast && !adapted ? "text-foreground/45" : "text-foreground/90"}`}>
            <p className="font-medium">Confirm your transfer</p>
            <p className={`mt-1 ${on.contrast && !adapted ? "text-foreground/35" : "text-foreground/60"}`}>
              Sending $240.00 to Priya S. This can&apos;t be undone once confirmed.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                data-cursor-hover
                className={`rounded-lg bg-accent font-mono uppercase tracking-widest text-background ${targetSize}`}
              >
                Confirm
              </button>
              <button
                type="button"
                data-cursor-hover
                className={`rounded-lg border border-border font-mono uppercase tracking-widest text-foreground/70 ${targetSize}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* adapt toggle + read-out */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setAdapted((v) => !v)}
          data-cursor-hover
          aria-pressed={adapted}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] tracking-widest uppercase transition-colors ${
            adapted ? "bg-foreground text-background" : "border border-foreground/30 text-foreground hover:border-accent/60"
          }`}
        >
          {adapted ? "Design adapted ✓" : "Adapt the design"}
        </button>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground max-w-xs">
          {!anyOn
            ? "Turn on a lens to see the barrier."
            : adapted
              ? "Bigger type, AA contrast, ≥44px targets — the impairment barely bites now."
              : "This is what a real slice of your audience faces every day."}
        </p>
      </div>

      <p className="mt-3 font-mono text-[9px] leading-relaxed text-muted-foreground/70">
        A simulation to build intuition — never a substitute for testing with real people.
      </p>

      <style jsx>{`
        @keyframes fw-tremor {
          from { transform: translate(0, 0); }
          to { transform: translate(1.5px, -1.5px); }
        }
      `}</style>
    </div>
  )
}
