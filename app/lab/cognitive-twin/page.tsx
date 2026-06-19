import type { Metadata } from "next"
import { Github, ExternalLink } from "lucide-react"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseLessons,
  CasePullQuote,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  title: "Cognitive Twin Agent — a local-first personal AI runtime · Ankur Sinha",
  description:
    "An open-source (MIT) local-first personal AI agent: a local Ollama model, a skill system, and a bounded tool-calling loop that turns 'do X' into real actions — privately, on hardware you own. Built in the spirit of local-first agent research like OpenJarvis.",
}

type RuntimeRow = {
  layer: string
  detail: string
  why: string
}

const runtimeRows: RuntimeRow[] = [
  {
    layer: "Local model",
    detail: "Ollama over its HTTP API (stdlib only), any tool-capable model",
    why: "Reasoning stays on-device by default — no cloud dependency for the core loop.",
  },
  {
    layer: "Persona",
    detail: "system_dna.md drives voice and behaviour",
    why: "The twin reasons in a consistent, owned character rather than a generic assistant.",
  },
  {
    layer: "Skill system",
    detail: "Skill contract + registry → tool specs (now · list_dir · read_file · daily_digest)",
    why: "Turns “do X” into real, typed actions the model can call; new skills are a few lines.",
  },
  {
    layer: "Agent loop",
    detail: "persona + tools → model → run tool → feed result back → repeat, with a step limit",
    why: "A bounded loop where skill errors are fed back to recover — guardrails over autonomy.",
  },
  {
    layer: "Model routing",
    detail: "A policy file picks a local model per request by task complexity, risk, and device state",
    why: "The right local model for the job — fast one for quick asks, a deeper one for risky planning — never the cloud.",
  },
  {
    layer: "Local context",
    detail: "Workspace tasks.md + a dropped-in .ics fold into the daily digest (no OAuth)",
    why: "Useful day-mapping today without sending anything off-device.",
  },
  {
    layer: "Future layers",
    detail: "OAuth connectors, IPC, menubar, multimodal sensing (scaffolding in src/)",
    why: "Kept as the next layers to harden onto the working core, not yet wired into the agent.",
  },
]

const shipped: { title: string; body: string }[] = [
  {
    title: "Local model client",
    body: "Talks to Ollama over its HTTP API using only the Python standard library — no heavy SDK, no API key, no cloud round-trip for the core loop.",
  },
  {
    title: "Skill system",
    body: "A small Skill contract + registry compiles Python functions into tool specs the model can call. Built-ins: now, list_dir, read_file (sandboxed), and daily_digest. Adding one is a decorator and a few lines.",
  },
  {
    title: "Bounded tool-calling loop",
    body: "Persona + tools → model → run the tool → feed the result back → repeat, under a step limit. Skill errors are returned to the model to recover from rather than crashing the run — deterministic guardrails over an autonomous loop.",
  },
  {
    title: "Policy-driven model routing",
    body: "A JSON policy picks a local model per request — a small heuristic classifies each prompt by complexity and risk, then the first matching rule wins (a fast model for quick asks, a deeper one for risky planning, a low-power one on battery). Routing never leaves the machine, and --route-explain shows exactly why each model was chosen.",
  },
  {
    title: "Local day-mapping",
    body: "daily_digest folds a workspace tasks.md and a dropped-in .ics calendar into a summary of your day — useful context with zero OAuth and nothing leaving the machine.",
  },
  {
    title: "CLI + tested plumbing",
    body: "One-shot and interactive REPL entrypoints (python -m cognitive_twin), model selection, and a pytest suite that drives the loop with a mock client so the tool-calling plumbing is provable without a live model.",
  },
]

const journeySteps: { stage: string; detail: string }[] = [
  {
    stage: "Install a model",
    detail:
      "Pull a tool-capable model with Ollama (e.g. qwen2.5:3b or llama3.2) — local-first from the very first run.",
  },
  {
    stage: "Run the agent",
    detail:
      "python -m cognitive_twin \"…\" for a one-shot, or no args for an interactive REPL. The core needs no Python dependencies.",
  },
  {
    stage: "Give it local context",
    detail:
      "Drop a tasks.md and a .ics into the workspace; daily_digest folds them into a summary of your day — no OAuth, nothing off-device.",
  },
  {
    stage: "Teach it skills",
    detail:
      "Add a skill with a decorator and a small JSON schema; the registry exposes it to the model as a callable tool.",
  },
  {
    stage: "Ahead",
    detail:
      "Harden the scaffolded layers onto the core — OAuth connectors, a menubar shell, and multimodal sensing — with consent and trust made explicit as each lands.",
  },
]

export default function CognitiveTwinPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab — AI Systems · 2026 · in progress"
      title="Cognitive Twin Agent"
      subtitle="A local-first personal AI agent that runs continuously, senses context, and maps day-to-day work into actionable plans — on a machine I control."
      period="2026 · active build"
      role="Architect · Designer · Engineer"
      tags={["Agent systems", "Local-first", "Multimodal", "Privacy", "Work in progress"]}
      backTo={{ label: "Back to The Lab", href: "/lab" }}
      intro={
        <>
          <p>
            This project started as a digital-twin prompt architecture and evolved into
            an application runtime: an always-on daemon, multimodal perception, and
            day-mapping connectors. The goal is no longer just response style — it&rsquo;s{" "}
            <strong>reliable operational behavior</strong> on a machine I control,
            calling the cloud only when it&rsquo;s genuinely the better tool.
          </p>
          <p>
            It sits in the same lineage as recent local-first agent research — work like
            Stanford&rsquo;s{" "}
            <a
              href="https://github.com/open-jarvis/OpenJarvis"
              target="_blank"
              rel="noreferrer noopener"
            >
              OpenJarvis
            </a>
            , whose benchmarks show local models already handling the large majority of
            everyday queries. That&rsquo;s the bet this build is making too: keep context,
            sensing, and trust on-device by default.
          </p>
          <p className="text-sm text-muted-foreground">
            Working MVP, open source under MIT — a local model, a skill system, and a
            bounded agent loop you can run today. What follows is where the architecture
            stands, and the layers still ahead.
          </p>
        </>
      }
    >
      <section aria-label="Project links" className="-mt-8 md:-mt-12">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://github.com/sinhaankur/cognitive-twin-agent"
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="
              inline-flex items-center gap-2.5
              px-5 py-3 rounded-full
              border border-border bg-secondary/30 hover:border-accent/60
              transition-colors duration-300
              font-mono text-xs tracking-[0.2em] uppercase text-foreground/85
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
            "
          >
            <Github className="w-4 h-4" aria-hidden="true" />
            cognitive-twin-agent · open source (MIT)
            <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
          </a>
          <a
            href="https://github.com/open-jarvis/OpenJarvis"
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
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Prior art: OpenJarvis
          </a>
        </div>
      </section>

      <section>
        <CaseSectionHeading>Why local-first</CaseSectionHeading>
        <CaseProse>
          <p>
            Most personal assistants route everything through a cloud API. That is the
            wrong default for something that watches your screen, hears your room, and
            reads your calendar. The thesis here — shared with local-first agent research
            like{" "}
            <a
              href="https://github.com/open-jarvis/OpenJarvis"
              target="_blank"
              rel="noreferrer noopener"
            >
              OpenJarvis
            </a>{" "}
            — is that on-device models are now good enough to handle the large majority of
            everyday work, so the cloud should be the exception, not the rule.
          </p>
          <p>
            This is my own build, not a fork of any framework — an original implementation
            in the same spirit. OpenJarvis is prior art I point to for the local-first case;
            the persona, skill system, and bounded agent loop below are mine. The aim is a
            daily companion where context and reasoning stay on a machine I control.
          </p>
          <p>
            One idea I took directly from that line of research is <strong>routing the
            right local model to each task</strong> instead of sending everything to one
            big model. Here that&rsquo;s a JSON policy: a quick model for simple asks, a
            deeper one when a request is complex and risky, a low-power one on battery — and
            an explicit guardrail that keeps it all on-device. The classifier behind it is a
            transparent heuristic, not a black box, so every routing decision is inspectable.
          </p>
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>What it is now</CaseSectionHeading>
        <CaseProse>
          <p>
            Today it&rsquo;s a working command-line agent: a local model (via Ollama), a
            persona loaded from <code>system_dna.md</code>, a registry of skills the model
            can call, and a bounded loop that turns a request into real actions. You can run{" "}
            <code>python -m cognitive_twin &quot;summarize my day&quot;</code> and it reads a
            local <code>tasks.md</code> and calendar file to answer — nothing leaves the
            machine.
          </p>
          <p>
            The runnable core lives in the <code>cognitive_twin/</code> package. An earlier{" "}
            <code>src/</code> tree holds scaffolding for the layers ahead — OAuth connectors,
            IPC, a menubar, and multimodal sensing — kept deliberately so the working agent
            can stay small while those harden on top of it.
          </p>
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>Runtime stack</CaseSectionHeading>
        <div className="mt-8 overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground px-4 py-3">
                  Layer
                </th>
                <th className="text-left font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground px-4 py-3">
                  Detail
                </th>
                <th className="text-left font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground px-4 py-3">
                  Why it matters
                </th>
              </tr>
            </thead>
            <tbody>
              {runtimeRows.map((row, idx) => (
                <tr
                  key={row.layer}
                  className={
                    idx % 2 === 1
                      ? "border-t border-border/60 bg-secondary/10"
                      : "border-t border-border/60"
                  }
                >
                  <td className="font-medium text-foreground px-4 py-3 align-top">{row.layer}</td>
                  <td className="text-muted-foreground leading-relaxed px-4 py-3 align-top">
                    {row.detail}
                  </td>
                  <td className="text-muted-foreground leading-relaxed px-4 py-3 align-top">
                    {row.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <CaseSectionHeading>Trust &amp; safety</CaseSectionHeading>
        <CaseProse>
          <p>
            The trust story starts with where the work happens: on-device, against a local
            model, with no cloud round-trip and no API key for the core loop. File-reading
            skills are sandboxed to the workspace, and the only &ldquo;integrations&rdquo;
            today are local files you place yourself — a <code>tasks.md</code> and a{" "}
            <code>.ics</code> — so there are no third-party tokens to leak.
          </p>
          <p>
            The agent loop is the other half: it&rsquo;s bounded by a step limit, and a
            failing skill returns its error to the model to recover from instead of crashing
            the run. The heavier trust machinery for the connector era — explicit per-connector
            consent, authenticated runs, keychain-backed secrets — is scaffolded for when
            those layers land, not claimed as shipped.
          </p>
        </CaseProse>
        <CasePullQuote>
          A personal assistant is only personal when the work — and the trust boundary — stays local.
        </CasePullQuote>
      </section>

      <section>
        <CaseSectionHeading>What works today</CaseSectionHeading>
        <CaseLessons lessons={shipped} />
      </section>

      <section>
        <CaseSectionHeading>Journey map</CaseSectionHeading>
        <div className="mt-8 grid gap-3">
          {journeySteps.map((step, idx) => (
            <article
              key={step.stage}
              className="rounded-md border border-border bg-secondary/20 px-4 py-4"
            >
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                Stage {String(idx + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-sm md:text-base font-semibold text-foreground">{step.stage}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <CaseSectionHeading>How it works</CaseSectionHeading>
        <CaseProse>
          <p>
            A request goes to the local model together with the persona and the list of
            available skills as tool specs. If the model calls a tool, the loop runs it,
            feeds the result back, and lets the model continue — repeating until it has an
            answer or hits the step limit. A skill that errors returns its message to the
            model to recover from rather than ending the run.
          </p>
          <p>
            The result is a small, legible loop: local reasoning, typed tools, and bounded
            autonomy — the kind of predictable behaviour you want before adding sensing and
            connectors on top.
          </p>
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
