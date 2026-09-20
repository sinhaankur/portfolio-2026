import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
} from "@/components/case-study/case-study-layout"
import { PiIrrationalEmbed, PiLabEmbed } from "@/components/pi/pi-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/pi"),
  title: "Pie — how π is calculated, and why it never ends",
  description:
    "π is computed, never finished. Watch it three ways — Archimedes' polygons squeezing a circle, Leibniz's infinite series, Monte-Carlo darts — and see, in a two-arm curve that never closes, exactly why an irrational number has no exact value.",
}

export default function PiPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · Pie"
      title="Pie — how π is calculated, and why it never ends."
      subtitle="π isn't looked up, it's computed — by squeezing, by summing forever, by throwing darts. And because it's irrational, every method only ever gets close. Here's that, made visible."
      period="2026"
      role="Interactive · real math, live"
      tags={["Mathematics", "π", "Canvas", "Irrationality", "Teaching"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            Everyone knows π ≈ 3.14. Fewer have <em>watched</em> it be calculated —
            and almost no one is shown <em>why</em> it has no exact value. This is
            both: the real ways we compute π, animated live, and a curve that shows
            irrationality with your own eyes.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>Why π never completes</CaseSectionHeading>
        <CaseProse>
          Start here, because it&apos;s the beautiful part. Give a point two arms:
          the first turns at one speed, the second at π times that speed, and its
          tip draws the curve. Whether the curve ever <em>closes</em> depends only
          on that ratio. A whole-number or fraction ratio lines up after a few
          turns and closes into a finite flower. But <strong>π is irrational</strong> —
          no whole number of turns of one arm ever matches the other — so the tip
          never returns to its start, and the curve draws new petals forever.
          That&apos;s the same fact as &ldquo;π has no exact decimal&rdquo;: an
          irrational number never resolves into a clean, repeating whole. Switch the
          ratio and see rational-closes vs π-never-does, side by side.
        </CaseProse>
        <div className="mt-6">
          <PiIrrationalEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Three ways to actually compute it</CaseSectionHeading>
        <CaseProse>
          π is never <em>stored</em> as a final number — it&apos;s always the limit
          of a process that never finishes. Three classic processes, each running
          live below, each converging digit by digit (the green digits are the ones
          that have stopped changing — the value &ldquo;locked in&rdquo; so far):
        </CaseProse>
        <div className="mt-6">
          <PiLabEmbed />
        </div>
        <CaseProse>
          Notice the shared truth across all three — polygons, an infinite sum, and
          random darts have nothing in common except this: each <em>approaches</em>
          π and none <em>arrives</em>. Add more sides, more terms, more darts, and
          you buy more correct digits — but never the last one, because there is no
          last one.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>So why is there no exact value?</CaseSectionHeading>
        <CaseProse>
          Two deeper facts, both proven:
        </CaseProse>
        <CaseProse>
          <strong>π is irrational</strong> (Lambert, 1761) — it cannot be written as
          a fraction of two whole numbers. So its decimals never terminate and never
          fall into a repeating cycle; they go on, without pattern, forever. That is
          exactly what the two-arm curve shows: a fraction would close the loop, and
          π refuses to be a fraction.
        </CaseProse>
        <CaseProse>
          <strong>π is transcendental</strong> (Lindemann, 1882) — it isn&apos;t the
          root of any polynomial with whole-number coefficients. It sits beyond the
          numbers you can build with ordinary algebra. This is the fact that finally
          settled &ldquo;squaring the circle&rdquo; — you cannot, ever — and it&apos;s
          why π can only be reached by an endless process, never captured by a finite
          formula that spits out the whole thing.
        </CaseProse>
        <CaseProse>
          So &ldquo;what is π, exactly?&rdquo; has an honest answer: π <em>is</em> the
          process. It&apos;s the number every one of these methods is walking toward
          and will never stop walking toward. The wonder isn&apos;t that we can&apos;t
          find the last digit — it&apos;s that a number with no end is written into
          every circle that has ever existed.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>Where the infinite series really came from — India</CaseSectionHeading>
        <CaseProse>
          The &ldquo;Leibniz series&rdquo; above has the wrong name. It was found
          around <strong>1400 CE by Mādhava of Sangamagrāma</strong>, founder of the{" "}
          <strong>Kerala school of astronomy and mathematics</strong> — nearly{" "}
          <em>three centuries</em> before Leibniz and Gregory in Europe. Mādhava
          derived the infinite series π/4 = 1 − 1/3 + 1/5 − 1/7 + … (rightly the{" "}
          <strong>Mādhava–Leibniz series</strong>), and, knowing how slowly it
          converges, also worked out faster-converging corrections — the beginnings
          of calculus-style analysis, done in Kerala. It&apos;s recorded in later
          Kerala texts such as Nīlakaṇṭha&apos;s <em>Tantrasaṅgraha</em> and the{" "}
          <em>Yuktibhāṣā</em>.
        </CaseProse>
        <CaseProse>
          Five centuries on, <strong>Srinivasa Ramanujan</strong> (1887–1920) gave
          π formulas of a completely different order — series that add roughly{" "}
          <em>eight correct digits per term</em>. His 1914 series (and the
          Chudnovsky formula built on the same idea) are what modern record
          computations of π — into the tens of trillions of digits — still run
          today. The fastest known way to compute π traces straight back to him.
        </CaseProse>
        <CaseProse>
          It&apos;s worth stating plainly: the idea that π could be reached by an{" "}
          <em>infinite process</em> — the very thing this page is about — was an
          Indian insight first, from Kerala, long before it appeared in Europe. The
          history of a number with no end has a beginning, and part of it is here.
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
