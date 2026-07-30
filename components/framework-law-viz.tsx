"use client"

/**
 * LawViz — one small, self-contained visual per cognitive law, for the /framework
 * pop view. Each is a purpose-built SVG/CSS diagram that shows HOW the law works
 * at a glance (dual-coding aids memory — a picture + the words stick better than
 * either alone). Pure presentation, no state, reduced-motion-safe.
 *
 * Keyed by LawVizKey; unknown/generic keys get a clean before→after panel.
 */

import type { LawVizKey } from "@/lib/framework-data"

const ACCENT = "var(--accent, #e0a34b)"

/** Small labelled frame every viz sits in, so they read consistently. */
function Frame({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="m-0">
      <div className="grid place-items-center rounded-xl border border-border bg-background/50 p-4 min-h-[160px]">
        {children}
      </div>
      <figcaption className="mt-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}

function dots(n: number, cls = "") {
  return Array.from({ length: n }).map((_, i) => (
    <span key={i} className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} style={{ background: ACCENT }} />
  ))
}

export function LawViz({ viz }: { viz?: LawVizKey }) {
  switch (viz) {
    /* ── decision & load ─────────────────────────────────────────────── */
    case "hicks":
      return (
        <Frame caption="2 choices decide fast · 8 choices slow the pick down">
          <div className="w-full space-y-3">
            {[
              { n: 2, t: "quick" },
              { n: 8, t: "slower" },
            ].map((row) => (
              <div key={row.n} className="flex items-center gap-3">
                <span className="w-5 font-mono text-[11px] text-foreground/60 tabular-nums">{row.n}</span>
                <div className="flex flex-wrap gap-1.5">{dots(row.n)}</div>
                <span className="ml-auto font-mono text-[10px] text-accent">{row.t}</span>
              </div>
            ))}
          </div>
        </Frame>
      )
    case "miller":
      return (
        <Frame caption="141559 2653 → chunked, it fits in memory">
          <div className="space-y-3 text-center">
            <div className="font-mono text-lg tracking-[0.2em] text-foreground/40 line-through">141559 2653</div>
            <div className="text-muted-foreground text-xs">becomes</div>
            <div className="flex justify-center gap-2">
              {["141", "559", "2653"].map((c) => (
                <span key={c} className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-sm text-accent">{c}</span>
              ))}
            </div>
          </div>
        </Frame>
      )
    case "cognitive-load":
      return (
        <Frame caption="Same budget — cut the extraneous, keep the task">
          <div className="w-full space-y-2">
            {[
              { label: "task (intrinsic)", w: 45, keep: true },
              { label: "learning (germane)", w: 20, keep: true },
              { label: "UI noise (extraneous)", w: 35, keep: false },
            ].map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-border/40">
                  <div className="h-full rounded-full" style={{ width: `${seg.w}%`, background: seg.keep ? ACCENT : "var(--muted-foreground, #8b8d90)", opacity: seg.keep ? 1 : 0.4 }} />
                </div>
                <span className={`w-32 shrink-0 font-mono text-[10px] ${seg.keep ? "text-foreground/70" : "text-muted-foreground line-through"}`}>{seg.label}</span>
              </div>
            ))}
          </div>
        </Frame>
      )
    case "teslers":
      return (
        <Frame caption="Complexity can't vanish — pull it into the product">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="grid h-16 w-16 place-items-center rounded-xl border-2 border-accent/60 bg-accent/10 font-mono text-[10px] text-accent">system<br/>carries it</div>
            </div>
            <span className="text-2xl text-muted-foreground">←</span>
            <div className="text-center">
              <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-border font-mono text-[10px] text-muted-foreground">user<br/>burden</div>
            </div>
          </div>
        </Frame>
      )

    /* ── interaction & time ──────────────────────────────────────────── */
    case "fitts":
      return (
        <Frame caption="Big & close is a fast hit · small & far is slow">
          <svg viewBox="0 0 220 120" className="w-full max-w-[240px]">
            <circle cx="30" cy="60" r="4" fill={ACCENT} />
            <circle cx="70" cy="45" r="18" fill={ACCENT} opacity="0.85" />
            <text x="70" y="80" textAnchor="middle" className="fill-current text-muted-foreground" fontSize="8" fontFamily="monospace">easy</text>
            <line x1="34" y1="60" x2="52" y2="48" stroke={ACCENT} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
            <circle cx="188" cy="30" r="6" fill={ACCENT} opacity="0.85" />
            <text x="188" y="48" textAnchor="middle" className="fill-current text-muted-foreground" fontSize="8" fontFamily="monospace">hard</text>
            <line x1="34" y1="60" x2="182" y2="32" stroke="var(--muted-foreground,#8b8d90)" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
          </svg>
        </Frame>
      )
    case "doherty":
      return (
        <Frame caption="Under 400 ms keeps the user locked in">
          <div className="w-full">
            <div className="relative h-8 w-full rounded-lg bg-border/40">
              <div className="absolute inset-y-0 left-0 rounded-l-lg bg-accent/70" style={{ width: "40%" }} />
              <div className="absolute inset-y-0" style={{ left: "40%" }}>
                <div className="h-full w-0.5 bg-foreground/60" />
                <span className="absolute top-9 -translate-x-1/2 font-mono text-[10px] text-foreground/70">400 ms</span>
              </div>
              <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-accent">in flow</span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">drifting</span>
            </div>
          </div>
        </Frame>
      )
    case "goal-gradient":
      return (
        <Frame caption="Effort accelerates as the finish line nears">
          <svg viewBox="0 0 220 90" className="w-full max-w-[240px]">
            <path d="M10 80 C 80 78, 140 60, 205 12" fill="none" stroke={ACCENT} strokeWidth="2.5" />
            <circle cx="205" cy="12" r="4" fill={ACCENT} />
            <text x="205" y="30" textAnchor="end" fontSize="8" fontFamily="monospace" className="fill-current text-accent">goal</text>
            <text x="12" y="72" fontSize="8" fontFamily="monospace" className="fill-current text-muted-foreground">start</text>
          </svg>
        </Frame>
      )
    case "response-times":
      return (
        <Frame caption="0.1s feels instant · 1s keeps flow · 10s is the limit">
          <div className="flex w-full items-end justify-around gap-2">
            {[
              { t: "0.1s", h: 30, l: "instant" },
              { t: "1s", h: 55, l: "flow" },
              { t: "10s", h: 90, l: "limit" },
            ].map((b) => (
              <div key={b.t} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: b.h, background: ACCENT, opacity: 0.4 + b.h / 180 }} />
                <span className="font-mono text-[11px] text-foreground/70">{b.t}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{b.l}</span>
              </div>
            ))}
          </div>
        </Frame>
      )

    /* ── memory & attention ──────────────────────────────────────────── */
    case "serial-position":
      return (
        <Frame caption="First & last remembered · the middle fades">
          <svg viewBox="0 0 220 90" className="w-full max-w-[240px]">
            <path d="M10 20 C 60 70, 160 70, 210 20" fill="none" stroke={ACCENT} strokeWidth="2.5" />
            <circle cx="10" cy="20" r="4" fill={ACCENT} />
            <circle cx="210" cy="20" r="4" fill={ACCENT} />
            <circle cx="110" cy="66" r="3.5" fill="var(--muted-foreground,#8b8d90)" />
            <text x="10" y="14" textAnchor="middle" fontSize="8" fontFamily="monospace" className="fill-current text-accent">first</text>
            <text x="210" y="14" textAnchor="middle" fontSize="8" fontFamily="monospace" className="fill-current text-accent">last</text>
            <text x="110" y="82" textAnchor="middle" fontSize="8" fontFamily="monospace" className="fill-current text-muted-foreground">middle</text>
          </svg>
        </Frame>
      )
    case "peak-end":
      return (
        <Frame caption="Memory = the peak + the ending, not the average">
          <svg viewBox="0 0 220 90" className="w-full max-w-[240px]">
            <polyline points="10,60 45,55 80,20 115,58 150,50 190,35" fill="none" stroke={ACCENT} strokeWidth="2.5" />
            <circle cx="80" cy="20" r="4" fill={ACCENT} />
            <text x="80" y="14" textAnchor="middle" fontSize="8" fontFamily="monospace" className="fill-current text-accent">peak</text>
            <circle cx="190" cy="35" r="4" fill={ACCENT} />
            <text x="190" y="29" textAnchor="middle" fontSize="8" fontFamily="monospace" className="fill-current text-accent">end</text>
          </svg>
        </Frame>
      )
    case "zeigarnik":
      return (
        <Frame caption="An open loop keeps tugging until it's closed">
          <div className="w-full max-w-[220px]">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-foreground/70"><span>Profile</span><span className="text-accent">60%</span></div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/40">
              <div className="h-full rounded-full" style={{ width: "60%", background: ACCENT }} />
            </div>
            <ul className="mt-3 space-y-1 font-mono text-[10px]">
              <li className="text-foreground/60">✓ Add name</li>
              <li className="text-foreground/60">✓ Add photo</li>
              <li className="text-accent">○ Add bio — unfinished</li>
            </ul>
          </div>
        </Frame>
      )
    case "von-restorff":
      return (
        <Frame caption="The one that differs is the one that's clicked">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="grid h-9 w-9 place-items-center rounded-lg text-[10px]"
                style={
                  i === 2
                    ? { background: ACCENT, color: "#fff", boxShadow: "0 4px 14px -4px rgba(0,0,0,.4)" }
                    : { border: "1px solid var(--border)", color: "var(--muted-foreground,#8b8d90)" }
                }
              >
                {i === 2 ? "✓" : ""}
              </span>
            ))}
          </div>
        </Frame>
      )
    case "jakobs":
      return (
        <Frame caption="It works like every other site they've used">
          <div className="w-full max-w-[220px] rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-card/60 px-2 py-1.5">
              <span className="font-mono text-[10px] text-foreground/70">◆ Brand</span>
              <span className="flex gap-2 font-mono text-[9px] text-muted-foreground"><span>search</span><span style={{ color: ACCENT }}>cart ▾</span></span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-2">
              {dots(3, "!h-8 !w-full !rounded")}
            </div>
          </div>
        </Frame>
      )
    case "aesthetic":
      return (
        <Frame caption="Polished reads as easier — even before use">
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-dashed border-border p-3 opacity-60">
              <div className="mb-1 h-2 w-16 rounded bg-muted-foreground/40" />
              <div className="h-2 w-10 rounded bg-muted-foreground/30" />
              <div className="mt-2 h-4 w-12 rounded bg-muted-foreground/30" />
            </div>
            <span className="text-muted-foreground">vs</span>
            <div className="rounded-lg border border-accent/40 bg-accent/[0.06] p-3 shadow-[0_8px_24px_-10px_rgba(0,0,0,.4)]">
              <div className="mb-1 h-2 w-16 rounded" style={{ background: ACCENT }} />
              <div className="h-2 w-10 rounded bg-foreground/30" />
              <div className="mt-2 h-4 w-12 rounded" style={{ background: ACCENT }} />
            </div>
          </div>
        </Frame>
      )
    case "postels":
      return (
        <Frame caption="Accept any format in → one clean value out">
          <div className="w-full max-w-[220px] space-y-1.5">
            {["(555) 123-4567", "555.123.4567", "5551234567"].map((v) => (
              <div key={v} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="flex-1 rounded border border-border bg-background/60 px-2 py-1 text-foreground/60">{v}</span>
                <span className="text-muted-foreground">→</span>
                <span className="rounded bg-accent/15 px-2 py-1 text-accent">+1 555 123 4567</span>
              </div>
            ))}
          </div>
        </Frame>
      )
    case "pragnanz":
      return (
        <Frame caption="The eye picks the simplest reading of a form">
          <svg viewBox="0 0 120 90" className="w-40">
            <circle cx="45" cy="45" r="24" fill="none" stroke={ACCENT} strokeWidth="2.5" />
            <rect x="55" y="30" width="30" height="30" fill="none" stroke="var(--muted-foreground,#8b8d90)" strokeWidth="2.5" />
            <text x="60" y="82" textAnchor="middle" fontSize="8" fontFamily="monospace" className="fill-current text-muted-foreground">circle + square, not one odd blob</text>
          </svg>
        </Frame>
      )
    case "selective-attention":
      return (
        <Frame caption="Ad-shaped things in ad-shaped places get skipped">
          <div className="w-full max-w-[220px] space-y-1.5">
            <div className="rounded border border-dashed border-muted-foreground/40 px-2 py-1 text-center font-mono text-[9px] text-muted-foreground/50">advertisement — skipped</div>
            <div className="rounded px-2 py-2 font-mono text-[10px] text-accent" style={{ border: `1px solid ${ACCENT}` }}>◎ key info — seen (in the scan path)</div>
            <div className="h-2 w-3/4 rounded bg-border/50" />
            <div className="h-2 w-2/3 rounded bg-border/50" />
          </div>
        </Frame>
      )

    /* ── gestalt ─────────────────────────────────────────────────────── */
    case "proximity":
      return (
        <Frame caption="Spacing alone splits one field into groups">
          <div className="flex gap-6">
            {[0, 1, 2].map((g) => (
              <div key={g} className="grid grid-cols-2 gap-1">{dots(4)}</div>
            ))}
          </div>
        </Frame>
      )
    case "similarity":
      return (
        <Frame caption="Shared colour reads as one set">
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="h-3 w-3 rounded-full" style={{ background: i % 3 === 0 ? ACCENT : "var(--muted-foreground,#8b8d90)", opacity: i % 3 === 0 ? 1 : 0.4 }} />
            ))}
          </div>
        </Frame>
      )
    case "common-region":
      return (
        <Frame caption="A shared border groups, even over distance">
          <div className="flex items-center gap-3">
            <div className="flex gap-2 rounded-lg border border-accent/50 bg-accent/[0.06] p-3">{dots(2)}</div>
            <div className="flex gap-2">{dots(1)}</div>
          </div>
        </Frame>
      )
    case "closure":
      return (
        <Frame caption="Gaps and all, the mind still sees a circle">
          <svg viewBox="0 0 90 90" className="w-24">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2
              const a2 = a + Math.PI / 8
              return <path key={i} d={`M ${45 + 32 * Math.cos(a)} ${45 + 32 * Math.sin(a)} A 32 32 0 0 1 ${45 + 32 * Math.cos(a2)} ${45 + 32 * Math.sin(a2)}`} fill="none" stroke={ACCENT} strokeWidth="3" />
            })}
          </svg>
        </Frame>
      )
    case "continuity":
      return (
        <Frame caption="The eye follows the aligned line">
          <svg viewBox="0 0 200 60" className="w-full max-w-[220px]">
            <line x1="10" y1="30" x2="190" y2="30" stroke="var(--border)" strokeWidth="1" />
            {[20, 60, 100, 140, 180].map((x) => <circle key={x} cx={x} cy="30" r="5" fill={ACCENT} />)}
          </svg>
        </Frame>
      )
    case "figure-ground":
      return (
        <Frame caption="Contrast + shadow lift the object off the page">
          <div className="relative grid h-24 w-full max-w-[220px] place-items-center rounded-lg bg-border/30">
            <div className="grid h-14 w-32 place-items-center rounded-lg bg-card shadow-[0_12px_30px_-8px_rgba(0,0,0,.5)] border border-border font-mono text-[10px] text-foreground/70">dialog (figure)</div>
          </div>
        </Frame>
      )

    /* ── generic fallback ────────────────────────────────────────────── */
    default:
      return (
        <Frame caption="Before → after: the law applied">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-20 place-items-center rounded-lg border border-dashed border-border font-mono text-[10px] text-muted-foreground">before</div>
            <span className="text-muted-foreground">→</span>
            <div className="grid h-16 w-20 place-items-center rounded-lg border border-accent/50 bg-accent/[0.06] font-mono text-[10px] text-accent">after</div>
          </div>
        </Frame>
      )
  }
}
