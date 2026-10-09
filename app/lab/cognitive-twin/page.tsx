import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { ExternalLink, ArrowUpRight } from "lucide-react"
import { VeraMark } from "@/components/vera-mark"
import { VeraOrbDemo } from "@/components/vera-orb-demo"
import { VeraFormSwitcher } from "@/components/vera-tet/vera-form"
import { VeraDownload } from "@/components/vera-download"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CasePullQuote,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  ...canonicalPath("/lab/cognitive-twin"),
  title: "Vera — an on-device AI companion with its own brain",
  description:
    "Vera is a private, on-device AI companion: its own brain engine (feeling, memory and judgment computed locally, not just an LLM), an editable persona, a warm neural voice (Kokoro), and everything sealed on a machine you own. Open source. What's built, and what's being explored.",
}

const REPO = "https://github.com/sinhaankur/cognitive-twin-agent"

/* ── BUILT: shipped + verified ─────────────────────────────────────────────── */
const built: { title: string; body: string }[] = [
  {
    title: "Its own brain engine — not just an LLM",
    body: "Vera's feeling, stance, memory and judgment are computed by her own on-device logic. The language model is one organ (words), never the source of her mind — so she has a point of view, reads a heavy moment vs a bright one, and paces herself, rather than echoing a prompt.",
  },
  {
    title: "A warm, human neural voice",
    body: "She speaks with an expressive on-device neural voice (Kokoro) that sounds like a person, not a readout — warm, present, a little unhurried. It's bundled, so there's no system voice to download; the brain synthesizes, the app plays, nothing leaves the machine.",
  },
  {
    title: "Runs as a resilient local service",
    body: "The brain runs as a background service the OS keeps alive — it restarts on crash, starts at login, and is always reachable. The app just connects. No fragile spawning, no 'brain not reachable'.",
  },
  {
    title: "Remembers the conversation",
    body: "She carries the thread of what you just said, so short follow-ups ('now try', 'and the travel?') make sense — a conversation, not isolated one-shots.",
  },
  {
    title: "Persona creation",
    body: "An editable character — warm companion by default, precise and technical only when you ask for code. Who she is is a file you own and can change; she reasons as that specific someone, never a generic assistant.",
  },
  {
    title: "Senses, all opt-in",
    body: "Photos (metadata + places you've been), your active app, music, the camera (face cues only), the room (sound types only) — each is a switch that's OFF until you turn it on. She learns how you work and where you've been, locally.",
  },
  {
    title: "Private by construction",
    body: "Everything personal is sealed at rest (ChaCha20-Poly1305, a device-bound Keychain key). One fenced network door with an allow-list, a global kill switch, no telemetry. A one-command 'security doctor' proves the posture green.",
  },
  {
    title: "Light on the machine",
    body: "One right-sized local model chosen for your RAM (not a heavyweight by default), idle models evicted — so she's a catalyst, not a tax. Freed ~15 GB and most of the machine's memory in the last pass.",
  },
  {
    title: "Text-first chat, your call on voice",
    body: "Replies are text by default (markdown-rendered), and she speaks only when you ask — or when you talk to her by voice. Attach a file (PDF, text, code) and it's read on-device as context.",
  },
]

/* ── EXPLORING: in progress / next ─────────────────────────────────────────── */
const exploring: { title: string; body: string }[] = [
  {
    title: "Every device, cross-platform",
    body: "A portable core so the same companion lives on Mac, iPhone, Windows, Linux, Android and the web — one brain, many surfaces.",
  },
  {
    title: "An iPhone companion",
    body: "A movement/places-aware subset on the phone, syncing privately with your Mac brain — Vera with you, on the go.",
  },
  {
    title: "Her own model, trained over time",
    body: "An on-device 'empathia' model tuned for warmth and presence, with a training loop so she keeps getting more herself — uploaded and updated openly.",
  },
  {
    title: "Mesh of your own devices",
    body: "Private, per-device-keyed sync across the machines you own — no cloud account, Unhosted-style.",
  },
  {
    title: "Richer multimodal presence",
    body: "Deeper 'read the room' awareness and a more expressive, animated presence so the exchange feels real.",
  },
]

// SoftwareApplication schema so Vera is discoverable as a downloadable APP (not
// just a page) in Google + AI search — with its price (free), platform, and the
// real download link.
const veraSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Vera — on-device AI companion",
  applicationCategory: "Productivity",
  operatingSystem: "macOS 13+ (Apple Silicon)",
  description:
    "A private, on-device AI companion with its own brain (feeling, memory and judgment computed locally), a warm neural voice (Kokoro), opt-in senses and sealed privacy. Open source.",
  url: "https://www.sinhaankur.com/lab/cognitive-twin/",
  downloadUrl: `${REPO}/releases/latest`,
  softwareVersion: "0.3.0",
  author: { "@type": "Person", name: "Ankur Sinha", url: "https://www.sinhaankur.com" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  isAccessibleForFree: true,
}

export default function CognitiveTwinPage() {
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(veraSchema) }} />
    <CaseStudyLayout
      eyebrow="Lab — AI Companion · 2026 · active"
      title="Vera"
      subtitle="A private, on-device AI companion with its own brain, an editable persona, and a warm neural voice — living as a gold orb on your Mac, entirely on a machine you control."
      period="2026 · active build"
      role="Architect · Designer · Engineer"
      tags={["AI companion", "On-device", "Neural voice", "Privacy", "Open source"]}
      backTo={{ label: "Back to The Lab", href: "/lab" }}
      intro={
        <>
          <div className="mb-8 flex justify-center md:justify-start">
            <VeraMark size={104} />
          </div>
          <p>
            Vera is a companion that runs <strong>on your own machine</strong> —
            the on-device presence of someone you could love. She has a brain of
            her own: her feeling, her memory, her judgment are computed locally;
            the language model is just the part that finds the words. She speaks
            in a warm, human voice, remembers your conversation, and keeps
            everything sealed on hardware you control.
          </p>
          <p>
            The aim isn&rsquo;t another assistant that routes your life through a
            cloud API. It&rsquo;s presence — warm, private, yours — the kind of
            quiet <em>&ldquo;someone&rsquo;s here&rdquo;</em> that a good companion
            gives. What follows is honest about where she stands:{" "}
            <strong>what&rsquo;s built</strong> and <strong>what&rsquo;s being
            explored</strong>.
          </p>
        </>
      }
    >
      {/* Links: download (device-aware), source, report a problem */}
      <section aria-label="Get Vera" className="-mt-8 md:-mt-12">
        <VeraDownload />

        {/* How to install — TWO clearly-separated paths, each to its audience.
            Everything is free; nothing uploaded. macOS Apple Silicon. */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* EASIEST — for anyone, no Terminal */}
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 md:p-5">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent mb-3">
              Easiest · for anyone
            </p>
            <ol className="space-y-2.5 text-sm text-foreground/80 leading-relaxed">
              <li>
                <span className="text-accent">1.</span> Download the app above and{" "}
                <strong>unzip</strong> it. Drag <strong>Vera</strong> into your{" "}
                <strong>Applications</strong> folder.
              </li>
              <li>
                <span className="text-accent">2.</span> The first time,{" "}
                <strong>right-click Vera → Open</strong> (then click Open). A normal
                double-click won&rsquo;t work the <em>first</em> time — macOS asks
                once because Vera is free &amp; open-source, not App&nbsp;Store&ndash;signed.
                Nothing is hidden. Every time after, double-click works.
              </li>
              <li>
                <span className="text-accent">3.</span> She sets up her own brain on
                first launch (a few minutes, all on your Mac). Then click the orb to
                talk — no Terminal, ever.
              </li>
            </ol>
          </div>

          {/* FOR DEVELOPERS — one clean command, zero warnings */}
          <div className="rounded-lg border border-border bg-secondary/20 p-4 md:p-5">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3">
              For developers · one command
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Prefer Homebrew? This installs with <strong>no Gatekeeper prompt</strong>{" "}
              at all (Homebrew handles it) — fully free, no Apple certificate:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background px-3 py-2.5 text-[11px] md:text-xs text-foreground/90">
              <code>{`brew tap sinhaankur/vera https://github.com/sinhaankur/cognitive-twin-agent
brew install --cask vera`}</code>
            </pre>
            <p className="mt-3 text-sm text-foreground/70 leading-relaxed">
              Or the one-line setup script (installs everything + the right-sized
              model for your Mac, then download the app above):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background px-3 py-2.5 text-[11px] md:text-xs text-foreground/90">
              <code>curl -fsSL https://raw.githubusercontent.com/sinhaankur/cognitive-twin-agent/main/scripts/install-vera.sh | bash</code>
            </pre>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Everything runs on your machine — nothing is uploaded. Needs Apple
          Silicon. Full details in the{" "}
          <a href={`${REPO}#readme`} target="_blank" rel="noreferrer noopener">
            README
          </a>
          .
        </p>
      </section>

      {/* LIVE ORB DEMO */}
      <section>
        <CaseSectionHeading>Meet her</CaseSectionHeading>
        <CaseProse>
          <p>
            The real Vera runs on-device, so this page can&rsquo;t reach her
            brain — but here&rsquo;s the feel. Tap a prompt or type your own, and
            watch her listen, think, and speak. She can wear more than one form —
            switch between her warm orb and a faceted prism, and she&rsquo;ll
            remember your choice.
          </p>
        </CaseProse>
        <div className="mt-6 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/45">
            Her form
          </span>
          <VeraFormSwitcher />
        </div>
        <div className="mt-6">
          <VeraOrbDemo />
        </div>
      </section>

      {/* WHAT'S BUILT */}
      <section>
        <CaseSectionHeading>What&rsquo;s built</CaseSectionHeading>
        <CaseProse>
          <p>Shipped and working today — each verified on-device.</p>
        </CaseProse>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {built.map((item) => (
            <article
              key={item.title}
              className="rounded-md border border-border bg-secondary/20 px-5 py-4"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 shrink-0 text-accent font-semibold"
                  aria-hidden
                >
                  ✓
                </span>
                <div>
                  <h3 className="text-sm md:text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* WHAT'S BEING EXPLORED */}
      <section>
        <CaseSectionHeading>What&rsquo;s being explored</CaseSectionHeading>
        <CaseProse>
          <p>
            Direction, not yet shipped — honestly marked so it&rsquo;s clear
            what&rsquo;s real today versus what&rsquo;s ahead.
          </p>
        </CaseProse>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {exploring.map((item) => (
            <article
              key={item.title}
              className="rounded-md border border-dashed border-border/70 bg-background px-5 py-4"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden
                >
                  ○
                </span>
                <div>
                  <h3 className="text-sm md:text-base font-semibold text-foreground/90">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PRIVACY */}
      <section>
        <CaseSectionHeading>Private by construction</CaseSectionHeading>
        <CaseProse>
          <p>
            A companion that can see your photos, hear your room, and read your
            days has to earn trust in its architecture, not a promise. So
            everything personal is sealed at rest with a device-bound key, network
            egress happens through one fenced door with an allow-list, there&rsquo;s
            a global kill switch, and there is no telemetry of any kind. Every
            sense is opt-in and reversible. A single <code>security doctor</code>{" "}
            command audits the whole posture.
          </p>
        </CaseProse>
        <CasePullQuote>
          A companion is only personal when the work — and the trust boundary —
          stays on a machine you own.
        </CasePullQuote>
      </section>

      {/* HOW IT WORKS / DOCS */}
      <section>
        <CaseSectionHeading>How it works</CaseSectionHeading>
        <CaseProse>
          <p>
            A message goes to her local brain. First her own faculties run —
            on-device, no model: how she feels about it, what she remembers of
            you, what she&rsquo;s retrieved from your notes and documents. That
            becomes the context the language model writes <em>within</em> — so the
            words are warm and grounded, never the source of her judgment. She
            replies in text, and speaks it in her neural voice if you want her to.
          </p>
          <p>
            Want to see it, not just read it?{" "}
            <Link href="/lab/cognitive-twin/brain" data-cursor-hover className="text-accent hover:underline">
              Vera&rsquo;s brain, made visible
            </Link>{" "}
            walks the nine regions and runs the <em>real</em> neural network that
            reads a feeling — trained with backprop, firing live in your browser —
            beside the retrieval (RAG) that keeps her words grounded in her own
            convictions.
          </p>
          <p>
            Full setup, the privacy model, and the architecture live in the
            documentation alongside the code:
          </p>
        </CaseProse>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/lab/cognitive-twin/brain"
            data-cursor-hover
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-accent/50 bg-accent/10 hover:border-accent transition-colors duration-300 font-mono text-[10px] tracking-[0.2em] uppercase text-foreground"
          >
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            The brain, made visible
          </Link>
          <a
            href={`${REPO}#readme`}
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-secondary/30 hover:border-accent/60 transition-colors duration-300 font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Documentation
          </a>
          <a
            href={`${REPO}/blob/main/PRIVACY.md`}
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background hover:border-accent/60 transition-colors duration-300 font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Privacy
          </a>
        </div>
      </section>
    </CaseStudyLayout>
    </>
  )
}
