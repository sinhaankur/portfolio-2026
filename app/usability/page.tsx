import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"
import { Container } from "@/components/container"

export const metadata: Metadata = {
  title: "Usability — A practitioner's guide · Ankur Sinha",
  description:
    "A practical usability guide: what and why of usability, methods (qualitative vs quantitative), guidelines, content strategy, project management, and visual hierarchy.",
}

/* ------------------------------------------------------------------ */
/*  Small primitives, scoped to this page                             */
/* ------------------------------------------------------------------ */

function SectionHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string
  title: string
  lede?: string
}) {
  return (
    <header className="mb-10 md:mb-14 max-w-3xl">
      <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-4">
        {eyebrow}
      </p>
      <h2 className="font-sans text-2xl md:text-4xl font-light tracking-tight text-foreground">
        {title}
      </h2>
      {lede && (
        <p className="mt-5 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
          {lede}
        </p>
      )}
    </header>
  )
}

function Steps({ items }: { items: { label: string; body: string }[] }) {
  return (
    <ol className="max-w-3xl border-t border-b border-border divide-y divide-border">
      {items.map((s, i) => (
        <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-4 py-4">
          <span className="font-mono text-[10px] tracking-widest text-accent pt-1.5">
            {String(i + 1).padStart(2, "0")}
          </span>
          <p className="font-sans text-sm md:text-base text-foreground/85 leading-relaxed">
            <span className="text-foreground font-medium">{s.label}</span>
            {" — "}
            {s.body}
          </p>
        </li>
      ))}
    </ol>
  )
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 max-w-3xl border-l-2 border-accent pl-5 py-2 font-serif italic text-base md:text-lg text-foreground/85 leading-relaxed">
      {children}
    </p>
  )
}

function GridCards({
  items,
}: {
  items: { eyebrow: string; title: string; body: string }[]
}) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden">
      {items.map((it, i) => (
        <li key={i} className="bg-background p-6 md:p-7 flex flex-col">
          <p className="font-mono text-[10px] tracking-widest text-accent mb-3">
            {it.eyebrow}
          </p>
          <h3 className="font-sans text-lg md:text-xl text-foreground mb-3 leading-snug">
            {it.title}
          </h3>
          <p className="font-sans text-sm text-foreground/80 leading-relaxed">
            {it.body}
          </p>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

export default function UsabilityPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />

      <main id="main" className="pt-24 pb-24">
        <Container width="default">
          {/* Hero */}
          <header className="mb-20 md:mb-28 max-w-4xl">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-6">
              Usability · A practitioner's guide
            </p>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-foreground">
              What is usability,{" "}
              <span className="italic">and why does it matter?</span>
            </h1>
            <p className="mt-8 font-sans text-base md:text-lg text-foreground/85 leading-relaxed max-w-3xl">
              Usability is the quality that makes a product easy, efficient, and
              satisfying to use. It is not one thing — it is a composite of{" "}
              <span className="text-foreground">learnability</span>,{" "}
              <span className="text-foreground">efficiency</span>,{" "}
              <span className="text-foreground">memorability</span>,{" "}
              <span className="text-foreground">error tolerance</span>, and{" "}
              <span className="text-foreground">satisfaction</span>. Get it right
              and people accomplish their goals. Get it wrong and they leave, or
              make costly mistakes.
            </p>
          </header>

          {/* The five components */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="01 — The components"
              title="The five qualities under one word."
              lede="Usability is a composite. Lose one component and the whole experience tilts — even when every other dimension is strong."
            />
            <GridCards
              items={[
                {
                  eyebrow: "Learnability",
                  title: "First-use task success",
                  body: "How quickly can a new user accomplish basic tasks on first encounter?",
                },
                {
                  eyebrow: "Efficiency",
                  title: "Speed once learned",
                  body: "Once learned, how fast can experienced users reach their goals?",
                },
                {
                  eyebrow: "Memorability",
                  title: "Returning after absence",
                  body: "When users return after time away, can they re-establish proficiency quickly?",
                },
                {
                  eyebrow: "Error tolerance",
                  title: "Recovery cost",
                  body: "How severe are mistakes, and how easily can users recover from them?",
                },
                {
                  eyebrow: "Satisfaction",
                  title: "Subjective experience",
                  body: "Is the experience pleasant and fulfilling, not just functional?",
                },
                {
                  eyebrow: "UX is not UI",
                  title: "Surface vs experience",
                  body: "UI is the surface; UX is the entire experience — the moment of confusion, the moment of success, the feeling after the session ends.",
                },
              ]}
            />
          </section>

          {/* Recruiting */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="02 — Recruiting"
              title="The legend of 'the general public.'"
              lede="Research aimed at 'anyone' produces findings that apply to no one. Every product has a real user — a person with domain knowledge, a mental model shaped by prior tools, and specific goals."
            />
            <Steps
              items={[
                {
                  label: "Define the user profile first",
                  body: "Role, domain knowledge, frequency of use, technical comfort — be specific before opening any recruiting tool.",
                },
                {
                  label: "Write a tight screener",
                  body: "6–8 questions max. Avoid leading language. Screen on behaviours, not demographics alone.",
                },
                {
                  label: "Use multiple channels",
                  body: "Customer success teams, LinkedIn, existing panels, UX agencies. Do not rely on a single source.",
                },
                {
                  label: "Plan for 5–8 participants per segment",
                  body: "Diminishing returns kick in fast; beyond 8 you are confirming, not discovering.",
                },
                {
                  label: "Compensate fairly",
                  body: "Poor incentives bias your sample toward people who need the money, not your target user.",
                },
              ]}
            />
            <Takeaway>
              Specificity in recruiting is the difference between research that
              changes product decisions and research that validates whatever
              stakeholders already believed.
            </Takeaway>
          </section>

          {/* Methods */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="03 — Methods"
              title="Qualitative vs quantitative · attitudinal vs behavioural."
              lede="No single method answers every question. The choice depends on where you are in the design process and what you need to know."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden mb-10">
              {[
                {
                  axis: "Qualitative (Why)",
                  body: "Moderated testing, contextual inquiry, cognitive walkthroughs. Use when you need to understand why something is happening.",
                },
                {
                  axis: "Quantitative (How many)",
                  body: "Unmoderated testing, surveys, analytics, A/B testing. Use when you need to measure scale and frequency.",
                },
                {
                  axis: "Attitudinal (What they say)",
                  body: "Surveys, NPS, interviews, focus groups. Captures stated preference, perception, satisfaction.",
                },
                {
                  axis: "Behavioural (What they do)",
                  body: "Moderated and unmoderated testing, analytics, eye tracking. Prefer this when you can — what people say and what they do are often different.",
                },
              ].map((c) => (
                <div key={c.axis} className="bg-background p-6 md:p-7">
                  <p className="font-mono text-[10px] tracking-widest text-accent mb-3">
                    {c.axis}
                  </p>
                  <p className="font-sans text-sm md:text-base text-foreground/85 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>

            <h3 className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground mb-5">
              Method reference
            </h3>
            <Steps
              items={[
                {
                  label: "Card sorting",
                  body: "Reveals mental models for navigation. Run early.",
                },
                {
                  label: "Tree testing",
                  body: "Validates IA without visual design interference. Run after card sorting.",
                },
                {
                  label: "Diary studies",
                  body: "Captures longitudinal experience over days or weeks. Costly but uniquely revealing.",
                },
                {
                  label: "Heuristic evaluation",
                  body: "Fast expert review. Surfaces obvious issues before participant studies.",
                },
                {
                  label: "First-click testing",
                  body: "Validates whether users find the right starting point for a task.",
                },
              ]}
            />
            <Takeaway>
              Mix generative and evaluative methods. Generative tells you what
              to build; evaluative tells you whether you built it well.
            </Takeaway>
          </section>

          {/* Research sprint timeline */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="04 — Research velocity"
              title="A 5–7 day research sprint."
              lede="A 3-day study with clear output beats a 3-week study with a 60-slide deck nobody finishes reading."
            />
            <ol className="max-w-3xl border-l border-border ml-4">
              {[
                {
                  day: "Day 1",
                  title: "Research Brief",
                  body: "Define the research question. Align stakeholders. Not the solution — the question.",
                },
                {
                  day: "Days 2–3",
                  title: "Study plan + screener",
                  body: "Method, participant criteria, session guide, schedule, roles. Written and approved.",
                },
                {
                  day: "Day 3",
                  title: "Pilot session",
                  body: "Run once with a colleague. Fix broken flows and timing before real participants.",
                },
                {
                  day: "Days 4–5",
                  title: "Sessions (5–8 participants)",
                  body: "Run sessions. Synthesise same-day — cluster observations within 24 hours.",
                },
                {
                  day: "Day 6",
                  title: "Synthesis",
                  body: "Themes, severity, prioritisation. Do not batch to end of study.",
                },
                {
                  day: "Day 7",
                  title: "Two-format readout",
                  body: "1-page summary for decisions. Full report for the record. Lead with the summary.",
                },
              ].map((row, i) => (
                <li key={i} className="relative pl-8 pb-8 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-accent border border-background"
                  />
                  <p className="font-mono text-[10px] tracking-widest uppercase text-accent">
                    {row.day}
                  </p>
                  <h4 className="mt-1 font-sans text-lg text-foreground">
                    {row.title}
                  </h4>
                  <p className="mt-1 font-sans text-sm md:text-base text-foreground/80 leading-relaxed max-w-prose">
                    {row.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* Nielsen's 10 + severity */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="05 — Guidelines"
              title="Nielsen's 10 heuristics."
              lede="Heuristics are a diagnostic vocabulary, not a design spec. Severity is context-dependent — a violation affecting 80% of users daily dwarfs one affecting 0.1% weekly."
            />
            <Steps
              items={[
                { label: "Visibility of system status", body: "Always keep users informed about what is happening." },
                { label: "Match the real world", body: "Use words and concepts the user knows." },
                { label: "User control & freedom", body: "Support undo, redo, and easy exits." },
                { label: "Consistency & standards", body: "Follow platform conventions." },
                { label: "Error prevention", body: "Design to prevent problems first." },
                { label: "Recognition over recall", body: "Make options visible; do not make users memorise." },
                { label: "Flexibility & efficiency", body: "Accelerators for experts; do not punish novices." },
                { label: "Aesthetic & minimalist design", body: "Every extra element competes for attention." },
                { label: "Recognise & recover from errors", body: "Plain language, precise, constructive." },
                { label: "Help & documentation", body: "Easy to find, action-oriented." },
              ]}
            />

            <h3 className="mt-12 mb-5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
              Severity scale for heuristic violations
            </h3>
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">Severity</th>
                    <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">Definition</th>
                    <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">Action</th>
                    <th className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground px-5 py-3 border-b border-border">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { sev: "Critical (4)", color: "bg-red-500", def: "Prevents task completion. High frequency.", act: "Fix before release", ex: "Form submit disabled with no feedback." },
                    { sev: "Serious (3)",  color: "bg-orange-500", def: "Causes significant confusion or delay.", act: "Fix this sprint", ex: "Error message says \"Error 403\" only." },
                    { sev: "Minor (2)",    color: "bg-yellow-500", def: "Irritating but user can work around it.", act: "Schedule soon", ex: "Inconsistent button label between two screens." },
                    { sev: "Cosmetic (1)", color: "bg-emerald-500", def: "Noticeable but almost no impact on task.", act: "Fix if time allows", ex: "Slight misalignment on a rarely used modal." },
                    { sev: "Not an issue (0)", color: "bg-muted-foreground", def: "Disputed or not a real problem.", act: "Document, move on", ex: "Reviewer preference vs. established standard." },
                  ].map((row, i, arr) => (
                    <tr key={row.sev} className={i === arr.length - 1 ? "" : "border-b border-border"}>
                      <td className="px-5 py-4 font-sans text-sm text-foreground align-top">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className={`block w-2 h-2 rounded-full ${row.color}`} />
                          {row.sev}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-sans text-sm text-foreground/80 align-top">{row.def}</td>
                      <td className="px-5 py-4 font-sans text-sm text-foreground/80 align-top">{row.act}</td>
                      <td className="px-5 py-4 font-sans text-sm text-foreground/75 align-top">{row.ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Content strategy */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="06 — Content strategy"
              title="Content is the product."
              lede="Words, labels, instructions, and error messages are interface elements — not filler. Content strategy in UX means designing the information architecture, hierarchy, and language from the first wireframe."
            />
            <Steps
              items={[
                { label: "Lead with the user's goal", body: "Labels, headings, and CTAs should answer 'what does the user want to do?' not 'what does this section contain?'" },
                { label: "Write at the level of your audience", body: "Plain language reduces cognitive load for everyone. Jargon is acceptable when the audience genuinely owns it." },
                { label: "Error messages are content", body: "'Something went wrong' is not a message. Tell users what happened, what it means, and how to fix it." },
                { label: "Audit before redesign", body: "Inventory what exists, what's redundant, what's missing before redesigning anything." },
                { label: "Test your labels", body: "Card sorting and first-click tests validate whether labels are interpreted as intended." },
              ]}
            />
            <Takeaway>
              "We'll fix the copy later" is how products ship with confirmation
              dialogs saying "Are you sure?" and errors saying "Error 403."
              Make content a first-class design decision.
            </Takeaway>
          </section>

          {/* Visual hierarchy */}
          <section className="mb-24 md:mb-32">
            <SectionHeading
              eyebrow="07 — Visual design"
              title="Hierarchy is the usability tool."
              lede="Visual design is not decoration — it is communication. Every spacing decision, contrast ratio, and typographic weight either helps users understand a hierarchy or makes it harder."
            />
            <Steps
              items={[
                { label: "Hierarchy before aesthetics", body: "Define primary, secondary, and tertiary actions before choosing colours. The most important action should be most visually prominent." },
                { label: "WCAG AA as a floor", body: "4.5:1 contrast ratio for text is the minimum. Aim for 7:1 in data-dense contexts." },
                { label: "Don't communicate with colour alone", body: "8% of males have some form of colour blindness. Use shape, label, and pattern alongside colour." },
                { label: "Whitespace is information architecture", body: "Spacing groups related elements and separates unrelated ones. Insufficient whitespace makes everything feel equally important." },
                { label: "Typography is UI", body: "Font size, weight, and line-height determine whether users can scan efficiently. 16px body, 1.5 line-height, limited weight range." },
              ]}
            />
            <Takeaway>
              A usability test revealing users ignoring your primary CTA is
              often a visual design problem. Hierarchy, contrast, and size
              communicate intent before the user reads a single word.
            </Takeaway>
          </section>

          {/* Project management */}
          <section>
            <SectionHeading
              eyebrow="08 — Research ops"
              title="Managing UX research like a product."
              lede="UX research does not manage itself. Without a clear plan, studies run over schedule, findings get buried in decks nobody reads, and stakeholders lose confidence in the process."
            />
            <Steps
              items={[
                { label: "Research brief (day 1)", body: "Document the research question, not the solution hypothesis. Align stakeholders before recruiting starts." },
                { label: "Study plan (week 1)", body: "Method, participant criteria, screener, session guide, schedule, roles. Written, reviewed, approved." },
                { label: "Pilot session", body: "Run one session with a colleague first. Catch broken prototypes and timing issues." },
                { label: "Same-day synthesis", body: "Cluster observations within 24 hours. Do not batch synthesis to the end of a two-week study." },
                { label: "Two-format readout", body: "A one-page summary for quick decisions. A detailed report for the record. Lead with the one-pager." },
                { label: "Track decisions, not just findings", body: "What changed because of this research? Document it. This is how research builds credibility over time." },
              ]}
            />
            <Takeaway>
              Research velocity matters. Treat research like a product: scope
              it, schedule it, ship findings on time.
            </Takeaway>
          </section>
        </Container>
      </main>

      <Footer />
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
