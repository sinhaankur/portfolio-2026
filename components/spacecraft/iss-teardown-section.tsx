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

function TeardownFrame({ src, title }: { src?: string; title?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

  // This whole gallery section is ALWAYS dark (bg-[#0a0a0c] text-white),
  // regardless of the site's light/dark theme — so the embedded figure always
  // uses the DARK bundle to sit flush with its surroundings. (The light bundle
  // exists for a future light-surfaced home.)
  const frameSrc = src ?? "/reference/spacecraft/iss-teardown/index.html"

  return (
    // NO CARD CHROME — the figure must BLEND into the page, not sit in a boxed
    // widget (Ankur: "nothing should be separate, all of this should blend in").
    // So: no border, no rounded frame, no plate — just a soft radial glow BEHIND
    // the figure so the grey wireframe still reads on the dark section, and the
    // iframe floats directly on it. (The bundle's own plate chrome is stripped in
    // build.mjs → the figure is the whole canvas.)
    <div
      className="relative w-full"
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, rgba(120,130,150,0.08) 0%, transparent 60%)",
      }}
    >
      {/* The figure reserves its own headroom for the explode; the iframe gives
          it a fixed aspect so it never collapses to 0 height. */}
      <iframe
        ref={ref}
        src={frameSrc}
        title={title ?? "International Space Station — exploded teardown of its 27 real elements"}
        loading="lazy"
        className="block h-[clamp(360px,62vw,640px)] w-full"
        style={{ border: 0, colorScheme: "normal", background: "transparent" }}
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
            In depth
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

        {/* Six subsystems — flows straight out of the figure (the figure IS these
            systems coming apart), so no numbered "tab", just a quiet lead line. */}
        <motion.div
          className="mt-12 md:mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="max-w-2xl font-sans text-sm leading-relaxed text-white/55 md:text-[15px]">
            Everything in that figure belongs to one of six systems — the backbone
            it&apos;s built on, the power and cooling that keep it alive, the
            modules where people live and work, and the ports and arm that let it
            grow.
          </p>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2">
            {SUBSYSTEMS.map((s) => (
              <div key={s.name} className="bg-[#0a0a0c] p-5 md:p-6">
                <h3 className="font-display text-lg font-light text-white">{s.name}</h3>
                <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-white/60">{s.role}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* The facts — real numbers AND the ecosystem, merged under one heading
            (they're both "the station, measured + connected", not two tabs). */}
        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h3 className="max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] text-white md:text-3xl">
            The real numbers — and what it works with.
          </h3>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-5">
            {SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>

          {/* Ecosystem — a port, not an island — continues the same block. */}
          <p className="mt-12 max-w-2xl font-sans text-sm leading-relaxed text-white/55 md:text-[15px]">
            It&apos;s a port, not an island — a steady stream of crew and cargo
            ships dock, and a line of commercial stations is being built to take
            over.
          </p>
          <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
            {ECOSYSTEM.map((e) => (
              <div key={e.kind} className="bg-[#0a0a0c] p-5">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{e.kind}</div>
                <div className="mt-1.5 font-sans text-[13px] leading-relaxed text-white/75">{e.craft}</div>
              </div>
            ))}
          </div>

          <p className="mt-8 font-mono text-[10px] text-white/30">
            Figures: NASA · Wikipedia (International Space Station). The structure
            in the figure follows the real assembly sequence, segment by segment.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// Real Hubble specs — NASA Hubble fact sheet + lib/craft-anatomy.ts.
const HUBBLE_SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Mirror", value: "2.4 m", note: "the primary" },
  { label: "Length", value: "13.2 m", note: "a school bus" },
  { label: "Mass", value: "~11,100 kg" },
  { label: "Power", value: "~2.8 kW", note: "two solar wings" },
  { label: "Altitude", value: "~540 km", note: "low Earth orbit" },
  { label: "Pointing", value: "7 milliarcsec", note: "a coin, 320 km away" },
  { label: "Launched", value: "1990", note: "STS-31" },
  { label: "Servicings", value: "5", note: "by Shuttle crews" },
]

export function HubbleTeardownSection() {
  return (
    <section
      id="hubble-teardown"
      className="relative w-full scroll-mt-0 border-t border-white/10 bg-[#0a0a0c] px-5 pb-28 pt-16 text-white md:px-10 md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Hubble is really one long tube.
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-sm leading-relaxed text-white/70 md:text-[15px]">
            Strip away the gold foil and Hubble is an optical telescope the length
            of a school bus. Starlight enters the aperture door, runs down the
            baffled tube to the 2.4 m primary mirror at the back, folds off the
            little secondary near the front, and lands on the instruments at the
            focal plane. Hover the figure to lift every real part clear; tap one to
            read what it is.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <TeardownFrame
            src="/reference/spacecraft/hubble-teardown/index.html"
            title="Hubble Space Telescope — exploded teardown of its 10 real elements"
          />
        </motion.div>

        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h3 className="max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] text-white md:text-3xl">
            The real numbers.
          </h3>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            {HUBBLE_SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-2xl font-sans text-sm leading-relaxed text-white/55">
            The famous part: the 2.4 m primary was ground slightly too flat in 1990
            — a flaw the width of 1/50th of a human hair — and blurred every early
            image. Astronauts fitted corrective optics in 1993, the first of five
            servicing missions. It&apos;s been imaging the deep universe ever since.
          </p>
          <p className="mt-6 font-mono text-[10px] text-white/30">
            Figures: NASA Hubble fact sheet. The optical path in the figure is the
            real light path — aperture → primary → secondary → instruments.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// Real JWST specs — NASA JWST fact sheet + Wikipedia (verified 2026-11-05).
const JWST_SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Mirror", value: "6.5 m", note: "18 gold hex segments" },
  { label: "Mass", value: "6,200 kg" },
  { label: "Sunshield", value: "21 × 14 m", note: "5 layers, tennis-court" },
  { label: "Cold side", value: "< 50 K", note: "−223 °C" },
  { label: "Orbit", value: "Sun–Earth L2", note: "~1.5M km" },
  { label: "Sees in", value: "Infrared", note: "the first galaxies" },
  { label: "Launched", value: "2021", note: "Ariane 5" },
  { label: "Builders", value: "NASA · ESA · CSA" },
]

export function JwstTeardownSection() {
  return (
    <section
      id="jwst-teardown"
      className="relative w-full scroll-mt-0 border-t border-white/10 bg-[#0a0a0c] px-5 pb-28 pt-16 text-white md:px-10 md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Webb is a cold telescope on a hot kite.
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-sm leading-relaxed text-white/70 md:text-[15px]">
            To see the first galaxies in infrared, Webb has to be colder than its
            own glow. So everything splits in two: above a five-layer, tennis-court-
            sized sunshield, the 18 hexagonal gold mirror segments and the
            instruments sit near 40 below zero; below it, in the Sun, the warm bus
            keeps house. Hover the figure to lift every real part clear; tap one to
            read what it is.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <TeardownFrame
            src="/reference/spacecraft/jwst-teardown/index.html"
            title="James Webb Space Telescope — exploded teardown of its 10 real elements"
          />
        </motion.div>

        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h3 className="max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] text-white md:text-3xl">
            The real numbers.
          </h3>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            {JWST_SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-2xl font-sans text-sm leading-relaxed text-white/55">
            The mirror is gold for a reason — a 100-nanometre coating reflects
            infrared better than silver or aluminium. It launched folded like
            origami inside the rocket and unfolded over two weeks in space, a
            sequence with 344 single points of failure, every one of which held.
          </p>
          <p className="mt-6 font-mono text-[10px] text-white/30">
            Figures: NASA JWST fact sheet (verified). The two-zone split in the
            figure is the real thermal design — cold optics, warm bus.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// Real Tiangong specs — Wikipedia / CMSA (verified 2026-11-05).
const TIANGONG_SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Mass", value: "~100 t", note: "three modules" },
  { label: "Length", value: "~55.6 m", note: "the T" },
  { label: "Volume", value: "340 m³", note: "pressurised" },
  { label: "Altitude", value: "~390 km", note: "low Earth orbit" },
  { label: "Inclination", value: "41.5°", note: "from Jiuquan" },
  { label: "Crew", value: "3", note: "6 at handover" },
  { label: "Core launched", value: "2021", note: "Tianhe" },
  { label: "Operator", value: "CMSA", note: "China" },
]

export function TiangongTeardownSection() {
  return (
    <section
      id="tiangong-teardown"
      className="relative w-full scroll-mt-0 border-t border-white/10 bg-[#0a0a0c] px-5 pb-28 pt-16 text-white md:px-10 md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Tiangong is a T in orbit.
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-sm leading-relaxed text-white/70 md:text-[15px]">
            China&apos;s station is three modules in the shape of a T: the Tianhe
            core runs fore-and-aft with the crew quarters and a three-port docking
            node, and two science labs — Wentian and Mengtian — hang off its sides
            to make the crossbar. Built independently after China was left out of
            the ISS. Hover the figure to lift every real part clear; tap one to
            read what it is.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <TeardownFrame
            src="/reference/spacecraft/tiangong-teardown/index.html"
            title="Tiangong Space Station — exploded teardown of its 10 real elements"
          />
        </motion.div>

        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h3 className="max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] text-white md:text-3xl">
            The real numbers.
          </h3>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            {TIANGONG_SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-8 font-mono text-[10px] text-white/30">
            Figures: Wikipedia / China Manned Space Agency (verified). The T layout
            + module order in the figure is the real assembled configuration.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// Real Cassini specs — Wikipedia Cassini–Huygens (verified 2026-11-06).
const CASSINI_SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Height", value: "6.8 m", note: "4 m wide" },
  { label: "Mass", value: "5,712 kg", note: "at launch, fuelled" },
  { label: "Power", value: "~885 W", note: "3 plutonium RTGs" },
  { label: "Antenna", value: "4 m", note: "high-gain dish" },
  { label: "Main engine", value: "490 N", note: "R-4D, +1 backup" },
  { label: "Launched", value: "1997", note: "Titan IV-B" },
  { label: "Arrived", value: "2004", note: "Saturn orbit" },
  { label: "Huygens", value: "2005", note: "landed on Titan" },
]

export function CassiniTeardownSection() {
  return (
    <section
      id="cassini-teardown"
      className="relative w-full scroll-mt-0 border-t border-white/10 bg-[#0a0a0c] px-5 pb-28 pt-16 text-white md:px-10 md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Cassini was a nuclear bus, stacked tall.
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-sm leading-relaxed text-white/70 md:text-[15px]">
            Out at Saturn there&apos;s almost no sunlight, so Cassini ran on three
            plutonium generators instead of solar panels. The 4-metre antenna on
            top doubled as a sunshade; below it stacked the brain, the adapter, and
            the propulsion module; an 11-metre boom held the magnetometer clear;
            and ESA&apos;s Huygens probe rode on the side until it parachuted onto
            Titan. Hover the figure to lift every real part clear; tap one to read
            what it is.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <TeardownFrame
            src="/reference/spacecraft/cassini-teardown/index.html"
            title="Cassini orbiter — exploded teardown of its 10 real elements"
          />
        </motion.div>

        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h3 className="max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] text-white md:text-3xl">
            The real numbers.
          </h3>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            {CASSINI_SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-2xl font-sans text-sm leading-relaxed text-white/55">
            After 13 years at Saturn — discovering oceans under Enceladus and
            methane seas on Titan — Cassini was deliberately flown into Saturn in
            2017 to burn up, so it could never contaminate a potentially habitable
            moon. It sent data the whole way down.
          </p>
          <p className="mt-6 font-mono text-[10px] text-white/30">
            Figures: Wikipedia (Cassini–Huygens), verified. The stacked layout +
            side-mounted Huygens in the figure is the real configuration.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// Real Voyager specs — Wikipedia Voyager program (verified 2026-11-06).
const VOYAGER_SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Antenna", value: "3.7 m", note: "always points home" },
  { label: "Mass", value: "815 kg", note: "at launch" },
  { label: "Power", value: "~470 W", note: "3 plutonium RTGs" },
  { label: "Mag boom", value: "13 m", note: "holds the magnetometer out" },
  { label: "Launched", value: "1977", note: "both twins" },
  { label: "V1 distance", value: "~173 AU", note: "a full light-day" },
  { label: "Still talking", value: "Yes", note: "22-watt signal" },
  { label: "Carries", value: "The Golden Record" },
]

export function VoyagerTeardownSection() {
  return (
    <section
      id="voyager-teardown"
      className="relative w-full scroll-mt-0 border-t border-white/10 bg-[#0a0a0c] px-5 pb-28 pt-16 text-white md:px-10 md:pt-24"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
            In depth
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Voyager is a dish that never stops pointing home.
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-sm leading-relaxed text-white/70 md:text-[15px]">
            The two Voyagers are identical, and the most distant things we&apos;ve
            ever made. A 3.7-metre dish on top stays locked on Earth; three
            plutonium generators ride one boom, a 13-metre magnetometer boom
            reaches out the other, and the cameras that gave us the outer planets
            sit on a steerable platform. Bolted to the side: a gold record of what
            Earth sounds like. Hover the figure to lift every real part clear.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <TeardownFrame
            src="/reference/spacecraft/voyager-teardown/index.html"
            title="Voyager spacecraft — exploded teardown of its 6 real elements"
          />
        </motion.div>

        <motion.div
          className="mt-16 md:mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h3 className="max-w-2xl font-display text-2xl font-light leading-tight tracking-[-0.01em] text-white md:text-3xl">
            The real numbers.
          </h3>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            {VOYAGER_SPECS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</dt>
                <dd className="mt-1 font-display text-xl font-light tabular-nums text-white md:text-2xl">{s.value}</dd>
                {s.note && <dd className="mt-0.5 font-mono text-[10px] leading-snug text-white/35">{s.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-2xl font-sans text-sm leading-relaxed text-white/55">
            Launched in 1977, both are now in interstellar space — Voyager 1 a full
            light-day from Earth. Their plutonium is slowly fading, so one by one
            the instruments are switched off to save power; sometime in the 2030s
            the last of them will go quiet, and they&apos;ll drift on, silent, for
            millions of years.
          </p>
          <p className="mt-6 font-mono text-[10px] text-white/30">
            Figures: NASA / Wikipedia (Voyager program), verified. The dish + two
            splayed booms in the figure are the real configuration.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
