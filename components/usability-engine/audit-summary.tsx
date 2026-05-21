"use client"

/**
 * AuditSummary — end-of-page report for the active audit session.
 *
 * Shows the user a structured report once they've voted on at least
 * one heuristic. Failures are ordered by severity (blocker → major →
 * minor) so the most consequential gaps surface first.
 */

import { motion } from "framer-motion"
import type { AuditSession, Heuristic } from "./types"

const SEVERITY_RANK: Record<Heuristic["severity"], number> = {
  blocker: 0,
  major: 1,
  minor: 2,
}

export function AuditSummary({
  heuristics,
  session,
}: {
  heuristics: Heuristic[]
  session: AuditSession
}) {
  const answered = heuristics.filter((h) => session.verdicts[h.id])
  if (answered.length === 0) return null

  const passes = answered.filter((h) => session.verdicts[h.id] === "pass")
  const fails = answered
    .filter((h) => session.verdicts[h.id] === "fail")
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  const skips = answered.filter((h) => session.verdicts[h.id] === "skip")

  const scored = passes.length + fails.length
  const score = scored === 0 ? null : Math.round((passes.length / scored) * 100)

  let host = session.url
  try {
    host = new URL(session.url).host
  } catch {
    // url already plain
  }

  const grade = scoreGrade(score)

  return (
    <motion.section
      aria-labelledby="audit-summary-heading"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="mt-24 md:mt-32 border-t border-border pt-12 md:pt-16"
    >
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-6">
        Audit report ·{" "}
        <a
          href={session.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground hover:text-accent transition-colors"
        >
          {host}
        </a>
      </p>

      <h2
        id="audit-summary-heading"
        className="font-display text-3xl md:text-5xl font-light tracking-[-0.01em] leading-[1.05] mb-8"
      >
        {score === null ? (
          "No verdicts yet."
        ) : (
          <>
            <span className="italic">{grade.label}</span> · {score}/100
          </>
        )}
      </h2>

      {score !== null && (
        <p className="font-sans text-base md:text-lg text-foreground/80 max-w-2xl leading-relaxed mb-10">
          {grade.body} {scored < heuristics.length && (
            <span className="text-muted-foreground">
              ({heuristics.length - scored} heuristics not yet voted — finish the rest for a complete picture.)
            </span>
          )}
        </p>
      )}

      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        {/* Tally column */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Tally
          </p>
          <dl className="space-y-3 font-mono text-sm">
            <Row label="Passing"   value={passes.length} tone="good" />
            <Row label="Failing"   value={fails.length}  tone="bad" />
            <Row label="Skipped"   value={skips.length}  tone="muted" />
            <Row label="Unanswered" value={heuristics.length - answered.length} tone="muted" />
          </dl>
        </div>

        {/* Failures column — actionable list ordered by severity */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            What to fix first
          </p>
          {fails.length === 0 ? (
            <p className="font-sans text-base text-foreground/75 leading-relaxed">
              {score === 100 ? "Clean sweep. " : "Nothing failing yet. "}
              Failures sorted by severity will appear here as you mark them.
            </p>
          ) : (
            <ol className="space-y-5 border-t border-border">
              {fails.map((h) => (
                <li key={h.id} className="pt-5 border-b border-border pb-5 last:border-b-0">
                  <div className="flex items-baseline gap-3">
                    <span
                      aria-hidden="true"
                      className={`
                        inline-block w-1.5 h-1.5 rounded-full shrink-0
                        ${h.severity === "blocker" ? "bg-red-500" : h.severity === "major" ? "bg-amber-500" : "bg-emerald-500"}
                      `}
                    />
                    <span className="font-mono text-[10px] tracking-widest uppercase text-foreground/70 shrink-0">
                      {h.severity} · {h.number}
                    </span>
                    <h3 className="font-sans text-base md:text-lg text-foreground leading-snug">
                      {h.title}
                    </h3>
                  </div>
                  <p className="mt-2 ml-6 font-sans text-sm text-foreground/80 leading-relaxed max-w-2xl">
                    {h.fix}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <p className="mt-10 font-mono text-[10px] tracking-widest text-muted-foreground/80">
        Audit started{" "}
        {new Date(session.startedAt).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        · Your verdicts live in this browser. Refresh, come back, finish later.
      </p>
    </motion.section>
  )
}

function Row({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "muted" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
      <dt
        className={`
          ${tone === "good" ? "text-emerald-700 dark:text-emerald-400" : ""}
          ${tone === "bad"  ? "text-red-600 dark:text-red-400" : ""}
          ${tone === "muted" ? "text-foreground/65" : ""}
        `}
      >
        {label}
      </dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

function scoreGrade(score: number | null): { label: string; body: string } {
  if (score === null) return { label: "", body: "" }
  if (score >= 90) return {
    label: "Sharp.",
    body: "Nearly every heuristic answered passes. Whatever's still failing is worth fixing for the long tail of users, but the foundation is sound.",
  }
  if (score >= 70) return {
    label: "Solid foundation.",
    body: "Core usability holds. The failures below are the difference between solid and excellent — pick the blockers first.",
  }
  if (score >= 50) return {
    label: "Mixed bag.",
    body: "About half the heuristics passing. The blockers below are likely the friction points users are actually feeling — start there.",
  }
  return {
    label: "Material rebuild needed.",
    body: "Most heuristics failing. This is the kind of result where shipping one targeted fix per week will move the score visibly inside a quarter.",
  }
}
