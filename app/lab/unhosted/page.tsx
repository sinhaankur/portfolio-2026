import type { Metadata } from "next"
import { Github, ExternalLink } from "lucide-react"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseLessons,
  CasePullQuote,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  title: "Unhosted — AI that lives where you do · Ankur Sinha",
  description:
    "Frontier-class AI inference on hardware you own. Three trust modes — local, trusted, public — pooled into one inference cluster. Founder + lead designer + engineer: Ankur Sinha.",
}

type TrustMode = { label: string; name: string; body: string }
const trustModes: TrustMode[] = [
  {
    label: "1 · Local",
    name: "Devices you own",
    body: "Your laptop, gaming PC, home server. No internet required. Free forever. The whole product works here without ever crossing the network boundary.",
  },
  {
    label: "2 · Trusted",
    name: "Friends, family, team",
    body: "Your roommate's PC, your homelab, your team. End-to-end encrypted, no public exposure, no payment. Pair once over the internet, then routes treat them like local.",
  },
  {
    label: "3 · Public",
    name: "Strangers' GPUs · USDC",
    body: "Opt-in safety net. A swarm of strangers renting idle GPUs for USDC per token. Used only when your circle can't fulfill the request, with a per-month spend cap you set.",
  },
]

type StatusRow = {
  capability: string
  status: "shipped" | "scaffolded" | "pending"
  notes: string
}
const statusRows: StatusRow[] = [
  {
    capability: "Single-machine inference",
    status: "shipped",
    notes: "v0.0.1. Wraps llama.cpp llama-server. Smoke-tested on M-series.",
  },
  {
    capability: "LAN cluster (request routing)",
    status: "shipped",
    notes: "v0.0.2. Round-robin across local + peers; verified end-to-end.",
  },
  {
    capability: "mDNS peer discovery + pairing",
    status: "shipped",
    notes: "v0.0.3. One-click pair in the app sidebar; hot-reload routing.",
  },
  {
    capability: "Model management (unhosted pull)",
    status: "shipped",
    notes: "Known short names + direct GGUF URL support.",
  },
  {
    capability: "Public-mode policy + signed receipts",
    status: "shipped",
    notes: "unhosted-payments-core 0.0.2 + daemon integration in v0.0.39. Cross-language wire compatibility (Rust ↔ TypeScript) verified.",
  },
  {
    capability: "Wallet-js payer helpers",
    status: "shipped",
    notes: "@unhosted-ai/wallet-js 0.0.1. Browser + Node.",
  },
  {
    capability: "VRAM-pooling via RPC-enabled llama.cpp",
    status: "shipped",
    notes: "Distributed via the homebrew-unhosted tap because upstream Homebrew omits -DGGML_RPC=ON.",
  },
  {
    capability: "MCP server (first plugin)",
    status: "scaffolded",
    notes: "Exposes local capabilities (memory, web fetch, VRAM-pool status) as MCP tools so Claude Desktop and IDE clients can call into the daemon.",
  },
  {
    capability: "First payment rail (Lightning leading candidate)",
    status: "pending",
    notes: "Slice 3 of the transactional-public-mode ADR.",
  },
  {
    capability: "Solidity escrow on Base",
    status: "pending",
    notes: "Slice 5 of the transactional-public-mode ADR.",
  },
]

const statusStyles: Record<StatusRow["status"], string> = {
  shipped: "border-emerald-600/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  scaffolded: "border-amber-600/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  pending: "border-border text-muted-foreground bg-secondary/40",
}

type Repo = { name: string; lang: string; href: string; body: string[] }
const repos: Repo[] = [
  {
    name: "unhosted-core",
    lang: "Rust",
    href: "https://github.com/unhosted-ai/unhosted-core",
    body: [
      "The daemon. Wraps llama.cpp's llama-server on each node and presents a single OpenAI-compatible inference endpoint across the whole cluster.",
      "What it does: mDNS peer discovery on the LAN, one-click pairing over the internet for trusted nodes, round-robin routing across local + peers with hot-reload, model management, VRAM-pooling via RPC-enabled llama.cpp, public-mode policy + signed-receipt verification.",
      "Why it lives in its own crate: the daemon's release cadence is hardware-bound (Apple silicon updates, CUDA driver versions, ROCm releases). Compliance and rails work for the public mode happens on a different clock — that's unhosted-payments.",
    ],
  },
  {
    name: "unhosted-payments",
    lang: "Rust + TypeScript",
    href: "https://github.com/unhosted-ai/unhosted-payments",
    body: [
      "The settlement layer. When peers rent out idle compute to strangers in public mode, this is where the money moves — policy-driven, multi-rail, country-aware.",
      "Why a separate repo: three reasons. Cadence — compliance work on a different clock than daemon engineering. Surface — payments touches more languages than the daemon's Rust. Trust boundary — sensitive code (key handling, settlement state) is reviewable in isolation; a reader auditing payments shouldn't have to skim 50k lines of daemon code to find the parts that move money.",
      "Shape: Rust core crate with PeerPaymentPolicy, PaymentRail, KycTier, Country, SignedReceipt, verify_receipt, sign_receipt. TypeScript wallet-js for payer-side browser/Node helpers, cross-verified by an integration test. Solidity escrow on Base pending.",
    ],
  },
  {
    name: "unhosted-plugins",
    lang: "TypeScript",
    href: "https://github.com/unhosted-ai/unhosted-plugins",
    body: [
      "Extensions that talk to a running Unhosted daemon. Each plugin lives in its own top-level directory; the only thing that makes it a 'plugin' is that it talks to the documented HTTP API at 127.0.0.1:7777.",
      "First plugin (scaffolded): mcp-server/ — exposes Unhosted's local capabilities (memory, web fetch, VRAM-pool status) as MCP tools so MCP-aware clients like Claude Desktop or IDE extensions can call into the daemon.",
      "Why a separate repo: the core daemon stays small, and plugin work doesn't block daemon releases (or vice versa).",
    ],
  },
  {
    name: "homebrew-unhosted",
    lang: "Ruby",
    href: "https://github.com/unhosted-ai/homebrew-unhosted",
    body: [
      "Homebrew tap for Unhosted dependencies that aren't shipped by upstream Homebrew the way Unhosted needs them.",
      "Today: one formula, llama-cpp-rpc — llama.cpp built with -DGGML_RPC=ON, which Unhosted's VRAM-pooling feature requires. Upstream brew install llama.cpp omits the flag. The tap fills the gap.",
    ],
  },
]

export default function UnhostedCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Currently building · Open source"
      title="Unhosted — AI that lives where you do."
      subtitle="Frontier-class inference on hardware you own. Three trust modes — local, trusted, public — pooled into one inference cluster."
      period="2024 – Present · pre-alpha"
      role="Founder · Lead designer · Engineer"
      tags={["Open source", "Distributed systems", "Local AI", "Apache 2.0"]}
      backTo={{ label: "Back to The Lab", href: "/#lab" }}
      intro={
        <>
          <p>
            Unhosted is the open-source project I started to answer one question:{" "}
            <strong>
              when frontier AI runs as well on your laptop as it does in a
              hyperscaler, who owns the inference?
            </strong>
          </p>
          <p>
            Pool the computers you already own — and optionally your friends', and
            optionally a public swarm of strangers' GPUs — into a single inference
            cluster. One endpoint. Mac, Linux, Windows. CUDA, Metal, ROCm.
          </p>
          <p>
            Three trust modes. You decide the radius. Local and trusted are free
            forever; public is the safety net you pay for in USDC only when you
            opt in. You can use Unhosted for the rest of your life and never spend
            a dollar.
          </p>
        </>
      }
    >
      {/* GitHub + links action row */}
      <section aria-label="Project links" className="-mt-8 md:-mt-12">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://github.com/unhosted-ai"
            target="_blank"
            rel="noreferrer noopener"
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
            <Github className="w-4 h-4" aria-hidden="true" />
            github.com/unhosted-ai
            <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
          </a>
          <a
            href="https://github.com/unhosted-ai/unhosted-core"
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
            unhosted-core
          </a>
          <a
            href="https://github.com/unhosted-ai/unhosted-payments"
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
            unhosted-payments
          </a>
        </div>
      </section>

      {/* Featured ASCII diagram + status pills */}
      <section>
        <div className="rounded-md border border-border bg-secondary/30 p-6 md:p-10">
          <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-3">
                github.com/unhosted-ai · CLI v0.0.34
              </p>
              <h2 className="font-sans text-2xl md:text-3xl font-light text-foreground leading-tight">
                The radius is the product.
              </h2>
              <p className="mt-4 font-sans text-base text-foreground/80 leading-relaxed max-w-prose">
                Most local-AI tools force the user to choose between "private and
                limited" and "powerful and surveilled." Unhosted makes the trust
                radius itself the primary control.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["pre-alpha", "built in public", "Apache 2.0"].map((p) => (
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
{`       ╭───────────────────────────────╮
       │   public · pay (USDC)         │
       │   ╭───────────────────────╮   │
       │   │  trusted · free       │   │
       │   │   ╭───────────────╮   │   │
       │   │   │ local · free  │   │   │
       │   │   ╰───────────────╯   │   │
       │   ╰───────────────────────╯   │
       ╰───────────────────────────────╯`}
            </pre>
          </div>
        </div>
      </section>

      {/* Trust radius */}
      <section>
        <CaseSectionHeading>The trust radius</CaseSectionHeading>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trustModes.map((mode) => (
            <li
              key={mode.label}
              className="border border-border rounded-md p-6 bg-background flex flex-col"
            >
              <p className="font-mono text-[10px] tracking-widest text-accent mb-2">
                {mode.label}
              </p>
              <p className="font-sans text-lg text-foreground mb-3">{mode.name}</p>
              <p className="font-sans text-sm text-foreground/80 leading-relaxed">
                {mode.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Status table */}
      <section>
        <CaseSectionHeading>What's honest about today</CaseSectionHeading>
        <CaseProse>
          <p>
            The product is pre-alpha and shipping in public. Status is named
            explicitly, not hidden behind a polished feature page. This table is
            the truth about what works today.
          </p>
        </CaseProse>
        <div className="mt-8 overflow-x-auto border border-border rounded-md">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/30">
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">
                  Capability
                </th>
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">
                  Status
                </th>
                <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {statusRows.map((row, i) => (
                <tr
                  key={row.capability}
                  className={i === statusRows.length - 1 ? "" : "border-b border-border"}
                >
                  <td className="px-5 py-4 font-sans text-sm text-foreground align-top">
                    {row.capability}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span
                      className={`inline-block font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border rounded-full ${statusStyles[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-foreground/75 align-top leading-relaxed">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Repos */}
      <section>
        <CaseSectionHeading>Repos in the org</CaseSectionHeading>
        <div className="space-y-4">
          {repos.map((repo) => (
            <article
              key={repo.name}
              className="border border-border rounded-md p-6 md:p-8 bg-background"
            >
              <header className="flex items-center flex-wrap gap-3 mb-4">
                <h3 className="font-mono text-base text-foreground">{repo.name}</h3>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-muted-foreground">
                  {repo.lang}
                </span>
                <a
                  href={repo.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-cursor-hover
                  className="
                    ml-auto font-mono text-[10px] tracking-widest uppercase
                    text-accent hover:text-foreground
                    border-b border-accent hover:border-foreground
                    pb-0.5
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                    focus-visible:ring-offset-2 focus-visible:ring-offset-background
                    rounded-sm
                  "
                >
                  View on GitHub →
                </a>
              </header>
              <div className="space-y-3 font-sans text-sm md:text-base text-foreground/85 leading-relaxed">
                {repo.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Design moves */}
      <section>
        <CaseSectionHeading>Design moves I'm proud of</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: '"Status: pre-alpha" as the first line of the README.',
              body: "Most pre-alpha projects pretend otherwise. Naming it up front earns the right to ship in public without misleading anyone. The 'What's honest' status table runs the same posture — a binary works / doesn't per capability.",
            },
            {
              title: "Three trust modes as a visual primitive, not a settings page.",
              body: "Most local-AI tools force the user to choose between 'private and limited' and 'powerful and surveilled.' The radius diagram says the truth: three concentric circles, and you can stop at the inner one for the rest of your life if you want.",
            },
            {
              title: '"You can use Unhosted forever and never spend a dollar."',
              body: "A revenue model can sit under a free product if the free product is genuinely complete on its own. Public mode is the safety net for the cases your circle can't fulfill, not the upsell the rest of the product pushes you toward.",
            },
            {
              title: "Separate repos by cadence + trust boundary, not by tech.",
              body: "unhosted-payments isn't separate because it's a different language — it's separate because a blocked KYC review shouldn't pause a VRAM-pool release, and because a reader auditing money-moving code shouldn't have to skim 50k lines of daemon code first.",
            },
            {
              title: "The CLI is the source of truth; the GUI is a wrapper.",
              body: "Every operation the desktop app can do is also expressible as unhosted <verb>. That makes the product scriptable by default and forces the design of each verb to be sharp enough to type.",
            },
          ]}
        />
      </section>

      <CasePullQuote>
        If frontier AI ends up running on the hardware you already own, the design
        problem is no longer about chat windows. It's about <em>where</em> the
        inference happens, <em>who</em> the trust boundary is around, and{" "}
        <em>how legibly</em> the system tells you those things.
      </CasePullQuote>

      <section className="text-center pt-4">
        <a
          href="https://github.com/unhosted-ai"
          target="_blank"
          rel="noreferrer noopener"
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
          View the org on GitHub →
        </a>
      </section>

      <CaseNextLinks prev={{ label: "Back to The Lab", href: "/#lab" }} />
    </CaseStudyLayout>
  )
}
