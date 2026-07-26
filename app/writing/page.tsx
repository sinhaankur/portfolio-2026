import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"
import { SHORT_POSTS } from "@/lib/writing-posts"

export const metadata: Metadata = {
  ...canonicalPath("/writing"),
  // Root layout appends "· Ankur Sinha" — keep this standalone to avoid doubling.
  title: "Writing",
  description:
    "Notes on building things: the Universe Engine, real-data 3D, design-in-code, and the reasoning behind the work.",
}

// Hand-built long-form essays (their own routes) + the data-driven short posts,
// merged and sorted newest-first.
const longForm = [
  {
    slug: "universe-engine",
    title: "How I built a real-data universe engine",
    date: "2026-07-05",
    blurb:
      "18,500 satellites on real SGP4 orbits, a true-scale solar system, Mars rover coverage, and validated Earth→Mars transfer math — all in the browser, all from real data. The how and the why.",
  },
]
const posts = [
  ...longForm,
  ...SHORT_POSTS.map((p) => ({ slug: p.slug, title: p.title, date: p.date, blurb: p.blurb })),
].sort((a, b) => (a.date < b.date ? 1 : -1))

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export default function WritingIndex() {
  return (
    <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <Link
        href="/"
        className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        sinhaankur.com
      </Link>

      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-3">Writing</p>
      <h1 className="font-display text-4xl md:text-5xl font-light tracking-[-0.02em] leading-[1.05] mb-4">
        Notes on the work.
      </h1>
      <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed max-w-2xl mb-14">
        How the things on this site are built, and the reasoning behind them. Real data, honest
        engineering, no hand-waving.
      </p>

      <ul className="space-y-10">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/writing/${p.slug}`} className="group block">
              <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-2">
                {fmtDate(p.date)}
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground group-hover:text-accent transition-colors mb-2">
                {p.title}
              </h2>
              <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl">
                {p.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
