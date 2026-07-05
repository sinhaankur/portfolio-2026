"use client"

/**
 * TransferTool — an Earth→Mars Hohmann transfer calculator + diagram.
 *
 * Real patched-conic astrodynamics (validated to textbook values): flight time,
 * departure/arrival Δv, C3, required phase angle, and the next launch window
 * from the synodic period. An SVG shows the transfer ellipse between the two
 * orbits with the departure geometry. This is the engine's "explore → compute"
 * step — the thing that reads as real aerospace engineering.
 */

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Route, X } from "lucide-react"
import { earthToMarsTransfer, c3FromDv } from "@/lib/transfer"

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-background p-3">
      <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">{label}</dt>
      <dd className="font-sans text-sm text-foreground tabular-nums">
        {value}{sub && <span className="text-muted-foreground text-xs"> {sub}</span>}
      </dd>
    </div>
  )
}

/** Hohmann transfer diagram: Earth orbit (inner), Mars orbit (outer), the
 *  transfer ellipse (perihelion at Earth, aphelion at Mars) + planet markers. */
function TransferDiagram({ phaseDeg }: { phaseDeg: number }) {
  const cx = 110, cy = 110
  const rE = 42            // Earth orbit px
  const rM = rE * 1.5237   // Mars orbit px (true ratio)
  const aT = (rE + rM) / 2 // transfer semi-major (px)
  const cT = aT - rE       // ellipse centre offset toward aphelion (focus at Sun)
  const bT = Math.sqrt(aT * aT - cT * cT)
  // Earth at departure = left (perihelion); Mars ahead by phaseDeg.
  const eAng = Math.PI
  const mAng = Math.PI - (phaseDeg * Math.PI) / 180
  const eX = cx + rE * Math.cos(eAng), eY = cy + rE * Math.sin(eAng)
  const mX = cx + rM * Math.cos(mAng), mY = cy + rM * Math.sin(mAng)
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[16rem] mx-auto">
      {/* Sun */}
      <circle cx={cx} cy={cy} r="5" fill="#ffcf6b" />
      {/* orbits */}
      <circle cx={cx} cy={cy} r={rE} fill="none" stroke="#4d7cff" strokeWidth="0.8" opacity="0.6" />
      <circle cx={cx} cy={cy} r={rM} fill="none" stroke="#ff7a4d" strokeWidth="0.8" opacity="0.6" />
      {/* transfer ellipse — centre shifted so the Sun sits at a focus (left) */}
      <ellipse cx={cx + cT} cy={cy} rx={aT} ry={bT} fill="none" stroke="#7affd0" strokeWidth="1.1" strokeDasharray="3 2" />
      {/* planets */}
      <circle cx={eX} cy={eY} r="3.4" fill="#5a9dff" />
      <circle cx={mX} cy={mY} r="3" fill="#ff8a5a" />
      <text x={eX - 4} y={eY + 14} fill="#9ab8ff" fontSize="7" fontFamily="monospace">Earth</text>
      <text x={mX + 5} y={mY} fill="#ffb08a" fontSize="7" fontFamily="monospace">Mars</text>
    </svg>
  )
}

export function TransferTool({ onClose }: { onClose: () => void }) {
  const [t] = useState(() => earthToMarsTransfer())
  const c3 = useMemo(() => c3FromDv(t.dvDepartKms), [t])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(23rem,calc(100vw-2rem))] max-h-[78vh] overflow-y-auto rounded-xl border border-[#7affd0]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#7affd0]">
          <Route className="h-3.5 w-3.5" /> Earth → Mars transfer
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        <TransferDiagram phaseDeg={t.phaseAngleDeg} />

        <dl className="mt-3 grid grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden">
          <Stat label="Flight time" value={Math.round(t.flightDays).toString()} sub="days" />
          <Stat label="Next window" value={t.nextWindow.toLocaleDateString(undefined, { month: "short", year: "numeric" })} />
          <Stat label="Depart Δv" value={t.dvDepartKms.toFixed(2)} sub="km/s" />
          <Stat label="Arrive Δv" value={t.dvArriveKms.toFixed(2)} sub="km/s" />
          <Stat label="Total Δv" value={t.dvTotalKms.toFixed(2)} sub="km/s" />
          <Stat label="C3" value={c3.toFixed(1)} sub="km²/s²" />
          <Stat label="Phase angle" value={`${Math.round(t.phaseAngleDeg)}°`} sub="Mars ahead" />
          <Stat label="Window cycle" value={Math.round(t.synodicDays).toString()} sub="days" />
        </dl>

        <p className="mt-3 font-sans text-[11px] text-muted-foreground leading-relaxed">
          A Hohmann transfer: fire once to raise your orbit to Mars&apos;s distance, coast half an
          ellipse, arrive as Mars sweeps in. Launch only works when Mars leads Earth by ~{Math.round(t.phaseAngleDeg)}°,
          which recurs every ~{Math.round(t.synodicDays / 30.4)} months. Real patched-conic
          mechanics (circular-coplanar) — validated to textbook Δv/flight-time.
        </p>
      </div>
    </motion.div>
  )
}
