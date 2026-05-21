import type { Metadata } from "next"
import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"
import { Navbar } from "@/components/navbar"

export const metadata: Metadata = {
  title: "Drifted off course · 404",
  description:
    "This page isn't on the chart. Return to the home orbit or jump to any of the visible bodies.",
  robots: { index: false, follow: true },
}

const escapeRoutes = [
  { label: "Home orbit", href: "/" },
  { label: "The Lab — Unhosted", href: "/lab/unhosted" },
  { label: "Works", href: "/#works" },
  { label: "Skills", href: "/skills" },
  { label: "Upcoming", href: "/upcoming" },
]

export default function NotFound() {
  return (
    <>
      <CustomCursor />
      <Navbar />

      <main
        id="main"
        className="
          relative min-h-screen w-full overflow-hidden
          dark bg-background text-foreground
          flex items-center justify-center
          px-6 md:px-12 pt-24 pb-16
        "
        style={{ colorScheme: "dark" }}
      >
        {/* Layered starfields — pure CSS so this page stays under ~2 kB. */}
        <Starfield density="dense" sizePx={1.5} blur={0} opacity={0.6} parallax={0} />
        <Starfield density="mid"   sizePx={2}   blur={0.5} opacity={0.5} parallax={0} />
        <Starfield density="sparse" sizePx={3} blur={1} opacity={0.7} parallax={0} />

        {/* Drifting planet — sits behind the type, scaled responsively */}
        <div
          aria-hidden="true"
          className="
            absolute -right-32 top-1/2 -translate-y-1/2
            w-[420px] h-[420px] sm:w-[520px] sm:h-[520px] md:w-[640px] md:h-[640px]
            rounded-full
            motion-safe:animate-pulse
          "
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #ff5b50 0%, #ff3b30 25%, #6e1610 60%, transparent 75%)",
            filter: "blur(2px)",
            opacity: 0.55,
          }}
        />

        {/* Content — clamps from phone to ultra-wide */}
        <div className="relative z-10 max-w-3xl">
          <p className="font-mono text-[10px] sm:text-xs tracking-[0.3em] uppercase text-foreground/55 mb-6">
            404 · Off the chart
          </p>
          <h1
            className="
              font-display font-light tracking-[-0.02em] leading-[1.02]
              text-5xl sm:text-6xl md:text-7xl lg:text-8xl
              text-foreground text-balance
            "
          >
            You've drifted{" "}
            <span className="italic">past the last orbit.</span>
          </h1>
          <p className="mt-6 sm:mt-8 max-w-xl font-sans text-base sm:text-lg text-foreground/80 leading-relaxed">
            This page isn't on the chart. Either the link aged out, or you found
            a coordinate I never reached. Pick a body below and we'll get you
            back inside the heliopause.
          </p>

          <ul className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-xl">
            {escapeRoutes.map((route, i) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  data-cursor-hover
                  className="
                    group flex items-center justify-between gap-3
                    px-4 py-3 sm:py-3.5 rounded-full
                    border border-foreground/25 bg-background/40 backdrop-blur-sm
                    hover:border-accent/60 hover:bg-foreground/5
                    transition-colors duration-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                    focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  "
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[10px] tracking-widest text-accent shrink-0">
                      0{i + 1}
                    </span>
                    <span className="font-sans text-sm sm:text-base text-foreground/90 truncate">
                      {route.label}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-foreground/55 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-300"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  )
}

/**
 * Inline starfield — multi-layer radial-gradient backgrounds tile across the
 * viewport. Pure CSS, no JS, no canvas — sized in px so density stays
 * consistent from phone (320 px) to retina ultra-wide (3840 px+).
 */
function Starfield({
  density,
  sizePx,
  blur,
  opacity,
}: {
  density: "sparse" | "mid" | "dense"
  sizePx: number
  blur: number
  opacity: number
  parallax: number
}) {
  const tilePx = density === "dense" ? 140 : density === "mid" ? 220 : 320
  // Pre-computed pseudo-random star coordinates per density layer so the
  // server-rendered HTML matches the client render (no hydration mismatch).
  const seeds: Record<string, [number, number][]> = {
    dense: [[12, 18], [37, 56], [68, 22], [83, 73], [22, 88], [54, 41], [91, 32]],
    mid:   [[18, 28], [62, 14], [80, 60], [44, 78], [8, 64]],
    sparse: [[30, 40], [70, 70], [50, 12]],
  }
  const stars = seeds[density]
  const gradients = stars
    .map(
      ([xPct, yPct]) =>
        `radial-gradient(${sizePx}px ${sizePx}px at ${xPct}% ${yPct}%, rgba(255,255,255,${opacity}) 0%, transparent 60%)`,
    )
    .join(",")

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: gradients,
        backgroundSize: `${tilePx}px ${tilePx}px`,
        backgroundRepeat: "repeat",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    />
  )
}
