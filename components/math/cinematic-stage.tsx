import Link from "next/link"

// Shared cinematic-first hero for the math series: a full-bleed black stage that
// the interactive viz fills, with the title floating over it and a scroll cue.
// You land on the art, not a paper header. Used by /lab/pi, /lab/euler, etc. so
// every page in the series opens the same directed way.

export function CinematicStage({
  title,
  subtitle,
  children,          // the interactive embed
  heightClass = "h-[84vh] min-h-[500px]",
}: {
  title: React.ReactNode
  subtitle: string
  children: React.ReactNode
  heightClass?: string
}) {
  return (
    <section className="relative bg-black">
      <div className={`relative w-full ${heightClass}`}>
        <div className="absolute inset-0">{children}</div>

        {/* floating title over the stage */}
        <div className="pointer-events-none absolute top-20 md:top-24 left-5 md:left-10 z-20 max-w-xl">
          <Link
            href="/lab/math"
            className="pointer-events-auto font-mono text-[10px] tracking-widest uppercase text-white/45 hover:text-white/80 transition-colors"
          >
            ← Math collection
          </Link>
          <h1 className="mt-4 font-serif italic text-4xl md:text-6xl leading-[1.03] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.85)]">
            {title}
          </h1>
          <p className="mt-4 font-sans text-sm md:text-base text-white/70 max-w-md drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]">
            {subtitle}
          </p>
        </div>

        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] tracking-widest uppercase text-white/40 animate-pulse pointer-events-none">
          scroll to read ↓
        </div>
      </div>
    </section>
  )
}

// The prose body that follows the stage — consistent width + spacing.
export function MathBody({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 md:px-10 py-16 md:py-24 space-y-14 md:space-y-20">
        {children}
      </div>
    </main>
  )
}
