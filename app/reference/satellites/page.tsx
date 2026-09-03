import type { Metadata } from "next"
import catalogData from "@/public/data/satellites.json"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { CatalogBrowser } from "@/components/satellites-reference/catalog-browser"

export const metadata: Metadata = {
  ...canonicalPath("/reference/satellites"),
  title: "The satellite catalogue — every tracked object, readable",
  description:
    "A plain-language reference to everything tracked in Earth orbit: the live catalogue counts, the mega-constellations, the debris families and the events that made them, the real shapes and sizes of spacecraft against Earth, and the math of a TLE — with every object one click from its live orbit in the Satellite Engine.",
  keywords: [
    "satellite catalogue",
    "how many satellites are in orbit",
    "space debris list",
    "Starlink count",
    "TLE explained",
    "two-line element",
    "satellite sizes",
    "Fengyun-1C debris",
    "Iridium Cosmos collision",
    "NORAD catalog",
  ],
  openGraph: {
    ...canonicalPath("/reference/satellites").openGraph,
    title: "The satellite catalogue — every tracked object, readable",
    description:
      "Live counts, mega-constellations, debris families, real spacecraft sizes vs Earth, and the math of a TLE — every object one click from its live orbit.",
    type: "website",
  },
}

/* ── Build-time stats, computed from the exact file the engine renders ────── */

type CatSat = { id: number; name: string; owner: string; type?: string; group?: string; launchMs: number; l1: string; l2: string }
type Catalog = { snapshot: string; count: number; breakdown: Record<string, number>; sats: CatSat[] }

// Direct JSON import — this is a server component, so the 4.6 MB catalogue is
// consumed at BUILD time only; the page ships just the derived numbers.
// (node:fs is aliased to an empty module in next.config for the static export.)
function loadCatalog(): Catalog {
  return catalogData as unknown as Catalog
}

// The recognisable constellations/families — counted live at build so the
// numbers refresh with every catalogue snapshot instead of rotting in copy.
const FAMILIES: { label: string; match: RegExp; owner: string; what: string }[] = [
  { label: "Starlink", match: /STARLINK/, owner: "SpaceX · US", what: "broadband internet" },
  { label: "OneWeb", match: /ONEWEB/, owner: "Eutelsat OneWeb · UK", what: "broadband internet" },
  { label: "Kuiper", match: /KUIPER/, owner: "Amazon · US", what: "broadband internet" },
  { label: "Qianfan (“Thousand Sails”)", match: /QIANFAN/, owner: "SSST · China", what: "broadband internet" },
  { label: "Iridium NEXT", match: /IRIDIUM/, owner: "Iridium · US", what: "voice + data comms" },
  { label: "Flock / SuperDove", match: /FLOCK|SUPERDOVE/, owner: "Planet Labs · US", what: "daily Earth imaging" },
  { label: "Lemur", match: /LEMUR/, owner: "Spire · US", what: "weather + ship/aircraft tracking" },
  { label: "GPS (NAVSTAR)", match: /NAVSTAR/, owner: "US Space Force", what: "navigation" },
  { label: "BeiDou", match: /BEIDOU/, owner: "China", what: "navigation" },
  { label: "Galileo", match: /GALILEO/, owner: "European Union", what: "navigation" },
  { label: "GLONASS", match: /GLONASS/, owner: "Russia", what: "navigation" },
]

// The real events behind the debris families in the public catalogue.
const DEBRIS_EVENTS: { group: string; title: string; story: string }[] = [
  {
    group: "fengyun-1c-debris",
    title: "Fengyun-1C — 2007 anti-satellite test",
    story:
      "China destroyed its own weather satellite with a missile at ~865 km. One strike, and the largest single debris cloud in history — still up there, because at that altitude the air is too thin to drag it down.",
  },
  {
    group: "cosmos-2251-debris",
    title: "Cosmos 2251 — the 2009 collision",
    story:
      "A dead Russian comsat hit an operating Iridium satellite over Siberia at ~11.7 km/s — the first accidental satellite-on-satellite collision. Both shattered.",
  },
  {
    group: "iridium-33-debris",
    title: "Iridium 33 — the other half of 2009",
    story:
      "The working satellite in that collision. Its fragments share the same shell, crossing thousands of live craft every day.",
  },
  {
    group: "analyst",
    title: "Analyst objects",
    story:
      "Objects tracked by radar but not yet firmly identified or catalogued — the honest 'we see something there' set.",
  },
]

// Real deployed spans (metres) — the same values the engine's true-scale
// selected-craft rendering uses. EARTH_D_M anchors the "vs Earth" ratios.
const SIZES: { label: string; spanM: number }[] = [
  { label: "International Space Station", spanM: 109 },
  { label: "Tiangong station", spanM: 55 },
  { label: "GEO dish comsat", spanM: 35 },
  { label: "Starlink v2 Mini (arrays out)", spanM: 30 },
  { label: "Weather / GEO satellite", spanM: 24 },
  { label: "GPS III (arrays out)", spanM: 17 },
  { label: "Falcon 9 upper stage (spent)", spanM: 13.8 },
  { label: "Hubble Space Telescope", spanM: 13.2 },
  { label: "Iridium NEXT", spanM: 9.4 },
  { label: "OneWeb bus", spanM: 5.6 },
  { label: "3U CubeSat", spanM: 0.34 },
  { label: "Typical tracked debris", spanM: 0.1 },
]
const EARTH_D_M = 12_742_000

/** TLE epoch (YYDDD.DDD…) → readable UTC date. */
function tleEpochDate(l1: string): string {
  const yy = parseInt(l1.substring(18, 20), 10)
  const doy = parseFloat(l1.substring(20, 32))
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000).toISOString().slice(0, 10)
}

export default function SatelliteCataloguePage() {
  const cat = loadCatalog()
  const familyRows = FAMILIES.map((f) => ({
    ...f,
    count: cat.sats.reduce((n, s) => (f.match.test(s.name.toUpperCase()) ? n + 1 : n), 0),
  })).sort((a, b) => b.count - a.count)
  const debrisRows = DEBRIS_EVENTS.map((d) => ({
    ...d,
    count: cat.sats.reduce((n, s) => (s.group === d.group ? n + 1 : n), 0),
  }))
  const iss = cat.sats.find((s) => s.id === 25544)
  // Worked math from the real ISS elements: mean motion (rev/day) → altitude.
  const meanMotion = iss ? parseFloat(iss.l2.substring(52, 63)) : 15.5
  const periodS = 86_400 / meanMotion
  const MU = 398_600.4418 // km³/s² — Earth's gravitational parameter
  const aKm = Math.cbrt(MU * Math.pow(periodS / (2 * Math.PI), 2))
  const altKm = aKm - 6_371
  const maxSpan = SIZES[0].spanM

  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Satellite Engine · Reference
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            What&apos;s actually up there.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            The whole tracked catalogue, readable: who the objects belong to, how the debris
            got there, how big any of it really is, and the math that turns two lines of
            numbers into a live position. Every object here is one click from its real orbit
            in the <a href="/lab/celestial" className="text-accent hover:underline">Satellite Engine</a>.
          </p>
          <p className="mt-3 font-mono text-[10px] tracking-wider text-muted-foreground">
            Catalogue snapshot {cat.snapshot} · CelesTrak SATCAT + GP/TLE · refreshed per deploy
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-14 md:mt-20 space-y-16 md:space-y-24 pb-24">
          {/* ── The count ─────────────────────────────────────────────── */}
          <section>
            <h2 className="font-serif text-2xl text-foreground mb-6">The count</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Tracked objects", value: cat.count },
                { label: "Active payloads", value: cat.breakdown["PAY"] ?? 0 },
                { label: "Debris fragments", value: cat.breakdown["DEB"] ?? 0 },
                { label: "Rocket bodies", value: cat.breakdown["R/B"] ?? 0 },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-white/[0.02] p-4 md:p-5">
                  <p className="font-mono text-2xl md:text-3xl text-foreground tabular-nums">{k.value.toLocaleString()}</p>
                  <p className="mt-1 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-2xl text-sm text-foreground/60 leading-relaxed">
              This is the keyless public set — active payloads plus the major fragmentation
              clouds. The full military-grade catalogue (~40k objects, most rocket bodies
              included) sits behind Space-Track credentials; nothing here is estimated.
            </p>
          </section>

          {/* ── The constellations ────────────────────────────────────── */}
          <section>
            <h2 className="font-serif text-2xl text-foreground mb-2">The constellations</h2>
            <p className="max-w-2xl text-sm text-foreground/60 leading-relaxed mb-6">
              Most of orbit is a handful of fleets. Counts are computed from the live
              catalogue at build time — they move with every snapshot.
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border bg-white/[0.02]">
              {familyRows.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-4 px-4 md:px-5 py-3">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{f.label}</span>
                    <span className="ml-2 text-sm text-foreground/55">{f.what}</span>
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-0.5">{f.owner}</p>
                  </div>
                  <span className="shrink-0 font-mono text-lg text-foreground tabular-nums">{f.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── The debris ────────────────────────────────────────────── */}
          <section>
            <h2 className="font-serif text-2xl text-foreground mb-2">The debris — and how it got there</h2>
            <p className="max-w-2xl text-sm text-foreground/60 leading-relaxed mb-6">
              Tracked debris means fragments ≥ ~10 cm — big enough for radar. Below that,
              hundreds of thousands of pieces fly untracked at ~7.8 km/s. Two events made
              most of what we can see.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {debrisRows.map((d) => (
                <div key={d.group} className="rounded-xl border border-border bg-white/[0.02] p-4 md:p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-medium text-foreground">{d.title}</h3>
                    <span className="shrink-0 font-mono text-lg text-[#ff9a6b] tabular-nums">{d.count.toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/70 leading-relaxed">{d.story}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-foreground/60">
              See the clouds themselves: open{" "}
              <a href="/lab/celestial" className="text-accent hover:underline">the engine</a> →
              Explore → Debris clouds, and isolate one family around Earth.
            </p>
          </section>

          {/* ── Shape & size ──────────────────────────────────────────── */}
          <section>
            <h2 className="font-serif text-2xl text-foreground mb-2">Shape &amp; size, honestly</h2>
            <p className="max-w-2xl text-sm text-foreground/60 leading-relaxed mb-6">
              Real deployed spans — the same values the engine uses when it renders a
              selected craft at true scale. Even the ISS is{" "}
              <span className="font-mono text-foreground/80 tabular-nums">
                1/{Math.round(EARTH_D_M / 109).toLocaleString()}
              </span>{" "}
              of Earth&apos;s width, which is why at honest scale every satellite is a point of light.
            </p>
            <ul className="space-y-2.5">
              {SIZES.map((s) => (
                <li key={s.label} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3">
                  <span className="text-sm text-foreground/80 truncate">{s.label}</span>
                  <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${Math.max(0.75, (s.spanM / maxSpan) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums text-right w-16">
                    {s.spanM < 1 ? `${(s.spanM * 100).toFixed(0)} cm` : `${s.spanM} m`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── The math ──────────────────────────────────────────────── */}
          <section>
            <h2 className="font-serif text-2xl text-foreground mb-2">The math of two lines</h2>
            <p className="max-w-2xl text-sm text-foreground/60 leading-relaxed mb-6">
              Every object above is tracked as a TLE — a two-line element set. This is the
              ISS&apos;s real one from this snapshot{iss ? <> (epoch {tleEpochDate(iss.l1)})</> : null}:
            </p>
            {iss && (
              <pre className="overflow-x-auto rounded-xl border border-border bg-white/[0.02] p-4 md:p-5 font-mono text-[11px] md:text-xs leading-relaxed text-foreground/85">
                {iss.l1 + "\n" + iss.l2}
              </pre>
            )}
            <ul className="mt-4 grid gap-x-8 gap-y-1.5 md:grid-cols-2 text-sm text-foreground/70">
              <li><span className="font-mono text-accent">25544U</span> — NORAD catalogue number (the ISS)</li>
              <li><span className="font-mono text-accent">{iss ? iss.l1.substring(18, 32).trim() : "epoch"}</span> — epoch: year + fractional day the elements were measured</li>
              <li><span className="font-mono text-accent">{iss ? iss.l2.substring(8, 16).trim() : "incl"}</span> — inclination (°): the tilt of the orbit vs the equator</li>
              <li><span className="font-mono text-accent">{iss ? iss.l2.substring(26, 33).trim() : "ecc"}</span> — eccentricity (leading decimal implied): how elliptical</li>
              <li><span className="font-mono text-accent">{iss ? iss.l2.substring(52, 63).trim() : "n"}</span> — mean motion: revolutions per day</li>
              <li><span className="font-mono text-accent">B*</span> — drag term: how hard the thin air brakes it</li>
            </ul>
            <div className="mt-6 rounded-xl border border-border bg-white/[0.02] p-4 md:p-5">
              <p className="text-sm text-foreground/70 leading-relaxed">
                Mean motion alone gives the altitude. The ISS makes{" "}
                <span className="font-mono text-foreground tabular-nums">{meanMotion.toFixed(4)}</span> revolutions
                a day → one orbit every{" "}
                <span className="font-mono text-foreground tabular-nums">{(periodS / 60).toFixed(1)}</span> minutes.
                Kepler&apos;s third law, a = (μ·(T/2π)²)<sup>1/3</sup> with μ = 398,600 km³/s², puts the orbit at{" "}
                <span className="font-mono text-foreground tabular-nums">{aKm.toFixed(0)}</span> km from Earth&apos;s
                centre — about <span className="font-mono text-accent tabular-nums">{altKm.toFixed(0)} km</span> up.
              </p>
              <p className="mt-3 text-sm text-foreground/60 leading-relaxed">
                The engine propagates every TLE with SGP4 — honest to roughly a kilometre near
                epoch, drifting as the elements age. The full derivations (Kepler&apos;s equation,
                SGP4, ECI → your sky) live on{" "}
                <a href="/universe-engine/math" className="text-accent hover:underline">The Math Behind the Universe Engine</a>.
              </p>
            </div>
          </section>

          {/* ── Browse everything ─────────────────────────────────────── */}
          <section>
            <h2 className="font-serif text-2xl text-foreground mb-2">Browse all {cat.count.toLocaleString()}</h2>
            <p className="max-w-2xl text-sm text-foreground/60 leading-relaxed mb-6">
              Search the full catalogue. Every result opens the live engine with the chase
              camera locked on that object&apos;s real orbit.
            </p>
            <CatalogBrowser />
          </section>

          <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
            Data: CelesTrak SATCAT + GP/TLE (public) · debris families: Space-Track fragmentation groups via CelesTrak ·
            sizes: operator specifications · nothing estimated, nothing invented
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
