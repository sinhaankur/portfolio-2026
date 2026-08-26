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

      <CaseNextLinks
        prev={{ label: "Back to work", href: "/#works" }}
        next={{ label: "Rubik Cube · OpenGL", href: "/academic/rubik-cube" }}
      />
    </CaseStudyLayout>
  )
}
