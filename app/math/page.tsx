import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { MATH_SERIES as PIECES } from "@/lib/math-series"

export const metadata: Metadata = {
  ...canonicalPath("/math"),
  title: "Mathematics, made visible",
  description:
    "Every equation has a picture that makes it obvious. A growing set of interactive visualizations — π, Euler's identity, Fourier series, the golden ratio, Pythagoras, the bell curve, the ocean's waves — each showing the real math, live, so you can see why it's true.",
}

export default function MathHubPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      {/* This hub is laid out on the golden ratio itself — the same φ that one of
          its visualizations is about. Type sizes step by φ (--text-phi-*), vertical
          rhythm and gaps use the φ spacing ramp (--spacing-phi-*), and the intro is
          a 62/38 golden split. "A proven way of making things." */}
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10 golden-split items-start">
          <div>
            <p className="font-mono uppercase text-muted-foreground" style={{ fontSize: "var(--text-phi--1)", letterSpacing: "0.3em", marginBottom: "var(--space-phi-3)" }}>
              Equations, visible
            </p>
            <h1 className="font-serif leading-[1.05] italic" style={{ fontSize: "var(--text-phi-5)", marginBottom: "var(--space-phi-3)" }}>
              Mathematics, made visible.
            </h1>
            <p className="text-foreground/75 leading-relaxed" style={{ fontSize: "var(--text-phi-1)" }}>
              Every equation has a picture that makes it <span className="italic">obvious</span>.
              Not a diagram of the answer — the thing itself, running, so you can watch
              <em> why</em> it&apos;s true. This is a growing set of interactive
              visualizations: real math, live, honest, and open to anyone.
            </p>
          </div>
          <p className="text-muted-foreground leading-relaxed md:pt-[var(--space-phi-6)]">
            A theme runs through them — the infinite. π never resolves, Fourier
            never quite squares, φ is the hardest number to pin down. Seeing one
            makes you trust the next.
            <span className="mt-[var(--space-phi-3)] block font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">
              this page is proportioned by φ
            </span>
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 pb-24" style={{ marginTop: "var(--space-phi-6)" }}>
          <div className="grid md:grid-cols-2" style={{ gap: "var(--space-phi-3)" }}>
            {PIECES.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                data-cursor-hover
                className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-accent/60 transition-colors"
                style={{ padding: "var(--space-phi-4)" }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-phi-2)" }}>
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{p.tag}</span>
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-accent transition-colors">open →</span>
                </div>
                <h2 className="font-serif text-foreground group-hover:text-accent transition-colors" style={{ fontSize: "var(--text-phi-2)", marginBottom: "var(--space-phi-1)" }}>{p.title}</h2>
                <p className="text-foreground/70 leading-relaxed" style={{ fontSize: "var(--text-phi-0)" }}>{p.line}</p>
              </Link>
            ))}
          </div>

          <p className="text-sm text-foreground/55 leading-relaxed border-t border-border max-w-2xl" style={{ paddingTop: "var(--space-phi-4)", marginTop: "var(--space-phi-5)" }}>
            More to come — this set grows. It&apos;s the same instinct behind the{" "}
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
