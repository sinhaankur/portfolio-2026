"use client"

/**
 * FrameworkGuide — the interactive body of /framework.
 *
 * Renders Ankur's Universal Experience Framework 1.0 (lib/framework-data.ts) in
 * the site's own design language: a sticky section rail (desktop) + the content
 * grouped into the document's three layers — Principles & Laws, System &
 * Standards, Applied. The cognitive laws are the centrepiece.
 *
 * The page practises what it preaches: one dominant heading per section,
 * generous grouping by proximity, ≥40px targets, visible focus, no
 * colour-only meaning, and a reduced-motion-safe reveal.
 */

import { useEffect, useState } from "react"
import { Container } from "@/components/container"
import { HicksDemo } from "@/components/framework-hicks-demo"
import { FittsDemo } from "@/components/framework-fitts-demo"
import { GestaltDemo } from "@/components/framework-gestalt-demo"
import { LawModal, type ModalItem } from "@/components/framework-law-modal"
import {
  PRINCIPLES,
  LAW_GROUPS,
  HEURISTICS,
  PLANES,
  CORE_LOOP,
  METHOD,
  PRE_SHIP,
  POUR,
  CANON,
} from "@/lib/framework-data"

const SECTIONS = [
  { id: "principles", label: "Principles" },
  { id: "laws", label: "Laws of UX" },
  { id: "heuristics", label: "Heuristics" },
  { id: "foundations", label: "Foundations" },
  { id: "accessibility", label: "Accessibility" },
  { id: "method", label: "The method" },
]

function Eyebrow({ no, children }: { no: string; children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-accent mb-4">
      <span className="text-muted-foreground">{no}</span> — {children}
    </p>
  )
}

export function FrameworkGuide() {
  const [active, setActive] = useState<string>("principles")
  // the law or heuristic whose click-through pop view is open (null = closed).
  const [openLaw, setOpenLaw] = useState<ModalItem | null>(null)

  // Scroll-spy: highlight the section rail item currently in view.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="relative">
      <Container>
        <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
          {/* sticky section rail — desktop only */}
          <nav aria-label="Framework sections" className="hidden lg:block">
            <ul className="sticky top-28 space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    data-cursor-hover
                    className={`block rounded-lg px-3 py-2 font-mono text-[11px] tracking-widest uppercase transition-colors ${
                      active === s.id ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="max-w-3xl space-y-24">
            {/* ── LAYER A intro ─────────────────────────────────────────── */}
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Layer A</p>
              <p className="font-sans text-lg text-foreground/70 leading-relaxed">
                The human factors and design principles that never change — the
                tie-breakers behind every decision.
              </p>
            </div>

            {/* ── PRINCIPLES ────────────────────────────────────────────── */}
            <section id="principles" className="scroll-mt-28">
              <Eyebrow no="2.1">The seven principles</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] mb-3">
                When two designs are both plausible, these decide.
              </h2>
              <p className="font-sans text-base text-foreground/70 leading-relaxed mb-8">
                The one that honours more of these wins.
              </p>
              <ol className="space-y-4">
                {PRINCIPLES.map((p, i) => (
                  <li key={p.name} className="rounded-2xl border border-border bg-card/40 p-5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] text-accent tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="font-sans text-base font-medium text-foreground">{p.name}</h3>
                    </div>
                    <p className="mt-1.5 pl-8 font-sans text-sm text-foreground/65 leading-relaxed">{p.what}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* ── LAWS OF UX & COGNITION (centerpiece) ──────────────────── */}
            <section id="laws" className="scroll-mt-28">
              <Eyebrow no="4.0">Laws of UX &amp; Cognition</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] mb-3">
                The <span className="italic">why</span> behind the rules.
              </h2>
              <p className="font-sans text-base text-foreground/70 leading-relaxed mb-10">
                Heuristics tell you what to do; these cognitive laws tell you why
                it works — the human wiring the whole framework is built on.
              </p>

              <div className="space-y-12">
                {LAW_GROUPS.map((g) => (
                  <div key={g.id} id={g.id} className="scroll-mt-28">
                    <div className="flex items-baseline gap-3 mb-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{g.no}</span>
                      <h3 className="font-display text-xl md:text-2xl font-light">{g.title}</h3>
                    </div>
                    <p className="font-sans text-sm text-foreground/60 leading-relaxed mb-5 max-w-2xl">{g.lead}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {g.laws.map((law) => (
                        <button
                          key={law.name}
                          type="button"
                          onClick={() => setOpenLaw(law)}
                          data-cursor-hover
                          aria-haspopup="dialog"
                          className="group rounded-xl border border-border bg-card/40 p-4 text-left transition-colors hover:border-accent/50"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-1.5 w-1.5 rounded-sm bg-accent" />
                            <h4 className="font-sans text-sm font-medium text-foreground">{law.name}</h4>
                            <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 group-hover:text-accent transition-colors">expand →</span>
                          </div>
                          <p className="font-sans text-[13px] text-foreground/65 leading-relaxed">{law.what}</p>
                          {law.mnemonic && (
                            <p className="mt-2 font-sans text-[12px] italic text-accent/90">&ldquo;{law.mnemonic}&rdquo;</p>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Live proofs — you can feel these laws, not just read
                        them. Placed in the group where each law lives. */}
                    {g.id === "decision-load" && (
                      <div className="mt-4">
                        <HicksDemo />
                      </div>
                    )}
                    {g.id === "interaction-time" && (
                      <div className="mt-4">
                        <FittsDemo />
                      </div>
                    )}
                    {g.id === "gestalt" && (
                      <div className="mt-4">
                        <GestaltDemo />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── HEURISTICS ────────────────────────────────────────────── */}
            <section id="heuristics" className="scroll-mt-28">
              <Eyebrow no="5.1">Nielsen's ten heuristics</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] mb-8">
                The evaluation checklist.
              </h2>
              <ul className="divide-y divide-border/60 rounded-2xl border border-border bg-card/40">
                {HEURISTICS.map((h) => (
                  <li key={h.n}>
                    <button
                      type="button"
                      onClick={() => setOpenLaw({ ...h, kind: "heuristic" })}
                      data-cursor-hover
                      aria-haspopup="dialog"
                      className="group flex w-full gap-4 p-4 text-left transition-colors hover:bg-secondary/40"
                    >
                      <span className="font-mono text-[11px] text-accent tabular-nums shrink-0 mt-0.5">{String(h.n).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-sans text-sm font-medium text-foreground">{h.name}</h3>
                          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 group-hover:text-accent transition-colors shrink-0">expand →</span>
                        </div>
                        <p className="mt-0.5 font-sans text-[13px] text-foreground/60 leading-relaxed">{h.what}</p>
                        <p className="mt-1 font-sans text-[12px] italic text-accent/80">&ldquo;{h.mnemonic}&rdquo;</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── FOUNDATIONS ───────────────────────────────────────────── */}
            <section id="foundations" className="scroll-mt-28">
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Layer A · foundations</p>
              <Eyebrow no="3.1">The five planes</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] mb-3">
                Experience is built bottom-up.
              </h2>
              <p className="font-sans text-base text-foreground/70 leading-relaxed mb-8">
                Abstract to concrete (after Garrett). Decisions on a lower plane
                constrain everything above — so mistakes at the bottom cost most.
              </p>
              <ol className="space-y-3 mb-12">
                {PLANES.map((pl) => (
                  <li key={pl.n} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] text-accent tabular-nums">{pl.n}</span>
                      <h3 className="font-sans text-sm font-medium text-foreground">{pl.name}</h3>
                      <span className="font-sans text-[13px] text-foreground/50 italic">{pl.q}</span>
                    </div>
                    <p className="mt-1 pl-7 font-sans text-[13px] text-foreground/60 leading-relaxed">{pl.lives}</p>
                  </li>
                ))}
              </ol>

              <Eyebrow no="2.2">The core loop</Eyebrow>
              <p className="font-sans text-base text-foreground/70 leading-relaxed mb-6">
                Before designing screens, define the loop the product exists to
                power. Every mock should visibly move a user forward in it.
              </p>
              <div className="flex flex-wrap gap-2">
                {CORE_LOOP.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-2">
                    <div className="rounded-xl border border-border bg-card/40 px-4 py-3 text-center min-w-[7rem]">
                      <div className="font-mono text-[10px] text-accent">{s.n}</div>
                      <div className="font-sans text-sm font-medium text-foreground mt-0.5">{s.name}</div>
                      <div className="font-sans text-[11px] text-foreground/50 mt-0.5">{s.note}</div>
                    </div>
                    {i < CORE_LOOP.length - 1 && <span className="text-muted-foreground" aria-hidden>→</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* ── ACCESSIBILITY ─────────────────────────────────────────── */}
            <section id="accessibility" className="scroll-mt-28">
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Layer B</p>
              <Eyebrow no="11.1">POUR &amp; WCAG 2.2 AA</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] mb-3">
                AA is the floor, not a feature.
              </h2>
              <p className="font-sans text-base text-foreground/70 leading-relaxed mb-8">
                Four principles organise every requirement — and accessible design
                helps everyone (the curb-cut effect).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {POUR.map((p) => (
                  <div key={p.name} className="rounded-xl border border-border bg-card/40 p-4">
                    <h3 className="font-sans text-sm font-medium text-foreground mb-1.5">{p.name}</h3>
                    <p className="font-sans text-[13px] text-foreground/65 leading-relaxed">{p.what}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── THE METHOD ────────────────────────────────────────────── */}
            <section id="method" className="scroll-mt-28">
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">Layer C</p>
              <Eyebrow no="13.1">A working method for mocks</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] mb-8">
                Run it on every screen.
              </h2>
              <ol className="space-y-3 mb-12">
                {METHOD.map((m) => (
                  <li key={m.n} className="flex gap-4 rounded-xl border border-border bg-card/40 p-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 font-mono text-[12px] text-accent tabular-nums">{m.n}</span>
                    <div>
                      <h3 className="font-sans text-sm font-medium text-foreground">{m.step}</h3>
                      <p className="mt-0.5 font-sans text-[13px] text-foreground/60 leading-relaxed">{m.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-2xl border border-accent/30 bg-accent/[0.05] p-6">
                <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent mb-4">Pre-ship checklist</h3>
                <ul className="space-y-2">
                  {PRE_SHIP.map((c) => (
                    <li key={c} className="flex gap-2.5 font-sans text-sm text-foreground/75">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ── THE CANON ─────────────────────────────────────────────── */}
            <section className="scroll-mt-28">
              <Eyebrow no="A.1">The canon</Eyebrow>
              <p className="font-sans text-base text-foreground/70 leading-relaxed mb-5">
                The shoulders this stands on. Structure after the Citi GS+DT
                Universal Experience Framework (2013), assembled as a personal
                working guide and expanded with the contemporary UX canon.
              </p>
              <ul className="flex flex-wrap gap-2">
                {CANON.map((c) => (
                  <li key={c} className="rounded-full border border-border bg-card/40 px-3 py-1.5 font-mono text-[11px] text-foreground/70">
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </Container>

      {/* Click-through pop view for a law — clarity + memorability. */}
      {openLaw && <LawModal law={openLaw} onClose={() => setOpenLaw(null)} />}
    </div>
  )
}
