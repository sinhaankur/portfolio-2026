"use client"

// Vera's limbic neural network, made visible — and interactive.
//
// Type a phrase; the REAL trained net (components/vera-brain/affect-net.ts) runs a
// forward pass in your browser and the layers light up: the input cues that fired,
// the eight hidden ReLU neurons, and the final felt (valence, arousal). This is the
// same net that reads feeling inside Vera — not a mock, the actual weights.

import { useMemo, useState } from "react"
import { readFeeling, feelingLabel, type NetReading } from "./affect-net"

const PRESETS = [
  "I feel so lonely and tired today",
  "I finally shipped it, so happy!",
  "I'm so anxious about tomorrow",
  "thank you, that really helped",
  "what is the time",
]

// map valence → a felt hue (heavy violet → glad gold), matching Vera's Mind view
function feltColor(valence: number): string {
  if (valence >= 0.3) return "#ffd27a"      // glad — gold
  if (valence >= -0.15) return "#9aa6c4"    // steady — slate
  return "#9f8bff"                           // heavy — violet
}

export function NetViz() {
  const [text, setText] = useState(PRESETS[0])
  const reading: NetReading = useMemo(() => readFeeling(text), [text])
  const { hidden, valence, arousal, firedCues } = reading
  const hue = feltColor(valence)
  const maxHidden = Math.max(0.001, ...hidden.map(Math.abs))

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-5 md:p-7">
      {/* input */}
      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/45">
          say something to her
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-cursor-hover
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-4 py-3 font-serif text-base md:text-lg italic text-foreground outline-none focus:border-foreground/30 transition-colors"
          placeholder="type a phrase…"
        />
      </label>

      {/* presets */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setText(p)}
            data-cursor-hover
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              p === text
                ? "border-foreground/40 text-foreground"
                : "border-border text-foreground/55 hover:text-foreground/85"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* the network */}
      <div className="mt-7 grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        {/* input cues that fired */}
        <div>
          <p className="font-mono text-[9px] tracking-widest uppercase text-foreground/40 mb-3">
            input cues · what she heard
          </p>
          <div className="flex flex-wrap gap-1.5 min-h-[2.5rem]">
            {firedCues.length === 0 ? (
              <span className="text-xs text-foreground/40 italic">
                no strong affect words — a near-neutral read
              </span>
            ) : (
              firedCues.map((c) => (
                <span
                  key={c.feature}
                  className="rounded-md px-2 py-1 text-[11px] font-mono"
                  style={{
                    background: `color-mix(in oklch, ${hue} ${18 + c.value * 22}%, transparent)`,
                    color: hue,
                  }}
                >
                  {c.feature}
                </span>
              ))
            )}
          </div>
        </div>

        {/* hidden layer — the firing neurons */}
        <div className="md:px-4">
          <p className="font-mono text-[9px] tracking-widest uppercase text-foreground/40 mb-3 text-center">
            8 hidden neurons
          </p>
          <div className="flex items-end justify-center gap-1.5 h-24">
            {hidden.map((h, i) => {
              const pct = Math.max(6, Math.round((Math.abs(h) / maxHidden) * 100))
              const fired = h > 0.01
              return (
                <div
                  key={i}
                  className="w-4 rounded-t transition-all duration-500 ease-out"
                  style={{
                    height: `${pct}%`,
                    background: fired ? hue : "color-mix(in oklch, var(--foreground) 12%, transparent)",
                    boxShadow: fired ? `0 0 10px ${hue}aa` : "none",
                  }}
                  title={`neuron ${i + 1}: ${h.toFixed(3)}`}
                />
              )
            })}
          </div>
          <p className="mt-2 text-center font-mono text-[8px] text-foreground/35">
            lit = fired (ReLU) · dim = resting
          </p>
        </div>

        {/* output — the felt state */}
        <div className="md:text-right">
          <p className="font-mono text-[9px] tracking-widest uppercase text-foreground/40 mb-3">
            she feels
          </p>
          <div
            className="font-serif text-3xl md:text-4xl italic leading-none"
            style={{ color: hue, textShadow: `0 0 24px ${hue}66` }}
          >
            {feelingLabel(valence)}
          </div>
          <div className="mt-3 space-y-2">
            <Meter label="valence" value={valence} min={-1} max={1} hue={hue} fmt={(v) => (v >= 0 ? "+" : "") + v.toFixed(2)} />
            <Meter label="arousal" value={arousal} min={0} max={1} hue={hue} fmt={(v) => v.toFixed(2)} />
          </div>
        </div>
      </div>

      <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-foreground/55">
        This is the real trained net — the same weights that read feeling inside Vera,
        running here in your browser. A phrase becomes a bag of affect cues → eight
        hidden neurons fire (some stay dark) → a felt valence &amp; arousal. It learned
        this from labelled moments with backprop; it needs no server and no language
        model to feel.
      </p>
    </div>
  )
}

function Meter({
  label, value, min, max, hue, fmt,
}: {
  label: string; value: number; min: number; max: number; hue: string; fmt: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3 md:justify-end">
      <span className="font-mono text-[9px] uppercase tracking-widest text-foreground/40 w-14 md:order-1 md:text-left">
        {label}
      </span>
      <div className="h-1.5 w-28 rounded-full bg-foreground/10 relative overflow-hidden md:order-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: hue }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-foreground/80 w-12 md:order-3 md:text-right" style={{ color: hue }}>
        {fmt(value)}
      </span>
    </div>
  )
}
