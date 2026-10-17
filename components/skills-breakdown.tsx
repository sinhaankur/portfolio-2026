"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

/* =========================================================================
   SKILLS — a gallery, not a resume.

   Proof-first content (no self-scored stars / meters / "years" dots — those
   are theatre), dressed as a dark exhibition in the spirit of the Warhol-Arts
   concept: a pure-black room, warm-cream type, ONE hot burnt-orange accent,
   enormous display headline, technical filing notation (00_1), each discipline
   an "exhibit". Every skill earns its wall space by pointing at REAL work you
   can open. "Don't rate yourself. Show the receipts."

   This page runs its own fixed dark palette regardless of site theme — it's a
   room you step into, like a gallery.
========================================================================= */

type Proof = {
  label: string
  href: string
  kind: "case" | "live"
}

type MotifKey =
  | "strategy"
  | "product"
  | "framework"
  | "ia"
  | "interaction"
  | "system"
  | "usability"
  | "frontend"
  | "graphics"
  | "ai"
  | "math"
  | "facilitation"
  | "research"
  | "inclusive"

type Skill = {
  name: string
  what: string
  /** A crafted visual tile themed to what this skill actually produces —
   *  rendered in the gallery's own ink + accent, so every card SHOWS, not
   *  just tells. (Enterprise work is NDA-bound; honest motifs beat logos.) */
  motif: MotifKey
  proof: Proof[]
}

type Discipline = {
  id: string
  title: string
  line: string
  skills: Skill[]
}

// Every proof href is a real route (app/works/*, app/lab/*, /usability,
// /framework, /library, /math, /llm). Nothing links to work that doesn't exist.
const DISCIPLINES: Discipline[] = [
  {
    id: "strategy",
    title: "Strategy & product",
    line: "Deciding what to build, for whom, under real constraints.",
    skills: [
      {
        name: "Enterprise UX strategy",
        what: "Shaping console-level flows for high-complexity systems where a wrong default costs real money.",
        motif: "strategy",
        proof: [
          { label: "Oracle — database console", href: "/works/oracle", kind: "case" },
          { label: "Deloitte — enterprise platform", href: "/works/deloitte", kind: "case" },
        ],
      },
      {
        name: "Product thinking",
        what: "Weighing user value against platform constraints to decide what ships — and what waits.",
        motif: "product",
        proof: [
          { label: "Oracle case study", href: "/works/oracle", kind: "case" },
          { label: "The Lab — shipped solo", href: "/lab", kind: "live" },
        ],
      },
      {
        name: "Framework thinking",
        what: "Turning scattered UX intuition into a teachable system — laws of cognition you can apply.",
        motif: "framework",
        proof: [{ label: "The Universal Experience Framework", href: "/framework", kind: "live" }],
      },
    ],
  },
  {
    id: "ux-core",
    title: "UX craft",
    line: "The core moves — structure, interaction, the states nobody else designs.",
    skills: [
      {
        name: "Information architecture",
        what: "Restructuring dense navigation so people find things — measured by task success, not taste.",
        motif: "ia",
        proof: [
          { label: "Oracle — restructured DBaaS", href: "/works/oracle", kind: "case" },
          { label: "Snowtint", href: "/works/snowtint", kind: "case" },
        ],
      },
      {
        name: "Interaction design",
        what: "Designing the edge states — progressive disclosure, empty states, safer destructive actions.",
        motif: "interaction",
        proof: [
          { label: "Rage — interaction patterns", href: "/works/rage", kind: "case" },
          { label: "Oracle", href: "/works/oracle", kind: "case" },
        ],
      },
      {
        name: "Design systems",
        what: "Reusable patterns so a hundred screens stay consistent without a hundred decisions.",
        motif: "system",
        proof: [
          { label: "Oracle — RDS / HgDS", href: "/works/oracle", kind: "case" },
          { label: "My craft library", href: "/library", kind: "live" },
        ],
      },
      {
        name: "Usability engineering",
        what: "Making usability checkable — a framework and a live engine, not a gut-feel checklist.",
        motif: "usability",
        proof: [
          { label: "The Usability Engine — open it", href: "/usability", kind: "live" },
          { label: "Why it's built this way", href: "/lab/usability-engine", kind: "case" },
        ],
      },
    ],
  },
  {
    id: "build",
    title: "Build",
    line: "A designer who writes the real thing — not a mockup of it.",
    skills: [
      {
        name: "Front-end engineering",
        what: "Shipping production React / WebGL — this whole site, and a live galaxy in your browser.",
        motif: "frontend",
        proof: [
          { label: "The Universe Engine — live", href: "/lab/celestial", kind: "live" },
          { label: "Unhosted — open-source flagship", href: "/lab/unhosted", kind: "case" },
        ],
      },
      {
        name: "Real-time 3D / graphics",
        what: "Pure-GLSL worlds built from real NASA/JPL data — stars rendered from their measured physics.",
        motif: "graphics",
        proof: [
          { label: "The galaxy, from real data", href: "/lab/celestial", kind: "live" },
          { label: "Real planetary terrain", href: "/lab/terrain", kind: "live" },
        ],
      },
      {
        name: "On-device AI",
        what: "Keyless, in-browser models — a copilot that runs on your machine, not someone's server.",
        motif: "ai",
        proof: [
          { label: "The on-device copilot", href: "/lab/celestial", kind: "live" },
          { label: "Cognitive Twin — local-first AI", href: "/lab/cognitive-twin", kind: "live" },
        ],
      },
      {
        name: "Teaching the math, visibly",
        what: "The real equations behind the work, made interactive — e^{iπ}, Fourier, π, how an LLM works.",
        motif: "math",
        proof: [
          { label: "Mathematics, made visible", href: "/math", kind: "live" },
          { label: "How a language model works", href: "/llm", kind: "live" },
        ],
      },
    ],
  },
  {
    id: "people",
    title: "People & quality",
    line: "The work around the work — alignment, inclusion, research.",
    skills: [
      {
        name: "Stakeholder facilitation",
        what: "Getting product, engineering and business to one decision inside brutal timelines.",
        motif: "facilitation",
        proof: [
          { label: "Oracle", href: "/works/oracle", kind: "case" },
          { label: "Deloitte", href: "/works/deloitte", kind: "case" },
        ],
      },
      {
        name: "Research & usability testing",
        what: "Running the sessions, then pruning the friction they revealed — completion rate as the scoreboard.",
        motif: "research",
        proof: [
          { label: "Deloitte", href: "/works/deloitte", kind: "case" },
          { label: "Rage", href: "/works/rage", kind: "case" },
        ],
      },
      {
        name: "Inclusive design",
        what: "Accessible structure, contrast and plain language — so the system excludes fewer people by default.",
        motif: "inclusive",
        proof: [
          { label: "Oracle — accessible console", href: "/works/oracle", kind: "case" },
          { label: "The framework's cognition laws", href: "/framework", kind: "live" },
        ],
      },
    ],
  },
]

const ALL_SKILLS = DISCIPLINES.flatMap((d) => d.skills)
const ALL_PROJECTS = Array.from(
  new Set(ALL_SKILLS.flatMap((s) => s.proof.map((p) => projectName(p.href)))),
)
  .filter(Boolean)
  .sort() as string[]

function projectName(href: string): string {
  if (href.startsWith("/works/")) {
    const slug = href.split("/")[2]
    return slug.charAt(0).toUpperCase() + slug.slice(1)
  }
  if (
    href.startsWith("/lab") ||
    ["/framework", "/usability", "/library", "/math", "/llm"].some((p) => href.startsWith(p))
  )
    return "The Lab"
  return ""
}

const EASE = [0.16, 1, 0.3, 1] as const

// The gallery palette — fixed, theme-independent (you step into the room).
const INK = "#000000"
const CREAM = "#ffe5d5"
const ACCENT = "#fb4e2b"
const MUTE = "#8a7a70"

export function SkillsBreakdown() {
  const reduce = useReducedMotion()
  const [discipline, setDiscipline] = useState<string | "All">("All")
  const [project, setProject] = useState<string>("All")
  const [open, setOpen] = useState<string | null>(null)

  const shown = useMemo(() => {
    return DISCIPLINES.map((d) => ({
      ...d,
      skills: d.skills.filter((s) => {
        if (project !== "All" && !s.proof.some((p) => projectName(p.href) === project)) return false
        return true
      }),
    })).filter((d) => (discipline === "All" || d.id === discipline) && d.skills.length > 0)
  }, [discipline, project])

  const shownCount = shown.reduce((n, d) => n + d.skills.length, 0)
  const filtersActive = discipline !== "All" || project !== "All"

  return (
    <section
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: INK, color: CREAM }}
    >
      {/* Deconstructed-grid motif — faint cream hairlines + a few hot-accent
          tiles drifting behind the content, echoing Warhol's mosaic reveal. */}
      <GridMotif reduce={!!reduce} />

      {/* Edge filing notation — the "00_1" gallery chrome. */}
      <div
        className="pointer-events-none absolute left-4 top-28 z-10 hidden select-none font-mono text-[10px] tracking-[0.3em] md:block"
        style={{ color: MUTE, writingMode: "vertical-rl" }}
      >
        00_SKILLS · SHOWN NOT SCORED
      </div>
      <div
        className="pointer-events-none absolute right-4 top-28 z-10 hidden select-none font-mono text-[10px] tracking-[0.3em] md:block"
        style={{ color: MUTE, writingMode: "vertical-rl" }}
      >
        AnkurSinha · {new Date().getFullYear()}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-28 md:px-12 md:py-36">
        {/* MASSIVE display headline — the gallery nameplate. */}
        <motion.header
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-16 md:mb-24"
        >
          <p className="mb-6 font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>
            EXHIBIT · THE WORK THAT EARNED IT
          </p>
          <h1
            className="font-display font-light leading-[0.86] tracking-[-0.03em]"
            style={{ fontSize: "clamp(3.2rem, 13vw, 11rem)" }}
          >
            SKILLS
          </h1>
          <p className="mt-8 max-w-2xl font-sans text-lg leading-relaxed md:text-xl" style={{ color: CREAM }}>
            I won&apos;t <span className="italic" style={{ color: ACCENT }}>rate</span> myself —
            no stars, no &ldquo;9/10&rdquo;, no bar charts. Every skill here is a
            wall label pointing at real work you can open: a shipped case study,
            or a live thing running right now. <span style={{ color: MUTE }}>Tap one to see the proof.</span>
          </p>
        </motion.header>

        {/* Filter rail — technical chips */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
          className="mb-16 flex flex-wrap items-center gap-2.5 border-y py-5"
          style={{ borderColor: "rgba(255,229,213,0.12)" }}
        >
          <GChip active={discipline === "All" && project === "All"} onClick={() => { setDiscipline("All"); setProject("All") }}>
            ALL
          </GChip>
          {DISCIPLINES.map((d, i) => (
            <GChip key={d.id} active={discipline === d.id} onClick={() => setDiscipline(discipline === d.id ? "All" : d.id)}>
              {String(i + 1).padStart(2, "0")} · {d.title}
            </GChip>
          ))}
          <span aria-hidden className="mx-1 h-4 w-px" style={{ backgroundColor: "rgba(255,229,213,0.18)" }} />
          {ALL_PROJECTS.map((p) => (
            <GChip key={p} active={project === p} onClick={() => setProject(project === p ? "All" : p)} tone="project">
              {p}
            </GChip>
          ))}
          {filtersActive && (
            <span className="ml-auto font-mono text-[11px] tracking-wider" style={{ color: MUTE }}>
              {shownCount} ON VIEW
            </span>
          )}
        </motion.div>

        {/* Exhibits */}
        {shown.length === 0 ? (
          <p
            className="rounded-md border border-dashed py-12 text-center font-mono text-sm"
            style={{ borderColor: "rgba(255,229,213,0.2)", color: MUTE }}
          >
            Nothing matches that filter.
          </p>
        ) : (
          <div className="space-y-20 md:space-y-28">
            {shown.map((d, di) => (
              <motion.section
                key={d.id}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: reduce ? 0 : di * 0.04, ease: EASE }}
                aria-labelledby={`disc-${d.id}`}
              >
                {/* Exhibit header — big index number + title */}
                <header className="mb-8 flex items-end gap-5 md:gap-8">
                  <span
                    className="font-display font-light leading-none tracking-tight"
                    style={{ fontSize: "clamp(2.2rem, 7vw, 5rem)", color: ACCENT }}
                  >
                    {String(DISCIPLINES.findIndex((x) => x.id === d.id) + 1).padStart(2, "0")}
                  </span>
                  <div className="pb-1 md:pb-2">
                    <h2 id={`disc-${d.id}`} className="font-display text-2xl font-light tracking-tight md:text-4xl">
                      {d.title}
                    </h2>
                    <p className="mt-1 font-sans text-sm md:text-base" style={{ color: MUTE }}>
                      {d.line}
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-px md:grid-cols-2" style={{ backgroundColor: "rgba(255,229,213,0.1)" }}>
                  {d.skills.map((s) => (
                    <GProofCard
                      key={s.name}
                      skill={s}
                      open={open === s.name}
                      onToggle={() => setOpen(open === s.name ? null : s.name)}
                      reduce={!!reduce}
                    />
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        )}

        {/* Footer line */}
        <p className="mt-24 max-w-2xl font-mono text-[11px] leading-relaxed tracking-wider" style={{ color: MUTE }}>
          IF A SKILL ISN&apos;T ON THIS WALL, IT&apos;S BECAUSE I COULDN&apos;T POINT YOU AT
          SOMETHING REAL THAT PROVES IT. THAT&apos;S THE ONLY BAR.
        </p>
      </div>
    </section>
  )
}

/* The faint deconstructed grid + a few drifting accent tiles. */
function GridMotif({ reduce }: { reduce: boolean }) {
  // Fixed decorative tiles — positions chosen to echo the mosaic reveal.
  const tiles = [
    { left: "12%", top: "18%", size: 46, delay: 0 },
    { left: "78%", top: "30%", size: 64, delay: 0.4 },
    { left: "60%", top: "62%", size: 38, delay: 0.8 },
    { left: "22%", top: "72%", size: 54, delay: 1.2 },
    { left: "88%", top: "80%", size: 30, delay: 0.6 },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* hairline grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffe5d5 1px, transparent 1px), linear-gradient(to bottom, #ffe5d5 1px, transparent 1px)",
          backgroundSize: "clamp(60px, 8vw, 120px) clamp(60px, 8vw, 120px)",
        }}
      />
      {/* drifting accent tiles */}
      {tiles.map((t, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ left: t.left, top: t.top, width: t.size, height: t.size, backgroundColor: ACCENT, opacity: 0.12 }}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={
            reduce
              ? { opacity: 0.12 }
              : { opacity: [0.06, 0.16, 0.06], y: [0, -12, 0] }
          }
          transition={{ duration: 9 + i * 1.5, repeat: Infinity, ease: "easeInOut", delay: t.delay }}
        />
      ))}
    </div>
  )
}

function GChip({
  children,
  active,
  onClick,
  tone = "discipline",
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  tone?: "discipline" | "project"
}) {
  return (
    <button
      onClick={onClick}
      data-cursor-hover
      className="rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-wider transition-colors duration-200 focus-visible:outline-none"
      style={{
        backgroundColor: active ? CREAM : "transparent",
        color: active ? INK : tone === "project" ? MUTE : CREAM,
        borderColor: active ? CREAM : "rgba(255,229,213,0.22)",
      }}
    >
      {children}
    </button>
  )
}

function GProofCard({
  skill,
  open,
  onToggle,
  reduce,
}: {
  skill: Skill
  open: boolean
  onToggle: () => void
  reduce: boolean
}) {
  const primary = skill.proof[0]
  const extra = skill.proof.slice(1)
  return (
    <div
      className="group relative flex flex-col transition-colors duration-300"
      style={{ backgroundColor: open ? "rgba(251,78,43,0.05)" : INK }}
    >
      {/* Visual tile — the work SHOWS. A crafted motif in the gallery palette. */}
      <div className="relative h-36 overflow-hidden border-b md:h-44" style={{ borderColor: "rgba(255,229,213,0.1)" }}>
        <SkillMotif motif={skill.motif} reduce={reduce} />
        {/* ink vignette so the title below sits on solid ground */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.65))" }}
        />
        {/* primary-proof kind tag, top-left on the tile */}
        <span
          className="absolute left-4 top-4 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
          style={
            primary.kind === "live"
              ? { backgroundColor: ACCENT, color: "#000" }
              : { backgroundColor: "rgba(255,229,213,0.9)", color: "#000" }
          }
        >
          {primary.kind === "live" ? "live" : "case"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-7">
        <h3 className="font-display text-xl font-light leading-snug tracking-tight md:text-2xl">
          {skill.name}
        </h3>
        <p className="mt-2 font-sans text-sm leading-relaxed md:text-[15px]" style={{ color: "rgba(255,229,213,0.62)" }}>
          {skill.what}
        </p>

        {/* Primary proof — always visible, the headline receipt. */}
        <Link
          href={primary.href}
          data-cursor-hover
          className="group/link mt-5 flex items-center gap-2 font-sans text-sm font-medium transition-colors"
          style={{ color: CREAM }}
        >
          <span className="underline-offset-4 group-hover/link:underline">{primary.label}</span>
          <span
            aria-hidden
            className="transition-transform duration-200 group-hover/link:translate-x-0.5"
            style={{ color: ACCENT }}
          >
            ↗
          </span>
        </Link>

        {/* More receipts — collapsed, revealed on toggle. */}
        {extra.length > 0 && (
          <>
            <button
              onClick={onToggle}
              data-cursor-hover
              aria-expanded={open}
              className="mt-3 flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-[0.2em] transition-colors focus-visible:outline-none"
              style={{ color: open ? ACCENT : MUTE }}
            >
              {open ? "fewer" : `+${extra.length} more proof`}
              <span aria-hidden className="transition-transform duration-300" style={{ transform: open ? "rotate(90deg)" : "none" }}>
                →
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="proof"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex flex-col gap-2.5">
                    {extra.map((p) => (
                      <Link
                        key={p.href + p.label}
                        href={p.href}
                        data-cursor-hover
                        className="group/link flex items-center gap-2.5 font-sans text-sm transition-colors"
                        style={{ color: "rgba(255,229,213,0.88)" }}
                      >
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                          style={
                            p.kind === "live"
                              ? { backgroundColor: "rgba(251,78,43,0.2)", color: ACCENT }
                              : { backgroundColor: "rgba(255,229,213,0.12)", color: "rgba(255,229,213,0.6)" }
                          }
                        >
                          {p.kind === "live" ? "live" : "case"}
                        </span>
                        <span className="underline-offset-4 group-hover/link:underline">{p.label}</span>
                        <span aria-hidden style={{ color: MUTE }} className="transition-transform duration-200 group-hover/link:translate-x-0.5">
                          ↗
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   SKILL MOTIFS — one crafted visual tile per skill, drawn in the gallery's
   ink + hot-orange so each card SHOWS what the skill produces. Pure SVG/CSS,
   theme-independent, reduced-motion-safe (the few animated ones go still).
   These are honest signposts, not fake screenshots.
========================================================================= */

function SkillMotif({ motif, reduce }: { motif: MotifKey; reduce: boolean }) {
  const A = ACCENT
  const C = "rgba(255,229,213,0.9)"
  const Cd = "rgba(255,229,213,0.3)"
  const Cf = "rgba(255,229,213,0.12)"
  const base = "absolute inset-0 h-full w-full"

  switch (motif) {
    case "strategy":
      // decision tree narrowing to one shipped node
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g stroke={Cd} strokeWidth="1" fill="none">
            <path d="M30 20 H90 M30 50 H90 M30 80 H90 M30 100 H90" />
            <path d="M90 20 Q120 60 150 60 M90 50 Q120 60 150 60 M90 80 Q120 60 150 60 M90 100 Q120 60 150 60" />
          </g>
          {[20, 50, 80, 100].map((y) => <circle key={y} cx="30" cy={y} r="3" fill={Cd} />)}
          <circle cx="150" cy="60" r="8" fill={A} />
          <circle cx="150" cy="60" r="14" fill="none" stroke={A} strokeWidth="1" opacity="0.4" />
        </svg>
      )
    case "product":
      // value vs constraint — two axes, a chosen point
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g stroke={Cf} strokeWidth="1">
            {[30, 60, 90].map((y) => <line key={y} x1="20" y1={y} x2="180" y2={y} />)}
            {[60, 100, 140].map((x) => <line key={x} x1={x} y1="15" x2={x} y2="105" />)}
          </g>
          <path d="M30 95 Q90 95 100 55 Q110 25 170 25" fill="none" stroke={C} strokeWidth="1.5" opacity="0.6" />
          <circle cx="100" cy="55" r="7" fill={A} />
        </svg>
      )
    case "framework":
      // laws as a connected lattice
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g stroke={Cd} strokeWidth="1">
            <path d="M50 30 L100 60 L150 30 M50 90 L100 60 L150 90 M100 60 L100 25 M100 60 L100 95" fill="none" />
          </g>
          {[[50,30],[150,30],[50,90],[150,90],[100,25],[100,95]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r="3.5" fill={C} opacity="0.7" />
          ))}
          <circle cx="100" cy="60" r="8" fill={A} />
        </svg>
      )
    case "ia":
      // nested structure → clear hierarchy
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g fill="none" stroke={Cd} strokeWidth="1">
            <rect x="24" y="22" width="152" height="18" />
            <rect x="40" y="52" width="60" height="14" />
            <rect x="110" y="52" width="66" height="14" />
            <rect x="56" y="80" width="40" height="12" />
            <rect x="126" y="80" width="40" height="12" />
          </g>
          <rect x="24" y="22" width="40" height="18" fill={A} opacity="0.85" />
        </svg>
      )
    case "interaction":
      // state machine: default → hover → active → disabled
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g fill="none" stroke={Cd} strokeWidth="1">
            <path d="M48 60 H78 M118 60 H148" markerEnd="" />
          </g>
          {[[40,"rest",Cf],[90,"on",A],[160,"off",Cf]].map(([x,,fill],i)=>(
            <g key={i}>
              <rect x={(x as number)-16} y="46" width="32" height="28" rx="4" fill={fill as string} stroke={Cd} strokeWidth="1" />
            </g>
          ))}
          <path d="M66 60 l-6 -3 v6 z M136 60 l-6 -3 v6 z" fill={Cd} />
        </svg>
      )
    case "system":
      // a grid of reusable tokens, one lit
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          {Array.from({length:4}).map((_,r)=>Array.from({length:6}).map((_,c)=>{
            const lit = r===1 && c===3
            return <rect key={`${r}-${c}`} x={24+c*26} y={18+r*24} width="18" height="16" rx="2"
              fill={lit?A:Cf} stroke={Cd} strokeWidth="1" />
          }))}
        </svg>
      )
    case "usability":
      // a checklist with a measured pass
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          {[28,50,72,94].map((y,i)=>(
            <g key={y}>
              <rect x="30" y={y-7} width="14" height="14" rx="3" fill={i<3?A:"none"} stroke={Cd} strokeWidth="1" />
              {i<3 && <path d={`M33 ${y} l3 3 l5 -6`} stroke="#000" strokeWidth="1.5" fill="none" />}
              <line x1="54" y1={y} x2={54+ (i<3?110:70)} y2={y} stroke={Cd} strokeWidth="2" opacity="0.5" />
            </g>
          ))}
        </svg>
      )
    case "frontend":
      // code brackets → rendered frame
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <text x="26" y="70" fontFamily="monospace" fontSize="44" fill={Cd}>&lt;/&gt;</text>
          <rect x="112" y="34" width="62" height="52" rx="4" fill="none" stroke={C} strokeWidth="1.5" opacity="0.7" />
          <line x1="112" y1="48" x2="174" y2="48" stroke={Cd} strokeWidth="1" />
          <circle cx="119" cy="41" r="2" fill={A} />
        </svg>
      )
    case "graphics":
      // a mini spiral galaxy
      return <GalaxyMotif reduce={reduce} />
    case "ai":
      // a small neural net
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g stroke={Cf} strokeWidth="1">
            {[32,60,88].map(y1=>[50,70].map(y2=>(<line key={`${y1}-${y2}`} x1="50" y1={y1} x2="100" y2={y2} />)))}
            {[50,70].map(y1=>[46,74].map(y2=>(<line key={`b${y1}-${y2}`} x1="100" y1={y1} x2="150" y2={y2} />)))}
          </g>
          {[32,60,88].map(y=><circle key={`i${y}`} cx="50" cy={y} r="4" fill={Cd} />)}
          {[50,70].map(y=><circle key={`h${y}`} cx="100" cy={y} r="5" fill={A} />)}
          {[46,74].map(y=><circle key={`o${y}`} cx="150" cy={y} r="4" fill={C} />)}
        </svg>
      )
    case "math":
      // epicycles → wave (Fourier)
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <circle cx="54" cy="60" r="26" fill="none" stroke={Cd} strokeWidth="1" />
          <circle cx="72" cy="42" r="12" fill="none" stroke={Cd} strokeWidth="1" />
          <line x1="54" y1="60" x2="72" y2="42" stroke={C} strokeWidth="1" />
          <line x1="72" y1="42" x2="82" y2="36" stroke={A} strokeWidth="1.5" />
          <path d="M82 36 q20 -18 40 24 t40 0" fill="none" stroke={A} strokeWidth="1.5" />
          <circle cx="82" cy="36" r="3" fill={A} />
        </svg>
      )
    case "facilitation":
      // three parties converging on one point
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g stroke={Cd} strokeWidth="1">
            <line x1="36" y1="30" x2="100" y2="60" />
            <line x1="36" y1="90" x2="100" y2="60" />
            <line x1="170" y1="60" x2="100" y2="60" />
          </g>
          <circle cx="36" cy="30" r="9" fill="none" stroke={C} strokeWidth="1.5" />
          <circle cx="36" cy="90" r="9" fill="none" stroke={C} strokeWidth="1.5" />
          <circle cx="170" cy="60" r="9" fill="none" stroke={C} strokeWidth="1.5" />
          <circle cx="100" cy="60" r="8" fill={A} />
        </svg>
      )
    case "research":
      // a bar chart climbing (completion rate)
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <line x1="28" y1="100" x2="176" y2="100" stroke={Cd} strokeWidth="1" />
          {[[44,40],[78,55],[112,30],[146,18]].map(([x,h],i)=>(
            <rect key={x} x={x} y={100-h} width="22" height={h} fill={i===3?A:Cf} stroke={Cd} strokeWidth="1" />
          ))}
          <path d="M55 60 L89 45 L123 70 L157 27" fill="none" stroke={C} strokeWidth="1.5" opacity="0.6" />
        </svg>
      )
    case "inclusive":
      // high-contrast type + focus ring
      return (
        <svg viewBox="0 0 200 120" className={base} preserveAspectRatio="xMidYMid slice" aria-hidden>
          <text x="30" y="74" fontFamily="serif" fontSize="52" fill={C}>Aa</text>
          <rect x="22" y="34" width="86" height="56" rx="6" fill="none" stroke={A} strokeWidth="2" strokeDasharray="4 4" />
          <g stroke={Cd} strokeWidth="2">
            <line x1="128" y1="48" x2="176" y2="48" />
            <line x1="128" y1="62" x2="176" y2="62" />
            <line x1="128" y1="76" x2="158" y2="76" />
          </g>
        </svg>
      )
    default:
      return <div className={base} style={{ background: "rgba(255,229,213,0.03)" }} />
  }
}

/* A tiny procedural spiral galaxy for the graphics card — the one live thing
   the engine actually renders, evoked honestly in a few dozen dots. */
function GalaxyMotif({ reduce }: { reduce: boolean }) {
  const dots = useMemo(() => {
    const out: { x: number; y: number; r: number; hot: boolean }[] = []
    const arms = 2
    for (let i = 0; i < 90; i++) {
      const t = i / 90
      const arm = i % arms
      const r = t * 52
      const ang = r * 0.14 + (arm * Math.PI) + (Math.random() - 0.5) * 0.5
      out.push({
        x: 100 + Math.cos(ang) * r + (Math.random() - 0.5) * 6,
        y: 60 + Math.sin(ang) * r * 0.6 + (Math.random() - 0.5) * 4,
        r: Math.random() < 0.12 ? 1.6 : 0.9,
        hot: Math.random() < 0.14,
      })
    }
    return out
  }, [])
  return (
    <motion.svg
      viewBox="0 0 200 120"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      initial={false}
      animate={reduce ? {} : { rotate: 360 }}
      transition={reduce ? undefined : { duration: 140, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "100px 60px" }}
    >
      <circle cx="100" cy="60" r="10" fill={ACCENT} opacity="0.5" />
      <circle cx="100" cy="60" r="4" fill="#fff" opacity="0.85" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.hot ? ACCENT : "rgba(255,229,213,0.85)"} />
      ))}
    </motion.svg>
  )
}
