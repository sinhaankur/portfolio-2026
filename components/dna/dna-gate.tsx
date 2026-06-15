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
import { Lock, Loader2 } from "lucide-react"
import { decryptDna, type DnaSummary, type EncryptedBlob } from "@/lib/dna-crypto"
import { DnaVisualization } from "./dna-visualization"

type Status = "locked" | "checking" | "error" | "unlocked"

export function DnaGate() {
  const [blob, setBlob] = useState<EncryptedBlob | null>(null)
  const [status, setStatus] = useState<Status>("locked")
  const [password, setPassword] = useState("")
  const [data, setData] = useState<DnaSummary | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      </motion.form>
    </div>
  )
}
