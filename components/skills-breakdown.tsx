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

type Skill = {
  name: string
  what: string
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
        proof: [
          { label: "Oracle — database console", href: "/works/oracle", kind: "case" },
          { label: "Deloitte — enterprise platform", href: "/works/deloitte", kind: "case" },
        ],
      },
      {
        name: "Product thinking",
        what: "Weighing user value against platform constraints to decide what ships — and what waits.",
        proof: [
          { label: "Oracle case study", href: "/works/oracle", kind: "case" },
          { label: "The Lab — shipped solo", href: "/lab", kind: "live" },
        ],
      },
      {
        name: "Framework thinking",
        what: "Turning scattered UX intuition into a teachable system — laws of cognition you can apply.",
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
        proof: [
          { label: "Oracle — restructured DBaaS", href: "/works/oracle", kind: "case" },
          { label: "Snowtint", href: "/works/snowtint", kind: "case" },
        ],
      },
      {
        name: "Interaction design",
        what: "Designing the edge states — progressive disclosure, empty states, safer destructive actions.",
        proof: [
          { label: "Rage — interaction patterns", href: "/works/rage", kind: "case" },
          { label: "Oracle", href: "/works/oracle", kind: "case" },
        ],
      },
      {
        name: "Design systems",
        what: "Reusable patterns so a hundred screens stay consistent without a hundred decisions.",
        proof: [
          { label: "Oracle — RDS / HgDS", href: "/works/oracle", kind: "case" },
          { label: "My craft library", href: "/library", kind: "live" },
        ],
      },
      {
        name: "Usability engineering",
        what: "Making usability checkable — a framework and a live engine, not a gut-feel checklist.",
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
        proof: [
          { label: "The Universe Engine — live", href: "/lab/celestial", kind: "live" },
          { label: "Unhosted — open-source flagship", href: "/lab/unhosted", kind: "case" },
        ],
      },
      {
        name: "Real-time 3D / graphics",
        what: "Pure-GLSL worlds built from real NASA/JPL data — stars rendered from their measured physics.",
        proof: [
          { label: "The galaxy, from real data", href: "/lab/celestial", kind: "live" },
          { label: "Real planetary terrain", href: "/lab/terrain", kind: "live" },
        ],
      },
      {
        name: "On-device AI",
        what: "Keyless, in-browser models — a copilot that runs on your machine, not someone's server.",
        proof: [
          { label: "The on-device copilot", href: "/lab/celestial", kind: "live" },
          { label: "Cognitive Twin — local-first AI", href: "/lab/cognitive-twin", kind: "live" },
        ],
      },
      {
        name: "Teaching the math, visibly",
        what: "The real equations behind the work, made interactive — e^{iπ}, Fourier, π, how an LLM works.",
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
        proof: [
          { label: "Oracle", href: "/works/oracle", kind: "case" },
          { label: "Deloitte", href: "/works/deloitte", kind: "case" },
        ],
      },
      {
        name: "Research & usability testing",
        what: "Running the sessions, then pruning the friction they revealed — completion rate as the scoreboard.",
        proof: [
          { label: "Deloitte", href: "/works/deloitte", kind: "case" },
          { label: "Rage", href: "/works/rage", kind: "case" },
        ],
      },
      {
        name: "Inclusive design",
        what: "Accessible structure, contrast and plain language — so the system excludes fewer people by default.",
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
  return (
    <div
      className="group relative p-6 transition-colors duration-300 md:p-8"
      style={{ backgroundColor: open ? "rgba(251,78,43,0.06)" : INK }}
    >
      <button
        onClick={onToggle}
        data-cursor-hover
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left focus-visible:outline-none"
      >
        <div>
          <h3 className="font-display text-xl font-light leading-snug tracking-tight md:text-2xl">
            {skill.name}
          </h3>
          <p className="mt-2 font-sans text-sm leading-relaxed md:text-[15px]" style={{ color: "rgba(255,229,213,0.62)" }}>
            {skill.what}
          </p>
        </div>
        <span
          aria-hidden
          className="mt-1 shrink-0 font-mono text-sm transition-transform duration-300"
          style={{
            color: open ? ACCENT : MUTE,
            transform: open ? "rotate(90deg)" : "none",
          }}
        >
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
            <div
              className="mt-5 flex flex-col gap-2.5 border-t pt-5"
              style={{ borderColor: "rgba(255,229,213,0.14)" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>
                The proof
              </span>
              {skill.proof.map((p) => (
                <Link
                  key={p.href + p.label}
                  href={p.href}
                  data-cursor-hover
                  className="group/link flex items-center gap-2.5 font-sans text-sm transition-colors"
                  style={{ color: "rgba(255,229,213,0.9)" }}
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
    </div>
  )
}
