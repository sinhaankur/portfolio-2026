import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { P2PSwarm } from "@/components/academic/p2p-swarm"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  ...canonicalPath("/academic/p2p-streaming"),
  title: "Optimization of Throughput of Data-Driven P2P Streaming",
  description:
    "Undergraduate project at Visvesvaraya Technological University (2012): a data-driven peer-to-peer live-streaming system in Java/NetBeans, implementing and measuring an IEEE base paper's throughput-optimization approach.",
}

/** An equation block: a styled formula + a plain-English 'what' + the real logic.
 *  Matches the /universe-engine/math pattern — no math library, static-export safe. */
function Eq({ title, formula, what, code }: { title: string; formula: string; what: string; code: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-5 md:p-6 my-6">
      <h3 className="font-medium text-foreground mb-3">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 px-4 py-3 mb-4">
        <p className="font-serif text-base md:text-lg italic text-accent whitespace-nowrap">{formula}</p>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed mb-4">{what}</p>
      <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-4 text-[12px] leading-relaxed">
        <code className="font-mono text-foreground/85">{code}</code>
      </pre>
    </div>
  )
}

export default function P2PStreamingPage() {
  return (
    <CaseStudyLayout
      eyebrow="Academic · Early work"
      title="Data-Driven P2P Streaming"
      subtitle="Optimizing throughput in a peer-to-peer live-streaming overlay — an undergraduate project built from an IEEE base paper."
      period="Aug 2012"
      role="Student project · VTU"
      tags={["Java", "NetBeans", "P2P", "Networking", "IEEE base paper"]}
      backTo={{ label: "Back to work", href: "/#works" }}
      intro={
        <>
          A final-year project at Visvesvaraya Technological University. The goal
          was to build a <em>data-driven</em> peer-to-peer streaming system — where
          peers pull media chunks from each other rather than from a central
          server — and to optimize the overlay so that available upload bandwidth
          across the swarm translated into higher, steadier playback throughput.
        </>
      }
    >
      <section>
        <CaseSectionHeading>The overlay, live</CaseSectionHeading>
        <CaseProse>
          A live model of the base paper&apos;s mechanism, running in your browser.
          The source emits a continuous stream of numbered chunks; each peer keeps a
          sliding <em>buffer map</em> with a <em>playhead</em> on a deadline, and pulls
          the most-urgent missing chunks from partners that hold them. If a chunk misses
          its deadline, playback stalls — so the <em>continuity</em> score is the number
          the design optimizes. Flip to a single server and its one uplink throttles the
          swarm, the bottleneck data-driven streaming removes.
        </CaseProse>
        <div className="mt-6">
          <P2PSwarm />
        </div>
      </section>

      <section>
        <CaseSectionHeading>The problem</CaseSectionHeading>
        <CaseProse>
          A single streaming server is a bottleneck: every viewer draws from the
          same finite uplink, so quality degrades as the audience grows. In a
          data-driven peer-to-peer overlay, each viewer is also a source — nodes
          exchange availability maps and pull the chunks they still need from
          peers that already have them. The hard part isn&apos;t the idea; it&apos;s
          scheduling. Which chunk to request, from which peer, next — so playback
          stays continuous and the swarm&apos;s collective bandwidth is actually used.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>What I built</CaseSectionHeading>
        <CaseProse>
          Working from an IEEE base paper, I implemented the overlay and its
          chunk-scheduling logic in Java, developed in NetBeans. The system
          modelled a set of peers sharing a live stream and let me measure how
          different scheduling and peer-selection choices moved the throughput
          number.
        </CaseProse>
        <CaseList
          items={[
            "A peer overlay where each node advertises the chunks it holds (a buffer / availability map) and requests missing ones from neighbours.",
            "Chunk-scheduling logic — deciding request order and peer selection to keep the playback buffer fed under a deadline.",
            "A measurement harness to compare throughput across configurations, so the optimization was demonstrated with numbers, not asserted.",
          ]}
        />
      </section>

      <section>
        <CaseSectionHeading>The math — how peers connect, send &amp; share</CaseSectionHeading>
        <CaseProse>
          The whole system is one idea made rigorous: don&apos;t pull the stream from a
          server — pull each <em>chunk</em> from whichever <em>peer</em> already holds it.
          Below is the math the base paper turns on: why the swarm beats a server, how a
          peer knows who has what, which chunk to fetch next, and the number the design
          optimizes — playback continuity.
        </CaseProse>

        <Eq
          title="1 · Why the swarm wins — upload capacity"
          formula="C_server = U_s      vs.      C_swarm = U_s + Σᵢ uᵢ"
          what="A single server can only push what its own uplink U_s allows — split across N viewers, each gets U_s⁄N, so quality collapses as the audience grows. In the swarm, every peer i is also a source contributing its upload uᵢ, so total capacity is the server plus every peer. The system's supply scales with demand instead of against it — the core result."
          code={`// per-viewer share, server vs. swarm
const serverShare = U_s / N                     // shrinks with every joiner
const swarmShare  = (U_s + peers.reduce((s,p)=>s+p.upload,0)) / N`}
        />

        <Eq
          title="2 · How peers know who has what — the buffer map"
          formula="BMᵢ = ⟨ b₀, b₁, …, b_{W−1} ⟩,   b_k ∈ {0,1}"
          what="Each peer advertises a buffer map to its partners: a bitmap over the live window of W recent chunks, where bit k is 1 if it holds chunk k. Peers gossip these maps, so everyone has a local, partial picture of chunk availability across the swarm — the 'data-driven' part: decisions are driven by who actually has which data."
          code={`// a peer's availability over the sliding window
type BufferMap = boolean[]                        // length W
peer.have = new Set<number>()                     // chunk indices held
const advertise = () => window.map(k => peer.have.has(k))`}
        />

        <Eq
          title="3 · Which chunk to fetch next — urgency-first scheduling"
          formula="next = argmin_k { deadline_k − t  :  b_k = 0,  ∃ partner with b_k = 1 }"
          what="Scheduling is the hard part. Each missing chunk in the window has a playback deadline; the scheduler requests the most urgent one it can source — the missing chunk nearest the playhead that some partner holds. (Rarest-first is the other classic rule, for spreading supply; urgency-first keeps playback continuous.) One request per round keeps the pull legible and the swarm balanced."
          code={`for (let k = playhead+1; k < playhead+W; k++) {
  if (peer.have.has(k)) continue                  // already have it
  const holder = peer.partners.find(p => p.have.has(k))
  if (holder) { pull(holder, k); break }          // most-urgent first
}`}
        />

        <Eq
          title="4 · The number it optimizes — playback continuity"
          formula="continuity = chunks_played / (chunks_played + stalls)"
          what="A chunk that misses its deadline is a stall — a freeze in playback. Continuity is the fraction of window slots that arrived in time; 100% is flawless playback. Maximizing it (while using the swarm's collective bandwidth) is exactly what the throughput-optimization the project set out to demonstrate — and what the live visualization above scores as you watch."
          code={`if (playhead advances to slot k) {
  if (peer.have.has(k)) played++                  // arrived in time
  else stalls++                                   // missed its deadline
}
const continuity = played / (played + stalls)`}
        />
      </section>

      <section>
        <CaseSectionHeading>Why it still matters to me</CaseSectionHeading>
        <CaseProse>
          This was my first real encounter with distributed systems: no central
          authority, partial information at every node, and a global property
          (smooth playback) that has to emerge from local decisions. That shape —
          many machines cooperating without a coordinator — is the same one I keep
          coming back to years later. It&apos;s an honest, dated piece of early work,
          kept here because it&apos;s where the interest started.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>What it became</CaseSectionHeading>
        <CaseProse>
          Years on, that same principle — peers moving data directly, no server in
          the middle — became a real, downloadable tool:{" "}
          <a
            href="https://github.com/sinhaankur/Beam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Beam
          </a>
          , a pure-Rust desktop app that sends a file straight from one machine to
          another over a plain socket — no cloud, no account, with a SHA-256 integrity
          check so you only keep a byte-exact copy. The streaming problem here was
          continuous chunks under a deadline; Beam is the simpler point-to-point case,
          but it&apos;s the same lineage: your data goes where you send it and nowhere
          else.
        </CaseProse>
      </section>

      <CaseNextLinks
        prev={{ label: "Back to work", href: "/#works" }}
        next={{ label: "Rubik Cube · OpenGL", href: "/academic/rubik-cube" }}
      />
    </CaseStudyLayout>
  )
}
