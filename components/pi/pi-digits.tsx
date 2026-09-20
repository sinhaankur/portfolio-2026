"use client"

// π to the nth digit — computed live, streaming into a horizontally-scrollable
// ribbon. The point you can feel: the digits never stop and never repeat. We
// compute them ourselves with a spigot algorithm (BigInt), so it's the real π,
// not a stored string — and you can pull the ribbon as far as you like.
//
// Algorithm: the classic unbounded spigot for π (Rabinowitz–Wagon style), which
// emits correct decimal digits one at a time using only big-integer arithmetic.
// Original implementation.

import { useCallback, useEffect, useRef, useState } from "react"

// Unbounded spigot generator for π's decimal digits (first digit is 3).
// Uses the BigInt() constructor (not `n` literals) so it compiles on an ES6
// target. Verified: emits 3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,… correctly.
function* piDigits(): Generator<number> {
  const B = (x: number) => BigInt(x)
  const TWO = B(2), THREE = B(3), FOUR = B(4), TEN = B(10), SEVEN = B(7)
  let q = B(1), r = B(0), t = B(1), k = B(1), n = B(3), l = B(3)
  while (true) {
    if (q * FOUR + r - t < n * t) {
      yield Number(n)
      const nr = TEN * (r - n * t)
      n = TEN * (THREE * q + r) / t - TEN * n
      q = q * TEN
      r = nr
    } else {
      const nr = (TWO * q + r) * l
      const nn = (q * (SEVEN * k) + TWO + r * l) / (t * l)
      q = q * k
      t = t * l
      l = l + TWO
      k = k + B(1)
      n = nn
      r = nr
    }
  }
}

export function PiDigits() {
  const [digits, setDigits] = useState<string>("3")   // "3" then "3.14159…"
  const [count, setCount] = useState(1)               // digits produced
  const [running, setRunning] = useState(true)
  const genRef = useRef<Generator<number> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const runRef = useRef(running); runRef.current = running
  const bufRef = useRef<string>("3")

  const reset = useCallback(() => {
    genRef.current = piDigits()
    genRef.current.next()   // consume the leading 3 (we seed it)
    bufRef.current = "3"
    setDigits("3"); setCount(1)
  }, [])

  useEffect(() => { reset() }, [reset])

  // produce a batch of digits per animation frame; keep the ribbon scrolled to
  // the newest digit so it reads as an endless stream flowing left.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!runRef.current || !genRef.current) return
      let s = bufRef.current
      for (let i = 0; i < 6; i++) {                     // ~6 digits/frame → smooth
        const d = genRef.current.next()
        if (d.done) break
        s += d.value
      }
      bufRef.current = s
      setDigits(s)
      setCount(s.length)
      // auto-follow the newest digits
      const el = scrollRef.current
      if (el) el.scrollLeft = el.scrollWidth
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // render "3.14159…" — the first char is the 3, then a dot, then the rest
  const rest = digits.slice(1)

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="font-mono text-[11px] text-foreground/55">
          π to <span className="text-accent tabular-nums">{count.toLocaleString()}</span> digits — computed live, scroll ←→ to travel
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">{running ? "Pause" : "Compute more"}</button>
          <button onClick={reset} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60 hover:border-accent/50">Restart</button>
        </div>
      </div>

      {/* the horizontally-scrollable digit ribbon */}
      <div
        ref={scrollRef}
        className="relative overflow-x-auto overflow-y-hidden rounded-lg border border-border/40 bg-black py-6 px-5"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="whitespace-nowrap font-mono text-2xl md:text-4xl leading-none tracking-tight select-text">
          <span className="text-accent">3</span>
          <span className="text-foreground/40">.</span>
          {/* group the fractional digits in tens for readability, subtle stripes */}
          {rest.split("").map((ch, i) => (
            <span
              key={i}
              className={((i + 1) % 10 === 0 ? "text-white " : (Math.floor(i / 10) % 2 === 0 ? "text-foreground/85 " : "text-foreground/60 "))}
            >
              {ch}
            </span>
          ))}
          <span className="text-accent/70 animate-pulse">▮</span>
        </div>
      </div>

      <p className="mt-3 text-sm text-foreground/65 leading-relaxed">
        These digits are <em>computed here, now</em> — a spigot algorithm grinding
        them out one at a time with exact big-integer arithmetic, not a stored
        string. Let it run and the ribbon grows without end; scroll back and you
        can inspect any digit. It never terminates and never falls into a repeat —
        that&apos;s what &ldquo;irrational&rdquo; means, in the most literal way:
        the decimals just keep coming, forever.
      </p>
    </div>
  )
}
