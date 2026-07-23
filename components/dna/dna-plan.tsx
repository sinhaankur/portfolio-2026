/**
 * DnaPlan — the personalised course of action derived from YOUR genotypes:
 * which supplements/vitamins to consider, how the diet should lean, the habits
 * that fit, and what compounds over time. Every card shows the marker it came
 * from, so the reasoning is transparent. Informational, never a prescription.
 */

import { useMemo } from "react"
import { buildDnaPlan, type Recommendation } from "@/lib/dna-plan"
import { Pill, Salad, Activity, TrendingUp, Ban } from "lucide-react"

const TONE_STYLE: Record<Recommendation["tone"], string> = {
  "lean-in": "border-emerald-500/40 bg-emerald-500/[0.06]",
  consider: "border-accent/40 bg-accent/[0.05]",
  watch: "border-amber-500/40 bg-amber-500/[0.06]",
}
const TONE_LABEL: Record<Recommendation["tone"], string> = {
  "lean-in": "Lean in",
  consider: "Consider",
  watch: "Watch",
}

function RecCard({ rec }: { rec: Recommendation }) {
  return (
    <div className={`rounded-xl border p-4 ${TONE_STYLE[rec.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-sans text-sm md:text-base text-foreground leading-snug">{rec.what}</p>
        <span className="shrink-0 font-mono text-[9px] tracking-[0.16em] uppercase px-2 py-1 rounded-full border border-current/30 text-foreground/60">
          {TONE_LABEL[rec.tone]}
        </span>
      </div>
      <p className="mt-2 font-sans text-xs text-muted-foreground leading-relaxed">{rec.why}</p>
      <p className="mt-2.5 font-mono text-[10px] tracking-wider text-foreground/45">
        because your <span className="text-accent/80">{rec.because.gene}</span> is{" "}
        <span className="text-foreground/70">{rec.because.genotype}</span>
      </p>
    </div>
  )
}

function Bucket({
  icon, title, subtitle, recs,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  recs: Recommendation[]
}) {
  if (!recs.length) return null
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-accent">{icon}</span>
        <h3 className="font-display text-xl font-light text-foreground">{title}</h3>
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{subtitle}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {recs.map((r, i) => <RecCard key={i} rec={r} />)}
      </div>
    </div>
  )
}

export function DnaPlan({ traits }: { traits: Record<string, string> }) {
  const plan = useMemo(() => buildDnaPlan(traits), [traits])
  const total = plan.supplements.length + plan.diet.length + plan.habits.length
  if (total === 0) return null

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-3">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          Your plan
        </h2>
      </div>
      <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl mb-8">
        Not just what your genes say — what to <em>do</em> about it. Everything
        below is derived from your actual genotypes at specific markers; each card
        shows which one. It&apos;s a starting point for a conversation with a
        doctor or dietitian, not a prescription — genes are one input among diet,
        sleep, stress, and chance.
      </p>

      <div className="space-y-10">
        <Bucket
          icon={<Pill className="h-5 w-5" />}
          title="Supplements & vitamins"
          subtitle="worth considering for this genome"
          recs={plan.supplements}
        />
        <Bucket
          icon={<Salad className="h-5 w-5" />}
          title="Diet"
          subtitle="how to lean"
          recs={plan.diet}
        />
        <Bucket
          icon={<Activity className="h-5 w-5" />}
          title="Habits & movement"
          subtitle="what fits your biology"
          recs={plan.habits}
        />
        <Bucket
          icon={<Ban className="h-5 w-5" />}
          title="Things to steer clear of"
          subtitle="where your genome raises the cost"
          recs={plan.avoid}
        />

        {/* The long game */}
        {plan.overTime.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <TrendingUp className="h-5 w-5 text-accent" />
              <h3 className="font-display text-xl font-light text-foreground">Over time</h3>
            </div>
            <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4">
              None of this is a quick fix. These are the levers that compound —
              the habits that, kept for years, matter most for <em>this</em> genome:
            </p>
            <ul className="space-y-3">
              {plan.overTime.map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="font-sans text-sm text-foreground/80 leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 font-mono text-[10px] tracking-wider text-muted-foreground/60">
        Informational only · not medical advice · discuss supplements + big diet changes with a professional
      </p>
    </section>
  )
}
