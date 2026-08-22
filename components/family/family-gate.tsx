"use client"

import { useEffect, useState } from "react"
import { FamilyAccordion } from "./family-accordion"

/**
 * A SOFT passcode gate.
 *
 * IMPORTANT — what this is and isn't: the site is a static export, so the media
 * files under /public are served by URL and the check below runs entirely in the
 * browser. This gate keeps the page from casually showing on arrival and hides
 * the passcode word behind a hash (so it isn't sitting in plain text in the JS
 * bundle) — but a determined person could read the network requests and reach an
 * image URL directly. Treat this as a "please knock first" curtain, not real
 * access control. Don't put anything here you'd be harmed by a stranger seeing.
 *
 * To change the passcode: pick a word, compute its SHA-256 hash, and paste the
 * hex string into PASSCODE_HASH below. From a terminal:
 *   echo -n "yourword" | shasum -a 256
 * (the value here is the hash of the default word "family").
 */
const PASSCODE_HASH =
  "d9256a362a4ee8d7fffff3d856e30ad7d763892abb4d35d4b611b22ea5a72c07" // sha256("gubbu") — case-insensitive

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input.trim().toLowerCase())
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

const SESSION_KEY = "family-unlocked"

export function FamilyGate() {
  const [unlocked, setUnlocked] = useState(false)
  const [value, setValue] = useState("")
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  // Remember an unlock for the browser session so we don't re-prompt on every nav.
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") {
      setUnlocked(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setError(false)
    const ok = (await sha256Hex(value)) === PASSCODE_HASH
    setChecking(false)
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1")
      setUnlocked(true)
    } else {
      setError(true)
      setValue("")
    }
  }

  if (unlocked) return <FamilyAccordion />

  return (
    <div className="flex h-[60vh] w-full items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl"
      >
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
          For people I love
        </p>
        <h2 className="mb-6 font-serif text-2xl font-light tracking-tight text-white/90">
          A little private corner
        </h2>
        <input
          type="password"
          inputMode="text"
          autoComplete="off"
          placeholder="Passcode"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          className="w-full rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-center font-sans text-sm text-white/90 placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={checking || value.length === 0}
          className="mt-4 w-full rounded-full border border-white/20 bg-white/[0.08] px-5 py-3 font-mono text-xs uppercase tracking-widest text-white/80 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
        >
          {checking ? "Checking…" : "Enter"}
        </button>
        <p
          className={`mt-4 h-4 font-sans text-xs transition-opacity ${
            error ? "text-rose-300/80 opacity-100" : "opacity-0"
          }`}
        >
          That&apos;s not it — try again.
        </p>
      </form>
    </div>
  )
}
