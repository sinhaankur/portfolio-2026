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
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Upload, ShieldCheck, Dna, Share2 } from "lucide-react"
import { type DnaSummary } from "@/lib/dna-crypto"
import { parseDnaFile } from "@/lib/dna-parse"
import { DnaVisualization } from "./dna-visualization"
import { ClearCacheButton } from "@/components/clear-cache-button"

export function DnaGate() {
  const [data, setData] = useState<DnaSummary | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-md border border-accent/30 bg-accent/5 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-accent shrink-0" aria-hidden />
          <p className="flex-1 min-w-0 font-sans text-xs md:text-sm text-foreground/80">
            Analyzing <strong>your file</strong> — processed in your browser,
            never uploaded or stored. Close the tab and it&apos;s gone.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setData(null)}
              data-cursor-hover
              className="font-mono text-[10px] tracking-widest uppercase text-accent hover:text-foreground border-b border-accent hover:border-foreground pb-0.5 transition-colors"
            >
              Clear genome
            </button>
            {/* Wipe all cached site state + hard-reload — handy if the page ever
                shows stale data. Small icon button so it doesn't crowd the row. */}
            <ClearCacheButton />
          </div>
        </div>
        <DnaVisualization data={data} />
      </motion.div>
    )
  }

  return (
    <div className="min-h-[55vh] grid place-items-center">
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
    </div>
  )
}
