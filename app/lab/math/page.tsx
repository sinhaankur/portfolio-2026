import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { MATH_SERIES } from "@/lib/math-series"

export const metadata: Metadata = {
  ...canonicalPath("/lab/math"),
  title: "Lab · Math — equations, made visible",
  description:
    "The Lab's mathematics collection: interactive visualizations that make an equation obvious — π, Euler's identity, Fourier, the golden ratio, Pythagoras, the bell curve, and the engine & ocean math. Real math, live.",
}

export default function LabMathPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <Link href="/lab" data-cursor-hover className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
            ← Back to the Lab
          </Link>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-6 mb-4">
            Lab · Math · Equations, visible
          </p>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] italic mb-6">
            The math collection.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed text-lg">
            Every equation has a picture that makes it <span className="italic">obvious</span>.
            Not a diagram of the answer — the thing itself, running, so you can watch
            <em> why</em> it&apos;s true. A growing set of interactive
            visualizations: real math, live, and open to anyone.
          </p>
          <p className="max-w-2xl text-muted-foreground leading-relaxed mt-4">
            A theme runs through them — the infinite and the inevitable. π never
            resolves, Fourier never quite squares, φ is the hardest number to pin
            down, and a thousand random balls always agree on a bell. Seeing one
            makes you trust the next.
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-12 md:mt-16 pb-24">
          <div className="grid gap-4 md:grid-cols-2">
            {MATH_SERIES.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                data-cursor-hover
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 md:p-7 hover:border-accent/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{p.tag}</span>
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-accent transition-colors">open →</span>
                </div>
                <h2 className="font-serif text-xl md:text-2xl text-foreground mb-2 group-hover:text-accent transition-colors">{p.title}</h2>
                <p className="text-sm text-foreground/70 leading-relaxed">{p.line}</p>
              </Link>
            ))}
          </div>

          <p className="text-sm text-foreground/55 leading-relaxed border-t border-border pt-8 mt-12 max-w-2xl">
            More to come — this set grows. Same instinct as the{" "}
            <Link href="/rag" data-cursor-hover className="text-accent hover:underline">RAG</Link> and{" "}
            <Link href="/llm" data-cursor-hover className="text-accent hover:underline">LLM</Link> explainers,
            and the engines themselves: make the invisible legible, from real data,
            for anyone. Seeing is believing.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
