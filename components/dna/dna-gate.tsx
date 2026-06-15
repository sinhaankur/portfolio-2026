"use client"

/**
 * DnaGate — password screen for the (unlisted) /dna page.
 *
 * Fetches the encrypted blob, asks for a password, and attempts an AES-GCM
 * decrypt. A wrong password fails the GCM auth tag and throws — we surface that
 * as "incorrect password". On success it renders the visualization. The
 * password is never stored; nothing decrypts server-side because there is no
 * server (static export).
 */

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Lock, Loader2, Upload, ShieldCheck } from "lucide-react"
import { decryptDna, type DnaSummary, type EncryptedBlob } from "@/lib/dna-crypto"
import { parseDnaFile } from "@/lib/dna-parse"
import { DnaVisualization } from "./dna-visualization"

type Status = "locked" | "checking" | "error" | "unlocked"

export function DnaGate() {
  const [blob, setBlob] = useState<EncryptedBlob | null>(null)
  const [status, setStatus] = useState<Status>("locked")
  const [password, setPassword] = useState("")
  const [data, setData] = useState<DnaSummary | null>(null)
  const [own, setOwn] = useState(false) // viewing an uploaded file (not Ankur's)
  const [parsing, setParsing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setUploadError(null)
    const result = await parseDnaFile(file)
    setParsing(false)
    if (result.ok) {
      setData(result.summary)
      setOwn(true)
      setStatus("unlocked")
    } else {
      setUploadError(result.error)
    }
    // allow re-selecting the same file
    if (fileRef.current) fileRef.current.value = ""
  }

  useEffect(() => {
    fetch("/data/dna.enc.json")
      .then((r) => r.json())
      .then(setBlob)
      .catch(() => setBlob(null))
  }, [])

  useEffect(() => {
    if (status === "locked") inputRef.current?.focus()
  }, [status])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!blob || !password) return
    setStatus("checking")
    try {
      const result = await decryptDna(blob, password)
      setData(result)
      setStatus("unlocked")
    } catch {
      setStatus("error")
      setPassword("")
      // re-focus for another try
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  if (status === "unlocked" && data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {own && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-md border border-accent/30 bg-accent/5 px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-accent shrink-0" aria-hidden />
            <p className="flex-1 min-w-0 font-sans text-xs md:text-sm text-foreground/80">
              Analyzing <strong>your uploaded file</strong> — processed in your
              browser, never uploaded or stored.
            </p>
            <button
              type="button"
              onClick={() => {
                setData(null)
                setOwn(false)
                setStatus("locked")
              }}
              data-cursor-hover
              className="font-mono text-[10px] tracking-widest uppercase text-accent hover:text-foreground border-b border-accent hover:border-foreground pb-0.5 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
        <DnaVisualization data={data} />
      </motion.div>
    )
  }

  return (
    <div className="min-h-[55vh] grid place-items-center">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm text-center"
      >
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border border-border bg-secondary/30">
          <Lock className="h-5 w-5 text-accent" aria-hidden />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-light tracking-[-0.01em] mb-2">
          Private
        </h1>
        <p className="font-sans text-sm text-foreground/70 leading-relaxed mb-8">
          This page visualizes my genome. It&apos;s encrypted — enter the
          password to decrypt and view it.
        </p>

        <div className="relative">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (status === "error") setStatus("locked")
            }}
            placeholder="Password"
            autoComplete="off"
            aria-label="Password"
            aria-invalid={status === "error"}
            className="
              w-full rounded-full border border-border bg-background
              px-5 py-3 pr-12
              font-mono text-sm tracking-wider text-foreground
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
            "
          />
          <button
            type="submit"
            disabled={!blob || !password || status === "checking"}
            data-cursor-hover
            aria-label="Unlock"
            className="
              absolute right-1.5 top-1/2 -translate-y-1/2
              grid h-9 w-9 place-items-center rounded-full
              text-accent hover:text-foreground hover:bg-secondary/60
              disabled:opacity-40 disabled:hover:bg-transparent
              transition-colors
            "
          >
            {status === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <span aria-hidden>→</span>
            )}
          </button>
        </div>

        <div className="h-6 mt-3">
          <AnimatePresence>
            {status === "error" && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[11px] tracking-wider uppercase text-[#f06c8d]"
              >
                Incorrect password
              </motion.p>
            )}
            {!blob && status !== "error" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground"
              >
                Loading…
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="my-8 flex items-center gap-4" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            or
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Upload your own — anyone can analyze their own file, client-side */}
        <div className="text-left">
          <p className="font-sans text-sm md:text-base text-foreground mb-1.5 text-center">
            Analyze your own DNA
          </p>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed mb-4 text-center">
            Upload a raw file from MyHeritage, 23andMe, or AncestryDNA. It&apos;s
            read and analyzed <strong>entirely in your browser</strong> — never
            uploaded, stored, or sent anywhere.
          </p>

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
              rounded-full border border-border bg-background
              px-5 py-3 min-h-11
              font-mono text-xs tracking-widest uppercase
              text-foreground/85 hover:text-foreground hover:border-accent/60
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

          <div className="mt-3 flex items-start gap-2 justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" aria-hidden />
            <p className="font-sans text-[11px] text-muted-foreground leading-relaxed text-center">
              100% private. No server, no account, nothing leaves this device.
            </p>
          </div>

          <AnimatePresence>
            {uploadError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 font-sans text-xs text-[#f06c8d] leading-relaxed text-center"
              >
                {uploadError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.form>
    </div>
  )
}
