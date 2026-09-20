import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
} from "@/components/case-study/case-study-layout"
import { PythagorasEmbed } from "@/components/pythagoras/pythagoras-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/pythagoras"),
  title: "Pythagoras — a² + b² = c², proven by area",
  description:
    "Not asserted — shown. Four identical right triangles, two arrangements of the same big square: one leaves holes of a² and b², the other a hole of c². Slide the triangles between them and watch the theorem prove itself.",
}

export default function PythagorasPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · Equations, visible"
      title="Pythagoras — a² + b² = c², proven by moving four triangles."
      subtitle="The oldest famous equation, and one you can prove without a single line of algebra — just by rearranging areas. Slide the triangles and watch it hold."
      period="2026"
      role="Interactive · real math, live"
      tags={["Mathematics", "Geometry", "Proof", "Canvas", "Teaching"]}
      backTo={{ label: "Back to the Math collection", href: "/lab/math" }}
      intro={
        <>
          <p>
            Part of the &ldquo;see the equation&rdquo; series (with{" "}
            <Link href="/lab/pi" className="text-accent hover:underline">π</Link>,{" "}
            <Link href="/lab/euler" className="text-accent hover:underline">Euler</Link>,{" "}
            <Link href="/lab/fourier" className="text-accent hover:underline">Fourier</Link>, and the{" "}
            <Link href="/lab/golden-ratio" className="text-accent hover:underline">golden ratio</Link>).
            This one&apos;s a different flavour: not an infinite process, but a proof
            you can hold in a single picture.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>The proof is the animation</CaseSectionHeading>
        <CaseProse>
          Take a big square of side <span className="font-serif italic">a + b</span> and
          fill it with four copies of the same right triangle. There are two ways to
          do it. One way leaves two square gaps — of area{" "}
          <span className="font-serif italic">a²</span> and{" "}
          <span className="font-serif italic">b²</span>. The other leaves a single
          tilted square gap of area <span className="font-serif italic">c²</span>.
          Same big square, same four triangles taken out both times — so the gaps
          must have equal area: <strong>a² + b² = c²</strong>. Slide{" "}
          <em>rearrange</em> to move the triangles between the two layouts, and drag
          the triangle-shape slider to confirm it holds for any right triangle.
        </CaseProse>
        <div className="mt-6">
          <PythagorasEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>Two kinds of mathematical truth</CaseSectionHeading>
        <CaseProse>
          This page is here partly as a contrast. π, Fourier and the golden ratio
          are truths of the <em>infinite</em> — processes you approach forever and
          never quite complete. Pythagoras is the other kind: a truth of the{" "}
          <em>finite</em>, settled completely by four triangles that either fit or
          don&apos;t. Both are proof; both are beautiful; and seeing them side by
          side is a small lesson in what &ldquo;proof&rdquo; even means — sometimes
          it&apos;s an endless converging sum, and sometimes it&apos;s a picture
          that leaves you nothing left to doubt.
        </CaseProse>
        <CaseProse>
          That&apos;s the whole point of{" "}
          <Link href="/math" className="text-accent hover:underline">this series</Link>:
          an equation isn&apos;t a string of symbols to memorize, it&apos;s a fact
          about the world with a shape you can watch take hold.
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
