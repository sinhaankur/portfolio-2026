import type { Metadata } from "next"
import Link from "next/link"
import { Github, ExternalLink, ArrowUpRight } from "lucide-react"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseLessons,
  CasePullQuote,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  title: "Usability Engine — an audit catalog you can run · Ankur Sinha",
  description:
    "Nielsen's 10 heuristics rewritten for modern product surfaces, plus two extensions for AI agents. Twelve self-audit questions, twelve LLM prompts, twelve interactive good-vs-bad demos. Designer + engineer: Ankur Sinha.",
}

/* ---------- Heuristic catalog summary ---------- */

type Severity = "blocker" | "major" | "minor"
type Checkability = "script" | "llm" | "hybrid" | "manual"
type HeuristicRow = {
  number: string
  title: string
  severity: Severity
  checkability: Checkability
  note: string
}

const heuristics: HeuristicRow[] = [
  { number: "01", title: "Visibility of system status",          severity: "blocker", checkability: "hybrid", note: "Silence is the most expensive UX bug." },
  { number: "02", title: "Match the user's world, not the system's", severity: "major",   checkability: "llm",    note: "Jargon audit — replace anything 2+ users define differently." },
  { number: "03", title: "User control & freedom",                severity: "blocker", checkability: "hybrid", note: "Soft-delete with snackbar > confirmation modal." },
  { number: "04", title: "Consistency & standards",               severity: "major",   checkability: "script", note: "Same word, same icon, same action — everywhere." },
  { number: "05", title: "Error prevention",                      severity: "blocker", checkability: "hybrid", note: "Make the wrong state unreachable, not just recoverable." },
  { number: "06", title: "Recognition over recall",               severity: "major",   checkability: "llm",    note: "Show options. Don't make people remember them." },
  { number: "07", title: "Flexibility & efficiency",              severity: "major",   checkability: "script", note: "Power users deserve shortcuts; novices shouldn't see them." },
  { number: "08", title: "Aesthetic & minimalist design",         severity: "major",   checkability: "llm",    note: "Every element competes for attention." },
  { number: "09", title: "Recognize, diagnose, recover",          severity: "blocker", checkability: "llm",    note: "Errors must say what, why, and what to do next." },
  { number: "10", title: "Help & documentation",                  severity: "major",   checkability: "llm",    note: "Help that arrives where the user is stuck, not buried in a menu." },
  { number: "11", title: "Uncertainty must be legible",           severity: "blocker", checkability: "llm",    note: "New. Every AI claim shows its confidence." },
  { number: "12", title: "Reversibility is the policy axis",      severity: "blocker", checkability: "manual", note: "New. Map each agent action to its recovery cost." },
]

const severityStyles: Record<Severity, string> = {
  blocker: "border-red-600/40 text-red-600 dark:text-red-400 bg-red-500/10",
  major:   "border-amber-600/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  minor:   "border-border text-muted-foreground bg-secondary/40",
}

const checkabilityStyles: Record<Checkability, string> = {
  script: "border-emerald-600/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  llm:    "border-sky-600/40 text-sky-600 dark:text-sky-400 bg-sky-500/10",
  hybrid: "border-violet-600/40 text-violet-600 dark:text-violet-400 bg-violet-500/10",
  manual: "border-border text-muted-foreground bg-secondary/40",
}

/* ---------- Checkability tiers ---------- */

type Tier = { key: Checkability; label: string; body: string; example: string }
const tiers: Tier[] = [
  {
    key: "script",
    label: "Script",
    body: "A deterministic check on the DOM, accessibility tree, or rendered text. No model needed; the answer is yes/no.",
    example: "Find every interactive element on the page and verify it has a visible focus ring.",
  },
  {
    key: "llm",
    label: "LLM",
    body: "A prompt against the visible content. The model evaluates judgment-shaped questions a script can't reduce to a regex.",
    example: "Read every error message on the page and judge whether it tells the user what went wrong, why, and what to do next.",
  },
  {
    key: "hybrid",
    label: "Hybrid",
    body: "Script enumerates candidates, LLM evaluates them. The split is mechanical: scripts find the elements, models judge the quality.",
    example: "Script lists every destructive button; LLM follows each click and rates whether recovery is visible without a modal.",
  },
  {
    key: "manual",
    label: "Manual",
    body: "The judgment requires reading the system architecture or the user model. Pattern detection isn't enough; this is design review.",
    example: "Mapping every agentic action to its recovery cost — needs the actual blast-radius diagram and the approval-authority model.",
  },
]

export default function UsabilityEngineCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Live demo · Open source"
      title="Usability Engine — an audit catalog you can run."
      subtitle="Nielsen's 10 rewritten for modern surfaces. Plus two extensions for AI agents. Each heuristic carries its own audit question, its own LLM prompt, its own interactive demo."
      period="2026 · live on this site"
      role="Designer · Engineer"
      tags={["UX research", "Heuristic evaluation", "Local LLM", "Open source"]}
      backTo={{ label: "Back to The Lab", href: "/#lab" }}
      intro={
        <>
          <p>
            Most usability writing online — Nielsen's 10, Norman doors, the WCAG
            checklist — gives you the <em>principle</em> but not the{" "}
            <em>audit</em>. You read the heuristic. You nod. You close the tab.
            The product you were going to fix is still broken.
          </p>
          <p>
            The Usability Engine is the catalog as engine. Twelve heuristics —
            Nielsen's 10 rewritten in the vocabulary of modern product surfaces,
            plus two extensions for AI: <strong>Uncertainty must be legible</strong>{" "}
            and <strong>Reversibility is the policy axis</strong>. Each row
            carries its audit question, its fix, its automation spec, and where
            it makes sense, an interactive good-vs-bad demo.
          </p>
          <p>
            Type a URL in. The engine pages each heuristic, marks a verdict,
            reports back. Heuristics a script can answer get a script. Ones
            that need judgment route through your local Ollama. Ones that need
            a human reading a system diagram stay manual and say so. Nothing is
            faked. The static site never touches the cloud.
          </p>
        </>
      }
    >
      {/* Action row — live demo + source */}
      <section aria-label="Project links" className="-mt-8 md:-mt-12">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/usability"
            data-cursor-hover
            className="
              inline-flex items-center gap-2.5
              px-5 py-3 rounded-full
              border border-foreground/80 bg-foreground text-background
              hover:bg-background hover:text-foreground hover:border-foreground
              transition-colors duration-300
              font-mono text-xs tracking-[0.2em] uppercase
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
            "
          >
            Open the live engine
            <ArrowUpRight className="w-3 h-3 opacity-70" aria-hidden="true" />
          </Link>
          <a
            href="https://github.com/sinhaankur/Portfolio/tree/main/components/usability-engine"
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="
              inline-flex items-center gap-2
              px-4 py-2.5 rounded-full
              border border-border bg-background hover:border-accent/60
              transition-colors duration-300
              font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
            "
          >
            <Github className="w-3.5 h-3.5" aria-hidden="true" />
            usability-engine source
          </a>
          <a
            href="https://github.com/sinhaankur/Portfolio/blob/main/components/usability-engine/heuristics.ts"
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="
              inline-flex items-center gap-2
              px-4 py-2.5 rounded-full
              border border-border bg-background hover:border-accent/60
              transition-colors duration-300
              font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
            "
          >
            <Github className="w-3.5 h-3.5" aria-hidden="true" />
            heuristics.ts
            <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Featured anchor — the spec is the engine */}
      <section>
        <div className="rounded-md border border-border bg-secondary/30 p-6 md:p-10">
          <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-3">
                heuristics.ts · 12 rows · one renderer
              </p>
              <h2 className="font-sans text-2xl md:text-3xl font-light text-foreground leading-tight">
                The catalog is the spec.
              </h2>
              <p className="mt-4 font-sans text-base text-foreground/80 leading-relaxed max-w-prose">
                One row of data per heuristic — story, severity, audit question,
                fix, checkability, automation spec, optional demo key. The engine
                handles surface filtering, demo lookup, verdict aggregation, and
                report generation. Add a row, the engine picks it up.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Static export", "No backend", "Local Ollama, opt-in", "Apache 2.0"].map((p) => (
                  <span
                    key={p}
                    className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border border-border rounded-full text-foreground/80"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <pre
              aria-hidden="true"
              className="font-mono text-[11px] md:text-xs leading-relaxed text-foreground/80 bg-background border border-border rounded p-5 overflow-x-auto"
            >
{`{
  id: "user-control",
  number: "03",
  title: "User control & freedom",
  severity: "blocker",
  appliesTo: ["website","application",
              "form","mobile-app"],
  story: "...",
  auditQuestion: "...",
  fix: "...",
  checkability: "hybrid",
  automationSpec: "...",
  demo: "undo",
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* The catalog */}
      <section>
        <CaseSectionHeading>What's in the catalog</CaseSectionHeading>
        <CaseProse>
          <p>
            Twelve heuristics. Ten are Nielsen's, rewritten in the vocabulary of
            modern product surfaces — gone is "Help and documentation" as a
            placid footer link; in is "help that arrives where the user is stuck."
            Two are mine: an AI confidence axis and an agent reversibility axis.
            Severity is opinionated — blockers are the ones I will not ship past.
          </p>
        </CaseProse>
        <div className="mt-8 overflow-x-auto border border-border rounded-md">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/30">
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-4 py-3 border-b border-border">#</th>
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-4 py-3 border-b border-border">Heuristic</th>
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-4 py-3 border-b border-border">Severity</th>
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-4 py-3 border-b border-border">Checkability</th>
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-4 py-3 border-b border-border">Note</th>
              </tr>
            </thead>
            <tbody>
              {heuristics.map((h, i) => (
                <tr
                  key={h.number}
                  className={i === heuristics.length - 1 ? "" : "border-b border-border"}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground align-top">{h.number}</td>
                  <td className="px-4 py-3 font-sans text-sm text-foreground align-top">{h.title}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-block font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border rounded-full ${severityStyles[h.severity]}`}>
                      {h.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-block font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border rounded-full ${checkabilityStyles[h.checkability]}`}>
                      {h.checkability}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-sans text-sm text-foreground/75 align-top leading-relaxed">{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Checkability framework */}
      <section>
        <CaseSectionHeading>Checkability tiers — what an audit can honestly automate</CaseSectionHeading>
        <CaseProse>
          <p>
            "Run an audit" is a vague verb. Some heuristics reduce to a regex on
            the DOM. Some are entirely judgment calls a script can never resolve.
            Each row in the catalog declares which it is — so the engine never
            pretends to answer a question it can't.
          </p>
        </CaseProse>
        <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {tiers.map((t) => (
            <li key={t.key} className="border border-border rounded-md p-6 bg-background flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-block font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border rounded-full ${checkabilityStyles[t.key]}`}>
                  {t.label}
                </span>
              </div>
              <p className="font-sans text-sm text-foreground/85 leading-relaxed mb-3">{t.body}</p>
              <p className="font-mono text-xs text-foreground/65 leading-relaxed border-l-2 border-border pl-3 mt-auto">
                e.g. {t.example}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Two new heuristics — the AI extensions */}
      <section>
        <CaseSectionHeading>Two heuristics that aren't Nielsen's</CaseSectionHeading>
        <CaseProse>
          <p>
            Nielsen's 10 were written in 1994 for desktop GUIs. They still hold.
            They don't cover what generative interfaces broke. These two are the
            additions I argue for — both rated blocker, both shipped in the catalog.
          </p>
        </CaseProse>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="border border-border rounded-md p-6 md:p-7 bg-background">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">11 · Blocker</p>
            <h3 className="font-sans text-lg text-foreground mb-3">Uncertainty must be legible.</h3>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed mb-3">
              Generative interfaces output confident prose regardless of how much
              they actually know. Without a visible confidence signal, the user
              has no way to weight the output — and repeated overconfidence
              erodes trust in the whole system.
            </p>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed">
              Fix: a calibrated vocabulary — Confident, Likely, Unsure, Low.
              Reserve raw percentages for power users who hover. Show the basis
              for every confident claim.
            </p>
          </article>
          <article className="border border-border rounded-md p-6 md:p-7 bg-background">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">12 · Blocker</p>
            <h3 className="font-sans text-lg text-foreground mb-3">Reversibility is the policy axis.</h3>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed mb-3">
              "Safety" is too vague to design around. <em>Recovery cost</em> is
              the lever: how quickly, how completely, and at what cognitive cost
              can the user undo the agent's action?
            </p>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed">
              Fix: a reversibility chip in the agent UX. Cheap to undo → run
              autonomously. Expensive to undo → present for human approval first.
              The recovery path is part of the design, not an afterthought.
            </p>
          </article>
        </div>
      </section>

      {/* Live audit mode */}
      <section>
        <CaseSectionHeading>The live audit mode</CaseSectionHeading>
        <CaseProse>
          <p>
            The engine has two modes. Manifesto mode is what most visitors see —
            twelve numbered heuristics, each with its story, an interactive demo
            where one is registered, and a self-audit question with a
            tap-to-reveal fix.
          </p>
          <p>
            Audit mode takes a URL. The engine pages through every applicable
            heuristic, asks the user to mark Pass / Fail / N/A, and assembles a
            report with the per-heuristic verdicts and a severity-weighted tally.
            For heuristics with an LLM prompt, the prompt is right there in the
            interface — copy it, paste it into Ollama with the page text, get
            an answer.
          </p>
          <p>
            What it doesn't do: pretend to be an autonomous crawler. The site is
            a static export — there is no backend, no headless browser, no cloud
            call. The audit is human-in-the-loop on purpose. The engine's job is
            to make the audit cheap and well-organised, not to fake it.
          </p>
        </CaseProse>
      </section>

      {/* Design moves */}
      <section>
        <CaseSectionHeading>Design moves I'm proud of</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Checkability as a first-class field, not a footnote.",
              body: "Every row declares whether a script, an LLM, a hybrid, or a human eye answers its question. The engine renders the tier on the card; the report respects it. No claim is made that a manual heuristic was 'automated.'",
            },
            {
              title: "Severity is opinionated, not democratic.",
              body: "Five of twelve are blockers — including both AI extensions. I'd rather over-call severity than ship a checklist where everything reads as major and nothing as a stop-the-line. A blocker says: I won't help you launch past this.",
            },
            {
              title: "Demos pair a good and a bad version side by side.",
              body: "The good-vs-bad pattern is the smallest reproducible UX experiment. One artifact teaches the principle better than a paragraph of prose can. Where a heuristic has one (visibility-of-status, undo, error-prevention, recognition), that demo is the focal point of the card.",
            },
            {
              title: "Ollama is opt-in, never default.",
              body: "The LLM prompts are part of the spec, not a hosted feature. Anyone with Ollama can run them on their own machine; the static site never makes a network call. The product is the catalog and the engine — the model is whichever one you brought.",
            },
            {
              title: "Two new heuristics in a place that respects Nielsen.",
              body: "Adding to a canon is delicate work. The 12 are presented in number order — Nielsen's 10 keep their original numbering; the AI extensions land at 11 and 12 with their own claim. The reader can audit the lineage without being asked to take the additions on faith.",
            },
          ]}
        />
      </section>

      <CasePullQuote>
        A heuristic without an audit is a poster. The Usability Engine's bet is
        that every principle worth writing down deserves the <em>verb</em> that
        proves it — the question you can answer, the fix you can ship, the
        check that catches you when you don't.
      </CasePullQuote>

      {/* CTA */}
      <section className="text-center pt-4">
        <Link
          href="/usability"
          data-cursor-hover
          className="
            inline-flex items-center gap-2
            font-mono text-xs tracking-widest uppercase
            px-6 py-3 border border-accent text-accent
            hover:bg-accent hover:text-accent-foreground
            transition-colors duration-300
            rounded-full
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-4 focus-visible:ring-offset-background
          "
        >
          Open the live engine →
        </Link>
      </section>

      <CaseNextLinks prev={{ label: "Back to The Lab", href: "/#lab" }} />
    </CaseStudyLayout>
  )
}
