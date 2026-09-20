import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
} from "@/components/case-study/case-study-layout"
import { FourierEmbed } from "@/components/fourier/fourier-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/fourier"),
  title: "Fourier — any wave is a sum of spinning circles",
  description:
    "A square wave looks nothing like a sine, yet it's built from pure sines added together. Draw each as a spinning circle, stack them, and their tip traces the wave. More circles, sharper corners — the Fourier series, made visible.",
}

export default function FourierPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · Equations, visible"
      title="Fourier — any wave is a sum of spinning circles."
      subtitle="A square wave and a sine share nothing to the eye — yet one is made of the other, added up. Draw each sine as a circle, stack them, and watch the shape appear."
      period="2026"
      role="Interactive · real math, live"
      tags={["Mathematics", "Fourier", "Waves", "Canvas", "Teaching"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            The next in the &ldquo;see the equation&rdquo; series (with{" "}
            <Link href="/lab/pi" className="text-accent hover:underline">Pie</Link> and{" "}
            <Link href="/lab/euler" className="text-accent hover:underline">Euler</Link>).
            Fourier&apos;s idea is one of the most far-reaching in all of science —
            and it becomes obvious the moment you watch circles do it.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>Circles that draw a square</CaseSectionHeading>
        <CaseProse>
          Each <span className="text-[#7c9cff]">circle</span> below is a single pure
          sine wave, spinning at an odd multiple of the base frequency (1×, 3×, 5×,
          7×…), each one smaller than the last. Chain them tip-to-tip and the final
          tip traces the <span className="text-[#ffe178]">wave</span> on the right.
          One circle is a plain sine; add more and the corners sharpen toward a
          square. Slide the count up and watch a square wave build itself out of
          nothing but circles.
        </CaseProse>
        <div className="mt-6">
          <FourierEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Why this matters everywhere</CaseSectionHeading>
        <CaseProse>
          Fourier&apos;s theorem says <em>any</em> repeating signal — a square wave,
          a musical chord, a heartbeat, the ocean&apos;s surface — can be written as
          a sum of pure sines. That single idea is the engine behind an astonishing
          amount of the modern world: it&apos;s how MP3 and JPEG compress (throw
          away the sines you can&apos;t perceive), how your phone&apos;s radio picks
          one station out of the air, how MRI turns signal into an image, how noise
          cancellation works. Learn to see a shape as its circles and you&apos;ve
          learned the language half of engineering speaks.
        </CaseProse>
        <CaseProse>
          It also ties this whole series together. The{" "}
          <Link href="/waves/math" className="text-accent hover:underline">ocean</Link>{" "}
          is a sum of sine-like wave trains — Fourier, in water. A circle is{" "}
          <Link href="/lab/euler" className="text-accent hover:underline">e^{"{iθ}"}</Link> —
          Fourier is most naturally written with Euler&apos;s rotating point. And,
          like <Link href="/lab/pi" className="text-accent hover:underline">π</Link>,
          it&apos;s an infinite sum: notice the small overshoot at each jump — the{" "}
          <em>Gibbs phenomenon</em> — that never fully vanishes with any finite
          number of circles. A perfect square is a limit you approach forever,
          never reach.
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
