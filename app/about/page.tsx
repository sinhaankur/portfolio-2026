import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  ...canonicalPath("/about"),
  title: "About",
  description:
    "Ankur Sinha — Principal UX designer and engineer working on the seam where humans meet AI agents. Design × Engineering × AI. The person behind the Universe Engine and the work on this site.",
  keywords: ["Ankur Sinha", "about", "UX designer engineer", "design engineering AI", "portfolio about"],
}

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  mainEntity: {
    "@type": "Person",
    name: "Ankur Sinha",
    jobTitle: "Principal UX Designer & Engineer",
    url: "https://www.sinhaankur.com",
    sameAs: [
      "https://www.linkedin.com/in/sinhaankur27",
      "https://github.com/sinhaankur",
    ],
  },
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}

export default function AboutPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />

      <Link
        href="/"
        className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        Home
      </Link>

      <div className="grid md:grid-cols-[minmax(0,16rem)_1fr] gap-8 md:gap-12 items-start">
        {/* Photo. Currently the 2004 origin photo (the kid at the CRT — the
            through-line). To use a proper headshot instead, drop it at
            public/img/about/ankur.webp and change the src below to it. */}
        <figure className="m-0">
          <div className="overflow-hidden rounded-2xl border border-border bg-secondary/20">
            <img
              src="/img/about/journey-2004.webp"
              alt="Ankur Sinha — where it started, at a CRT computer in 2004"
              width={1400}
              height={980}
              loading="lazy"
              decoding="async"
              // Natural aspect ratio — the photo shows in FULL, never cropped
              // (block h-auto lets the frame take the image's real proportions).
              className="block w-full h-auto [filter:saturate(0.96)]"
            />
          </div>
          <figcaption className="mt-2 font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground">
            Ankur Sinha · &apos;04
          </figcaption>
        </figure>

        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-3">About</p>
          <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.06] mb-6">
            Ankur Sinha
          </h1>
          <P>
            I&apos;m a Principal UX designer and engineer. I work on the seam where a human meets an
            AI agent — the moment of decision, override, and trust. Not the model, not the wrapper.
            The interaction itself.
          </P>
          <P>
            My through-line runs back to a kid at a CRT computer in 2004, taking things apart to see
            how they worked. That&apos;s still the job: understand the real thing, design the
            interaction, and prove it in working code — then hold the result to whether it&apos;s{" "}
            <em>true</em>, not just whether it looks good.
          </P>
          <P>
            This site is that idea running live. The{" "}
            <Link href="/lab/celestial" className="text-accent hover:underline">Universe Engine</Link>{" "}
            renders 18,500 real satellites, a true-scale solar system, and open-source orbital tools —
            all from real NASA / NORAD / NOAA data, all in the browser. It&apos;s design × engineering ×
            AI held to one standard: real over invented, resilient over clever, honest over impressive.
          </P>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-wide">
            <Link href="/lab" className="text-accent hover:underline">The Lab</Link>
            <Link href="/framework" className="text-accent hover:underline">UX Framework</Link>
            <Link href="/writing" className="text-accent hover:underline">Writing</Link>
            <Link href="/writing/how-its-built" className="text-accent hover:underline">How it&apos;s built</Link>
            <a href="/ankur-sinha-resume.pdf" download className="text-accent hover:underline">Resume ↓</a>
            <a href="https://www.linkedin.com/in/sinhaankur27" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">LinkedIn ↗</a>
            <a href="https://github.com/sinhaankur" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GitHub ↗</a>
          </div>

          <p className="mt-8 pt-6 border-t border-border font-sans text-[14px] text-foreground/65 leading-relaxed">
            Say hello:{" "}
            <a href="mailto:sinhaankur827@gmail.com?subject=Hello" className="text-accent hover:underline">
              sinhaankur827@gmail.com
            </a>.
          </p>
        </div>
      </div>

      {/* Family — the people behind the work. His father's research archive and
          the page for his mother (for whom the Cognitive Twin was built). */}
      <section className="mt-16 md:mt-24 pt-10 border-t border-border">
        <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-6">Family</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/dr-randhir-sinha"
            className="group rounded-2xl border border-border p-5 hover:border-accent/60 transition-colors"
          >
            <p className="font-display text-lg font-light text-foreground group-hover:text-accent transition-colors">Dr. Randhir Kumar Sinha</p>
            <p className="mt-1 font-mono text-[10px] tracking-wider uppercase text-muted-foreground">My father · silkworm genetics</p>
            <p className="mt-2 font-sans text-[13px] text-foreground/65 leading-relaxed">
              A career in silkworm mutation &amp; breeding, retired as Joint Director at CSGRC. A living
              archive of his research, digitalized to reference and use.
            </p>
            <span className="mt-3 inline-block font-mono text-[10px] tracking-widest uppercase text-accent">Open the archive →</span>
          </Link>
          <Link
            href="/vera"
            className="group rounded-2xl border border-border p-5 hover:border-accent/60 transition-colors"
          >
            <p className="font-display text-lg font-light text-foreground group-hover:text-accent transition-colors">Anita Sinha</p>
            <p className="mt-1 font-mono text-[10px] tracking-wider uppercase text-muted-foreground">My mother · the reason for the twin</p>
            <p className="mt-2 font-sans text-[13px] text-foreground/65 leading-relaxed">
              Her page — and the reason I built the Cognitive Twin: a private, on-device way to keep a
              loved one&apos;s warmth close.
            </p>
            <span className="mt-3 inline-block font-mono text-[10px] tracking-widest uppercase text-accent">Her page →</span>
          </Link>
          <Link
            href="/family"
            className="group rounded-2xl border border-border p-5 hover:border-accent/60 transition-colors sm:col-span-2"
          >
            <p className="font-display text-lg font-light text-foreground group-hover:text-accent transition-colors">For the people I love</p>
            <p className="mt-1 font-mono text-[10px] tracking-wider uppercase text-muted-foreground">A private corner · passcode</p>
            <p className="mt-2 font-sans text-[13px] text-foreground/65 leading-relaxed">
              Photos and moments I want to share with family. Gently gated behind a passcode.
            </p>
            <span className="mt-3 inline-block font-mono text-[10px] tracking-widest uppercase text-accent">Open →</span>
          </Link>
        </div>
      </section>
      </main>

      {/* Full footer so About is a real hub, not a stop — onward to Works, Lab,
          Contact. Contact CTA kept here (unlike the tributes): About → let's
          collaborate is on-tone. */}
      <Footer />
    </>
  )
}
