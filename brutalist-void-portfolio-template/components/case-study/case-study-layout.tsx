"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"
import { Container } from "@/components/container"
import { ScrollProgress } from "@/components/case-study/scroll-progress"

type CaseStudyLayoutProps = {
  eyebrow: string
  title: string
  subtitle: string
  period: string
  role: string
  tags: string[]
  intro: ReactNode
  children: ReactNode
  backTo?: { label: string; href: string }
}

export function CaseStudyLayout({
  eyebrow,
  title,
  subtitle,
  period,
  role,
  tags,
  intro,
  children,
  backTo = { label: "Back to work", href: "/#works" },
}: CaseStudyLayoutProps) {
  const prefersReducedMotion = useReducedMotion()

  const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: prefersReducedMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] as const },
  }

  return (
    <>
      <CustomCursor />
      <Navbar />
      <ScrollProgress />

      <main id="main" className="pt-24 pb-24">
        <Container width="default">
          {/* Back link */}
          <motion.div {...fadeUp} className="mb-12">
            <Link
              href={backTo.href}
              data-cursor-hover
              className="
                group inline-flex items-center gap-2
                font-mono text-xs tracking-widest uppercase
                text-muted-foreground hover:text-foreground
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                rounded
              "
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
              {backTo.label}
            </Link>
          </motion.div>

          {/* Header */}
          <header className="mb-20 md:mb-28">
            <motion.p
              {...fadeUp}
              className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-6"
            >
              {eyebrow}
            </motion.p>
            <motion.h1
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.05 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-foreground"
            >
              {title}
            </motion.h1>
            <motion.p
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="mt-6 font-serif italic text-xl md:text-2xl text-foreground/85 max-w-3xl"
            >
              {subtitle}
            </motion.p>

            {/* Meta strip */}
            <motion.dl
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6 border-t border-border pt-8"
            >
              <div>
                <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
                  Period
                </dt>
                <dd className="font-mono text-sm tracking-wider text-foreground">{period}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
                  Role
                </dt>
                <dd className="font-mono text-sm tracking-wider text-foreground">{role}</dd>
              </div>
              <div className="col-span-2 md:col-span-1">
                <dt className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
                  Tags
                </dt>
                <dd className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[10px] tracking-wider px-2.5 py-1 border border-border rounded-full text-foreground/80"
                    >
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            </motion.dl>
          </header>

          {/* Intro prose */}
          <motion.section {...fadeUp} className="prose-case-study mb-20 md:mb-28">
            {intro}
          </motion.section>

          {/* Body */}
          <div className="space-y-20 md:space-y-28">{children}</div>
        </Container>
      </main>

      <Footer />
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}

/* ===== Reusable section primitives ===== */

export function CaseSectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-4 mb-2">
        <span aria-hidden="true" className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-light tracking-[-0.01em] text-foreground">
          {children}
        </h2>
      </div>
    </div>
  )
}

export function CaseProse({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl font-sans text-base md:text-lg leading-relaxed text-foreground/85 space-y-5">
      {children}
    </div>
  )
}

export function CaseList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="max-w-3xl divide-y divide-border border-t border-b border-border">
      {items.map((item, i) => (
        <li
          key={i}
          className="py-5 grid grid-cols-[2rem_1fr] gap-4 font-sans text-sm md:text-base leading-relaxed text-foreground/85"
        >
          <span className="font-mono text-[10px] tracking-widest text-accent pt-1">
            0{i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function CasePullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="max-w-4xl border-l-2 border-accent pl-6 md:pl-8 py-2">
      <p className="font-serif italic text-2xl md:text-4xl leading-tight text-foreground/90">
        {children}
      </p>
    </blockquote>
  )
}

type Lesson = { title: string; body: ReactNode }
export function CaseLessons({ lessons }: { lessons: Lesson[] }) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden">
      {lessons.map((lesson, i) => (
        <li
          key={i}
          className="bg-background p-6 md:p-8 flex flex-col"
        >
          <span className="font-mono text-[10px] tracking-widest text-accent mb-3">
            LESSON 0{i + 1}
          </span>
          <h3 className="font-sans text-lg md:text-xl text-foreground mb-3 leading-snug">
            {lesson.title}
          </h3>
          <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
            {lesson.body}
          </p>
        </li>
      ))}
    </ul>
  )
}

type ProjectStoryProps = {
  index: number
  headline: string
  tagline: string
  context: ReactNode
  uxAngle: ReactNode
  approach: ReactNode
  learned: ReactNode
  image?: { src: string; alt: string }
  cta?: { label: string; href: string; external?: boolean }
}

export function ProjectStory({
  index,
  headline,
  tagline,
  context,
  uxAngle,
  approach,
  learned,
  image,
  cta,
}: ProjectStoryProps) {
  return (
    <details className="group case-story border border-border rounded-md overflow-hidden bg-background open:bg-secondary/20 transition-colors">
      <summary
        className="
          list-none cursor-pointer
          flex items-start gap-4 md:gap-6 px-5 md:px-8 py-5 md:py-6
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
      >
        <span className="font-mono text-xs tracking-widest text-accent pt-1.5 w-8 shrink-0">
          0{index + 1}
        </span>
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            className="hidden sm:block w-20 h-20 md:w-24 md:h-24 object-cover rounded-md border border-border shrink-0 bg-secondary/40"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-lg md:text-2xl text-foreground leading-snug">
            {headline}
          </p>
          <p className="mt-2 font-sans text-sm md:text-base text-muted-foreground leading-relaxed">
            {tagline}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="
            font-mono text-[10px] tracking-widest uppercase text-muted-foreground
            self-center px-3 py-1 border border-border rounded-full
            group-open:bg-accent group-open:text-accent-foreground group-open:border-accent
            transition-colors
          "
        >
          <span className="group-open:hidden">Story →</span>
          <span className="hidden group-open:inline">Close ↑</span>
        </span>
      </summary>

      <div className="px-6 md:px-8 pt-2 pb-8 md:pb-10 border-t border-border">
        <div className="grid md:grid-cols-2 gap-x-10 gap-y-8 pt-8">
          <StoryBlock label="Context">{context}</StoryBlock>
          <StoryBlock label="UX angle">{uxAngle}</StoryBlock>
          <StoryBlock label="Approach">{approach}</StoryBlock>
          <StoryBlock label="What I learned">{learned}</StoryBlock>
        </div>
        {cta && (
          <div className="mt-8">
            <a
              href={cta.href}
              {...(cta.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              data-cursor-hover
              className="
                inline-flex items-center gap-2
                font-mono text-xs tracking-widest uppercase
                text-accent hover:text-foreground
                border-b border-accent hover:border-foreground
                pb-1
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                rounded-sm
              "
            >
              {cta.label} →
            </a>
          </div>
        )}
      </div>
    </details>
  )
}

function StoryBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2.5">
        {label}
      </h4>
      <p className="font-sans text-sm md:text-base leading-relaxed text-foreground/85">
        {children}
      </p>
    </div>
  )
}

type Moment = { src: string; alt: string; caption: string }

export function CaseMoments({
  title = "Moments",
  intro,
  moments,
}: {
  title?: string
  intro?: string
  moments: Moment[]
}) {
  return (
    <section aria-labelledby="moments-heading">
      <div className="mb-10">
        <div className="flex items-baseline gap-4 mb-2">
          <span aria-hidden="true" className="block w-12 h-px bg-accent" />
          <h2
            id="moments-heading"
            className="font-display text-2xl md:text-3xl lg:text-4xl font-light tracking-[-0.01em] text-foreground"
          >
            {title}
          </h2>
        </div>
        {intro && (
          <p className="ml-16 mt-2 font-sans text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {intro}
          </p>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {moments.map((m) => (
          <li
            key={m.src}
            className="
              group relative overflow-hidden rounded-md border border-border bg-secondary/30
              transition-colors hover:border-accent/50
            "
          >
            <figure>
              <div className="aspect-4/3 overflow-hidden">
                <img
                  src={m.src}
                  alt={m.alt}
                  loading="lazy"
                  className="
                    w-full h-full object-cover
                    transition-transform duration-700 ease-out
                    group-hover:scale-105
                  "
                />
              </div>
              <figcaption className="px-4 py-3 font-sans text-sm text-foreground/80 leading-snug">
                {m.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CaseNextLinks({
  prev,
  next,
}: {
  prev?: { label: string; href: string }
  next?: { label: string; href: string }
}) {
  return (
    <nav
      aria-label="Case study navigation"
      className="mt-24 pt-10 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      {prev ? (
        <Link
          href={prev.href}
          data-cursor-hover
          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded"
        >
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            ← Previous
          </span>
          <p className="mt-1 font-sans text-xl text-foreground group-hover:text-accent transition-colors">
            {prev.label}
          </p>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          data-cursor-hover
          className="group block md:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded"
        >
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Next →
          </span>
          <p className="mt-1 font-sans text-xl text-foreground group-hover:text-accent transition-colors">
            {next.label}
          </p>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
