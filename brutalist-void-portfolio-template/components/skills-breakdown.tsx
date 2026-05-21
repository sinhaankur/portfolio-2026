"use client"

import { useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

type Skill = {
  name: string
  category: SkillCategory
  proficiency: 1 | 2 | 3 | 4 | 5
  years: number
  projects: string[]
  evidence: string
}

type SkillCategory =
  | "Strategy"
  | "UX Core"
  | "Systems"
  | "Research"
  | "Leadership"
  | "Build"
  | "Quality"
  | "Innovation"
  | "Craft"

// Projects on this page are restricted to company experience only —
// independent / lab / portfolio work is showcased on the Lab section, not here.
const skills: Skill[] = [
  { name: "Enterprise UX Strategy",      category: "Strategy",   proficiency: 5, years: 8,  projects: ["Oracle", "Deloitte"],                       evidence: "Shaped console-level flows for high-complexity enterprise workflows." },
  { name: "Product Thinking",            category: "Strategy",   proficiency: 5, years: 9,  projects: ["Oracle", "Deloitte"],                       evidence: "Balanced user value and platform constraints to prioritize roadmap outcomes." },
  { name: "Information Architecture",    category: "UX Core",    proficiency: 5, years: 9,  projects: ["Oracle", "Snowtint", "Deloitte"],            evidence: "Improved discoverability and task success by restructuring dense navigation systems." },
  { name: "Interaction Design",          category: "UX Core",    proficiency: 5, years: 10, projects: ["Oracle", "Rage", "Deloitte"],                evidence: "Designed patterns for edge states, progressive disclosure, and safer destructive actions." },
  { name: "Design Systems",              category: "Systems",    proficiency: 4, years: 7,  projects: ["Oracle"],                                    evidence: "Created reusable patterns on HgDS/RDS for consistency across DBaaS surfaces." },
  { name: "Usability Testing",           category: "Research",   proficiency: 4, years: 8,  projects: ["Deloitte", "Snowtint", "Rage"],              evidence: "Used feedback loops from test sessions to prune friction and improve completion rates." },
  { name: "Stakeholder Facilitation",    category: "Leadership", proficiency: 5, years: 9,  projects: ["Oracle", "Deloitte"],                       evidence: "Aligned product, engineering, and business goals in highly constrained timelines." },
  { name: "Mentorship & Coaching",       category: "Leadership", proficiency: 4, years: 5,  projects: ["Oracle", "Deloitte"],                       evidence: "Mentored designers and codified critique cadence within enterprise design teams." },
  { name: "Front-end Prototyping",       category: "Build",      proficiency: 4, years: 6,  projects: ["Oracle", "Snowtint"],                       evidence: "Built interactive prototypes in HTML/CSS/JS to validate behavior before implementation." },
  { name: "Inclusive Design",            category: "Quality",    proficiency: 4, years: 7,  projects: ["Oracle", "Deloitte"],                       evidence: "Applied accessible structures, contrast and language clarity to reduce exclusion." },
  { name: "AI-assisted Workflow Design", category: "Innovation", proficiency: 4, years: 3,  projects: ["Oracle"],                                    evidence: "Introduced practical AI interactions without adding cognitive overhead." },
  { name: "Visual Communication",        category: "Craft",      proficiency: 4, years: 10, projects: ["Snowtint", "Rage"],                          evidence: "Used visual hierarchy and tone to make complex information easier to scan." },
]

const allCategories = Array.from(new Set(skills.map((s) => s.category))) as SkillCategory[]
const allProjects = Array.from(new Set(skills.flatMap((s) => s.projects))).sort()

type ViewMode = "matrix" | "list"

export function SkillsBreakdown() {
  const prefersReducedMotion = useReducedMotion()
  const [view, setView] = useState<ViewMode>("matrix")
  const [category, setCategory] = useState<SkillCategory | "All">("All")
  const [project, setProject] = useState<string>("All")

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      if (category !== "All" && s.category !== category) return false
      if (project !== "All" && !s.projects.includes(project)) return false
      return true
    })
  }, [category, project])

  // Group filtered skills by category, preserving the canonical category order
  const grouped = useMemo(() => {
    const map = new Map<SkillCategory, Skill[]>()
    for (const cat of allCategories) {
      const list = filtered.filter((s) => s.category === cat)
      if (list.length) map.set(cat, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const totalYears = useMemo(() => {
    return Math.max(...skills.map((s) => s.years))
  }, [])

  const resetFilters = () => {
    setCategory("All")
    setProject("All")
  }

  const filtersActive = category !== "All" || project !== "All"

  return (
    <section className="relative py-24 md:py-32 px-6 md:px-12">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header — narrative, not generic */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-16 md:mb-20 max-w-4xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            Skills · Twelve practices · One through-line
          </p>
          <h1 className="font-sans text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.05]">
            <span className="italic font-serif">What I'm</span> good at —
            <br />
            with the work that <span className="italic font-serif">earned it</span>.
          </h1>
          <p className="mt-8 font-sans text-base md:text-lg text-foreground/80 leading-relaxed max-w-2xl">
            Not a checklist. Each practice below is tied to the projects, the
            companies, and the years that produced it. Filter by what you care
            about — the rest gets out of the way.
          </p>
        </motion.div>

        {/* Filters — single row, no slider */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-10 flex flex-wrap items-end gap-4 md:gap-6"
        >
          <div className="flex flex-col gap-2 min-w-0 flex-1 md:flex-initial md:min-w-48">
            <label className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              Filter by category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory | "All")}
              className="
                w-full px-3 py-2 rounded-md
                border border-border bg-background text-foreground
                font-mono text-xs tracking-wider
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
                cursor-pointer
              "
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 min-w-0 flex-1 md:flex-initial md:min-w-48">
            <label className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              Filter by project
            </label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="
                w-full px-3 py-2 rounded-md
                border border-border bg-background text-foreground
                font-mono text-xs tracking-wider
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
                cursor-pointer
              "
              aria-label="Filter by project"
            >
              <option value="All">All projects</option>
              {allProjects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button
              onClick={resetFilters}
              data-cursor-hover
              className="
                self-stretch flex items-center gap-2 px-4
                border border-border rounded-md
                font-mono text-[10px] tracking-widest uppercase
                text-muted-foreground hover:text-foreground hover:border-accent/60
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
              "
            >
              Reset
            </button>
          )}

          {/* View toggle pushed to the right */}
          <div
            role="tablist"
            aria-label="View mode"
            className="ml-auto inline-flex border border-border rounded-md overflow-hidden self-end"
          >
            {(["matrix", "list"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={view === mode}
                onClick={() => setView(mode)}
                data-cursor-hover
                className={`
                  px-4 py-2.5 font-mono text-[10px] tracking-widest uppercase
                  transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  ${
                    view === mode
                      ? "bg-foreground text-background"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                {mode}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Active filter chip */}
        {filtersActive && (
          <p className="mb-6 font-mono text-xs tracking-wider text-muted-foreground">
            <span className="text-foreground">{filtered.length}</span>{" "}
            of {skills.length} skills shown
            {category !== "All" && (
              <>
                {" · category: "}
                <span className="text-foreground">{category}</span>
              </>
            )}
            {project !== "All" && (
              <>
                {" · project: "}
                <span className="text-foreground">{project}</span>
              </>
            )}
          </p>
        )}

        {filtered.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-md">
            No skills match this filter set.
          </p>
        ) : view === "matrix" ? (
          <MatrixView grouped={grouped} totalYears={totalYears} prefersReducedMotion={!!prefersReducedMotion} />
        ) : (
          <ListView grouped={grouped} prefersReducedMotion={!!prefersReducedMotion} />
        )}

        {/* Footer caption */}
        <p className="mt-16 font-mono text-[11px] tracking-wider text-muted-foreground max-w-2xl">
          <span className="text-accent">●</span> dots are years of practice;{" "}
          <span className="text-foreground">filled bar</span> is calibrated
          proficiency (1–5). No vanity metrics here — anything I haven't actually
          shipped against didn't make this page.
        </p>
      </div>
    </section>
  )
}

/* =========================================================================
   MATRIX VIEW — the distinctive layout.
   Each skill is a compact card:
     • Name + category eyebrow
     • Five proficiency squares (filled / empty)
     • Years rendered as small dots along a track
     • Projects as tags
     • Evidence one-liner on hover/focus expand
========================================================================= */

function MatrixView({
  grouped,
  totalYears,
  prefersReducedMotion,
}: {
  grouped: [SkillCategory, Skill[]][]
  totalYears: number
  prefersReducedMotion: boolean
}) {
  return (
    <div className="space-y-12 md:space-y-16">
      {grouped.map(([cat, list], gi) => (
        <motion.section
          key={cat}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : gi * 0.05 }}
          aria-labelledby={`cat-${cat}`}
        >
          {/* Category banner row */}
          <header className="flex items-baseline gap-4 mb-6 border-b border-border pb-3">
            <span aria-hidden="true" className="w-10 h-px bg-accent" />
            <h2
              id={`cat-${cat}`}
              className="font-sans text-xl md:text-2xl font-light tracking-tight text-foreground"
            >
              {cat}
            </h2>
            <span className="ml-auto font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
              {list.length} {list.length === 1 ? "practice" : "practices"}
            </span>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden">
            {list.map((skill, i) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                totalYears={totalYears}
                index={i}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  )
}

function SkillCard({
  skill,
  totalYears,
  index,
  prefersReducedMotion,
}: {
  skill: Skill
  totalYears: number
  index: number
  prefersReducedMotion: boolean
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.4,
        delay: prefersReducedMotion ? 0 : Math.min(index * 0.04, 0.3),
      }}
      className="
        relative bg-background p-6 md:p-7
        flex flex-col gap-4
        hover:bg-secondary/30 transition-colors duration-300
      "
    >
      {/* Top row — name + proficiency squares */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-sans text-lg md:text-xl text-foreground leading-snug max-w-xs">
          {skill.name}
        </h3>
        <ProficiencySquares value={skill.proficiency} />
      </div>

      {/* Years dot track */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground shrink-0">
          {skill.years}y
        </span>
        <YearDots years={skill.years} total={totalYears} />
      </div>

      {/* Evidence one-liner */}
      <p className="font-sans text-sm text-foreground/75 leading-relaxed">
        {skill.evidence}
      </p>

      {/* Projects */}
      <ul className="flex flex-wrap gap-1.5 mt-auto">
        {skill.projects.map((p) => (
          <li
            key={p}
            className="font-mono text-[10px] tracking-wider px-2 py-0.5 border border-border rounded-full text-foreground/70"
          >
            {p}
          </li>
        ))}
      </ul>
    </motion.article>
  )
}

function ProficiencySquares({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-label={`Proficiency ${value} of 5`}
      className="flex gap-1 shrink-0"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`
            block w-2.5 h-2.5 rounded-[2px]
            ${n <= value ? "bg-accent" : "bg-border"}
          `}
        />
      ))}
    </div>
  )
}

function YearDots({ years, total }: { years: number; total: number }) {
  // Cap visual at total years from the dataset so all skills share a scale
  const clamped = Math.min(years, total)
  return (
    <div className="flex gap-0.75 flex-1" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`
            block flex-1 max-w-2 h-1 rounded-sm
            ${i < clamped ? "bg-foreground/60" : "bg-border"}
          `}
        />
      ))}
    </div>
  )
}

/* =========================================================================
   LIST VIEW — compact alternate, grouped by category.
   Single line per skill: name · category · proficiency · years · evidence
========================================================================= */

function ListView({
  grouped,
  prefersReducedMotion,
}: {
  grouped: [SkillCategory, Skill[]][]
  prefersReducedMotion: boolean
}) {
  return (
    <div className="space-y-12">
      {grouped.map(([cat, list], gi) => (
        <motion.section
          key={cat}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : gi * 0.04 }}
          aria-labelledby={`list-cat-${cat}`}
        >
          <header className="flex items-baseline gap-4 mb-3">
            <span aria-hidden="true" className="w-10 h-px bg-accent" />
            <h2
              id={`list-cat-${cat}`}
              className="font-sans text-lg md:text-xl font-light tracking-tight text-foreground"
            >
              {cat}
            </h2>
          </header>

          <ul className="border-t border-b border-border divide-y divide-border">
            {list.map((s) => (
              <li
                key={s.name}
                className="
                  grid gap-y-2 gap-x-6 py-5
                  md:grid-cols-[1fr_auto_auto_auto] md:items-center
                "
              >
                <div className="min-w-0">
                  <p className="font-sans text-base md:text-lg text-foreground">
                    {s.name}
                  </p>
                  <p className="mt-1 font-sans text-sm text-foreground/70 leading-relaxed max-w-prose">
                    {s.evidence}
                  </p>
                </div>
                <ProficiencySquares value={s.proficiency} />
                <span className="font-mono text-[11px] tracking-wider text-foreground/85 whitespace-nowrap">
                  {s.years} yrs
                </span>
                <ul className="flex flex-wrap gap-1.5 md:justify-end md:max-w-60">
                  {s.projects.map((p) => (
                    <li
                      key={p}
                      className="font-mono text-[10px] tracking-wider px-2 py-0.5 border border-border rounded-full text-foreground/65"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </motion.section>
      ))}
    </div>
  )
}
