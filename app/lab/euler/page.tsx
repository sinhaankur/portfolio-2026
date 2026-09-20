import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
} from "@/components/case-study/case-study-layout"
import { EulerEmbed } from "@/components/euler/euler-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/euler"),
  title: "Euler's Identity — e^{iπ} + 1 = 0, made obvious",
  description:
    "The most beautiful equation in mathematics isn't mystical once you see it: e^{iθ} is a point on the unit circle, and at θ = π it lands exactly on −1. Sweep the angle and watch e^{iπ} + 1 = 0 happen.",
}

export default function EulerPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · Equations, visible"
      title="Euler's identity — e^{iπ} + 1 = 0, made obvious."
      subtitle="Called the most beautiful equation in mathematics — and usually taught as a mystery. It isn't one. It's a point taking half a turn around a circle. Watch it."
      period="2026"
      role="Interactive · real math, live"
      tags={["Mathematics", "Complex plane", "Euler", "Canvas", "Teaching"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            Every equation has a picture that makes it obvious — the whole point of
            this series (see also{" "}
            <Link href="/lab/pi" className="text-accent hover:underline">Pie</Link>).
            Euler&apos;s identity looks like five unrelated constants colliding by
            magic. Show the picture and the magic becomes a half-turn.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>The picture that explains it</CaseSectionHeading>
        <CaseProse>
          The one idea you need: <span className="font-serif italic">e^{"{iθ}"}</span>{" "}
          is a point on the unit circle at angle θ. That&apos;s it. Its position is{" "}
          <span className="font-serif italic">cos θ + i·sin θ</span> — its shadow on
          the real axis is the cosine, on the imaginary axis the sine. Sweep θ and
          the point walks around the circle. Send it half a turn — θ = π — and it
          lands on the far side, at −1. So{" "}
          <span className="font-serif italic">e^{"{iπ}"} = −1</span>, i.e.{" "}
          <span className="font-serif italic">e^{"{iπ}"} + 1 = 0</span>. Sweep it
          yourself:
        </CaseProse>
        <div className="mt-6">
          <EulerEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Why raising e to an imaginary power spins</CaseSectionHeading>
        <CaseProse>
          The honest reason, briefly. Ordinary <span className="font-serif italic">e^x</span>{" "}
          is the function that is its own rate of change — it grows in proportion to
          where it is. Put an <span className="font-serif italic">i</span> in the
          exponent and that &ldquo;grow outward&rdquo; becomes &ldquo;turn
          sideways&rdquo;: the rate of change is now always at a right angle to the
          position. A thing that always moves at 90° to where it points travels in a{" "}
          <em>circle</em>, at constant speed. So{" "}
          <span className="font-serif italic">e^{"{iθ}"}</span> circles the origin,
          one radian of angle per unit of θ — which is exactly why θ = π (π radians =
          half the circle) puts it at −1.
        </CaseProse>
        <CaseProse>
          That&apos;s also the bridge to <Link href="/lab/pi" className="text-accent hover:underline">π</Link>:
          π isn&apos;t chosen here, it&apos;s <em>forced</em> — it&apos;s the amount
          of turning that gets you halfway around, so it&apos;s the exact angle where
          the circle crosses −1.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>The five constants, and why it feels beautiful</CaseSectionHeading>
        <CaseProse>
          What makes people call it beautiful is that one short line binds the five
          most important numbers in mathematics, each earning its place honestly —
          not as a coincidence:
        </CaseProse>
        <CaseProse>
          <strong>e</strong> — the natural rate of growth · <strong>i</strong> — the
          unit of rotation (a 90° turn) · <strong>π</strong> — half a turn around the
          circle · <strong>1</strong> — the unit, the radius we started from ·{" "}
          <strong>0</strong> — where it all balances out. The equation says: grow
          (e), but turned sideways (i), for half a lap (π), from the unit (1), and
          you arrive exactly opposite — which, added back to 1, is nothing (0). Seen
          this way it isn&apos;t a mystery to memorize; it&apos;s a sentence about a
          circle you can watch happen.
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
