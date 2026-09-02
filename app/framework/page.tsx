import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { FrameworkGuide } from "@/components/framework-guide"

export const metadata: Metadata = {
  ...canonicalPath("/framework"),
  title: "Universal Experience Framework — Laws of UX, Motion & Adaptability",
  description:
    "Ankur Sinha's working UX framework: the cognitive laws (Hick's, Fitts's, Miller's, Jakob's, Gestalt, Peak-End...), Nielsen's heuristics, motion & time (Doherty threshold, spring vs tween), adaptability across age, ability, culture, literacy, device and context, WCAG 2.2 accessibility, and a working method for any screen. The why behind good design.",
}

export default function FrameworkPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28 pb-24">
        {/* Header */}
        <header className="mb-20 md:mb-28">
          <Container>
            <div className="max-w-3xl">
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-6">
                Universal Experience Framework 1.1
              </p>
              <h1 className="font-display text-5xl md:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-balance">
                Laws of UX <span className="italic">&amp;</span> Cognition.
              </h1>
              <p className="mt-6 font-sans text-lg md:text-xl text-foreground/70 leading-relaxed">
                My working guide for shaping product experiences — the principles,
                the cognitive laws behind why designs work, the heuristics to
                evaluate them, and a method to run on any screen. Both a reference
                and an applied practice.
              </p>
              <p className="mt-4 font-sans text-sm text-muted-foreground leading-relaxed">
                A single body of thinking so hundreds of individual decisions add
                up to one product that feels made by one team. When a spec and a
                principle conflict, the principle wins — and the spec gets fixed.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] tracking-widest uppercase">
                <a
                  href="/ankur-sinha-uxd-framework.md"
                  download
                  data-cursor-hover
                  className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-4 py-2 text-accent hover:bg-accent/20 transition-colors"
                >
                  ↓ Framework (Markdown)
                </a>
                <span className="text-muted-foreground/70 normal-case tracking-normal font-sans">
                  Licensed <span className="text-foreground/70">Ankur Sinha UXD</span> · free to read + cite with attribution
                </span>
              </div>
            </div>
          </Container>
        </header>

        <FrameworkGuide />
      </main>
      <Footer />
    </>
  )
}
