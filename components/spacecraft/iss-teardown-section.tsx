"use client"

/**
 * IssTeardownSection — the in-depth second act of the spacecraft catalog.
 *
 * The visitor scrolls down from the gallery into this: the International Space
 * Station, taken apart into its 27 real elements. The exploded isometric figure
 * is a self-contained, offline-safe bundle (built from the anatomy/teardown kit,
 * authored in components/spacecraft/_teardown/iss/build.mjs) served from
 * public/reference/spacecraft/iss-teardown/ and embedded here via an iframe so
 * its 68 KB global-scope script never has to be replumbed into React. The frame
 * is theme-synced to the site (dark/light bundle).
 *
 * Every number on this page is real and sourced (NASA / Wikipedia ISS): the
 * station masses ~450 t, holds 1,005 m³ of pressurized volume, spans 109 m,
 * draws ~120 kW from eight solar wings, and laps the Earth every 92.9 minutes.
 */

import { useRef } from "react"
import { motion } from "framer-motion"

const EASE = [0.16, 1, 0.3, 1] as const

// Real ISS specs — sourced from NASA / Wikipedia (International Space Station).
const SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Mass", value: "~450,000 kg", note: "roughly 450 tonnes in orbit" },
  { label: "Length", value: "109 m", note: "truss span 94 m" },
  { label: "Solar array width", value: "73 m", note: "eight wings, ~120 kW" },
  { label: "Pressurized volume", value: "1,005 m³", note: "16 modules" },
  { label: "Altitude", value: "~400 km", note: "low Earth orbit" },
  { label: "Speed", value: "7.66 km/s", note: "27,600 km/h" },
  { label: "Orbit", value: "92.9 min", note: "15.5 orbits a day" },
  { label: "Inclination", value: "51.64°", note: "reachable from Baikonur + the Cape" },
  { label: "Crew", value: "7", note: "continuously crewed since Nov 2000" },
  { label: "First module", value: "20 Nov 1998", note: "Zarya, assembled over 40+ flights" },
]

// The six real subsystems the exploded figure separates into.
const SUBSYSTEMS: { name: string; role: string }[] = [
  { name: "The backbone", role: "the Integrated Truss Structure — 11 segments, P6 to S6, bolted end to end across 94 m" },
  { name: "Solar power", role: "eight solar array wings fanning off the outboard truss, generating ~120 kW; rotary joints track the Sun" },
  { name: "Cooling", role: "deployable ammonia radiators on P1/S1 dump the heat the arrays and avionics make into space" },
  { name: "Pressurized modules", role: "Destiny, Harmony, Columbus, Kibō, Unity, Tranquility + Cupola, Zarya, Zvezda — the lab + living stack hung fore-and-aft at S0" },
  { name: "Docking", role: "pressurized mating adapters + IDA docking ports where Dragon and Starliner arrive" },
  { name: "Robotics", role: "the 17 m Canadarm2 on its Mobile Base System, which walks the truss to berth cargo and build the station" },
]

// What visits the station — the ISS ecosystem (real active + retired vehicles).
const ECOSYSTEM: { kind: string; craft: string }[] = [
  { kind: "Crew", craft: "Crew Dragon (NASA/SpaceX) · Soyuz (Roscosmos)" },
  { kind: "Cargo", craft: "Cargo Dragon · Cygnus (Northrop) · Progress · HTV-X (JAXA)" },
  { kind: "Builds it", craft: "Canadarm2 + Dextre · spacewalking crew (EVA)" },
  { kind: "Succeeds it", craft: "commercial stations: Axiom, Orbital Reef, Starlab (~2030)" },
]

function TeardownFrame() {
  const ref = useRef<HTMLIFrameElement>(null)

  // This whole gallery section is ALWAYS dark (bg-[#0a0a0c] text-white),
  // regardless of the site's light/dark theme — so the embedded figure always
  // uses the DARK bundle to sit flush with its surroundings. (The light bundle
  // exists for a future light-surfaced home.)
  const src = "/reference/spacecraft/iss-teardown/index.html"

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      {/* The figure reserves its own headroom for the explode; the iframe gives
          it a fixed aspect so it never collapses to 0 height. */}
      <iframe
        ref={ref}
        src={src}
        title="International Space Station — exploded teardown of its 27 real elements"
        loading="lazy"
        className="block h-[clamp(360px,62vw,640px)] w-full"
        style={{ border: 0, colorScheme: "normal" }}
      />
    </div>
  )
}

export function IssTeardownSection() {
  return (
    <section
      id="iss-teardown"
      className="relative w-full scroll-mt-0 bg-[#0a0a0c] px-5 pb-28 pt-16 text-white md:px-10 md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth · 01
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
            The International Space Station, taken apart.
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-sm leading-relaxed text-white/70 md:text-[15px]">
            The largest thing humanity has ever built in space is not one machine
            but twenty-seven, bolted together over forty-odd flights. Hover the
            figure to lift every real element clear of the station — the eleven
            truss segments, the eight solar wings, the radiators, the pressurized
            module stack, the docking ports and Canadarm2 — then tap any part to
            read what it is. Every element below is a real, named ISS assembly.
          </p>
        </motion.div>

        {/* The exploded figure */}
        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <TeardownFrame />
        </motion.div>

        {/* Six subsystems */}
        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth · 02 — six systems, one station
          </div>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2">
            {SUBSYSTEMS.map((s) => (
              <div key={s.name} className="bg-[#0a0a0c] p-5 md:p-6">
                <h3 className="font-display text-lg font-light text-white">{s.name}</h3>
                <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-white/60">{s.role}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Real specs */}
        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth · 03 — the real numbers
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-5">
            {SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-6 font-mono text-[10px] text-white/30">
            Figures: NASA · Wikipedia (International Space Station). The structure
            in the figure follows the real assembly sequence, segment by segment.
          </p>
        </motion.div>

        {/* Ecosystem — what visits it */}
        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth · 04 — what it works with
          </div>
          <h3 className="mt-4 max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] md:text-3xl">
            A port, not an island.
          </h3>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
            {ECOSYSTEM.map((e) => (
              <div key={e.kind} className="bg-[#0a0a0c] p-5">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{e.kind}</div>
                <div className="mt-1.5 font-sans text-[13px] leading-relaxed text-white/75">{e.craft}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
