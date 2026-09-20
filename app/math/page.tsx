import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/math"),
  title: "Mathematics, made visible",
  description:
    "Every equation has a picture that makes it obvious. A growing set of interactive visualizations — π, Euler's identity, Fourier series, the golden ratio, the ocean's waves — each showing the real math, live, so you can see why it's true.",
}

// The hub for the "equations, visible" series. Each entry links a live page.
const PIECES: { href: string; title: string; line: string; tag: string }[] = [
  {
    href: "/lab/pi",
    title: "π — why it never ends",
    line: "A two-arm curve whose irrational ratio never closes — the visceral reason π has no exact value. Plus three ways to compute it, live.",
    tag: "Irrationality",
  },
  {
    href: "/lab/euler",
    title: "Euler's identity — e^(iπ) + 1 = 0",
    line: "The 'most beautiful equation' is just a point taking half a turn around a circle. Sweep the angle and watch it land on −1.",
    tag: "Complex plane",
  },
  {
    href: "/lab/fourier",
    title: "Fourier — any wave is spinning circles",
    line: "A square wave built from pure sines, drawn as stacked epicycles. The idea behind MP3, JPEG, radio and MRI, made visible.",
    tag: "Signals",
  },
  {
    href: "/lab/golden-ratio",
    title: "The golden ratio — φ, and sunflowers",
    line: "Fibonacci homes in on 1.618…, the 'most irrational' number — which is exactly why seeds at the golden angle pack perfectly.",
    tag: "Nature",
  },
  {
    href: "/waves/math",
    title: "Waves — the ocean's real math",
    line: "Gerstner trochoidal waves: watch water particles circle to make sharp crests, then sum trains into a living sea.",
    tag: "Physics",
  },
  {
    href: "/universe-engine/math",
    title: "The Universe Engine — orbital math",
    line: "The real equations that place the planets and satellites: Kepler, SGP4, J2000 — shown beside the code that runs them.",
    tag: "Astronomy",
  },
]

export default function MathHubPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Equations, visible
          </p>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] italic mb-6">
            Mathematics, made visible.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed text-lg">
            Every equation has a picture that makes it <span className="italic">obvious</span>.
            Not a diagram of the answer — the thing itself, running, so you can watch
            <em> why</em> it&apos;s true. This is a growing set of interactive
            visualizations: real math, live, honest, and open to anyone.
          </p>
          <p className="max-w-2xl text-muted-foreground leading-relaxed mt-4">
            A theme runs through them — the infinite. π never resolves, Fourier
            never quite squares, φ is the hardest number to pin down. Seeing one
            makes you trust the next.
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-12 md:mt-16 pb-24">
          <div className="grid gap-4 md:grid-cols-2">
            {PIECES.map((p) => (
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
