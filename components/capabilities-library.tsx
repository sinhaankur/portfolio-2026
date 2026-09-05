"use client"

/**
 * CapabilitiesLibrary — the Lab's "skills" half: the disciplines Ankur works
 * across, each as a card with what it covers, the tools, and proof links to
 * real work already on this site. Not a résumé list — a library you can open,
 * every claim backed by something you can click and see run.
 *
 * (The UX-competency matrix lives at /skills; this is the broader craft library.)
 */

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

type Proof = { label: string; href: string }
type Discipline = {
  icon: string
  name: string
  blurb: string
  tools: string[]
  proof: Proof[]
}

const DISCIPLINES: Discipline[] = [
  {
    icon: "✳",
    name: "Design",
    blurb:
      "Systems thinking made visible — information architecture, interaction, and the calm defaults that make dense products usable.",
    tools: ["Figma", "Design systems", "Prototyping", "Accessibility"],
    proof: [
      { label: "UX skill matrix", href: "/skills" },
      { label: "Usability engine", href: "/usability" },
      { label: "Experience framework", href: "/framework" },
    ],
  },
  {
    icon: "◐",
    name: "Web Development",
    blurb:
      "Real, fast, hand-built front-ends — this whole site is a static Next.js export with live WebGL, no page-weight excuses.",
    tools: ["Next.js", "React", "TypeScript", "Tailwind"],
    proof: [
      { label: "How it's built", href: "/writing/how-its-built" },
      { label: "The Lab", href: "/lab" },
    ],
  },
  {
    icon: "∑",
    name: "Mathematics",
    blurb:
      "The real formulas, implemented by hand — orbital mechanics, Kepler's equation, SGP4, ephemeris, wave spectra. No library black boxes.",
    tools: ["Linear algebra", "Numerics", "Physics", "Astronomy"],
    proof: [
      { label: "The math behind the engine", href: "/universe-engine/math" },
      { label: "Academic projects", href: "/academic/p2p-streaming" },
    ],
  },
  {
    icon: "⧉",
    name: "Full-Stack Development",
    blurb:
      "End to end — Cloudflare Workers + R2 APIs, auth, data models, and the UI on top. Private vaults, real deployments, real users.",
    tools: ["Cloudflare Workers", "R2 / KV", "Node", "APIs", "Auth"],
    proof: [
      { label: "Unhosted", href: "/lab/unhosted" },
      { label: "Cognitive twin", href: "/lab/cognitive-twin" },
    ],
  },
  {
    icon: "⚙",
    name: "DevOps",
    blurb:
      "Ship it and keep it cheap — static export to the edge, CI deploys, asset CDNs, size budgets, smoke tests on every route.",
    tools: ["GitHub Actions", "Cloudflare Pages", "Wrangler", "CI/CD"],
    proof: [
      { label: "How it's built", href: "/writing/how-its-built" },
      { label: "References & sources", href: "/references" },
    ],
  },
  {
    icon: "◇",
    name: "Product Management",
    blurb:
      "Deciding what not to build — balancing user value against platform constraints, and turning fuzzy intent into a shippable roadmap.",
    tools: ["Roadmapping", "Prioritization", "Stakeholders", "Discovery"],
    proof: [
      { label: "Works & case studies", href: "/#works" },
      { label: "Upcoming roadmap", href: "/upcoming" },
    ],
  },
  {
    icon: "◑",
    name: "Visual Design",
    blurb:
      "Type, hierarchy, and restraint — Fraunces/Inter/JetBrains, motion tokens, and a house style that reads at a glance.",
    tools: ["Typography", "Color", "Motion", "Brand"],
    proof: [
      { label: "Photography", href: "/photos" },
      { label: "The Lab", href: "/lab" },
    ],
  },
  {
    icon: "▶",
    name: "Video Editor",
    blurb:
      "From raw footage to a finished piece — grading, compositing, and web-encoding; the ocean film cut and colour-graded by hand.",
    tools: ["DaVinci Resolve", "ffmpeg", "Grading", "Compositing"],
    proof: [
      { label: "The Waves", href: "/lab/wave" },
      { label: "Watch the sea", href: "/waves" },
    ],
  },
  {
    icon: "◈",
    name: "3D Modeler",
    blurb:
      "Real-time and photoreal — Gerstner ocean shaders in the browser and path-traced Blender scenes, all physics-driven, all ours.",
    tools: ["Blender", "Cycles", "Three.js / R3F", "GLSL", "Geometry nodes"],
    proof: [
      { label: "The Waves ocean", href: "/lab/wave" },
      { label: "Terrain (3D tiles)", href: "/lab/terrain" },
      { label: "Helion Drift", href: "/lab/helion-drift" },
    ],
  },
]

export function CapabilitiesLibrary() {
  const reduce = useReducedMotion()
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-28">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        The Library · craft
      </p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
        A library of what I build with.
      </h1>
      <p className="mt-5 max-w-2xl font-sans text-base leading-relaxed text-foreground/75 md:text-lg">
        Nine disciplines, one instinct: understand the thing well enough to build
        it yourself. Every card links to real work on this site — not a résumé,
        a shelf you can open and watch run.
      </p>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISCIPLINES.map((d, i) => (
          <motion.article
            key={d.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : (i % 3) * 0.06 }}
            className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors duration-300 hover:border-accent/60"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-accent">{d.icon}</span>
              <h2 className="font-display text-xl font-light tracking-[-0.01em]">{d.name}</h2>
            </div>
            <p className="mt-3 flex-1 font-sans text-sm leading-relaxed text-foreground/75">{d.blurb}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {d.tools.map((t) => (
                <span key={t} className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/60 pt-4">
              {d.proof.map((p) => (
                <Link
                  key={p.href + p.label}
                  href={p.href}
                  data-cursor-hover
                  className="group inline-flex items-center gap-1 font-mono text-[11px] tracking-wide text-foreground/70 transition-colors hover:text-accent"
                >
                  {p.label}
                  <ArrowUpRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
