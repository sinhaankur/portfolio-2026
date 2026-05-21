import type { Metadata } from "next"
import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"
import { Navbar } from "@/components/navbar"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"

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
        {/* Shared three-layer CSS starfield (also used as the hero's lazy-load fallback). */}
        <StaticStarfield />

        {/* Drifting planet — sits behind the type, scaled responsively */}
        <div
          aria-hidden="true"
          className="
            absolute -right-32 top-1/2 -translate-y-1/2
            w-105 h-105 sm:w-130 sm:h-130 md:w-160 md:h-160
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

