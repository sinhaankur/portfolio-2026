import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"

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
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-14 mb-4">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}

export default function VeraPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />

      <Link
        href="/about"
        className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        About
      </Link>

      <article>
        <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-3">For my mother</p>
        <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.06] mb-6">
          Anita Sinha
        </h1>
        <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed mb-4">
          This page is for my mother — and for the reason I built{" "}
          <Link href="/lab/cognitive-twin" className="text-accent hover:underline">the Cognitive Twin</Link>, which
          I named <strong>Vera</strong> in her honour. Some people you carry with you. This is my way
          of keeping her warmth close.
        </p>

        <H2>Her page</H2>
        <P>
          {/* Her fuller story goes here, in Ankur's words, when he's ready. */}
          Her story belongs here, in her own words and mine — who she was, what she loved, the way she
          shaped the people around her. This page is hers to hold. Her professional journey is on her{" "}
          <a href="https://www.linkedin.com/in/anita-sinha-02a44174/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            LinkedIn
          </a>{" "}
          profile.
        </P>

        <H2>Why the twin exists</H2>
        <P>
          The Cognitive Twin, which I named <strong>Vera</strong>, was built for her: a private,
          on-device companion that can speak in a loved one&apos;s actual voice and reason in their
          character — never for impersonation, only to keep a person&apos;s warmth close. It runs
          entirely on the machine; nothing leaves it. It was, first and always, for her.
        </P>
        <P>
          You can read how it works on the{" "}
          <Link href="/lab/cognitive-twin" className="text-accent hover:underline">Cognitive Twin page</Link> —
          the voice, the private memory, the portable brain. But the technology was never the point.
          She was.
        </P>

        <p className="font-sans text-[15px] md:text-base text-foreground/70 leading-relaxed mt-10 pt-6 border-t border-border">
          In loving memory.
        </p>
      </article>
    </main>
  )
}
