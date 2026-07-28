import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/writing/how-its-built"),
  title: "How this site's tech stack was built, step by step",
  description:
    "A step-by-step walkthrough of the stack behind this site: a static-export Next.js app, a real-data 3D universe engine in pure WebGL/GLSL, an adaptive-quality renderer, a self-hosted asset CDN, open-source satellite SSA tools, and a deterministic-first on-device AI — the decisions and the why.",
  keywords: [
    "how to build a portfolio tech stack",
    "Next.js static export",
    "React Three Fiber tutorial",
    "WebGL GLSL universe",
    "adaptive quality WebGL",
    "on-device LLM WebLLM",
    "Cloudflare R2 CDN",
    "SGP4 satellite tracking browser",
  ],
}

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How this site's tech stack was built, step by step",
  author: { "@type": "Person", name: "Ankur Sinha", url: "https://www.sinhaankur.com" },
  datePublished: "2026-07-28",
  about: ["Next.js", "React Three Fiber", "WebGL", "GLSL", "Cloudflare R2", "On-device AI"],
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-14 mb-4">{children}</h2>
}
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-accent text-sm tabular-nums">{String(n).padStart(2, "0")}</span>
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/90">{children}</code>
}
function Why({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[14px] md:text-[15px] text-foreground/65 leading-relaxed mb-5 pl-4 border-l-2 border-accent/40">
      <span className="font-mono text-[10px] tracking-widest uppercase text-accent/80 mr-2">Why</span>{children}
    </p>
  )
}

export default function HowItsBuiltPost() {
  return (
    <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <Link
        href="/writing"
        className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        Writing
      </Link>

      <article>
        <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-3">July 28, 2026</p>
        <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.06] mb-6">
          How this site&apos;s tech stack was built, step by step
        </h1>
        <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed mb-4">
          This is a design-in-code site with a real-time universe engine and a set of open-source
          space tools running inside it. Here&apos;s how the stack came together, in the order it was
          actually built — and, more importantly, <em>why</em> each choice was made. If you&apos;re building
          something ambitious in the browser, the decisions matter more than the libraries.
        </p>

        <Step n={1} title="Start with the constraint: static export">
          <P>
            The whole site is a <Code>Next.js</Code> App Router app that builds to <em>static HTML</em>
            {" "}(<Code>output: &quot;export&quot;</Code>) and deploys to GitHub Pages behind Cloudflare. No server,
            no serverless functions, no database. Every dynamic thing — the 3D engine, the theme
            toggle, the AI copilot — runs entirely client-side.
          </P>
          <Why>
            A static site can&apos;t break, can&apos;t leak a server secret, costs nothing to host, and is
            trivially fast from any CDN edge. The constraint forces good architecture: if it has to
            run in the browser, you design it to be self-contained and resilient from day one.
          </Why>
        </Step>

        <Step n={2} title="The 3D layer: React Three Fiber over raw Three.js">
          <P>
            The universe is built with <Code>@react-three/fiber</Code> (R3F) — React bindings for
            {" "}<Code>Three.js</Code>. Scenes are declarative components; a planet is JSX, a satellite
            swarm is a single <Code>&lt;points&gt;</Code> with a custom shader. The engine is one
            self-contained module you mount with <Code>&lt;UniverseEngine /&gt;</Code>.
          </P>
          <Why>
            R3F lets you compose a complex scene the way you compose UI — state, props, effects — while
            still dropping to raw Three.js and GLSL where it matters. Adding a new planet is a one-file
            data edit, not a rewrite.
          </Why>
        </Step>

        <Step n={3} title="Render with pure GLSL, not meshes">
          <P>
            Every body is drawn with hand-written <Code>GLSL</Code> shaders — the spiral-arm star field,
            planet day/night terminators, the galactic dust haze, black-hole lensing. No imported 3D
            models in the engine (Blender is only used to <em>bake textures</em>). 18,500 satellites
            are one draw call.
          </P>
          <Why>
            Shaders scale to tens of thousands of objects where meshes would choke, and they keep the
            bundle tiny. Pure-GLSL is also honest: the look is <em>computed</em> from real data
            (a star&apos;s measured temperature drives its colour), not faked in a modelling tool.
          </Why>
        </Step>

        <Step n={4} title="Feed it real data, exactly">
          <P>
            Positions come from real sources: satellites propagate on live <Code>SGP4</Code> orbits from
            NORAD two-line element sets; planets sit at their true <Code>J2000</Code> positions; stars
            come from the HYG catalogue; launch sites from CelesTrak. A build script fetches and bakes
            18,500 objects into a static JSON the site ships.
          </P>
          <Why>
            The rule is &quot;real over invented&quot;: build every body from known data (NASA / JPL / ESA /
            NORAD), and where something genuinely isn&apos;t known, label it as inference — never present a
            guess as fact. That&apos;s what makes it a tool, not a toy.
          </Why>
        </Step>

        <Step n={5} title="Make it smooth on ANY device: adaptive quality">
          <P>
            A controller watches the real frame times and converges each device onto its best
            sustainable quality tier. It judges the <em>p95</em> (near-worst) frame — not the median —
            because stutter is what reads as lag. Everything costly (resolution, scene density,
            satellite propagation budget, hi-res textures) is gated on that tier, and it starts
            conservatively and climbs only with proven headroom.
          </P>
          <Why>
            &quot;Best experience on any device&quot; means the same scene has to feel good on a phone and a
            gaming PC. A static guess is wrong half the time; measuring the actual frames and adapting,
            forever, is the only honest way.
          </Why>
        </Step>

        <Step n={6} title="Ship heavy assets from a free CDN (Cloudflare R2)">
          <P>
            High-res textures (16K Earth, real MOLA/LOLA elevation) live on <Code>Cloudflare R2</Code> at
            {" "}<Code>assets.sinhaankur.com</Code> — zero egress cost. The site self-hosts a usable
            baseline and streams the CDN&apos;s top-rung detail only when you zoom close, decoded
            <em> off the main thread</em> so the frame never freezes. Textures are moving to
            {" "}<Code>KTX2</Code> (GPU-compressed) so they upload with no decode step and a fraction of
            the VRAM.
          </P>
          <Why>
            The site must never <em>depend</em> on the CDN — if it&apos;s down, the local texture renders.
            The CDN is a progressive enhancement, not a single point of failure. And on-GPU compression
            is what keeps mobile from running out of video memory.
          </Why>
        </Step>

        <Step n={7} title="Build real tools inside it (open-source SSA)">
          <P>
            On top of the render sits a working Space-Situational-Awareness toolkit: conjunction
            screening, paste-any-TLE screening against the whole catalogue, two-object proximity
            comparison, reentry watch, Earth→Mars transfer windows, and CSV / CCSDS-OEM ephemeris
            export — the math (SGP4, golden-section closest-approach) runs in the browser.
          </P>
          <Why>
            These are the tools commercial platforms gate behind a login. Built on public data, clearly
            labelled &quot;awareness &amp; education, not operational decisions&quot;, they democratize orbital
            awareness. The bright line is <em>observe &amp; understand, never operate</em>.
          </Why>
        </Step>

        <Step n={8} title="Add AI the honest way: deterministic-first, on-device">
          <P>
            The engine has an assistant that answers questions and flies you to any body. It&apos;s
            {" "}<em>deterministic first</em>: it grounds every answer in the real catalogue and executes
            real navigation tools — so &quot;fly me to Voyager 1&quot; <em>actually flies</em>. An optional tiny
            in-browser model (<Code>WebLLM</Code>) only polishes the phrasing; with no model at all, it
            still works and still teaches (e.g. how we <em>observe</em> each object — radio, infrared,
            visible, X-ray).
          </P>
          <Why>
            No API key, nothing leaves your device, zero cost, and it can&apos;t hallucinate a fake orbit —
            the facts come from data, the model only rewords. It must actually do what it intends; no
            hollow &quot;I could fly you there&quot; shells.
          </Why>
        </Step>

        <Step n={9} title="Keep it cinematic — but let people opt out">
          <P>
            The site opens with a deliberate cosmic-ignition intro and eases every camera move. But a
            {" "}<em>Fast mode</em> in the accessibility menu skips the intro for repeat visits, alongside
            reduce-motion, larger-text and reading-mode toggles.
          </P>
          <Why>
            The cinematic experience is the identity — but forcing every visitor through it is
            user-hostile. Cinematic by default, faster by choice.
          </Why>
        </Step>

        <Step n={10} title="Prove it, then ship it">
          <P>
            There&apos;s a committed performance test (Playwright + a live <Code>?perf</Code> overlay) that
            reads the engine&apos;s own frame stats and fails on regression. Every build type-checks and
            lints. The deploy is a single GitHub Action: <Code>build → static export → Pages</Code>.
          </P>
          <Why>
            &quot;Feels laggy&quot; is subjective; a p95 threshold is not. If you can measure it, you can defend
            it — and you stop guessing.
          </Why>
        </Step>

        <H2>The through-line</H2>
        <P>
          Every choice here points the same way: <em>real over invented, resilient over clever,
          honest over impressive.</em> The stack is just the means — Next.js, R3F, GLSL, R2, WebLLM.
          What holds it together is holding each piece to whether it&apos;s <em>true</em>, works on a
          real device, and does what it says.
        </P>

        <p className="font-sans text-[15px] md:text-base text-foreground/70 leading-relaxed mt-10 pt-6 border-t border-border">
          Go see it running:{" "}
          <Link href="/lab/celestial" className="text-accent hover:underline">the live universe engine</Link>{" "}
          (search a satellite, screen a TLE, ask the copilot to fly you to Voyager 1), or read the
          deeper technical story in{" "}
          <Link href="/writing/universe-engine" className="text-accent hover:underline">How I built a real-data universe engine</Link>.
        </p>

        <p className="font-sans text-[15px] md:text-base text-foreground/70 leading-relaxed mt-6">
          Questions about the build? Email{" "}
          <a href="mailto:sinhaankur827@gmail.com?subject=How%20it%27s%20built" className="text-accent hover:underline">
            sinhaankur827@gmail.com
          </a>.
        </p>
      </article>
    </main>
  )
}
