"use client"

/**
 * DnaGate — the public DNA tool landing.
 *
 * PRIVACY: this public page carries NO personal genome data. It is an
 * upload-your-own tool only. You drop a raw genotyping file (MyHeritage /
 * 23andMe / AncestryDNA) and it's parsed and analyzed ENTIRELY in your browser
 * via lib/dna-parse.ts — never uploaded, stored, or sent anywhere. There is no
 * server (static export), so nothing leaves the device.
 *
 * (Ankur's own genome lives in a separate PRIVATE repo and is never served
 * here — see the project notes.)
 */

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Upload, ShieldCheck, Dna, Share2, FileText, Cpu, Sparkles, Globe } from "lucide-react"
import { type DnaSummary } from "@/lib/dna-crypto"
import { parseDnaFile } from "@/lib/dna-parse"
import { DnaVisualization } from "./dna-visualization"
import { ClearCacheButton } from "@/components/clear-cache-button"
import { CHAPTERS, HUMAN_ROOT } from "./dna-origins"

// Teaser globe — the human-migration story, illustrative (no personal data;
// nothing is uploaded yet). Lazy + toggle-gated so the upload paints instantly.
const DnaMigrationGlobe = dynamic(
  () => import("./dna-migration-globe").then((m) => ({ default: m.DnaMigrationGlobe })),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[340px] w-full place-items-center rounded-2xl border border-border bg-[#05070d] font-mono text-[10px] tracking-widest uppercase text-white/50">
        Loading globe…
      </div>
    ),
  },
)

export function DnaGate() {
  const [data, setData] = useState<DnaSummary | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showGlobe, setShowGlobe] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Share the TOOL (never any data). Native share sheet on mobile; copy-link
  // fallback everywhere else. What's shared is only the public /dna URL.
  async function shareTool() {
    const url = typeof window !== "undefined" ? `${window.location.origin}/dna` : "https://www.sinhaankur.com/dna"
    const shareData = {
      title: "Read your DNA — free & private",
      text: "See what your DNA says — traits, a personalized plan, ancestry, and the real science. 100% in your browser; your file never leaves your device.",
      url,
    }
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData)
        return
      }
    } catch { /* user cancelled or unsupported — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — no-op */ }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setError(null)
    const result = await parseDnaFile(file)
    setParsing(false)
    if (result.ok) {
      setData(result.summary)
    } else {
      setError(result.error)
    }
    if (fileRef.current) fileRef.current.value = ""
  }

  if (data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Results view stays clean — the privacy explainer lives on the upload
            screen only. Here we keep just the essential reset controls, right-
            aligned + quiet, with a tiny on-device reassurance icon. */}
        <div className="mb-8 flex items-center justify-end gap-3">
          <span className="mr-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5 text-accent/70" aria-hidden />
            On-device
          </span>
          <button
            type="button"
            onClick={() => setData(null)}
            data-cursor-hover
            className="font-mono text-[10px] tracking-widest uppercase text-accent hover:text-foreground border-b border-accent hover:border-foreground pb-0.5 transition-colors"
          >
            Clear genome
          </button>
          <ClearCacheButton />
        </div>
        <DnaVisualization data={data} />
      </motion.div>
    )
  }

  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center gap-14 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md text-center"
      >
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border border-border bg-secondary/30">
          <Dna className="h-5 w-5 text-accent" aria-hidden />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-light tracking-[-0.01em] mb-2">
          Read your DNA
        </h1>
        <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed mb-5">
          Upload a raw DNA file from MyHeritage, 23andMe, or AncestryDNA and see
          it visualized — your helix, chromosome map, and a panel of well-studied
          diet, fitness, skin, wellness, and trait markers.
        </p>

        {/* Why I built it — the honest motivation, in Ankur's voice. */}
        <div className="mb-8 rounded-xl border border-border bg-secondary/20 p-4 text-left">
          <p className="font-mono text-[9px] tracking-[0.22em] uppercase text-accent/80 mb-2">
            Why I built this
          </p>
          <p className="font-sans text-[13px] text-foreground/70 leading-relaxed">
            Curiosity, mostly — I wanted to actually understand how DNA works, so I
            built the thing I&apos;d want to read. It&apos;s an exploration, not a
            clinical test: every claim links to its source, and everything runs on
            your device. Bring your own file and poke around.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          onChange={handleFile}
          className="sr-only"
          id="dna-upload"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          data-cursor-hover
          className="
            w-full inline-flex items-center justify-center gap-2.5
            rounded-full border border-accent bg-accent/10
            px-5 py-3.5 min-h-12
            font-mono text-xs tracking-widest uppercase
            text-accent hover:bg-accent/20
            disabled:opacity-50
            transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
          "
        >
          {parsing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Reading…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden />
              Upload raw DNA file
            </>
          )}
        </button>

        <div className="mt-4 flex items-start gap-2 justify-center">
          <ShieldCheck className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" aria-hidden />
          <p className="font-sans text-[11px] text-muted-foreground leading-relaxed max-w-xs">
            100% private. No server, no account, no storage — your file is read
            in this browser tab and never sent anywhere.
          </p>
        </div>

        {/* Share the tool (never data) — so others can try it with their own file. */}
        <button
          type="button"
          onClick={shareTool}
          data-cursor-hover
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-accent/60 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          {copied ? "Link copied ✓" : "Share this tool"}
        </button>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 font-sans text-xs text-[#f06c8d] leading-relaxed"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* What happens & how it works — shown at upload so a first-timer knows
          the flow AND trusts it before dropping a file. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-3xl"
      >
        <div className="flex items-baseline gap-4 mb-6">
          <span aria-hidden className="block w-10 h-px bg-accent" />
          <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent">
            What happens when you upload
          </h2>
        </div>

        <ol className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileText,
              step: "1 · Read",
              title: "Your file is parsed in this tab",
              body:
                "The raw file (a big text list of your genotypes, one per line) is read by JavaScript in your browser. It never uploads — there's no server to upload to. It's gone the moment you close the tab unless you keep it.",
            },
            {
              icon: Cpu,
              step: "2 · Match",
              title: "Matched to open databases",
              body:
                "Your genotype at each well-studied marker is looked up against public data — dbSNP, ClinVar, gnomAD, and published papers. Only the ~40 curated markers are read; the rest of your file is ignored.",
            },
            {
              icon: Sparkles,
              step: "3 · Show",
              title: "Turned into something readable",
              body:
                "You get your helix, a trait panel, a personalized plan, your build type, an ancestry/migration story, and the real science — each claim linking its source. Nothing is a diagnosis; it's an exploration.",
            },
          ].map((s) => (
            <li key={s.step} className="rounded-xl border border-border bg-card/40 p-5 text-left">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="h-4 w-4 text-accent" aria-hidden />
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">{s.step}</span>
              </div>
              <h3 className="font-display text-base font-light text-foreground leading-snug mb-1.5">{s.title}</h3>
              <p className="font-sans text-[13px] text-foreground/70 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>

        {/* Live data points — what the tool actually knows, at a glance. */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
          {[
            { n: "41", label: "markers read" },
            { n: "4+", label: "open databases" },
            { n: "100%", label: "on your device" },
            { n: "0", label: "uploads · ever" },
          ].map((s) => (
            <div key={s.label} className="bg-background p-4 text-center">
              <div className="font-display text-2xl font-light text-foreground tabular-nums">{s.n}</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Teaser globe — the human-migration story your DNA is part of. */}
        <div className="mt-5">
          {showGlobe ? (
            <div>
              <DnaMigrationGlobe
                root={HUMAN_ROOT}
                chapters={CHAPTERS.map((c) => ({ origin: c.origin, spreadTo: c.spreadTo }))}
                showcase
                className="relative h-[340px] w-full rounded-2xl border border-border bg-[#05070d] overflow-hidden"
              />
              <p className="mt-2 font-mono text-[10px] tracking-wider text-muted-foreground/70 text-center">
                Every human left Africa ~60,000 years ago — variants arose + spread from there. Upload to see the chapters <em>your</em> markers trace.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowGlobe(true)}
              data-cursor-hover
              className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/[0.05] py-6 font-mono text-[11px] tracking-widest uppercase text-accent hover:bg-accent/10 transition-colors"
            >
              <Globe className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden />
              See the human migration globe
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">Where to get your file</p>
            <p className="font-sans text-[13px] text-foreground/70 leading-relaxed">
              In MyHeritage / 23andMe / AncestryDNA, look for{" "}
              <span className="text-foreground/85">&ldquo;Download raw DNA data&rdquo;</span> — it&apos;s a{" "}
              <span className="font-mono text-[11px]">.txt</span> or{" "}
              <span className="font-mono text-[11px]">.csv</span> (often zipped; unzip first).
            </p>
          </div>
          <div className="rounded-lg border border-accent/25 bg-accent/[0.04] px-4 py-3">
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-accent/80 mb-1">Don&apos;t have one?</p>
            <p className="font-sans text-[13px] text-foreground/70 leading-relaxed">
              You can still explore the science — the{" "}
              <a href="/dna/databases" className="text-accent underline underline-offset-2 hover:text-foreground transition-colors">sources &amp; how DNA works</a>{" "}
              pages are open, and the whole read is an{" "}
              <a href="https://github.com/sinhaankur/open-genome-atlas" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-foreground transition-colors">open dataset</a>.
            </p>
          </div>
        </div>

        {/* Fine print — the honest small print, well-placed at the bottom. */}
        <div className="mt-8 border-t border-border/60 pt-5">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/70 mb-2">Fine print</p>
          <p className="font-sans text-[11px] text-muted-foreground/80 leading-relaxed">
            Not a medical test or diagnosis — everything here is an <em>association</em>,
            not a verdict, and a consumer genotyping file can&apos;t assess serious
            clinical mutations. Raw direct-to-consumer data also carries real error
            rates, so treat surprising results as prompts to ask a clinician, not
            conclusions. Nothing is uploaded, stored, sold, or sent to any server —
            the file is read locally and discarded when you clear it or close the
            tab. Interpretations are drawn from public datasets (dbSNP · ClinVar ·
            gnomAD) and published research, each linked on its card; the full
            method is on the{" "}
            <a href="/dna/databases" className="underline underline-offset-2 hover:text-foreground transition-colors">sources page</a>.
            Association, never destiny.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
