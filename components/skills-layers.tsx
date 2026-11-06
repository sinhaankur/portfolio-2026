"use client"

/**
 * /skills — "How I think", as layers.
 *
 * The old version was a Warhol gallery GRID of skill-cards with filter chips.
 * Ankur: "it doesn't communicate my style of thinking… many people claim they do
 * many things." A grid of skills reads like everyone who claims a long list.
 *
 * So this is the same real skills + proof links, but restructured as HIS actual
 * design philosophy, in HIS order, explored on scroll — a page that doesn't LIST
 * what he can do, it DEMONSTRATES how he thinks a problem into a solution. The
 * page is itself an information architecture (a sticky spine, layers as nodes,
 * the method top-to-bottom) — proving the first skill by being built as one.
 *
 * The spine (his words):
 *   00  everything is information       "each product/service is about Information"
 *   01  IA is always first             "IA decides how the design solves the problem"
 *   02  UX = specific problem-solving   "a very specific problem, and a design solution"
 *   03  affordance                      "can't use it → lack of affordance"
 *   04  build it real                   the thinking becomes a working thing
 *
 * Every real proof link from the old page is preserved, mapped into a layer.
 * Backgrounds use theme tokens (bg-background / text-foreground) so the custom
 * cursor stays visible in both themes — the old forced palette hid it.
 */

import { useRef } from "react"
import Link from "next/link"
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion"

const EASE = [0.16, 1, 0.3, 1] as const

type Proof = { label: string; href: string }

type Skill = {
  name: string
  what: string
  proof: Proof[]
  /** ids of other layers this skill also belongs to — drawn as a cross-thread. */
  alsoIn?: string[]
}

type Layer = {
  id: string
  index: string
  title: string
  /** his words — the quote that defines this layer. */
  quote: string
  /** the sharp-and-spare lead (my phrasing, his idea). */
  lead: string
  /** the longer-but-still-spare body. */
  body: string
  skills: Skill[]
}

// Every skill + proof link below is REAL (from the old /skills), remapped into
// Ankur's philosophy layers. Nothing invented, nothing dropped.
const LAYERS: Layer[] = [
  {
    id: "ia",
    index: "01",
    title: "Information architecture — always first.",
    quote: "IA is always first. It decides how the design solves the problem.",
    lead: "Before a pixel, the structure.",
    body:
      "Every product, every service, is really information — organised, or not. So the first move is never visual. It's structural: what is this made of, how does it relate, where does a person expect to find it. Get the architecture right and the rest of the design almost falls out of it. Get it wrong and no amount of polish saves it. This page is built this way on purpose.",
    skills: [
      {
        name: "Information architecture",
        what: "Restructuring dense navigation so people find things — measured by task success, not taste.",
        proof: [
          { label: "Oracle — restructured DBaaS", href: "/works/oracle" },
          { label: "Snowtint", href: "/works/snowtint" },
        ],
        alsoIn: ["ux"],
      },
      {
        name: "Framework thinking",
        what: "Turning scattered UX intuition into a teachable system — laws of cognition you can apply.",
        proof: [{ label: "The Universal Experience Framework", href: "/framework" }],
      },
      {
        name: "Design systems",
        what: "Reusable patterns so a hundred screens stay consistent without a hundred decisions.",
        proof: [
          { label: "Oracle — RDS / HgDS", href: "/works/oracle" },
          { label: "My craft library", href: "/library" },
        ],
        alsoIn: ["affordance"],
      },
      {
        name: "Research",
        what: "Running the sessions, then pruning the friction they revealed — completion rate as the scoreboard.",
        proof: [
          { label: "Deloitte", href: "/works/deloitte" },
          { label: "Rage", href: "/works/rage" },
        ],
      },
    ],
  },
  {
    id: "ux",
    index: "02",
    title: "UX — one specific problem, one design solution.",
    quote:
      "Many people claim they do many things. UX is very specific problem-solving in design — and a design solution.",
    lead: "Not a menu. A method.",
    body:
      "UX isn't a list of things I can do. It's taking one real, specific problem and moving it, deliberately, to one specific solution. In enterprise that means more restraint than people expect: the system already exists, real users already depend on it. The senior move is slow, consistent change — so the user base understands every step, keeps their mental model, and the product gains value instead of breaking under a redesign. Not breaking what works is the skill.",
    skills: [
      {
        name: "Enterprise UX strategy",
        what: "Shaping console-level flows for high-complexity systems where a wrong default costs real money.",
        proof: [
          { label: "Oracle — database console", href: "/works/oracle" },
          { label: "Deloitte — enterprise platform", href: "/works/deloitte" },
        ],
      },
      {
        name: "Product thinking",
        what: "Weighing user value against platform constraints to decide what ships — and what waits.",
        proof: [
          { label: "Oracle case study", href: "/works/oracle" },
          { label: "The Lab — shipped solo", href: "/lab" },
        ],
      },
      {
        name: "Interaction design",
        what: "Designing the edge states — progressive disclosure, empty states, safer destructive actions.",
        proof: [
          { label: "Rage — interaction patterns", href: "/works/rage" },
          { label: "Oracle", href: "/works/oracle" },
        ],
        alsoIn: ["affordance"],
      },
      {
        name: "Stakeholder facilitation",
        what: "Getting product, engineering and business to one decision inside brutal timelines.",
        proof: [
          { label: "Oracle", href: "/works/oracle" },
          { label: "Deloitte", href: "/works/deloitte" },
        ],
      },
    ],
  },
  {
    id: "affordance",
    index: "03",
    title: "Affordance — can they actually use it?",
    quote: "If a user is unable to use anything, there is a lack of affordance.",
    lead: "The honest test.",
    body:
      "A design can be beautifully structured and still fail the only question that matters: can a person do the thing? If they can't, that's not their fault — it's a missing affordance. So the work is making the right action obvious and reachable, for the widest range of people, by default. (This page had a broken cursor when you arrived — a small lack of affordance. Fixed. The principle cuts everywhere.)",
    skills: [
      {
        name: "Inclusive design",
        what: "Accessible structure, contrast and plain language — so the system excludes fewer people by default.",
        proof: [
          { label: "Oracle — accessible console", href: "/works/oracle" },
          { label: "The framework's cognition laws", href: "/framework" },
        ],
      },
      {
        name: "Usability engineering",
        what: "Making usability checkable — a framework and a live engine, not a gut-feel checklist.",
        proof: [
          { label: "The Usability Engine — open it", href: "/usability" },
          { label: "Why it's built this way", href: "/lab/usability-engine" },
        ],
      },
    ],
  },
  {
    id: "build",
    index: "04",
    title: "Then I build it — the real thing, not a mockup.",
    quote: "I learn the human–AI seam by building it, not reading about it.",
    lead: "Thinking, made real.",
    body:
      "The thinking only counts when it ships. I write the production thing — React, WebGL, on-device AI — so the design argument is a working product you can open, not a picture of one. A live galaxy from real NASA data. A copilot that runs on your machine. The math behind it all, made interactive. If I can't build it, I don't really understand it yet.",
    skills: [
      {
        name: "Front-end engineering",
        what: "Shipping production React / WebGL — this whole site, and a live galaxy in your browser.",
        proof: [
          { label: "The Universe Engine — live", href: "/lab/celestial" },
          { label: "Unhosted — open-source flagship", href: "/lab/unhosted" },
        ],
      },
      {
        name: "Real-time 3D / graphics",
        what: "Pure-GLSL worlds built from real NASA/JPL data — stars rendered from their measured physics.",
        proof: [
          { label: "The galaxy, from real data", href: "/lab/celestial" },
          { label: "Real planetary terrain", href: "/lab/terrain" },
        ],
      },
      {
        name: "On-device AI",
        what: "Keyless, in-browser models — a copilot that runs on your machine, not someone's server.",
        proof: [
          { label: "The on-device copilot", href: "/lab/celestial" },
          { label: "Cognitive Twin — local-first AI", href: "/lab/cognitive-twin" },
        ],
      },
      {
        name: "Teaching the math, visibly",
        what: "The real equations behind the work, made interactive — e^{iπ}, Fourier, π, how an LLM works.",
        proof: [
          { label: "Mathematics, made visible", href: "/math" },
          { label: "How a language model works", href: "/llm" },
        ],
      },
    ],
  },
]

/** The left spine — the page's own information architecture, made visible. */
function Spine({ progress }: { progress: ReturnType<typeof useSpring> }) {
  return (
    <div className="pointer-events-none sticky top-0 hidden h-screen w-16 shrink-0 lg:block">
      <div className="absolute left-7 top-0 h-full w-px bg-border" />
      {/* the fill tracks scroll progress — you always see where you are */}
      <motion.div
        className="absolute left-7 top-0 w-px origin-top bg-accent"
        style={{ height: "100%", scaleY: progress }}
      />
      <div className="absolute left-0 top-[14vh] flex flex-col gap-[14vh]">
        {LAYERS.map((l) => (
          <a
            key={l.id}
            href={`#layer-${l.id}`}
            className="pointer-events-auto group flex items-center gap-3"
            data-cursor-hover
          >
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-border bg-background transition-colors group-hover:border-accent">
              <span className="h-1 w-1 rounded-full bg-accent/0 transition-colors group-hover:bg-accent" />
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground transition-colors group-hover:text-foreground">
              {l.index}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

function ProofLink({ p }: { p: Proof }) {
  return (
    <Link
      href={p.href}
      data-cursor-hover
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-wide text-foreground/70 transition-colors hover:border-accent/60 hover:text-foreground"
    >
      {p.label}
      <span aria-hidden className="text-accent">→</span>
    </Link>
  )
}

function LayerSection({ layer, reduce }: { layer: Layer; reduce: boolean }) {
  return (
    <section id={`layer-${layer.id}`} className="scroll-mt-24 border-t border-border/60 py-20 md:py-28">
      {/* Sticky headline: the claim pins while its proof scrolls past — "each
          exploration on scroll". */}
      <div className="md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-14">
        <div className="md:sticky md:top-24 md:self-start">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="font-mono text-[11px] tracking-[0.3em] text-accent">
              {layer.index} — layer
            </div>
            <h2 className="mt-4 font-display text-[1.9rem] font-light leading-[1.1] tracking-[-0.02em] text-foreground md:text-4xl">
              {layer.title}
            </h2>
            <p className="mt-5 font-serif text-lg italic leading-snug text-foreground/70">
              {layer.lead}
            </p>
            <blockquote className="mt-5 border-l-2 border-accent/50 pl-4 font-sans text-sm leading-relaxed text-foreground/60">
              &ldquo;{layer.quote}&rdquo;
            </blockquote>
          </motion.div>
        </div>

        <div className="mt-10 md:mt-1">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="max-w-xl font-sans text-[15px] leading-[1.7] text-foreground/80 md:text-base"
          >
            {layer.body}
          </motion.p>

          {/* the skills, as PROOF inside the layer — not a card wall */}
          <div className="mt-10 space-y-8">
            {layer.skills.map((s, i) => (
              <motion.div
                key={s.name}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: Math.min(i * 0.06, 0.24), ease: EASE }}
                className="border-l border-border pl-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-sans text-[15px] font-medium text-foreground">{s.name}</h3>
                  {s.alsoIn?.map((other) => (
                    <a
                      key={other}
                      href={`#layer-${other}`}
                      data-cursor-hover
                      className="font-mono text-[9px] tracking-wider text-accent/70 transition-colors hover:text-accent"
                      title={`also part of layer ${LAYERS.find((l) => l.id === other)?.index}`}
                    >
                      ↳ also {LAYERS.find((l) => l.id === other)?.index}
                    </a>
                  ))}
                </div>
                <p className="mt-1.5 max-w-lg font-sans text-[13.5px] leading-relaxed text-foreground/60">
                  {s.what}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.proof.map((p) => (
                    <ProofLink key={p.label} p={p} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function SkillsLayers() {
  const reduce = !!useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })

  return (
    <div ref={ref} className="relative min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl gap-0 px-6 md:px-12">
        <Spine progress={progress} />

        <div className="min-w-0 flex-1 pb-28 pt-28 md:pt-36">
          {/* THESIS — rejects the skill-list framing, sets the method up. */}
          <motion.header
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="max-w-3xl"
          >
            <p className="font-mono text-[11px] lowercase tracking-[0.2em] text-muted-foreground">
              how I think
            </p>
            <h1 className="mt-5 font-display text-4xl font-light leading-[1.04] tracking-[-0.025em] md:text-6xl">
              Anyone can list skills.
              <br />
              I&apos;ll show you how I <span className="italic">think</span>.
            </h1>
            <p className="mt-7 max-w-xl font-sans text-lg leading-relaxed text-foreground/70">
              Many people claim they do many things. But UX is one specific
              thing: taking a real problem and moving it, in order, to a real
              design solution. Here&apos;s that order — the way I actually work, from
              the structure underneath to the thing that ships. Every skill shows
              up as <span className="text-foreground">proof inside a step</span>, not
              a line on a list.
            </p>
            <p className="mt-6 font-serif text-[15px] italic text-foreground/45">
              — scroll down; it reads top to bottom, like the thinking does.
            </p>
          </motion.header>

          {/* premise strip — "everything is information" (why IA is first) */}
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mt-20 border-y border-border/60 py-10"
          >
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">00 — the premise</p>
            <p className="mt-4 max-w-2xl font-display text-xl font-light leading-snug text-foreground/90 md:text-2xl">
              Every product or service is, underneath, about{" "}
              <span className="italic text-accent">information</span>. Shape the
              information well and you&apos;ve already begun to solve the problem.
            </p>
          </motion.div>

          {LAYERS.map((layer) => (
            <LayerSection key={layer.id} layer={layer} reduce={reduce} />
          ))}

          {/* close */}
          <div className="mt-20 border-t border-border/60 pt-10">
            <p className="max-w-xl font-sans text-sm leading-relaxed text-foreground/55">
              That&apos;s the whole method — structure, problem, usability, build —
              and every link above opens the real work it produced. No scores, no
              stars. Just the thinking, and the receipts.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
