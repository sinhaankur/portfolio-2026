"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { VeraMark } from "@/components/vera-mark"

/**
 * SiteAI — a small, quiet assistant orb in the corner of the site.
 *
 * Click the orb → a compact panel opens. It answers questions about Ankur's work
 * from a CURATED, grounded knowledge base (so it's instant + reliable, and always
 * links to the real tool/page). This is the seed of the "site AI"; the on-device
 * webLLM runtime can slot in later behind the same panel.
 *
 * Deliberately small and unobtrusive — present, not intrusive.
 */

type Msg = { role: "you" | "vera"; text: string; href?: string; cta?: string }

// curated, grounded answers — each points to a real page/tool.
const KB: { q: string[]; a: string; href?: string; cta?: string }[] = [
  {
    q: ["who", "ankur", "about", "you"],
    a: "Ankur is a UX designer and engineer-by-degree who builds what he designs — product design at Oracle & Deloitte, plus a lab of human-in-the-loop AI tools you can actually use.",
    href: "/about", cta: "About Ankur",
  },
  {
    q: ["vera", "companion", "on-device ai", "assistant", "download"],
    a: "Vera is a private, on-device AI companion for macOS — its own brain (feeling + memory computed locally), a warm neural voice, sealed privacy. Open source, free to download.",
    href: "/lab/cognitive-twin", cta: "Meet Vera",
  },
  {
    q: ["universe", "satellite", "space", "sky", "stars", "engine"],
    a: "The Universe / Satellite Engine is a real-time, date-accurate solar system with 18,600+ real satellite orbits, Mars/Moon imaging and live space data — built from real NASA/JPL data, running in your browser.",
    href: "/lab/celestial", cta: "Open the engine",
  },
  {
    q: ["wave", "ocean", "sea", "water"],
    a: "The Waves is our own real-time procedural ocean under a real sun and moon, driven by tides, sun, wind and climate — all computed on-device.",
    href: "/waves", cta: "Explore the sea",
  },
  {
    q: ["math", "equation", "pi", "fourier", "euler", "golden"],
    a: "Mathematics, made visible — π, Euler's identity, Fourier epicycles, the golden ratio, the waves and the universe, each an original interactive visualization of the real math.",
    href: "/math", cta: "See the math",
  },
  {
    q: ["work", "case", "oracle", "deloitte", "project", "design"],
    a: "The work spans Oracle, Deloitte, Snowtint and Rage — real product design case studies, plus The Lab of experiments.",
    href: "/lab", cta: "The Lab",
  },
  {
    q: ["usability", "framework", "ux", "heuristic"],
    a: "There's a live Usability Engine and a Universal Experience Framework — the Laws of UX & cognition with interactive demos.",
    href: "/framework", cta: "The framework",
  },
  {
    q: ["skill", "library", "craft", "stack", "tool"],
    a: "A skills matrix and a craft library — nine disciplines, each with the tools and proof links to real work.",
    href: "/skills", cta: "Skills & craft",
  },
]

const GREETING: Msg = {
  role: "vera",
  text: "Hi — I'm the guide to Ankur's work. Ask about Vera, the Universe Engine, the waves, the math, or the work.",
}

function answer(q: string): Msg {
  const t = q.toLowerCase()
  let best: (typeof KB)[number] | null = null
  let bestScore = 0
  for (const item of KB) {
    const score = item.q.reduce((s, kw) => (t.includes(kw) ? s + 1 : s), 0)
    if (score > bestScore) { bestScore = score; best = item }
  }
  if (best && bestScore > 0) {
    return { role: "vera", text: best.a, href: best.href, cta: best.cta }
  }
  return {
    role: "vera",
    text: "I can point you to the real thing — try 'Vera', 'the universe engine', 'the waves', 'the math', or 'the work'.",
    href: "/lab", cta: "Browse The Lab",
  }
}

export function SiteAI() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs])

  function send(e?: React.FormEvent) {
    e?.preventDefault()
    const q = typed.trim()
    if (!q) return
    setTyped("")
    setMsgs((m) => [...m, { role: "you", text: q }])
    setTimeout(() => setMsgs((m) => [...m, answer(q)]), 280)
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
              <div className="leading-tight">
                <div className="text-[13px] font-semibold">Ask the guide</div>
                <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground">
                  about Ankur&rsquo;s work
                </div>
              </div>
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
                  {m.href && (
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
