import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"
import { ParallaxBackdrop } from "@/components/parallax-backdrop"
import { WarmthMotif } from "@/components/warmth-motif"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  ...canonicalPath("/vera"),
  title: "Anita Sinha — my mother, and the twin built to keep her warmth close",
  description:
    "A page for my mother, Anita Sinha — the person the Cognitive Twin (Vera) was built for: a local-first, on-device way to keep a loved one's voice, warmth, and character close.",
  keywords: ["Anita Sinha", "Vera", "cognitive twin", "memory", "on-device voice"],
}

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Anita Sinha",
  description:
    "Mother of Ankur Sinha; the person for whom the Cognitive Twin (Vera) was built.",
  sameAs: ["https://www.linkedin.com/in/anita-sinha-02a44174/"],
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-16 mb-4">
      {children}
    </h2>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}

export default function VeraPage() {
  return (
    <main className="relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />

      {/* A soft warm glow at the top — the "warmth" the whole page is about. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] -z-10"
        style={{
          background:
            "radial-gradient(120% 60% at 50% -10%, color-mix(in oklch, var(--accent) 22%, transparent) 0%, transparent 60%)",
        }}
      />

      {/* Rising motes of warmth, drifting on scroll. */}
      <ParallaxBackdrop speed={0.18}>
        <WarmthMotif />
      </ParallaxBackdrop>

      <div className="mx-auto max-w-3xl px-6 md:px-12 py-16 md:py-24">
        <Link
          href="/about"
          className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          About
        </Link>

        {/* Hero — centered, serif, tender. */}
        <header className="text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent/80 mb-6">
            In loving memory
          </p>

          {/* A haloed circle for her. When a photo is added at
              public/img/about/anita.webp, swap the monogram for an <Image>.
              Until then it degrades to a soft serif monogram — never a broken
              image at the top of her page. */}
          <figure className="mx-auto mb-8 w-40 h-40 md:w-48 md:h-48">
            <div className="relative w-full h-full rounded-full overflow-hidden border border-accent/25 shadow-[0_0_60px_-12px_var(--accent)] bg-gradient-to-b from-secondary/40 to-secondary/10 flex items-center justify-center">
              <span className="font-display text-6xl md:text-7xl font-light text-accent/70 select-none" aria-hidden>
                A
              </span>
            </div>
          </figure>

          <h1 className="font-display text-4xl md:text-6xl font-light tracking-[-0.02em] leading-[1.02] mb-5">
            Anita Sinha
          </h1>
          <p className="font-serif italic text-xl md:text-2xl text-foreground/70 leading-snug max-w-xl mx-auto">
            Some people you carry with you. This is my way of keeping her warmth close.
          </p>
        </header>

        <div className="mx-auto mt-16 w-12 h-px bg-accent/40" />

        <article className="mt-16">
          <H2>Her story</H2>
          <P>
            {/* Anita's fuller story goes here, in Ankur's words, when he's ready.
                Deliberately not invented — this space is hers to hold. */}
            Her story belongs here — who she was, what she loved, the way she shaped the people around
            her. I&apos;m writing it slowly, in her own spirit and mine, and it will live on this page.
            Until then, her professional journey is on her{" "}
            <a
              href="https://www.linkedin.com/in/anita-sinha-02a44174/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              LinkedIn
            </a>{" "}
            profile.
          </P>

          <H2>Why the twin exists</H2>
          <P>
            The <Link href="/lab/cognitive-twin" className="text-accent hover:underline">Cognitive Twin</Link> —
            which I named <em className="font-serif not-italic"><span className="italic">Vera</span></em> in
            her honour — was built for her: a private, on-device companion that can hold a loved
            one&apos;s voice, warmth, and character. Not for impersonation — only to keep a person close.
            It runs entirely on the machine; nothing ever leaves it.
          </P>
          <P>
            You can read how it works — the voice, the private memory, the portable brain — on the{" "}
            <Link href="/lab/cognitive-twin" className="text-accent hover:underline">Cognitive Twin page</Link>.
            But the technology was never the point.
          </P>

          {/* The line the whole page turns on — given room to breathe. */}
          <p className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-center text-foreground/90 my-16 leading-snug">
            She was.
          </p>
        </article>
      </div>

      {/* Site footer for navigation (no "collaborate" CTA under a memorial). */}
      <Footer hideContact />
    </main>
  )
}
