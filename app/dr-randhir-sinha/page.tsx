import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"
import {
  randhirStats,
  researchPapers,
  conferencePapers,
  popularArticles,
  booksAndCatalogues,
  type Publication,
} from "@/lib/randhir-publications"

/** Group publications by year, newest first. */
function byYearDesc(pubs: Publication[]) {
  const groups = new Map<number, Publication[]>()
  for (const p of pubs) {
    const list = groups.get(p.year) ?? []
    list.push(p)
    groups.set(p.year, list)
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0])
}

export const metadata: Metadata = {
  ...canonicalPath("/dr-randhir-sinha"),
  title: "Dr. Randhir Kumar Sinha — silkworm genetics & sericulture",
  description:
    "The life and work of Dr. Randhir Kumar Sinha — 34 years in silkworm mutation breeding with the Central Silk Board, retiring as Joint Director (Scientist-D) at CSGRC, Hosur. 60 research papers; a living archive digitalized for people to reference and use.",
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
  honorificSuffix: "Ph.D.",
  jobTitle: "Scientist-D (Joint Director, retd.), Central Sericultural Germplasm Resources Centre",
  affiliation: {
    "@type": "GovernmentOrganization",
    name: "Central Silk Board, Ministry of Textiles, Government of India",
  },
  alumniOf: "Bhagalpur University",
  award: "Best Scientist Award 2006–07 (CSGRC, Central Silk Board)",
  description:
    "Scientist in silkworm mutation and breeding across a 34-year career with the Central Silk Board; retired as Joint Director (Scientist-D) at CSGRC, Hosur. Author of 60 research papers.",
  knowsAbout: [
    "Sericulture",
    "Silkworm genetics",
    "Silkworm mutation breeding",
    "Bombyx mori",
    "Germplasm conservation",
    "Tasar silk",
  ],
  sameAs: ["https://www.linkedin.com/in/randhir-sinha-b9660132/"],
}

// His works as a structured list, so the work itself is indexable — not just
// the person. Research + conference papers are ScholarlyArticle; books/catalogues
// are Book. All authored by him.
const allWorks = [
  ...researchPapers.map((p) => ({ ...p, type: "ScholarlyArticle" as const })),
  ...conferencePapers.map((p) => ({ ...p, type: "ScholarlyArticle" as const })),
  ...popularArticles.map((p) => ({ ...p, type: "Article" as const })),
  ...booksAndCatalogues.map((p) => ({ ...p, type: "Book" as const })),
]
const publicationsSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Publications of Dr. Randhir Kumar Sinha",
  numberOfItems: allWorks.length,
  itemListElement: allWorks.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": p.type,
      headline: p.citation,
      name: p.citation,
      datePublished: `${p.year}`,
      author: { "@type": "Person", name: "Dr. Randhir Kumar Sinha" },
    },
  })),
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-14 mb-4">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl md:text-4xl font-light tracking-[-0.02em] text-foreground">{value}</div>
      <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/50 mt-1">{label}</div>
    </div>
  )
}

/** A collapsible, year-grouped list of publications. */
function PubList({ title, pubs }: { title: string; pubs: Publication[] }) {
  return (
    <details className="group my-6 rounded-xl border border-border bg-secondary/10">
      <summary className="cursor-pointer list-none select-none px-5 py-4 flex items-center justify-between gap-4">
        <span className="font-sans text-[15px] text-foreground">
          {title}
          <span className="text-foreground/50"> · {pubs.length} listed</span>
        </span>
        <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/50 group-open:hidden">Show</span>
        <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/50 hidden group-open:inline">Hide</span>
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-7">
        {byYearDesc(pubs).map(([year, items]) => (
          <div key={year}>
            <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent mb-2">{year}</h3>
            <ol className="space-y-2.5">
              {items.map((p, i) => (
                <li key={i} className="font-sans text-[13px] leading-relaxed text-foreground/75 pl-4 -indent-4">
                  {p.citation}
                  {p.url && (
                    <>
                      {" "}
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline whitespace-nowrap">
                        [link]
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </details>
  )
}

export default function DrRandhirSinhaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(publicationsSchema) }} />

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
        <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed mb-8">
          A scientist who spent a career on the genetics of the silkworm — the quiet, patient work of
          mutation and breeding that improves the very thread of sericulture. My father. This page
          gathers and digitalizes his work so others can reference and build on it.
        </p>

        {/* Portrait — Québec City, the Château Frontenac and the St. Lawrence behind him.
            Save the photo to public/img/about/randhir-quebec.webp (cwebp -q 82). */}
        <figure className="my-10">
          <div className="relative aspect-[4/5] w-full max-w-sm mx-auto overflow-hidden rounded-2xl border border-border bg-secondary/20">
            <Image
              src="/img/about/randhir-quebec.webp"
              alt="Dr. Randhir Kumar Sinha in Québec City, the Château Frontenac and the St. Lawrence River behind him at sunset."
              fill
              sizes="(max-width: 640px) 100vw, 384px"
              className="object-cover"
            />
          </div>
          <figcaption className="text-center font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/45 mt-3">
            Québec City
          </figcaption>
        </figure>

        {/* Career at a glance — figures from his own CV. */}
        <div className="grid grid-cols-3 gap-4 py-8 my-4 border-y border-border">
          <Stat value={`${randhirStats.yearsOfService}`} label="Years of service" />
          <Stat value={`${randhirStats.researchPapers}`} label="Research papers" />
          <Stat value={`${randhirStats.silkwormAccessions}+`} label="Silkworm accessions" />
        </div>

        <H2>His work</H2>
        <P>
          Dr. Sinha&apos;s doctoral research was on <em>silkworm mutation breeding</em> — his thesis,{" "}
          <em>&ldquo;Effect of various mutagens on economic traits and chromosomes of silkworm Bombyx mori L.&rdquo;</em>{" "}
          His life&apos;s work was the science of understanding and improving <em>Bombyx mori</em> through
          genetics: selecting, crossing, and stabilizing strains for better silk, hardier races, and
          — above all — <em>conserving</em> the genetic diversity that all future breeding depends on.
        </P>
        <P>
          Over <strong>34 years</strong> as a scientist with the <strong>Central Silk Board</strong>{" "}
          (Ministry of Textiles, Govt. of India), he served across the country — from Research
          Extension Centres in Bir (Himachal Pradesh) and Kolar (Karnataka), through the Central Tasar
          Research &amp; Training Institute at Ranchi, to the Regional Tasar Research Station at Imphal.
          He finished his career as Divisional Chief and, latterly,{" "}
          <strong>Joint Director (Scientist-D)</strong> at the{" "}
          <strong>Central Sericultural Germplasm Resources Centre (CSGRC), Hosur</strong> — the
          institution charged with conserving India&apos;s silkworm genetic diversity, where he
          managed a living collection of over <strong>{randhirStats.mulberryAccessions.toLocaleString()} mulberry</strong>{" "}
          and <strong>{randhirStats.silkwormAccessions} silkworm</strong> germplasm accessions.
        </P>
        <P>
          Along the way he published <strong>{randhirStats.researchPapers} research papers</strong>{" "}
          (national and international), {randhirStats.popularArticles} popular articles, and{" "}
          {randhirStats.booksAndCatalogues} books and catalogues — including the multi-volume{" "}
          <em>Catalogue on Silkworm (Bombyx mori L.) germplasm</em> — formulated multi-crore
          development projects for India&apos;s tasar-silk industry, guided M.Sc. scholars, and was
          named <strong>Best Scientist</strong> for 2006–07. The full arc is on his{" "}
          <a href="https://www.linkedin.com/in/randhir-sinha-b9660132/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            LinkedIn
          </a>{" "}
          profile.
        </P>

        <H2>The archive</H2>
        <P>
          This is a living page — his work, digitalized so a student, a breeder, or a fellow scientist
          can find and cite it rather than hunt through old journals. Below is his full documented
          output: peer-reviewed research papers, the papers he presented at conferences and seminars,
          the popular and semi-technical articles he wrote for the wider community (several in Hindi),
          and the books and catalogues he authored — all transcribed with full citations and grouped
          by year.
        </P>

        <PubList title="Research papers" pubs={researchPapers} />
        <PubList title="Conference & seminar papers" pubs={conferencePapers} />
        <PubList title="Popular & technical articles" pubs={popularArticles} />
        <PubList title="Books & catalogues" pubs={booksAndCatalogues} />

        <p className="font-sans text-[12px] text-foreground/45 leading-relaxed -mt-2 mb-6">
          Transcribed from his curriculum vitae. Where a paper has a verifiable online record, a{" "}
          <span className="text-accent">[link]</span> follows the citation. Spotted an error or have a
          missing paper? The email below reaches the archive.
        </p>

        <div className="rounded-xl border border-border bg-secondary/10 p-5 my-6">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Find his work online</p>
          <p className="font-sans text-[14px] text-foreground/70 leading-relaxed mb-4">
            Much of his research lives in Indian sericulture journals that predate DOIs and never went
            online — so his 34 years never surfaced on the open web. These searches turn up what has:
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="https://scholar.google.com/scholar?q=%22R.+K.+Sinha%22+Bombyx+mori+silkworm+germplasm"
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-wide px-3 py-1.5 rounded-full border border-border text-foreground/80 hover:text-foreground hover:border-accent transition-colors"
            >
              Google Scholar ↗
            </a>
            <a
              href="https://www.researchgate.net/search?q=Randhir%20Kumar%20Sinha%20silkworm"
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-wide px-3 py-1.5 rounded-full border border-border text-foreground/80 hover:text-foreground hover:border-accent transition-colors"
            >
              ResearchGate ↗
            </a>
            <a
              href="https://www.linkedin.com/in/randhir-sinha-b9660132/"
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-wide px-3 py-1.5 rounded-full border border-border text-foreground/80 hover:text-foreground hover:border-accent transition-colors"
            >
              LinkedIn ↗
            </a>
          </div>
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
