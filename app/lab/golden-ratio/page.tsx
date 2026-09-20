import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
} from "@/components/case-study/case-study-layout"
import { PhiEmbed } from "@/components/phi/phi-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/golden-ratio"),
  title: "The golden ratio — φ, and why sunflowers grow the way they do",
  description:
    "φ = 1.618… is the ratio the Fibonacci numbers home in on, and the 'most irrational' number there is — which is exactly why sunflower seeds packed at the golden angle never form wasteful spokes. See the spiral and the seeds, live.",
}

export default function GoldenRatioPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · Equations, visible"
      title="The golden ratio — φ, and why sunflowers grow this way."
      subtitle="1.618… turns up in Fibonacci, in spirals, in seed-heads. Not mysticism — a consequence of φ being the hardest number to approximate by any fraction. Here's that, made visible."
      period="2026"
      role="Interactive · real math, live"
      tags={["Mathematics", "Golden ratio", "Fibonacci", "Phyllotaxis", "Teaching"]}
      backTo={{ label: "Back to the Math collection", href: "/lab/math" }}
      intro={
        <>
          <p>
            Another in the &ldquo;see the equation&rdquo; series (with{" "}
            <Link href="/lab/pi" className="text-accent hover:underline">π</Link>,{" "}
            <Link href="/lab/euler" className="text-accent hover:underline">Euler</Link>, and{" "}
            <Link href="/lab/fourier" className="text-accent hover:underline">Fourier</Link>).
            φ is famous and often mystified. The real reason it&apos;s everywhere in
            nature is a precise, provable fact about irrationality — and you can
            watch it happen.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>The spiral, and the number it approaches</CaseSectionHeading>
        <CaseProse>
          Squares sized by the Fibonacci numbers (1, 1, 2, 3, 5, 8, 13, …) tile
          together without gaps; a quarter-circle in each traces the golden spiral.
          Divide each Fibonacci number by the one before it — 2/1, 3/2, 5/3, 8/5,
          13/8 — and the answers close in on{" "}
          <span className="font-serif italic">φ = (1+√5)/2 = 1.618…</span>. Switch to
          the seeds view for the part that actually explains the plants.
        </CaseProse>
        <div className="mt-6">
          <PhiEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Why &ldquo;the most irrational number&rdquo; packs seeds perfectly</CaseSectionHeading>
        <CaseProse>
          Here&apos;s the deep bit, and it ties straight back to{" "}
          <Link href="/lab/pi" className="text-accent hover:underline">π&apos;s irrationality</Link>.
          A plant grows its seeds one at a time, each turned a fixed angle from the
          last. If that angle were a nice fraction of a turn — say 1/4, or even a
          near-fraction — the seeds would quickly line up into a few radial{" "}
          <em>spokes</em>, wasting most of the flower head. To fill the space
          evenly, the turn angle must be as <em>far from every fraction</em> as
          possible.
        </CaseProse>
        <CaseProse>
          That number exists, and it&apos;s φ. Of all numbers, φ is the slowest to
          be approximated by fractions — the &ldquo;most irrational&rdquo; — so a
          turn of 360°/φ² (the <strong>golden angle, ≈ 137.5°</strong>) never
          repeats into spokes. Every new seed drops into the biggest remaining gap.
          That&apos;s not decoration; it&apos;s optimal packing, and it&apos;s why
          sunflowers, pinecones, pineapples and succulents all land on the same
          angle independently. In the seeds view, nudge the angle a fraction of a
          degree off φ — spokes and gaps appear immediately. Irrationality doing
          real, visible work.
        </CaseProse>
        <CaseProse>
          So φ and π are cousins: both irrational, both showing up in nature not by
          magic but because their number-theory forces a shape. Seeing one helps you
          trust the other — the point of this whole series.
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
