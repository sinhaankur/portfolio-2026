import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/dr-randhir-sinha"),
  title: "Dr. Randhir Kumar Sinha — silkworm genetics & sericulture",
  description:
    "The life and work of Dr. Randhir Kumar Sinha — a career in silkworm mutation and breeding, retiring as Joint Director at the Central Sericultural Germplasm Resources Centre (CSGRC). A living archive of his research, digitalized for people to reference and use.",
  keywords: [
    "Randhir Kumar Sinha",
    "silkworm mutation breeding",
    "sericulture research",
    "CSGRC",
    "silkworm genetics",
    "Bombyx mori breeding",
  ],
}

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Dr. Randhir Kumar Sinha",
  honorificPrefix: "Dr.",
  jobTitle: "Joint Director (retd.), Central Sericultural Germplasm Resources Centre",
  description:
    "Scientist in silkworm mutation and breeding; retired as Joint Director at CSGRC. Now a farmer.",
  knowsAbout: ["Sericulture", "Silkworm genetics", "Silkworm breeding", "Bombyx mori"],
  sameAs: ["https://www.linkedin.com/in/randhir-sinha-b9660132/"],
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-14 mb-4">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}

export default function DrRandhirSinhaPage() {
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
        <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-3">In tribute · a living archive</p>
        <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.06] mb-6">
          Dr. Randhir Kumar Sinha
        </h1>
        <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed mb-4">
          A scientist who spent a career on the genetics of the silkworm — the quiet, patient work of
          mutation and breeding that improves the very thread of sericulture. My father. This page
          gathers and digitalizes his work so others can reference and build on it.
        </p>

        <H2>His work</H2>
        <P>
          Dr. Sinha&apos;s research was in <em>silkworm mutation and breeding</em> — the science of
          understanding and improving <em>Bombyx mori</em> through genetics: selecting, crossing, and
          stabilizing strains for better silk, hardier races, and preserved germplasm. He spent his
          career at the <strong>Central Sericultural Germplasm Resources Centre (CSGRC)</strong>, the
          institution charged with conserving India&apos;s silkworm genetic diversity, and retired as
          its <strong>Joint Director</strong>.
        </P>
        <P>
          The full arc of his career — the posts, the institutions, the years — is on his{" "}
          <a href="https://www.linkedin.com/in/randhir-sinha-b9660132/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            LinkedIn
          </a>{" "}
          profile.
        </P>

        <H2>The archive</H2>
        <P>
          This is a living page. His papers, findings, and research notes will be added here as they
          are digitalized — organized so a student, a breeder, or a fellow scientist can find and use
          them. Real work, preserved and made referenceable.
        </P>
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 my-6">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Archive · coming online</p>
          <p className="font-sans text-[14px] text-foreground/70 leading-relaxed">
            Publications, research notes, and germplasm records are being scanned and digitalized.
            Each will be listed here with its citation and a link, so his work stays usable — not
            locked in a filing cabinet.
          </p>
        </div>

        <H2>After the lab</H2>
        <P>
          In retirement he turned to <em>farming</em> — from the genetics of one organism to the whole
          living system of a field. A scientist&apos;s attention, applied to the soil.
        </P>

        <p className="font-sans text-[15px] md:text-base text-foreground/70 leading-relaxed mt-10 pt-6 border-t border-border">
          To contribute a paper, a correction, or a memory for this archive, email{" "}
          <a href="mailto:sinhaankur827@gmail.com?subject=Dr.%20Randhir%20Kumar%20Sinha%20archive" className="text-accent hover:underline">
            sinhaankur827@gmail.com
          </a>.
        </p>
      </article>
    </main>
  )
}
