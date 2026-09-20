import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { CaseSectionHeading, CaseProse } from "@/components/case-study/case-study-layout"
import { CinematicStage, MathBody } from "@/components/math/cinematic-stage"
import { EulerEmbed } from "@/components/euler/euler-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/euler"),
  title: "Euler's Identity — e^{iπ} + 1 = 0, made obvious",
  description:
    "The most beautiful equation in mathematics isn't mystical once you see it: e^{iθ} is a point on the unit circle, and at θ = π it lands exactly on −1. Sweep the angle and watch e^{iπ} + 1 = 0 happen.",
}

export default function EulerPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />

      <CinematicStage
        title={<>Euler — <span className="not-italic">e</span><sup>iπ</sup> + 1 = 0.</>}
        subtitle="The 'most beautiful equation' is usually taught as a mystery. It isn't one — it's a point taking half a turn around a circle. Watch it land on −1."
      >
        <EulerEmbed />
      </CinematicStage>

      <MathBody>
        <section>
          <CaseSectionHeading>The picture that explains it</CaseSectionHeading>
          <CaseProse>
            The one idea you need: <span className="font-serif italic">e^{"{iθ}"}</span>{" "}
            is a point on the unit circle at angle θ. That&apos;s it. Its position is{" "}
            <span className="font-serif italic">cos θ + i·sin θ</span> — its shadow on
            the real axis is the cosine, on the imaginary axis the sine. Sweep θ in
            the stage above and the point walks around the circle. Send it half a
            turn — θ = π — and it lands on the far side, at −1. So{" "}
            <span className="font-serif italic">e^{"{iπ}"} = −1</span>, i.e.{" "}
            <span className="font-serif italic">e^{"{iπ}"} + 1 = 0</span>.
          </CaseProse>
        </section>

        <section>
          <CaseSectionHeading>Why raising e to an imaginary power spins</CaseSectionHeading>
          <CaseProse>
            The honest reason, briefly. Ordinary{" "}
            <span className="font-serif italic">e^x</span> is the function that is its
            own rate of change — it grows in proportion to where it is. Put an{" "}
            <span className="font-serif italic">i</span> in the exponent and that
            &ldquo;grow outward&rdquo; becomes &ldquo;turn sideways&rdquo;: the rate
            of change is now always at a right angle to the position. A thing that
            always moves at 90° to where it points travels in a <em>circle</em>, at
            constant speed. So <span className="font-serif italic">e^{"{iθ}"}</span>{" "}
            circles the origin, one radian of angle per unit of θ — which is exactly
            why θ = π (π radians = half the circle) puts it at −1.
          </CaseProse>
          <CaseProse>
            That&apos;s also the bridge to{" "}
            <Link href="/lab/pi" className="text-accent hover:underline">π</Link>: π
            isn&apos;t chosen here, it&apos;s <em>forced</em> — it&apos;s the amount of
            turning that gets you halfway around, so it&apos;s the exact angle where
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
            unit of rotation (a 90° turn) · <strong>π</strong> — half a turn around
            the circle · <strong>1</strong> — the unit, the radius we started from ·{" "}
            <strong>0</strong> — where it all balances out. The equation says: grow
            (e), but turned sideways (i), for half a lap (π), from the unit (1), and
            you arrive exactly opposite — which, added back to 1, is nothing (0). Seen
            this way it isn&apos;t a mystery to memorize; it&apos;s a sentence about a
            circle you can watch happen.
          </CaseProse>
        </section>

        <p className="text-sm text-foreground/55 leading-relaxed border-t border-border pt-8">
          Part of{" "}
          <Link href="/lab/math" className="text-accent hover:underline">the math collection</Link>{" "}
          — equations you can watch. Next door:{" "}
          <Link href="/lab/pi" className="text-accent hover:underline">π</Link>{" "}
          (the angle that lands you here) and{" "}
          <Link href="/lab/fourier" className="text-accent hover:underline">Fourier</Link>{" "}
          (this rotating point, summed into any wave).
        </p>
      </MathBody>
      <Footer />
    </>
  )
}
