import type { Metadata } from "next"
import { Lock, Mail, ExternalLink } from "lucide-react"
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
    "An in-progress local-first personal AI agent: multimodal sensing, keychain-backed encryption, consent-gated connectors, calibration, sentiment benchmarking, and menu-bar control. Built in the spirit of local-first agent research like OpenJarvis.",
}

type RuntimeRow = {
  layer: string
  detail: string
  why: string
}

const runtimeRows: RuntimeRow[] = [
  {
    layer: "Secure identity",
    detail: "OS user allowlist + token verification",
    why: "Assistant stays user-specific and cannot run under an unapproved account.",
  },
  {
    layer: "Encrypted state",
    detail: "Fernet at-rest encryption + key material in OS keychain",
    why: "Security state remains local while reducing plaintext exposure risk.",
  },
  {
    layer: "Perception",
    detail: "Camera, audio, activity signals with explicit sensor consent",
    why: "Turns raw context into probabilistic state hints without over-claiming certainty.",
  },
  {
    layer: "Task graph",
    detail: "Consent-gated Google Calendar, Notion, and Todoist connectors",
    why: "Maps day-to-day tasks and meetings into actionable planning context.",
  },
  {
    layer: "Reliability",
    detail: "Calibration profiles + local sentiment benchmark pipeline",
    why: "Replaces static heuristics with measured thresholds and trackable model quality.",
  },
  {
    layer: "Application shell",
    detail: "Always-on daemon + lightweight macOS menu-bar controller",
    why: "Makes the twin usable like a real assistant, not only a terminal script.",
  },
]

const shipped: { title: string; body: string }[] = [
  {
    title: "Secure daemon core",
    body: "A local runner now supports init, status, consent management, and authenticated day-planning loops for approved users only.",
  },
  {
    title: "Multimodal pipeline",
    body: "Voice transcription uses faster-whisper with model caching and automatic CPU/GPU device selection. Camera and activity inputs feed a fused confidence-scored state.",
  },
  {
    title: "Calibration and benchmark",
    body: "Thresholds can be re-trained from recorded sessions, and sentiment quality is benchmarked via a local report so behavior tuning is auditable.",
  },
  {
    title: "Connector consent boundaries",
    body: "Google Calendar, Notion, and Todoist access are each behind explicit grant/revoke toggles, with local file fallback when consent is missing.",
  },
  {
    title: "Menu-bar control",
    body: "A compact desktop controller can start and stop the daemon, trigger quick voice runs, and open latest output for fast operational feedback.",
  },
]

const journeySteps: { stage: string; detail: string }[] = [
  {
    stage: "Install and provision",
    detail:
      "A one-command setup prepares the local environment, model runtime, and starter weights — local-first from the first run.",
  },
  {
    stage: "Activate and secure",
    detail:
      "The assistant is initialized for the host OS user, token-authenticated, and keychain-backed.",
  },
  {
    stage: "Connect and calibrate",
    detail:
      "Calendar, tasks, and notes are consent-gated; thresholds are calibrated from real usage.",
  },
  {
    stage: "Run daily",
    detail:
      "The daemon maps meetings and tasks into focused plans via policy-routed model tiers.",
  },
  {
    stage: "Govern and improve",
    detail:
      "Memory, routing, and multi-device trust policies remain explicit, auditable, and revocable.",
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
            Active build — the codebase is private while it stabilises. What follows is
            where the architecture stands today.
          </p>
        </>
      }
    >
      <section aria-label="Project links" className="-mt-8 md:-mt-12">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="
              inline-flex items-center gap-2.5
              px-5 py-3 rounded-full
              border border-border bg-secondary/30
              font-mono text-xs tracking-[0.2em] uppercase text-foreground/85
            "
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            cognitive-twin-agent · private while in build
          </span>
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
          <a
            href="mailto:ankursinha.ai@gmail.com?subject=Cognitive%20Twin%20Agent"
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
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            Get in touch
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
            This is my own build, not a fork of any framework. OpenJarvis is prior art I
            point to for the local-first case; the architecture, security model, and
            multimodal pipeline below are mine. The aim is a daily companion where context,
            sensing, and trust stay on a machine I control.
          </p>
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>What it is now</CaseSectionHeading>
        <CaseProse>
          <p>
            The twin is now built as a private desktop-grade runtime. A secure daemon
            writes ongoing outputs locally, a menu-bar controller handles start/stop and
            quick triggers, and connectors build a daily task graph from tools I already use.
          </p>
          <p>
            It does not expose a public endpoint. Identity is scoped to allowed OS users,
            tokens are verified before execution, and state encryption is backed by the host
            keychain. The architecture keeps convenience and safety in the same frame.
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
        <CaseSectionHeading>Security posture</CaseSectionHeading>
        <CaseProse>
          <p>
            The security axis is explicit: user allowlist, authenticated runs,
            keychain-backed encryption, per-connector consent toggles, and reversible
            action pathways. The system defaults to local fallback data when an integration
            lacks permission.
          </p>
          <p>
            This avoids the common trap where assistants become useful by becoming
            overly permissive. Here, usefulness is constrained by explicit consent and
            clear boundaries.
          </p>
        </CaseProse>
        <CasePullQuote>
          A personal assistant is only personal when the trust boundary is local, explicit, and inspectable.
        </CasePullQuote>
      </section>

      <section>
        <CaseSectionHeading>What shipped in this phase</CaseSectionHeading>
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
            Input enters a security gate (user allowlist + token), passes through connector and
            sensor consent checks, and is fused into planning context with confidence scoring.
            A policy-routed model tier drafts the plan, and approval-gated actions preserve
            human control before execution.
          </p>
          <p>
            This creates a practical loop: contextual planning with strict boundaries,
            local auditability, and predictable behavior over time.
          </p>
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
