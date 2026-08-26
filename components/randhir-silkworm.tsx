"use client"

// The creatures behind the career. Dr. Sinha worked on several silk-producing
// species across his 34 years — the mulberry silkworm (Bombyx mori) at CSGRC Hosur,
// and the wild tasar silkmoths (Antheraea) at the tasar institutes. This features a
// realistic Blender render of the silkworm itself, with the species he worked on
// named beside it — so the page shows the living thing, not just an abstract thread.

import { useEffect, useRef, useState } from "react"

const SPECIES = [
  { name: "Bombyx mori", common: "Mulberry silkworm", note: "the domesticated silkworm — CSGRC Hosur, germplasm conservation" },
  { name: "Antheraea mylitta", common: "Tropical tasar", note: "the wild tasar silkmoth — his early breeding & genetics at Ranchi" },
  { name: "Antheraea proylei", common: "Oak tasar", note: "oak-fed tasar — breed development at Imphal & Himachal" },
  { name: "Antheraea assama", common: "Muga", note: "the golden muga silkmoth — germplasm conservation strategy" },
]

export function RandhirSilkworm() {
  const [reduce, setReduce] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const on = () => setReduce(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])

  return (
    <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 md:gap-8 items-center">
      {/* the realistic silkworm render */}
      <figure className="relative overflow-hidden rounded-2xl border border-border bg-[#1a1f16]">
        <div className="aspect-video w-full">
          {reduce ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/video/silkworm-poster.webp" alt="A photorealistic silkworm (Bombyx mori) resting on a mulberry leaf."
              className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay loop muted playsInline
              poster="/video/silkworm-poster.webp"
              aria-label="A photorealistic silkworm (Bombyx mori) resting on a mulberry leaf, breathing gently.">
              <source src="/video/silkworm.webm" type="video/webm" />
              <source src="/video/silkworm.mp4" type="video/mp4" />
            </video>
          )}
        </div>
        <figcaption className="absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.15em] uppercase text-white/55">
          Bombyx mori · rendered from life
        </figcaption>
      </figure>

      {/* the species he worked on */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-foreground/45 mb-3">The creatures he studied</p>
        <ul className="space-y-3">
          {SPECIES.map((s) => (
            <li key={s.name} className="border-l-2 border-accent/40 pl-3">
              <p className="font-display italic text-[15px] text-foreground/90">{s.name}</p>
              <p className="font-sans text-[12px] text-foreground/55">
                <span className="text-foreground/75">{s.common}</span> — {s.note}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
