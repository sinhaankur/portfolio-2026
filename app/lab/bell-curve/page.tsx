import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
} from "@/components/case-study/case-study-layout"
import { GaltonEmbed } from "@/components/galton/galton-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/bell-curve"),
  title: "The bell curve — order out of pure randomness",
  description:
    "Drop balls through a field of pegs, each bounce a coin-flip, and they pile into the same bell curve every time. The Central Limit Theorem, made visible: sum enough random nudges and you always get the normal distribution.",
}

export default function BellCurvePage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · Equations, visible"
      title="The bell curve — order out of pure randomness."
      subtitle="One ball is unpredictable. A thousand pile into the exact same shape, every time. That inevitability is the Central Limit Theorem — and you can watch it happen."
      period="2026"
      role="Interactive · real math, live"
      tags={["Mathematics", "Probability", "Normal distribution", "Canvas", "Teaching"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            Part of the &ldquo;see the equation&rdquo; series (see the{" "}
            <Link href="/math" className="text-accent hover:underline">hub</Link>).
            The bell curve is the most famous shape in statistics — and a Galton
            board shows exactly why it&apos;s unavoidable.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>Coin-flips that add up to a bell</CaseSectionHeading>
        <CaseProse>
          Each ball falls through a triangle of pegs; at every peg it bounces left
          or right on a fair coin-flip. Where a single ball lands is pure chance.
          But the landing spot is really the <em>sum</em> of all those little
          left/right flips — and when you sum many independent random choices, the
          totals cluster in the middle and thin at the edges. Drop enough balls and
          the histogram climbs right onto the theoretical{" "}
          <span className="text-[#ffd24d]">bell curve</span> drawn over it.
        </CaseProse>
        <div className="mt-6">
          <GaltonEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Why the bell curve is everywhere</CaseSectionHeading>
        <CaseProse>
          This is the <strong>Central Limit Theorem</strong>: add up enough small,
          independent random effects and the total is <em>always</em> normally
          distributed — remarkably, almost regardless of what each individual effect
          looks like. That&apos;s why the same bell shows up in wildly different
          places: human heights, measurement errors, the noise in a sensor, the
          spread of test scores, the jitter in a stock&apos;s daily returns. Each is
          a sum of many little randomnesses, so each becomes a bell.
        </CaseProse>
        <CaseProse>
          It&apos;s the mirror image of the rest of{" "}
          <Link href="/math" className="text-accent hover:underline">this series</Link>.
          π and Fourier build precise structure from exact rules; here, structure
          emerges from <em>pure chance</em> — and it&apos;s just as inevitable. Watch
          a thousand random balls agree on a single curve and you understand, in your
          gut, why randomness is so predictable in aggregate. Seeing is believing.
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
