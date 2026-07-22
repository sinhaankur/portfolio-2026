"use client"

/**
 * BrainRot live demo — paste any feed or article text and watch the on-device
 * engine mirror its bias back. Runs entirely in the browser (lib/brainrot.ts);
 * nothing is sent anywhere. Auto-detects FEED vs ARTICLE and shows the right
 * lens. The real extension does the same thing on live pages by scraping the DOM.
 */

import { useMemo, useState } from "react"
import {
  analyzeItem,
  profileFeed,
  antidoteFor,
  detectMode,
  analyzeArticle,
  MANIPULATION_LABELS,
  type FeedItem,
} from "@/lib/brainrot"
import { SAMPLE_FEED } from "@/lib/brainrot-sample"

const SAMPLE_ARTICLE = `Senator Blasted Over Shocking New Policy

In a stunning and brazen move that sparked outrage, Senator Miller slammed the controversial bill on Tuesday, calling the radical proposal a disaster in the making. Critics say the desperate measure is a botched attempt to appease the far-right base, and reportedly refused to answer questions from the press.

Governor Chen, by contrast, offered a measured and thoughtful response, earning praise from colleagues on both sides. Insiders say the chaos erupted as protesters gathered outside, though official numbers were not confirmed.`

function splitToItems(raw: string): FeedItem[] {
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 2)
  // If the user pasted single-line-per-post, split on newlines instead.
  const items = blocks.length > 1 ? blocks : raw.split(/\n/).map((l) => l.trim()).filter(Boolean)
  return items.map((text, i) => ({ id: String(i), text }))
}

const PCT = (x: number) => Math.round(x * 100)

export function BrainRotDemo() {
  const [text, setText] = useState(SAMPLE_FEED.map((f) => f.text).join("\n"))
  const [ran, setRan] = useState(true)

  const result = useMemo(() => {
    if (!ran || !text.trim()) return null
    const items = splitToItems(text)
    const mode = detectMode(items)
    if (mode === "article") {
      return { mode: "article" as const, article: analyzeArticle(items.map((i) => i.text).join("\n\n")) }
    }
    const analyses = items.map(analyzeItem)
    return {
      mode: "feed" as const,
      profile: profileFeed(analyses),
      antidotes: antidoteFor(profileFeed(analyses)),
      analyses,
    }
  }, [text, ran])

  return (
    <div className="not-prose my-8 rounded-2xl border border-border bg-card/40 overflow-hidden">
      {/* Input */}
      <div className="p-4 md:p-5 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
            Paste a feed or an article
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setText(SAMPLE_FEED.map((f) => f.text).join("\n")); setRan(true) }}
              className="px-2.5 py-1 rounded-full border border-border text-[10px] font-mono uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-accent/60 transition-colors"
            >
              Sample feed
            </button>
            <button
              type="button"
              onClick={() => { setText(SAMPLE_ARTICLE); setRan(true) }}
              className="px-2.5 py-1 rounded-full border border-border text-[10px] font-mono uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-accent/60 transition-colors"
            >
              Sample article
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setRan(true) }}
          spellCheck={false}
          rows={6}
          placeholder="Paste posts (one per line) or a whole news article…"
          className="w-full resize-y rounded-lg border border-border bg-background/60 p-3 font-sans text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
          Runs on-device. Nothing you paste leaves your browser.
        </p>
      </div>

      {/* Output */}
      {result && (
        <div className="p-4 md:p-5">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {result.mode === "feed" ? "Feed detected · algorithmic mirror" : "Article detected · editorial mirror"}
          </div>

          {result.mode === "feed" ? (
            <FeedView profile={result.profile} antidotes={result.antidotes} />
          ) : (
            <ArticleView a={result.article} />
          )}
        </div>
      )}
    </div>
  )
}

function FeedView({
  profile,
  antidotes,
}: {
  profile: ReturnType<typeof profileFeed>
  antidotes: ReturnType<typeof antidoteFor>
}) {
  const topics = profile.topics.filter((t) => t.topic !== "other").slice(0, 5)
  const manips = profile.manipulations.slice(0, 8)
  return (
    <div className="space-y-5">
      <Bolded text={profile.mirror} className="text-base leading-relaxed text-foreground" />

      <div className="grid grid-cols-3 gap-2">
        <Stat n={`${PCT(profile.meanHook)}%`} label="engineered" />
        <Stat n={profile.echoChamber > 0.4 ? "Tight" : profile.echoChamber > 0.25 ? "Narrow" : "Mixed"} label="echo chamber" />
        <Stat n={profile.meanSentiment < -0.15 ? "Agitated" : profile.meanSentiment > 0.15 ? "Comfort" : "Neutral"} label="mood" />
      </div>

      <Lens title="Fed to you">
        <div className="space-y-1.5">
          {topics.length ? topics.map((t) => (
            <div key={t.topic} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs capitalize text-foreground">{t.topic}</span>
              <span className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${PCT(t.share)}%` }} />
              </span>
              <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">{PCT(t.share)}%</span>
            </div>
          )) : <span className="text-xs text-muted-foreground">No clear topic lean.</span>}
        </div>
      </Lens>

      <Lens title="Hooks it's using — the manipulation techniques">
        <div className="flex flex-wrap gap-1.5">
          {manips.length ? manips.map((m) => (
            <span
              key={m.name}
              className={`px-2.5 py-1 rounded-full font-mono text-[11px] border ${
                m.count >= 4 ? "bg-red-500/15 text-red-300 border-red-500/30"
                : m.count >= 2 ? "bg-amber-500/12 text-amber-200 border-amber-500/28"
                : "border-border text-muted-foreground"
              }`}
            >
              {MANIPULATION_LABELS[m.name]} · {m.count}
            </span>
          )) : <span className="text-xs text-muted-foreground">No obvious manipulation patterns.</span>}
        </div>
      </Lens>

      {antidotes.length > 0 && (
        <Lens title="Break the loop — counter-content">
          <ul className="space-y-2">
            {antidotes.map((a) => (
              <li key={a.topic} className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-foreground">
                <strong className="capitalize text-accent">{a.topic}</strong> — try {a.suggestion}.
              </li>
            ))}
          </ul>
        </Lens>
      )}
    </div>
  )
}

function ArticleView({ a }: { a: ReturnType<typeof analyzeArticle> }) {
  return (
    <div className="space-y-5">
      <Bolded text={a.mirror} className="text-base leading-relaxed text-foreground" />

      <div className="grid grid-cols-3 gap-2">
        <Stat n={`${PCT(a.loadedDensity)}%`} label="loaded language" />
        <Stat n={a.sensationalHeadline ? "Clickbait" : "Plain"} label="headline" />
        <Stat n={a.frameLabel.replace(/ frame| \/ balanced framing/g, "").replace("mixed", "Balanced").replace("-leaning", "")} label="framing" />
      </div>

      {a.loadedWords.length > 0 && (
        <Lens title="Loaded words — telling you how to feel">
          <div className="flex flex-wrap gap-1.5">
            {a.loadedWords.slice(0, 14).map((w) => (
              <span key={w} className="px-2.5 py-1 rounded-full font-mono text-[11px] border border-amber-500/28 bg-amber-500/10 text-amber-200">{w}</span>
            ))}
          </div>
        </Lens>
      )}

      {a.entities.filter((e) => Math.abs(e.sentiment) > 0.15).length > 0 && (
        <Lens title="Who's framed how">
          <div className="space-y-1.5">
            {a.entities.filter((e) => Math.abs(e.sentiment) > 0.15).slice(0, 6).map((e) => (
              <div key={e.name} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{e.name}</span>
                <span className={e.sentiment > 0 ? "text-emerald-300" : "text-red-300"}>
                  {e.sentiment > 0 ? "framed favourably" : "framed negatively"}
                </span>
              </div>
            ))}
          </div>
        </Lens>
      )}
    </div>
  )
}

/* — small primitives — */
function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5 text-center">
      <div className="text-lg font-semibold text-foreground leading-tight">{n}</div>
      <div className="mt-0.5 font-mono text-[8px] tracking-[0.12em] uppercase text-muted-foreground">{label}</div>
    </div>
  )
}
function Lens({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[9px] tracking-[0.16em] uppercase text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}
/** Render **bold** markers from the engine's mirror string. */
function Bolded({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="text-accent font-semibold">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </p>
  )
}
