import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { CaseSectionHeading, CaseProse } from "@/components/case-study/case-study-layout"
import { CinematicStage, MathBody } from "@/components/math/cinematic-stage"
import { LogEmbed } from "@/components/log/log-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/logarithms"),
  title: "Logarithms — how a 'log book' multiplied huge numbers by hand",
  description:
    "A logarithm turns multiplication into addition. On a log scale, the distance from 1 to a number is its logarithm — so laying two lengths end to end multiplies the numbers. That's a slide rule, and it's why log tables ran the world for 300 years.",
}

export default function LogPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />

      <CinematicStage
        title={<>Logarithms — <span className="not-italic">adding = multiplying.</span></>}
        subtitle="The trick behind the old 'log book' and the slide rule: on a log scale, distance is the logarithm — so laying two lengths end to end multiplies the numbers. Watch a × b happen as a slide."
        heightClass="h-[80vh] min-h-[460px]"
      >
        <LogEmbed />
      </CinematicStage>

      <MathBody>
        <section>
          <CaseSectionHeading>The whole idea: adding becomes multiplying</CaseSectionHeading>
          <CaseProse>
            A logarithm answers &ldquo;what power do I raise 10 to, to get this
            number?&rdquo; — so log(10) = 1, log(100) = 2, log(1000) = 3. The magic
            property is one line: <strong>log(a·b) = log(a) + log(b)</strong>. Taking
            a log turns a hard multiplication into an easy addition, and taking the
            anti-log turns it back. That single fact is the engine above.
          </CaseProse>
          <CaseProse>
            On a <em>log scale</em>, the distance from 1 to any number <em>is</em> its
            logarithm — which is why 1, 10 and 100 sit evenly spaced even though
            they&apos;re wildly different sizes. So to multiply a × b, you lay the
            length &ldquo;1 to a&rdquo; down, then lay &ldquo;1 to b&rdquo; on the end
            of it. Because the lengths are logarithms, adding them adds the logs —
            and where you land is the number whose log is that sum: a·b. You just
            multiplied by adding two sticks together.
          </CaseProse>
        </section>

        <section>
          <CaseSectionHeading>Why this ran the world for 300 years</CaseSectionHeading>
          <CaseProse>
            Before calculators, multiplying big numbers by hand was slow and
            error-prone. So in 1614 John Napier published tables of logarithms — the
            original <em>log book</em>. To multiply two ugly numbers you&apos;d look
            up each one&apos;s log, <em>add</em> the two logs (easy), then look up the
            anti-log. Hard multiplication became simple addition. Engineers,
            navigators, astronomers and physicists carried log tables for
            <em> three centuries</em>.
          </CaseProse>
          <CaseProse>
            The <strong>slide rule</strong> is just this made physical: two log
            scales that slide against each other, so you add lengths mechanically
            instead of looking numbers up. It&apos;s literally the animation above,
            in wood and plastic. Slide rules put people on the Moon — the Apollo
            engineers ran them by hand. They only vanished in the 1970s when the
            pocket calculator arrived. If you ever wondered why that strange
            unevenly-spaced ruler existed, this is it: it multiplies by adding.
          </CaseProse>
        </section>

        <section>
          <CaseSectionHeading>Where logs still hide</CaseSectionHeading>
          <CaseProse>
            Logarithms didn&apos;t retire with the slide rule — they&apos;re
            everywhere your senses and your data compress a huge range into a
            manageable one. The <strong>decibel</strong> (sound), the{" "}
            <strong>Richter scale</strong> (earthquakes), <strong>pH</strong>
            (acidity), stellar <strong>magnitude</strong> (brightness), and the log
            axes on half the charts you&apos;ve seen — all use logs to turn
            &ldquo;×10 bigger&rdquo; into &ldquo;+1 step.&rdquo; Even your ear hears
            pitch logarithmically: each octave is a <em>doubling</em> of frequency,
            spaced evenly. Multiplication, felt as addition — the same trick, running
            quietly under a lot of the world.
          </CaseProse>
        </section>

        <p className="text-sm text-foreground/55 leading-relaxed border-t border-border pt-8">
          Part of{" "}
          <Link href="/lab/math" className="text-accent hover:underline">the math collection</Link>{" "}
          — equations you can watch. See also{" "}
          <Link href="/lab/golden-ratio" className="text-accent hover:underline">the golden ratio</Link>{" "}
          and{" "}
          <Link href="/lab/pi" className="text-accent hover:underline">π</Link>.
        </p>
      </MathBody>
      <Footer />
    </>
  )
}
