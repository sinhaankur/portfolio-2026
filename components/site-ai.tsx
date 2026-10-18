"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useTheme } from "next-themes"
import { VeraMark } from "@/components/vera-mark"
import { useVeraVoice } from "@/components/use-vera-voice"
import { answerFromSite, groundingFor, navIntent, siteCommand, isHrQuestion } from "@/lib/site-knowledge"
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

type Msg = {
  role: "you" | "vera"
  text: string
  href?: string
  cta?: string
  followups?: { label: string; href: string }[]
}

/** Render **bold** markers in Vera's replies (e.g. **Oracle**) as real bold,
 *  so the emphasis reads instead of showing literal asterisks. */
function renderBold(text: string): React.ReactNode {
  if (!text.includes("**")) return text
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  )
}

const GREETING: Msg = {
  role: "vera",
  text: "Hi — I'm Vera. Here I'm your guide to Ankur's work: ask about anything (the work, the galaxy, the moon, the waves, the math), or tell me what to do — “show me the moon”, “fly to Mars”, “take me to the works”, “play music”, “dark mode”. Tap ♪ and I'll speak. Want the full me? Say “meet Vera”.",
  href: "/lab/cognitive-twin",
  cta: "Meet the full Vera",
}

// The tiny model follows EXAMPLES better than rules, so the prompt is few-shot:
// it must answer using ONLY the grounded context, warmly, in 1–2 sentences.
const SYSTEM = `You are the warm, precise guide to Ankur Sinha's portfolio — a UX designer and engineer who builds what he designs.

Rules:
- Answer in 1–2 short, friendly sentences. No preamble, no "As an AI", no lists.
- Use ONLY the facts in the provided Context. NEVER invent a project, number, or claim.
- IMPORTANT distinction: his PROFESSIONAL work is the case studies — Oracle, Deloitte, Snowtint, Rage. The Lab (Vera, the engines, the math, the games) is IDEAS AND EXPLORATION — never call a Lab project client work, a job, or a professional engagement. If the Context frames something as a Lab exploration, keep that framing.
- Never mention when or how much he works, or anything personal that could be misread.
- If the Context doesn't cover it, say briefly what he does have and invite them to explore.

Example:
Context:
- the Oracle case study: At Oracle, Ankur designed enterprise product experiences — turning dense, high-stakes workflows into interfaces people could actually move through.
User: oracle work
Answer: At Oracle, Ankur designed enterprise product experiences — taking dense, high-stakes workflows and making them something people could actually move through. There's a full case study.`

// Routes that have their OWN on-page AI (the ✦ orb copilot, or a full-screen
// experience). The global guide must NOT appear there — two AIs overlapping is
// confusing, and Vera/the orb is the true AI of those pages. The site guide is
// for NAVIGATION across the portfolio, not for competing with the page's own AI.
const ROUTES_WITHOUT_GUIDE = [
  "/lab/celestial",   // the Satellite Engine's ✦ copilot (the orb) lives here
  "/sky",             // full-screen ambient experiences
  "/waves",
  "/tv",
  "/embed",           // embeddable widgets
]

// Is a model reply actually grounded (usable), or did the tiny model drift into
// confused/garbage territory? Cheap, deterministic checks — no model needed.
function isGroundedReply(reply: string, context: string): boolean {
  const r = reply.toLowerCase()
  // 1) Known-bad drift: confusing the VISITOR with Ankur, or meta-nonsense.
  const BAD = [
    "you are at oracle", "you are ankur", "you're ankur", "you can be",
    "you are the one", "you're the one", "as an ai", "i am an ai language model",
    "contribute to your portfolio", "your portfolio", "you work at",
  ]
  if (BAD.some((p) => r.includes(p))) return false
  // 2) It should share real vocabulary with the grounded context (not invent).
  const ctxWords = new Set(
    context.toLowerCase().match(/[a-z]{4,}/g) || [],
  )
  const replyWords = (r.match(/[a-z]{4,}/g) || [])
  if (replyWords.length === 0) return false
  const overlap = replyWords.filter((w) => ctxWords.has(w)).length
  // require a modest grounding overlap — a reply that shares almost nothing with
  // the real facts is the model making things up.
  return overlap / replyWords.length >= 0.25
}

export function SiteAI() {
  const pathname = usePathname()
  // Hide the global guide on pages that own their AI / are full-screen.
  const hidden = ROUTES_WITHOUT_GUIDE.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  )

  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [thinking, setThinking] = useState(false)
  // The orb's living state — same idle/listening/thinking/speaking arc as the big
  // Vera orb, so the small guide visibly reacts: it listens as you type, thinks
  // while it works, glows while it answers, then settles.
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking" | "speaking">("idle")
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // SHARED voice — the same on-device Kokoro voice the big Vera orb uses, so the
  // guide speaks its answers in Vera's real voice. Opt-in (a speaker toggle),
  // off by default; never talks unasked. One voice path for every orb.
  const [sound, setSound] = useState(false)
  const voice = useVeraVoice(sound)
  // live voice loudness (0..1) → feeds the orb's wave so it rides the real audio.
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number | null>(null)
  // Opt-in on-device LLM for warmer phrasing. Off by default (the grounded brain
  // already answers correctly); turning it on streams the first model download.
  const [llmOn, setLlmOn] = useState(false)
  const [llmProgress, setLlmProgress] = useState<WebLLMProgress | null>(null)
  const [llmReady, setLlmReady] = useState(false)
  const webgpu = useRef(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const router = useRouter()
  const { setTheme } = useTheme()
  // Remember where we were, so "go back" / "take me back" works (handheld feel).
  const prevPath = useRef<string | null>(null)
  // true when the Universe Engine is on screen (home hero or /lab/celestial) —
  // gates "fly to Mars" so it only runs where there's a sky to fly in.
  const onEngine = pathname === "/" || pathname.startsWith("/lab/celestial")

  useEffect(() => {
    webgpu.current = isWebGPUAvailable()
    // SMART BY DEFAULT: if the browser can run the on-device model, warm it
    // automatically so answers are intelligent out of the box (this is the
    // "loading LLM" you remember). Falls back to the instant grounded brain
    // where WebGPU is absent — the guide is never broken, just plainer.
    if (webgpu.current) enableLLM()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  // While the orb is speaking with sound on, sample the live voice loudness each
  // frame so the orb's wave rides the REAL audio (like the Vera app). Idle otherwise.
  useEffect(() => {
    if (phase !== "speaking" || !sound) { setLevel(0); return }
    let alive = true
    const tick = async () => {
      if (!alive) return
      try {
        const { getVoiceLevel } = await import("@/lib/kokoro-voice")
        setLevel(getVoiceLevel())
      } catch { /* ignore */ }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, sound])

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
    let { context, link, followups } = groundingFor(query)
    // SEMANTIC boost: if the loaded model has an embedding head, fold the best
    // semantic matches into the context so a paraphrase ("the thing that tracks
    // space junk") still grounds on the right project. Keyword grounding above is
    // always kept; this only adds. Fails silent → keyword-only, as before.
    try {
      const { semanticTop } = await import("@/lib/site-semantic")
      const sem = await semanticTop(query, 3)
      if (sem.length) {
        const extra = sem
          .map((s) => `- ${s.entry.topic}: ${s.entry.text}`)
          .filter((line) => !context.includes(line))
          .join("\n")
        if (extra) context = `${context}\n${extra}`.trim()
        // if keyword found nothing, let semantics drive the link + follow-ups
        if (!link?.href || link.href === "/lab") {
          const top = sem[0].entry
          link = { text: top.text, href: top.href, cta: top.cta }
          followups = top.followups
        }
      }
    } catch {
      /* semantic unavailable → keyword grounding stands */
    }
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
        temperature: 0.2,   // low: it should REPHRASE the facts, not free-associate
        max_tokens: 160,
        stream: true,
      })) as unknown as AsyncIterable<{ choices: { delta?: { content?: string } }[] }>

      // Push an empty assistant message we append streamed tokens into.
      setThinking(false)
      setPhase("speaking") // the orb glows while the answer streams in
      setMsgs((m) => [...m, { role: "vera", text: "", href: link?.href, cta: link?.cta, followups }])
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
      // QUALITY GUARD. The tiny model sometimes free-associates garbage that
      // undermines the whole site ("Yes, you are at Oracle", "you can be!") — for
      // real visitors, a wrong/weird answer is worse than a plain correct one. So
      // if the streamed reply is empty, OR drifts (confuses the VISITOR with
      // Ankur, or doesn't actually use the grounded facts), replace it with the
      // reliable grounded sentence. The grounded brain is the source of truth; the
      // model only gets to REPHRASE it, never override it.
      let out = acc.trim()
      if (!out || !isGroundedReply(out, context)) {
        const g = answerFromSite(query)
        out = g.text
        setMsgs((m) => {
          const copy = m.slice()
          copy[copy.length - 1] = { role: "vera", text: g.text, href: g.href, cta: g.cta, followups: g.followups }
          return copy
        })
      }
      speakThenIdle(out) // Vera speaks the final answer, then settles
      return true
    } catch {
      setLlmProgress(null)
      return false // fall back to the grounded sentence
    }
  }

  // Hold the "speaking" glow for a moment after an answer lands, then settle to
  // idle — the same gentle settle the big orb has. When sound is on, Vera's real
  // voice SPEAKS the answer (same Kokoro voice as the big orb) and the glow holds
  // for roughly how long she talks.
  function speakThenIdle(text?: string) {
    setPhase("speaking")
    if (speakTimer.current) clearTimeout(speakTimer.current)
    if (sound && text) {
      voice.speak(text.replace(/\*\*/g, "")) // don't read the markdown markers aloud
      // settle a little after she'd finish (~ reading time), min 2.6s
      const dur = Math.max(2600, text.split(/\s+/).length * 360)
      speakTimer.current = setTimeout(() => setPhase("idle"), dur)
    } else {
      speakTimer.current = setTimeout(() => setPhase("idle"), 2600)
    }
  }

  function send(e?: React.FormEvent) {
    e?.preventDefault()
    const q = typed.trim()
    if (!q) return
    // unlock audio inside this click/submit gesture so Vera's voice can play
    // later (generation is async; priming now keeps playback allowed).
    if (sound) voice.unlock()
    setTyped("")
    setMsgs((m) => [...m, { role: "you", text: q }])

    // SITE COMMANDS — the orb DOES things: switch theme, fly to a planet in the
    // engine, scroll to a section. Checked first (most specific).
    const cmd = siteCommand(q, onEngine)
    if (cmd) {
      setMsgs((m) => [...m, { role: "vera", text: cmd.text }])
      speakThenIdle(cmd.text)
      if (cmd.kind === "theme") setTheme(cmd.value)
      else if (cmd.kind === "fly" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: cmd.pointId } }))
      } else if (cmd.kind === "music" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("universe:music", { detail: { action: cmd.action } }))
      } else if (cmd.kind === "scroll") {
        if (pathname === "/") document.querySelector(cmd.anchor)?.scrollIntoView({ behavior: "smooth" })
        else { prevPath.current = pathname; router.push("/" + cmd.anchor) }
      }
      return
    }

    // NAVIGATION — "take me to / show me / go to X" should actually walk the
    // visitor there (handheld), and "go back" returns. The orb announces the
    // move, then routes. This runs before the Q&A brain.
    const lower = q.toLowerCase()
    if (/\b(go back|take me back|back again|previous page|return)\b/.test(lower) && prevPath.current) {
      const dest = prevPath.current
      const line = "Taking you back — here we go."
      setMsgs((m) => [...m, { role: "vera", text: line }])
      speakThenIdle(line)
      setTimeout(() => { prevPath.current = pathname; router.push(dest) }, 650)
      return
    }
    // HR/recruiter questions ("show me proof he can ship", "does he have
    // enterprise experience") must be ANSWERED, not treated as navigation —
    // "show me" would otherwise route them somewhere random. So skip nav for them.
    const nav = isHrQuestion(q) ? null : navIntent(q)
    if (nav && nav.href !== pathname) {
      setMsgs((m) => [...m, { role: "vera", text: nav.text, href: nav.href, cta: `Go to ${nav.topic}` }])
      speakThenIdle(nav.text)
      setTimeout(() => {
        prevPath.current = pathname
        if (nav.href.startsWith("/#")) {
          // same-page anchor from home, or route home then scroll
          router.push(nav.href)
        } else router.push(nav.href)
      }, 700)
      return
    }

    setThinking(true)
    setPhase("thinking")

    // HR/recruiter questions get the CURATED answer (Oracle-anchored), skipping
    // the tiny LLM — its phrasing of "are you hiring" etc. is worse and off-brand.
    if (isHrQuestion(q)) {
      setTimeout(() => {
        setThinking(false)
        const a = answerFromSite(q)
        setMsgs((m) => [...m, { role: "vera", text: a.text, href: a.href, cta: a.cta, followups: a.followups }])
        speakThenIdle(a.text)
      }, 340)
      return
    }

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
          setMsgs((m) => [...m, { role: "vera", text: a.text, href: a.href, cta: a.cta, followups: a.followups }])
          speakThenIdle(a.text) // orb glows + Vera speaks the answer, then settles
        }, 360)
      }
    })()
  }

  // On pages with their own AI (the orb copilot) or full-screen experiences,
  // the global guide stays out of the way — one AI per context.
  if (hidden) return null

  return (
    <>
      {/* the quiet orb button */}
      <button
        onClick={() => setOpen((v) => !v)}
        data-cursor-hover
        aria-label={open ? "Close Vera" : "Ask Vera"}
        className="fixed bottom-5 right-5 z-[60] rounded-full p-0 transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ width: 46, height: 46 }}
      >
        <VeraMark size={46} active phase={phase} level={level} />
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
              <VeraMark size={24} active phase={phase} level={level} />
              <div className="leading-tight flex-1">
                <div className="text-[13px] font-semibold">Vera</div>
                <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground">
                  your guide · on-device
                </div>
              </div>
              {/* voice toggle — speak answers in Vera's real on-device voice
                  (same Kokoro voice as the big orb). Opt-in; off by default. */}
              <button
                onClick={() => {
                  const next = !sound
                  setSound(next)
                  if (next) { voice.unlock(); voice.preload() } else voice.stop()
                }}
                data-cursor-hover
                aria-pressed={sound}
                title={sound
                  ? (voice.status === "loading" ? `Warming Vera's voice… ${voice.pct}%` : "Voice on — Vera speaks her answers (on-device). Click to mute.")
                  : "Turn on voice — Vera speaks her answers in her real on-device voice"}
                className={`rounded-full border px-2 py-1 font-mono text-[9px] tracking-wider transition-colors ${
                  sound ? "border-accent/60 bg-accent/15 text-foreground" : "border-border text-muted-foreground hover:border-accent/50"
                }`}
              >
                {sound ? (voice.warming || voice.status === "loading" ? "♪…" : "♪ ✓") : "♪"}
              </button>
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
                    {m.role === "vera" ? renderBold(m.text) : m.text}
                  </span>
                  {m.href && m.text && (
                    <div className="mt-1.5">
                      <a
                        href={m.href}
                        data-cursor-hover
                        {...(m.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent transition-colors"
                      >
                        {m.cta ?? "Open"} →
                      </a>
                    </div>
                  )}
                  {/* follow-up chips — real next taps, so the guide invites more */}
                  {m.followups && m.text && m.followups.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.followups.map((f, fi) => (
                        <a
                          key={fi}
                          href={f.href}
                          data-cursor-hover
                          {...(f.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent/50 hover:text-foreground transition-colors"
                        >
                          {f.label}
                        </a>
                      ))}
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
                onChange={(e) => {
                  setTyped(e.target.value)
                  // orb listens while you type, settles when the field is empty
                  if (phase === "idle" || phase === "listening")
                    setPhase(e.target.value ? "listening" : "idle")
                }}
                placeholder="Ask Vera anything…"
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
