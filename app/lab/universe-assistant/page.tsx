import type { Metadata } from "next"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseLessons,
} from "@/components/case-study/case-study-layout"
import { UniverseAssistantDemo } from "./universe-assistant-demo"

export const metadata: Metadata = {
  title:
    "Universe Engine Assistant — chat with a real-astronomy 3D simulation · Ankur Sinha",
  description:
    "An LLM front-end for the Universe Engine. Natural-language queries against 30+ named small bodies, 8 planets, 60+ deep-sky objects, projected from real J2000 coordinates. Tool use, prompt caching, browser-direct streaming. Designer + engineer: Ankur Sinha.",
}

type ArchitectureRow = {
  layer: string
  detail: string
  notes: string
}

const architectureRows: ArchitectureRow[] = [
  {
    layer: "Browser-direct API",
    detail: "anthropic-dangerous-direct-browser-access",
    notes:
      "Visitor brings their own Anthropic key, stored in localStorage. Requests go straight from the browser to api.anthropic.com — no server proxy, no shared key.",
  },
  {
    layer: "Streaming",
    detail: "client.messages.stream()",
    notes:
      "Text deltas update the chat UI live via .on('text'). finalMessage() collects the complete Message + usage for tool dispatch.",
  },
  {
    layer: "Tool-use loop",
    detail: "Manual agentic loop",
    notes:
      "stream → finalMessage → execute tool_use blocks against the live engine refs → append tool_result → repeat. Stops on end_turn or max iterations.",
  },
  {
    layer: "Prompt caching",
    detail: "cache_control: ephemeral",
    notes:
      "System prompt + condensed dataset + tool definitions are stable across requests. Cached at ~10% of input cost; cache_creation paid once per 5-min window.",
  },
  {
    layer: "Adaptive thinking",
    detail: "thinking: {type: 'adaptive'}",
    notes:
      "Sonnet 4.6 decides per-request when to reason. Default for tool-using chat — visible 'thinking' indicator while it deliberates which tool to call.",
  },
  {
    layer: "Reads (dataset only)",
    detail: "8 tools",
    notes:
      "listBodies, getBodyDetails, getBodyPosition, findBodiesNear, getOrbitalState, listExoplanetHosts, listConstellations, getCurrentSimDate.",
  },
  {
    layer: "Actions (engine state)",
    detail: "5 tools",
    notes:
      "flyToBody, followBody, setTimeWarp, setSimTime, resetView — all wrap the same module-scoped refs the existing HUD already uses.",
  },
]

const lessons: { title: string; body: string }[] = [
  {
    title: "Browser-direct API is real production tooling now.",
    body: "Anthropic's `dangerously-direct-browser-access` flag is opt-in and explicit — no surprises about where the key lives. BYO-key static-site assistants are a legitimate deployment shape, not a hack.",
  },
  {
    title: "Prompt caching pays for itself by turn 2.",
    body: "A 30 KB dataset injection lands at ~$0.001 per cached read vs ~$0.01 uncached on Sonnet 4.6. The first turn pays the ~1.25× cache-write premium; every turn after pays 10% of normal input cost.",
  },
  {
    title: "Manual agentic loops are simpler than they look.",
    body: "Stream text deltas live via `.on('text')`, await `finalMessage()` for tool dispatch, append the assistant turn to history verbatim, loop until end_turn. Six lines if you ignore the streaming callbacks.",
  },
  {
    title: "Tool definitions are a contract.",
    body: "The description tells the model when to call, the executor honours that intent. If the executor diverges from what the description promises, the description is now lying — and the model will pick wrong tools.",
  },
  {
    title: "Action tools are smaller than they look.",
    body: "Five scene-control tools collectively wrap four module refs (flyToRef, followRef, timeWarpRef, simTimeRef) — exactly the surface the existing HUD already uses. The assistant just speaks the same control language.",
  },
]

export default function UniverseAssistantPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab — AI · 2026"
      title="Universe Engine Assistant"
      subtitle="An LLM front-end for the real-astronomy 3D simulation"
      period="May 2026"
      role="Designer + engineer"
      tags={[
        "Anthropic SDK",
        "Tool use",
        "Streaming",
        "Prompt caching",
        "Browser-direct API",
        "TypeScript",
        "Next.js",
      ]}
      intro={
        <p>
          The Universe Engine renders a real solar system at the current epoch:
          orbital elements pulled from JPL, J2000 coordinates for the
          constellations, 30+ named small bodies that obey Kepler&apos;s second
          law. Visitors explore it by clicking. This assistant lets them
          explore it by{" "}
          <em>asking</em> — natural-language queries that translate into the
          same scene-control actions the HUD already wires up. The interesting
          engineering is what holds it together: browser-direct streaming with
          a BYO Anthropic key, prompt caching on a 30&nbsp;KB injected
          dataset, and a manual tool-use loop that dispatches each call into
          the live engine refs.
        </p>
      }
      backTo={{ label: "Back to lab", href: "/#lab" }}
    >
      {/* Working demo */}
      <section className="my-12 md:my-16">
        <UniverseAssistantDemo />
      </section>

      {/* Why this exists */}
      <CaseSectionHeading
        eyebrow="01"
        title="Why this exists"
        kicker="Demonstrating AI engineering on a surface that&apos;s already mine."
      />
      <CaseProse>
        <p>
          The Universe Engine is the heaviest piece of independent engineering
          on this portfolio — three months of iteration on real astronomy,
          custom GLSL shaders, Kepler-correct orbital math. It&apos;s also
          rare territory for AI engineering: most chat assistants sit on top
          of company knowledge bases or generic web search. This one sits on
          top of a 3D scene with structured, named state. That changes the
          shape of the work.
        </p>
        <p>
          The differentiator is the combination — design + engineering + AI,
          on a domain where I can ground every model output in real data.
          Not&nbsp;a ChatGPT clone, not another agent framework demo. A
          working instrument that demonstrates what a thoughtful human–AI
          surface looks like when the dataset is real and the actions are
          consequential (the camera actually moves, time actually advances).
        </p>
      </CaseProse>

      {/* Architecture */}
      <CaseSectionHeading
        eyebrow="02"
        title="Architecture"
        kicker="Static-site compatible. No server. Visitor&apos;s key, visitor&apos;s bill."
      />
      <CaseProse>
        <p>
          Anthropic added <code>anthropic-dangerous-direct-browser-access</code>{" "}
          specifically for the BYO-key static-site use case. The SDK exposes
          it as <code>dangerouslyAllowBrowser: true</code>. With that flag,
          the visitor pastes a key into the settings drawer, it lives in{" "}
          <code>localStorage</code>, and every API call goes browser → Anthropic
          directly. No proxy, no shared key, no hosting cost on my side.
        </p>
        <p>
          The runtime piece is a manual agentic loop. I could have used the
          SDK&apos;s <code>toolRunner</code> helper, but the loop here is short
          enough to read explicitly — and the manual version gives me one
          obvious hook for dispatching each tool call into the live engine
          refs. <code>stream → finalMessage → execute tool_use blocks →
          append tool_result → loop</code>. Stops on <code>end_turn</code>.
        </p>
      </CaseProse>

      <div className="my-8 overflow-hidden rounded-lg border border-border">
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
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {architectureRows.map((row, idx) => (
              <tr
                key={row.layer}
                className={
                  idx % 2 === 1
                    ? "border-t border-border/60 bg-secondary/10"
                    : "border-t border-border/60"
                }
              >
                <td className="font-medium text-foreground px-4 py-3 align-top">
                  {row.layer}
                </td>
                <td className="font-mono text-xs text-foreground/80 px-4 py-3 align-top">
                  {row.detail}
                </td>
                <td className="text-muted-foreground leading-relaxed px-4 py-3 align-top">
                  {row.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tool surface */}
      <CaseSectionHeading
        eyebrow="03"
        title="Tool surface"
        kicker="Eight read tools query the dataset; five action tools write to engine refs."
      />
      <CaseProse>
        <p>
          The read tools query the static dataset — <code>namedBodies</code>,{" "}
          <code>skyPoints</code>, <code>planetsData</code> — with no side
          effects. <code>getBodyPosition</code> recomputes the Keplerian
          position at the current sim time using the same math the scene
          uses, so &quot;where is Halley right now?&quot; returns the same answer
          the camera would frame on a flyTo.
        </p>
        <p>
          The action tools wrap the same module refs the existing HUD already
          uses: <code>flyToRef</code>, <code>followRef</code>,{" "}
          <code>timeWarpRef</code>, <code>simTimeRef</code>. The model
          dispatches into the same surface a click on the time-warp slider
          would. No parallel state, no fork in the engine&apos;s logic — the
          assistant just speaks the same control language as the UI.
        </p>
        <p>
          Tool descriptions are written like a panel-of-controls operator
          manual. The model picks tools by description, so the wording is the
          contract — &quot;use this when the user asks &lsquo;show me&rsquo;,
          &lsquo;take me to&rsquo;, or &lsquo;fly to&rsquo;&quot;. Vague
          descriptions = vague tool selection.
        </p>
      </CaseProse>

      {/* Engineering decisions */}
      <CaseSectionHeading
        eyebrow="04"
        title="Engineering decisions"
        kicker="The choices worth defending."
      />
      <CaseProse>
        <p>
          <strong className="text-foreground">Sonnet 4.6 over Opus 4.7 as
          default.</strong> Cost-quality balance for chat. Opus is selectable
          in settings for deeper reasoning at 3× the rate. Haiku is there for
          visitors who want zero cost anxiety. All three support adaptive
          thinking and tool use; only the depth differs.
        </p>
        <p>
          <strong className="text-foreground">Adaptive thinking on.</strong>{" "}
          Sonnet 4.6 supports <code>thinking: {`{type: "adaptive"}`}</code> —
          the model decides per-request when reasoning is worth it. For
          tool-using chat this is the right default; the UI shows a brief
          &quot;thinking&quot; indicator when the model deliberates and the
          tool indicators arrive in the same stream.
        </p>
        <p>
          <strong className="text-foreground">Prompt caching with the
          dataset baked in.</strong> The 30 KB dataset injection is the
          biggest single chunk of input — and it&apos;s stable byte-for-byte
          across requests. Marking the last system block and the last tool
          definition with <code>cache_control: ephemeral</code> means every
          turn after the first reads them at ~10% of input cost. With Sonnet 4.6
          input at $3/M, a cached turn lands at sub-cent territory.
        </p>
        <p>
          <strong className="text-foreground">Manual agentic loop, not
          toolRunner.</strong> The SDK&apos;s tool runner is fine, but the
          loop here is six lines if you ignore the streaming callbacks.
          Manual control lets me dispatch tool calls into the engine refs as
          they arrive, mutate the UI&apos;s assistant message in place, and
          accumulate per-iteration usage for the cost display. None of that
          is easier inside <code>toolRunner</code>.
        </p>
        <p>
          <strong className="text-foreground">BYO-key over a free
          tier.</strong> A serverless free tier was tempting — Vercel Edge or
          Cloudflare Worker would let anyone try the assistant without their
          own key. I traded zero-friction-but-cost-exposed for
          friction-but-pure-static. The portfolio audience (recruiters,
          engineers) skews toward people who already have Anthropic
          credentials; the cold-start UX cost feels worth the architectural
          honesty of &quot;no backend&quot;.
        </p>
      </CaseProse>

      {/* Lessons */}
      <CaseSectionHeading
        eyebrow="05"
        title="What I&apos;d build next"
        kicker="If this were the start of a product, not the end of an experiment."
      />
      <CaseLessons lessons={lessons} />

      <CaseProse>
        <p>
          If this stayed an experiment, the next obvious move is{" "}
          <strong className="text-foreground">spoken input</strong> — the Web
          Speech API runs in-browser, the assistant&apos;s output is already
          short enough for TTS. A spoken planetarium where you talk to the
          sky.
        </p>
        <p>
          If it became a product, the next move is{" "}
          <strong className="text-foreground">memory across sessions</strong>{" "}
          — &quot;take me back to where I was last time&quot;. That&apos;s a
          different shape of engineering (server state, identity), and worth
          a different conversation.
        </p>
      </CaseProse>
    </CaseStudyLayout>
  )
}
