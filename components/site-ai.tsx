"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { VeraMark } from "@/components/vera-mark"
import { answerFromSite, groundingFor } from "@/lib/site-knowledge"
import {
  getWebLLMEngine,
  isWebGPUAvailable,
  DEFAULT_WEBLLM_MODEL,
  type WebLLMProgress,
} from "@/lib/webllm-engine"

/**
 * SiteAI — a small, quiet guide orb in the corner of the site.
 *
 * TWO LAYERS, matching the project's "deterministic core, LLM for phrasing" rule:
 *
 *   1. GROUNDED BRAIN (always, instant, works everywhere) — every answer is
 *      resolved by lib/site-knowledge.ts: it understands the question (intent +
 *      entity) and returns a TRUE fact plus a link to the RIGHT page. So "oracle
 *      work" lands on /works/oracle, not a generic roster. No download, no WebGPU.
 *
 *   2. ON-DEVICE TINY LLM (opt-in) — when the visitor turns on "warmer answers",
 *      a small model (~380 MB, cached after first load) runs entirely in their
 *      browser via WebGPU and PHRASES the grounded facts conversationally. The
 *      facts and the link still come from the brain, so it can't hallucinate a
 *      page or a claim. If WebGPU is absent or the model errors, we fall straight
 *      back to the grounded sentence — the guide never breaks.
 *
 * Deliberately small and unobtrusive — present, not intrusive.
 */

type Msg = { role: "you" | "vera"; text: string; href?: string; cta?: string }

const GREETING: Msg = {
  role: "vera",
  text: "Hi — I'm the guide to Ankur's work. Ask about the work (Oracle, Deloitte…), Vera, the Universe Engine, the waves, or the math.",
}

// The tiny model follows EXAMPLES better than rules, so the prompt is few-shot:
// it must answer using ONLY the grounded context, warmly, in 1–2 sentences.
const SYSTEM = `You are the warm, precise guide to Ankur Sinha's portfolio — a UX designer and engineer who builds what he designs.

Rules:
- Answer in 1–2 short, friendly sentences. No preamble, no "As an AI", no lists.
- Use ONLY the facts in the provided Context. NEVER invent a project, number, or claim.
- If the Context doesn't cover it, say briefly what Ankur does have and invite them to explore.

Example:
Context:
- the Oracle case study: At Oracle, Ankur designed enterprise product experiences — turning dense, high-stakes workflows into interfaces people could actually move through.
User: oracle work
Answer: At Oracle, Ankur designed enterprise product experiences — taking dense, high-stakes workflows and making them something people could actually move through. There's a full case study.`

export function SiteAI() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [thinking, setThinking] = useState(false)
  // Opt-in on-device LLM for warmer phrasing. Off by default (the grounded brain
  // already answers correctly); turning it on streams the first model download.
  const [llmOn, setLlmOn] = useState(false)
  const [llmProgress, setLlmProgress] = useState<WebLLMProgress | null>(null)
  const [llmReady, setLlmReady] = useState(false)
  const webgpu = useRef(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    webgpu.current = isWebGPUAvailable()
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, thinking, llmProgress])

  // Warm the on-device model when the visitor opts in (first time only).
  async function enableLLM() {
    setLlmOn(true)
    if (!webgpu.current) return // no WebGPU → stays on the grounded brain
    try {
      await getWebLLMEngine(DEFAULT_WEBLLM_MODEL, (p) => setLlmProgress(p))
      setLlmReady(true)
      setLlmProgress(null)
    } catch {
      setLlmReady(false)
      setLlmProgress(null)
    }
  }

  /** Phrase the grounded answer with the on-device model, streaming into `msgs`. */
  async function phraseWithLLM(query: string): Promise<boolean> {
    if (!llmOn || !webgpu.current) return false
    const { context, link } = groundingFor(query)
    try {
      const engine = await getWebLLMEngine(DEFAULT_WEBLLM_MODEL, (p) => setLlmProgress(p))
      setLlmReady(true)
      setLlmProgress(null)
      abortRef.current = new AbortController()
      const prompt = `Context:\n${context}\n\nUser: ${query}\n\nAnswer:`
      const stream = (await engine.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 160,
        stream: true,
      })) as unknown as AsyncIterable<{ choices: { delta?: { content?: string } }[] }>

      // Push an empty assistant message we append streamed tokens into.
      setThinking(false)
      setMsgs((m) => [...m, { role: "vera", text: "", href: link?.href, cta: link?.cta }])
      let acc = ""
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? ""
        if (!delta) continue
        acc += delta
        setMsgs((m) => {
          const copy = m.slice()
          const last = copy[copy.length - 1]
          if (last && last.role === "vera") copy[copy.length - 1] = { ...last, text: acc.trim() }
          return copy
        })
      }
      // Guard against an empty model reply — fall back to the grounded sentence.
      if (!acc.trim()) {
        const g = answerFromSite(query)
        setMsgs((m) => {
          const copy = m.slice()
          copy[copy.length - 1] = { role: "vera", text: g.text, href: g.href, cta: g.cta }
          return copy
        })
      }
      return true
    } catch {
      setLlmProgress(null)
      return false // fall back to the grounded sentence
    }
  }

  function send(e?: React.FormEvent) {
    e?.preventDefault()
    const q = typed.trim()
    if (!q) return
    setTyped("")
    setMsgs((m) => [...m, { role: "you", text: q }])
    setThinking(true)

    // Try the on-device model first (if opted in); otherwise — or on any
    // failure — answer instantly from the grounded brain. Either way the answer
    // is TRUE and links to the right page.
    ;(async () => {
      const phrased = await phraseWithLLM(q)
      if (!phrased) {
        // a brief considered beat, then the grounded answer
        setTimeout(() => {
          setThinking(false)
          const a = answerFromSite(q)
          setMsgs((m) => [...m, { role: "vera", text: a.text, href: a.href, cta: a.cta }])
        }, 360)
      }
    })()
  }

  return (
    <>
      {/* the quiet orb button */}
      <button
        onClick={() => setOpen((v) => !v)}
        data-cursor-hover
        aria-label={open ? "Close the guide" : "Ask the guide"}
        className="fixed bottom-5 right-5 z-[60] rounded-full p-0 transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ width: 46, height: 46 }}
      >
        <VeraMark size={46} active={!open} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-20 right-5 z-[60] w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
          >
            {/* header */}
            <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
              <VeraMark size={24} active />
              <div className="leading-tight flex-1">
                <div className="text-[13px] font-semibold">Ask the guide</div>
                <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground">
                  about Ankur&rsquo;s work
                </div>
              </div>
              {/* warmer-answers toggle — opt-in on-device model */}
              {webgpu.current && (
                <button
                  onClick={() => (llmOn ? setLlmOn(false) : enableLLM())}
                  data-cursor-hover
                  aria-pressed={llmOn}
                  title={
                    llmOn
                      ? "On-device AI on — answers phrased by a tiny model in your browser"
                      : "Turn on warmer answers (a tiny AI runs on your device, ~380 MB first load)"
                  }
                  className={`rounded-full border px-2 py-1 font-mono text-[9px] tracking-wider transition-colors ${
                    llmOn
                      ? "border-accent/60 bg-accent/15 text-foreground"
                      : "border-border text-muted-foreground hover:border-accent/50"
                  }`}
                >
                  {llmReady ? "AI ✓" : llmOn ? "AI…" : "AI"}
                </button>
              )}
            </div>

            {/* messages */}
            <div ref={scrollRef} className="max-h-[46vh] space-y-2.5 overflow-y-auto px-4 py-3.5">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "you" ? "text-right" : "text-left"}>
                  <span
                    className={
                      m.role === "you"
                        ? "inline-block rounded-2xl bg-accent/15 px-3 py-1.5 text-[13px]"
                        : "inline-block rounded-2xl text-[13px] leading-relaxed text-foreground/90"
                    }
                  >
                    {m.text}
                  </span>
                  {m.href && m.text && (
                    <div className="mt-1.5">
                      <a
                        href={m.href}
                        data-cursor-hover
                        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent transition-colors"
                      >
                        {m.cta ?? "Open"} →
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {/* model download progress (first opt-in only) */}
              {llmProgress && (
                <div className="text-left">
                  <span className="inline-block rounded-2xl font-mono text-[10px] text-muted-foreground">
                    loading on-device AI… {Math.round((llmProgress.progress || 0) * 100)}%
                  </span>
                </div>
              )}
              {thinking && (
                <div className="text-left" aria-label="thinking">
                  <span className="inline-flex items-center gap-1 rounded-2xl px-1 py-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block h-1.5 w-1.5 rounded-full bg-accent/70 animate-pulse"
                        style={{ animationDelay: `${i * 160}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* input */}
            <form onSubmit={send} className="flex gap-2 border-t border-border/60 p-3">
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Ask about the work…"
                className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-[13px] focus:outline-none focus:border-accent/60"
              />
              <button
                type="submit"
                data-cursor-hover
                className="rounded-full bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground hover:brightness-110 transition"
              >
                Ask
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
