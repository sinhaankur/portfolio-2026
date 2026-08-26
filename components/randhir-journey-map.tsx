"use client"

// The journey of Dr. Randhir Kumar Sinha across India — 34 years, 8 postings, from
// the Himalayan foothills to the tropical south to the north-east. A constellation:
// each stop sits at its REAL geographic position (lat/lng, equirectangular-projected),
// connected in career order by a glowing silk thread. No country outline — the shape
// of his path IS the map, which suits the page's celestial silk aesthetic and keeps
// the geography honest (relative positions are real; a rough coastline would only
// add noise). Hover or tap a stop to read what he did there. Data from careerPosts.

import { useState } from "react"
import { careerPosts, type CareerPost } from "@/lib/randhir-publications"

// real coordinates of each posting town, in career order (oldest → newest).
// (a couple of postings share a town; we place the pin once and note both roles.)
type Stop = { city: string; lat: number; lng: number; postIdx: number }
const STOPS: Stop[] = [
  { city: "Ranchi / Batote", lat: 23.34, lng: 85.31, postIdx: 7 }, // 1975–77 (start)
  { city: "Bir, Himachal", lat: 32.05, lng: 76.72, postIdx: 6 },    // 1977–81
  { city: "Mysore", lat: 12.30, lng: 76.65, postIdx: 5 },           // 1981–82
  { city: "Kolar", lat: 13.14, lng: 78.13, postIdx: 4 },            // 1982–85
  { city: "Ranchi", lat: 23.34, lng: 85.31, postIdx: 3 },           // 1985–92
  { city: "Imphal", lat: 24.82, lng: 93.94, postIdx: 2 },           // 1992–95
  { city: "Hosur", lat: 12.74, lng: 77.83, postIdx: 1 },            // 1995–2008
  { city: "Munger", lat: 25.38, lng: 86.47, postIdx: 0 },           // 2008 → (retirement)
]

// India's bounding box for the equirectangular projection into a 0..100 viewBox.
const BOUNDS = { minLng: 68, maxLng: 97.5, minLat: 6.5, maxLat: 35.8 }
const VW = 100, VH = 118
function project(lat: number, lng: number): [number, number] {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * VW
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * VH
  return [x, y]
}

// the years label per stop (career order), for the constellation nodes
const YEARS = ["1975", "1977", "1981", "1982", "1985", "1992", "1995", "2008"]

export function RandhirJourneyMap() {
  const [active, setActive] = useState<number | null>(null)
  const pts = STOPS.map((s) => project(s.lat, s.lng))
  const pathD = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")

  const activeStop = active != null ? STOPS[active] : null
  const activePost: CareerPost | null = activeStop ? careerPosts[activeStop.postIdx] : null

  return (
    <div className="grid md:grid-cols-[1.15fr_1fr] gap-6 md:gap-8 items-center">
      {/* the constellation of postings */}
      <div className="relative rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12]/60 to-[#05060a]/60 p-4">
        <svg viewBox={`-6 -4 ${VW + 12} ${VH + 8}`} className="w-full h-auto" role="img"
          aria-label="Dr. Sinha's eight career postings across India, 1975 to 2008, as a connected path.">
          <defs>
            <linearGradient id="silk" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.95" />
              <stop offset="1" stopColor="#e6b26a" stopOpacity="0.95" />
            </linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="0.7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* a faint lat/lng graticule — a whisper of "this is India-scale geography" */}
          <g stroke="rgba(150,170,220,0.06)" strokeWidth="0.25">
            {[15, 20, 25, 30].map((lat) => { const [, y] = project(lat, 0); return (
              <line key={`h${lat}`} x1={-4} y1={y} x2={VW + 4} y2={y} />
            )})}
            {[72, 80, 88].map((lng) => { const [x] = project(0, lng); return (
              <line key={`v${lng}`} x1={x} y1={-2} x2={x} y2={VH + 2} />
            )})}
          </g>

          {/* the journey thread — a glowing silk line in career order */}
          <path d={pathD} fill="none" stroke="url(#silk)" strokeWidth="0.6"
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 1.5"
            opacity="0.9" filter="url(#glow)" className="journey-thread" />

          {/* the stops */}
          {pts.map(([x, y], i) => {
            const isActive = active === i
            const isEnd = i === STOPS.length - 1
            const labelBelow = y < 30 // put the label under the northern-most pins
            return (
              <g key={i} transform={`translate(${x} ${y})`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                onClick={() => setActive(isActive ? null : i)}
                style={{ cursor: "pointer" }} tabIndex={0} onFocus={() => setActive(i)}>
                <circle r="5" fill="transparent" /> {/* tap target */}
                {isActive && <circle r="3.4" fill="none" stroke={isEnd ? "#e6b26a" : "var(--accent)"} strokeWidth="0.4" opacity="0.6" />}
                <circle r={isActive ? 2.2 : 1.5} fill={isEnd ? "#e6b26a" : "var(--accent)"}
                  opacity={isActive ? 1 : 0.9} filter="url(#glow)" style={{ transition: "r 0.2s" }} />
                <text y={labelBelow ? 4.6 : -2.8} textAnchor="middle" className="fill-foreground"
                  style={{ fontSize: "2.7px", fontFamily: "var(--font-mono, monospace)", opacity: isActive ? 1 : 0.72 }}>
                  {STOPS[i].city.split(" ")[0]}
                </text>
                <text y={labelBelow ? 7.2 : -5.4} textAnchor="middle"
                  style={{ fontSize: "2px", fontFamily: "var(--font-mono, monospace)", fill: "var(--accent)", opacity: 0.55 }}>
                  {YEARS[i]}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="mt-1 text-center font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/40">
          1975 → 2008 · hover or tap a stop
        </p>
      </div>

      {/* the detail panel */}
      <div className="min-h-[180px]">
        {activePost ? (
          <div className="rounded-xl border border-border bg-secondary/10 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-sans text-[15px] font-medium text-foreground">{activePost.role}</p>
              <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-accent shrink-0">{activePost.years}</p>
            </div>
            <p className="font-sans text-[13px] text-foreground/60 mt-1">
              {activePost.institute} · {activePost.place}
            </p>
            <p className="font-sans text-[13px] leading-relaxed text-foreground/80 mt-3">{activePost.work}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-5 text-center">
            <p className="font-display text-lg font-light italic text-foreground/80">
              Thirty-four years, across the length of India.
            </p>
            <p className="font-sans text-[13px] text-foreground/55 mt-2 leading-relaxed">
              From the Himalayan foothills of Himachal to the tropical south, the
              north-east hills of Manipur, and home to Bihar — eight postings, the
              same patient science. Hover a stop to follow the path.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .journey-thread {
          stroke-dasharray: 0.1 1.6;
          animation: flow 22s linear infinite;
        }
        @keyframes flow { to { stroke-dashoffset: -34; } }
        @media (prefers-reduced-motion: reduce) { .journey-thread { animation: none; } }
      `}</style>
    </div>
  )
}
