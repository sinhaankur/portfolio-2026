import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { RubikGraphEmbed } from "@/components/academic/rubik-graph-embed"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  ...canonicalPath("/academic/rubik-cube-graph"),
  title: "Solving a Rubik's Cube with Graph Theory",
  description:
    "Solving a Rubik's cube is a graph problem: every state is a node, every face turn is an edge, and the optimal solution is the shortest path found by breadth-first search. An interactive, correct 2×2×2 solver (3,674,160 states, God's Number 14) shown beside the real code.",
}

/** An equation block: a styled formula + a plain-English 'what' + the real code.
 *  Matches the /academic/rubik-cube + /universe-engine/math pattern. */
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

export default function RubikCubeGraphPage() {
  return (
    <CaseStudyLayout
      eyebrow="Academic · Algorithms"
      title="Solving the Cube with Graph Theory"
      subtitle="Every cube state is a node, every turn is an edge — so solving is just a shortest path."
      period="Teaching page"
      role="Algorithms · graph search"
      tags={["Graph theory", "BFS", "Group theory", "Search", "TypeScript"]}
      backTo={{ label: "Back to work", href: "/#works" }}
      intro={
        <>
          The companion to the{" "}
          <Link href="/academic/rubik-cube" className="text-accent hover:underline">
            OpenGL cube
          </Link>{" "}
          asks a different question: not how to <em>draw</em> a Rubik&apos;s cube,
          but how to <em>solve</em> one — optimally, and provably. The clean answer
          is graph theory: turn the whole puzzle into a graph and walk it. This page
          builds a real, correct 2×2×2 solver and shows the graph being searched.
        </>
      }
    >
      <section>
        <CaseSectionHeading>The idea in one line</CaseSectionHeading>
        <CaseProse>
          A Rubik&apos;s cube has a finite number of arrangements. Make each
          arrangement a <strong>node</strong>. Connect two nodes with an{" "}
          <strong>edge</strong> whenever one face-turn takes you from one to the
          other. Now &ldquo;solving&rdquo; a scramble is exactly{" "}
          <strong>finding the shortest path</strong> from the scrambled node to the
          solved node — and breadth-first search finds it, guaranteed optimal.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>The graph, live</CaseSectionHeading>
        <CaseProse>
          Below is a working 2×2×2 &ldquo;pocket cube&rdquo; solver, running in your
          browser. Scramble it, then press <em>Solve</em> and watch the search fan
          out ring by ring — each ring is every state at one more move away — until
          it touches the solved state. The path it lights up is the fewest possible
          moves. We use the 2×2 because its <em>entire</em> graph is small enough
          (3,674,160 states) to search live and exactly.
        </CaseProse>
        <div className="mt-6">
          <RubikGraphEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Why a cube is a graph</CaseSectionHeading>
        <CaseProse>
          This isn&apos;t a metaphor — it&apos;s literally true, and it comes from
          group theory. The legal moves of a cube form a <em>group</em>: each move
          is a permutation, moves compose, every move has an inverse. The{" "}
          <em>Cayley graph</em> of that group — one node per state, one edge per
          generator (a face turn) — is the graph we search. So the puzzle&apos;s
          structure hands you the graph for free.
        </CaseProse>
        <CaseList
          items={[
            "Nodes = reachable states. For the 2×2 that's exactly 3,674,160 (8!·3⁷ / 24, after fixing one corner to remove whole-cube rotations).",
            "Edges = quarter-turns. Six of them (U, U', R, R', F, F'), so the graph is 6-regular — every node has six neighbours.",
            "Distance = the fewest turns between two states. The graph's diameter is the hardest possible scramble — the cube's 'God's Number'.",
            "For the 2×2 in the quarter-turn metric that diameter is 14 (with exactly 276 'antipode' states that far away). For the full 3×3 it's 26 quarter-turns / 20 half-turns — too huge to BFS whole, which is why real 3×3 solvers use cleverer search.",
          ]}
        />
      </section>

      <section>
        <CaseSectionHeading>The algorithm</CaseSectionHeading>
        <CaseProse>
          Four pieces: a way to <em>name</em> a state, the <em>moves</em> as
          operations on it, the <em>test</em> for solved, and the <em>search</em>{" "}
          itself. Here they are, verbatim from the solver above — the same code that
          just ran on your scramble.
        </CaseProse>

        <Eq
          title="1 · A state, and its neighbours"
          formula="state = (permutation, orientation)   →   6 neighbours"
          what="A 2×2 state is where its 7 movable corners sit and how each is twisted (0, 1, or 2). A move cycles four corners between slots and adds a fixed twist to each — a permutation of the group. Applying all six moves to a state gives its six neighbours in the graph."
          code={`type Cube = { p: Uint8Array; o: Uint8Array }   // positions + twists

// a move cycles 4 corners and twists them; verified: each has order 4
function applyMove(s: Cube, m: Move): Cube {
  const p = s.p.slice(), o = s.o.slice()
  for (let i = 0; i < m.cycle.length; i++) {
    const dst = m.cycle[i], from = m.cycle[(i - 1 + 4) % 4]
    p[dst] = s.p[from]
    o[dst] = (s.o[from] + (m.tw[dst] || 0)) % 3   // accumulate twist
  }
  return { p, o }
}`}
        />

        <Eq
          title="2 · Naming a state (so we can remember it)"
          formula="key(s) = p₀p₁…p₆ | o₀o₁…o₆"
          what="BFS must recognise a state it has already seen. A cheap, exact key is just the permutation and orientation written out as a string. Two cube states are the same node iff their keys match — that's what lets the visited-set catch cycles and keep the search finite."
          code={`function key(s: Cube): string {
  let k = ""
  for (let i = 0; i < 7; i++) k += s.p[i]
  k += "|"
  for (let i = 0; i < 7; i++) k += s.o[i]
  return k
}
const visited = new Set<string>([key(start)])`}
        />

        <Eq
          title="3 · Breadth-first search = shortest path"
          formula="explore distance 0, then 1, then 2, …  →  stop at the goal"
          what="BFS expands the graph in rings: all states 1 move away, then all 2 moves away, and so on. Because it reaches a node by the shortest route first, the moment the goal appears you have the optimal solution — no move count can be beaten. Each ring is one 'frontier'; the visited set stops it revisiting states."
          code={`let frontier = [{ s: start, path: [] }]
const visited = new Set([key(start)])
while (frontier.length) {
  const next = []
  for (const node of frontier) {
    if (isSolved(node.s)) return node.path      // first hit = optimal
    for (const m of MOVES) {                     // six neighbours
      const ns = m.run(node.s), k = key(ns)
      if (!visited.has(k)) { visited.add(k); next.push({ s: ns, path: [...node.path, m] }) }
    }
  }
  frontier = next                                // advance one ring
}`}
        />

        <Eq
          title="4 · When solved is solved"
          formula="solved ⇔ every corner home (pᵢ = i) and untwisted (oᵢ = 0)"
          what="The goal test is trivial in this representation: the cube is solved exactly when every corner is in its own slot with zero twist. BFS calls this on each node it pops; the search's whole job is to reach the one state where it returns true."
          code={`function isSolved(s: Cube): boolean {
  for (let i = 0; i < 7; i++)
    if (s.p[i] !== i || s.o[i] !== 0) return false
  return true
}`}
        />
      </section>

      <section>
        <CaseSectionHeading>Getting it right (and proving it)</CaseSectionHeading>
        <CaseProse>
          A cube model is easy to get subtly wrong — a bad move permutation makes the
          search never terminate. So this one was checked against known facts before
          shipping: applying any quarter-turn four times returns to solved (each move
          has order 4); a move followed by its inverse is the identity; and a full
          BFS from solved reaches <strong>exactly 3,674,160</strong> states with a{" "}
          <strong>quarter-turn diameter of 14</strong> and 276 antipodes — matching
          the published 2×2 distance histogram. Only a correct model produces those
          numbers, so they double as the proof.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>Scaling to the real 3×3</CaseSectionHeading>
        <CaseProse>
          The 3×3 cube has ~4.3×10¹⁹ states — you can&apos;t BFS that. The same graph
          idea still drives the real solvers, but with smarter search: iterative
          deepening with a heuristic (IDA*, as in Korf&apos;s optimal solver), or
          Kociemba&apos;s two-phase method that routes through a well-chosen
          subgroup. All of them are still &ldquo;find a path in the state graph&rdquo;
          — just with the graph too big to hold, so you navigate it instead of
          enumerating it. The 2×2 here is the honest, fully-searchable version of the
          same idea.
        </CaseProse>
      </section>

      <CaseNextLinks
        prev={{ label: "Rubik Cube in OpenGL", href: "/academic/rubik-cube" }}
        next={{ label: "Back to work", href: "/#works" }}
      />
    </CaseStudyLayout>
  )
}
