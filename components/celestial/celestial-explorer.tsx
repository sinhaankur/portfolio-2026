"use client"

/**
 * CelestialExplorer — a full-screen, immersive solar-system exploration page.
 * No site footer/chrome: the live Universe Engine fills the viewport (real
 * distances via its Scale toggle, planets, moons, satellites, warp/zoom), with
 * a compact title tile, a body rail along the bottom, and a slide-in detail
 * tile that shows the photoreal Blender globe + data for the picked world.
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, X, Rotate3d, Globe, Satellite, Sparkles, Rocket, Route, Orbit, Layers, Radio } from "lucide-react"
import { CustomCursor } from "@/components/custom-cursor"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"
import { TimelineControl } from "@/components/universe-engine/hud"
import { BODIES } from "@/lib/celestial-data"
import { SatelliteSearch } from "./satellite-search"
import { useIsMobile, MobileBar, BodiesSheet, Sheet } from "./mobile-controls"
import { selectedSatRef, satGroupFilterRef } from "@/components/universe-engine/satellite-field"
import { setSimMs, timeScaleRef, hiResTexturesRef } from "@/components/universe-engine/astronomy"
import { hasGoogleEarthKey } from "@/components/universe-engine/google-earth-tiles"

// The photoreal-Earth view pulls in the (heavy) 3D-tiles renderer. Lazy-load it
// so that bundle only downloads when the user actually clicks "Descend to Earth"
// — never on page load. Belt-and-braces with the opt-in mount for cost control.
const GoogleEarthView = dynamic(
  () => import("@/components/universe-engine/google-earth-tiles").then((m) => m.GoogleEarthView),
  { ssr: false },
)

// Mars coverage map (real MOLA globe + rover-site photos) — lazy so its R3F
// canvas + the elevation maps only load when the user opens it.
const MarsCoverage = dynamic(
  () => import("./mars-coverage").then((m) => m.MarsCoverage),
  { ssr: false },
)

// "ISS over you" passes panel — lazy (pulls satellite.js for the topocentric math).
const OverheadPasses = dynamic(
  () => import("./overhead-passes").then((m) => m.OverheadPasses),
  { ssr: false },
)

// Live space-weather + aurora panel (NOAA SWPC).
const SpaceWeatherPanel = dynamic(
  () => import("./space-weather-panel").then((m) => m.SpaceWeatherPanel),
  { ssr: false },
)

// Live launch feed (Launch Library 2).
const LaunchFeed = dynamic(
  () => import("./launch-feed").then((m) => m.LaunchFeed),
  { ssr: false },
)

// Earth→Mars transfer calculator.
const TransferTool = dynamic(
  () => import("./transfer-tool").then((m) => m.TransferTool),
  { ssr: false },
)

// Ground-station pass planner — ISS passes from named tracking stations
// (the operator counterpart to "ISS over you").
const PassPlanner = dynamic(
  () => import("./pass-planner").then((m) => m.PassPlanner),
  { ssr: false },
)

// Live ISS position — where the station is right now, ticking each second.
const IssLivePanel = dynamic(
  () => import("./iss-live-panel").then((m) => m.IssLivePanel),
  { ssr: false },
)

// Earth→Mars porkchop plot — launch windows from a Lambert C3 grid.
const PorkchopPlot = dynamic(
  () => import("./porkchop-plot").then((m) => m.PorkchopPlot),
  { ssr: false },
)

// Near-Earth asteroid approaches (NASA NeoWs).
const NeoPanel = dynamic(
  () => import("./neo-panel").then((m) => m.NeoPanel),
  { ssr: false },
)

// Orbital-population census (real LEO/MEO/GEO/HEO inventory).
const InventoryPanel = dynamic(
  () => import("./inventory-panel").then((m) => m.InventoryPanel),
  { ssr: false },
)

const UniverseEngine = dynamic(
  () => import("@/components/universe-engine").then((m) => m.UniverseEngine),
  { ssr: false, loading: () => <StaticStarfield loading /> },
)
const GlobeViewer = dynamic(
  () => import("./globe-viewer").then((m) => m.GlobeViewer),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
        Loading 3D…
      </div>
    ),
  },
)

// Bodies the Universe Engine can fly the camera to (its planet/sun focus
// channel keys on these exact names). Moon/asteroid/comet aren't planet-focusable.
const ENGINE_FOCUSABLE = new Set([
  "Sun", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
])

export function CelestialExplorer() {
  const [openName, setOpenName] = useState<string | null>(null)
  const open = BODIES.find((b) => b.name === openName) ?? null
  // Title tile is a welcome, not permanent chrome: show it on entry, then fade
  // it out so the view breathes (declutter). It also hides the moment the user
  // engages with a body. A small "?" affordance brings it back.
  const [titleVisible, setTitleVisible] = useState(true)
  // This is the deep-zoom explorer — enable the 4K planet surfaces (the hero keeps
  // 2K, since there planets are dots and 4K just costs a GPU upload stall).
  useEffect(() => {
    hiResTexturesRef.current = true
    return () => { hiResTexturesRef.current = false }
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setTitleVisible(false), 7000)
    return () => clearTimeout(t)
  }, [])
  // Photoreal-Earth (Google 3D Tiles) overlay — opt-in only, key-gated.
  const [earthView, setEarthView] = useState(false)
  // Mars coverage map overlay — opt-in, no key/cost (all local NASA data).
  const [marsView, setMarsView] = useState(false)
  // "ISS over you" passes panel (asks for geolocation on open).
  const [passesOpen, setPassesOpen] = useState(false)
  // Live space-weather + aurora panel.
  const [weatherOpen, setWeatherOpen] = useState(false)
  // Live launch feed.
  const [launchesOpen, setLaunchesOpen] = useState(false)
  // Earth→Mars transfer calculator.
  const [transferOpen, setTransferOpen] = useState(false)
  // Ground-station pass planner (ISS passes from named tracking stations).
  const [stationOpen, setStationOpen] = useState(false)
  // Live ISS position (sub-point, altitude, speed — ticks each second).
  const [issLiveOpen, setIssLiveOpen] = useState(false)
  // Earth→Mars porkchop plot (launch windows from a Lambert C3 grid).
  const [porkchopOpen, setPorkchopOpen] = useState(false)
  // Near-Earth asteroids.
  const [neoOpen, setNeoOpen] = useState(false)
  // Orbital-population census.
  const [inventoryOpen, setInventoryOpen] = useState(false)
  // The feature-launcher menu (collapses all the tools into one chip so the
  // bottom-left doesn't stack 5+ buttons on mobile).
  const [menuOpen, setMenuOpen] = useState(false)
  // Mobile-only sheets. On phones the body rail + Explore menu + timeline are
  // replaced by one slim bar that opens these drag-dismissable sheets, so the
  // scene owns the screen and a scroll never opens a body detail.
  const mobile = useIsMobile()
  const [bodiesSheet, setBodiesSheet] = useState(false)
  const [toolsSheet, setToolsSheet] = useState(false)
  const [timeSheet, setTimeSheet] = useState(false)
  const closePanels = () => { setPassesOpen(false); setWeatherOpen(false); setLaunchesOpen(false); setTransferOpen(false); setStationOpen(false); setIssLiveOpen(false); setPorkchopOpen(false); setNeoOpen(false); setInventoryOpen(false) }
  // `?earth=1` auto-opens the photoreal view — for capture/testing + deep-links.
  useEffect(() => {
    try {
      if (hasGoogleEarthKey && new URLSearchParams(window.location.search).has("earth")) {
        setEarthView(true)
      }
    } catch { /* no window */ }
  }, [])

  // `?simyear=YYYY` jumps the sim clock to that year — testing the launch-gating
  // of satellites (they should vanish before their real launch date).
  // `?mars=1` auto-opens the Mars coverage map (testing + deep-link).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const y = q.get("simyear")
      // Runs AFTER the engine's real-time anchor (setSimMs(now)) which fires on
      // its own mount — a short delay + freeze the clock so the test date sticks.
      if (y) {
        const t = window.setTimeout(() => {
          timeScaleRef.current = 0 // freeze so real-time doesn't drift us back
          setSimMs(Date.UTC(parseInt(y, 10), 0, 1))
        }, 300)
        void t
      }
      if (q.has("mars")) setMarsView(true)
      if (q.has("inv")) setInventoryOpen(true) // testing: open the census panel
      const ss = q.get("selectsat") // testing: select a satellite by NORAD id
      if (ss) setTimeout(() => { selectedSatRef.current = parseInt(ss, 10) }, 1600)
      const g = q.get("satgroup") // testing: drive the group filter (0=Starlink…)
      if (g) satGroupFilterRef.current = parseInt(g, 10)
    } catch { /* no window */ }
  }, [])

  // Fly to Earth to see the satellite shell. At true scale, LEO sats orbit only
  // ~6% above Earth's surface — invisible from the solar-system view, visible
  // only when Earth is framed. This gives users a one-click way there (the
  // #1 "I don't see satellites" confusion — they're real + true-scale, just
  // hugging Earth). Closes any open panel + drops the welcome tile.
  function viewSatellites() {
    setTitleVisible(false)
    closePanels()
    setMenuOpen(false)
    window.dispatchEvent(
      new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }),
    )
  }

  // Pick a body: open its detail tile AND fly the engine camera to it (so
  // distant bodies like Pluto are actually findable at true scale, not just a
  // far speck). Reuses the engine's focus channel — same event the Destinations
  // menu fires.
  function pick(name: string) {
    const next = name === openName ? null : name
    setOpenName(next)
    if (next) setTitleVisible(false) // engaging with a body → drop the welcome
    if (next && ENGINE_FOCUSABLE.has(next)) {
      window.dispatchEvent(
        new CustomEvent("universe:sky-focus", { detail: { pointId: `planet:${next}` } }),
      )
    }
  }

  // Auto-warp to Earth once the engine has mounted. At true scale the system
  // opens into mostly-empty space with a tiny distant Sun — framing Earth gives
  // an immediate, legible "you are here" rather than a blank starfield. Reuses
  // the engine's existing focus channel (same event the Destinations menu fires).
  useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }),
      )
    }, 1400)
    return () => {
      clearTimeout(t)
      selectedSatRef.current = null // drop any followed satellite on leave
    }
  }, [])

  // The 12 tools, grouped — shared by the desktop Explore menu AND the mobile
  // Tools sheet so there's a single source of truth. Each closes the launcher
  // context it was opened from.
  const renderToolItems = (afterPick?: () => void) => {
    const go = (fn: () => void) => () => { closePanels(); fn(); afterPick?.() }
    return (
      <>
        <MenuHeading>Satellites &amp; ISS</MenuHeading>
        <MenuItem color="#5affc0" icon={<Satellite className="h-3.5 w-3.5" />}
          label="View 18,500 satellites" onClick={() => { viewSatellites(); afterPick?.() }} />
        <MenuItem color="#7affd0" icon={<Satellite className="h-3.5 w-3.5" />}
          label="ISS live position" onClick={go(() => setIssLiveOpen(true))} />
        <MenuItem color="var(--accent)" icon={<Satellite className="h-3.5 w-3.5" />}
          label="ISS over you" onClick={go(() => setPassesOpen(true))} />
        <MenuItem color="#7affd0" icon={<Radio className="h-3.5 w-3.5" />}
          label="Ground-station tracker" onClick={go(() => setStationOpen(true))} />
        <MenuItem color="#9fe0ff" icon={<Layers className="h-3.5 w-3.5" />}
          label="Orbital census" onClick={go(() => setInventoryOpen(true))} />

        <MenuHeading>Trajectories</MenuHeading>
        <MenuItem color="#7affd0" icon={<Route className="h-3.5 w-3.5" />}
          label="Earth → Mars transfer" onClick={go(() => setTransferOpen(true))} />
        <MenuItem color="#7affd0" icon={<Orbit className="h-3.5 w-3.5" />}
          label="Launch windows (porkchop)" onClick={go(() => setPorkchopOpen(true))} />

        <MenuHeading>Deep space</MenuHeading>
        <MenuItem color="#ffd27a" icon={<Orbit className="h-3.5 w-3.5" />}
          label="Asteroids near Earth" onClick={go(() => setNeoOpen(true))} />
        <MenuItem color="#7affd0" icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Space weather · aurora" onClick={go(() => setWeatherOpen(true))} />
        <MenuItem color="#ffd27a" icon={<Rocket className="h-3.5 w-3.5" />}
          label="Launches" onClick={go(() => setLaunchesOpen(true))} />

        <MenuHeading>Surfaces</MenuHeading>
        {hasGoogleEarthKey && (
          <MenuItem color="var(--accent)" icon={<Globe className="h-3.5 w-3.5" />}
            label="Descend to Earth" onClick={go(() => setEarthView(true))} />
        )}
        <MenuItem color="#ff9a6b" icon={<Globe className="h-3.5 w-3.5" />}
          label="Mars · what we've seen" onClick={go(() => setMarsView(true))} />
      </>
    )
  }

  return (
    <>
      <CustomCursor />
      <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
        {/* Live solar system fills the screen. touch-none hands all touch
            gestures to the engine's OrbitControls (the page is fixed/non-scroll
            here) so drag-to-rotate + pinch-zoom are seamless on mobile. */}
        <div className="absolute inset-0 touch-none">
          <UniverseEngine interactive showHud showMusic={false} defaultTrueScale solarOnly quietMobileChrome />
        </div>

        {/* Back link */}
        <Link
          href="/lab"
          data-cursor-hover
          className="absolute top-4 left-4 md:top-6 md:left-6 z-30 group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/75 hover:text-foreground bg-background/40 backdrop-blur-sm border border-border rounded-full px-3 py-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          The Lab
        </Link>

        {/* Satellite search — find + follow any of the ~15.7k real satellites.
            Top-right, clear of the back link (top-left), rail (right-middle), and
            the engine's bottom HUD. */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-40">
          <SatelliteSearch />
        </div>

        {/* Title tile */}
        <div
          className={`absolute top-16 left-4 md:top-20 md:left-6 z-20 max-w-[18rem] pointer-events-none transition-opacity duration-700 ${titleVisible ? "opacity-100" : "opacity-0"}`}
          aria-hidden={!titleVisible}
        >
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-2">
            Celestial
          </p>
          <h1 className="font-display text-2xl md:text-4xl font-light tracking-[-0.02em] leading-[1.05]">
            Explore the <span className="italic">solar system</span>.
          </h1>
          <p className="mt-2 font-sans text-xs md:text-sm text-foreground/70 leading-relaxed">
            Shown at <span className="text-accent">true scale</span> — real
            distance ratios. Focus Earth and scrub the timeline back to{" "}
            <span className="text-accent">1957</span> to watch satellites launch
            into orbit as the space age unfolds.
          </p>
        </div>

        {/* Body rail — DESKTOP ONLY now. Vertical strip on the RIGHT edge,
            vertically centred (the one clear band beside the engine's bottom
            HUD). The detail tile (z-30) slides over it from the right when a
            body is open. On MOBILE the rail is replaced by the Bodies sheet
            (opened from the bottom bar) so scrolling can't misfire a tap. */}
        <div
          className={`hidden md:block absolute z-20 pointer-events-none
            md:left-auto md:right-2 md:top-1/2 md:-translate-y-1/2
            ${open ? "md:hidden" : ""}`}
        >
          <div className="pointer-events-auto w-fit max-w-full mx-auto md:mx-0 md:max-h-[64vh] overflow-x-auto md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="flex md:flex-col items-center gap-2.5 md:gap-3 min-w-max md:min-w-0 py-1 md:px-1">
              {BODIES.map((b) => {
                // Min 44px touch target (mobile-first); larger bodies a touch bigger.
                const px = Math.max(44, 40 + (b.relSize ?? 0.6) * 16)
                const on = b.name === openName
                return (
                  <li key={b.name} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => pick(b.name)}
                      data-cursor-hover
                      title={b.name}
                      aria-pressed={on}
                      aria-label={`Show ${b.name} details`}
                      className="group flex md:flex-row-reverse flex-col items-center gap-1 md:gap-2.5 focus-visible:outline-none"
                    >
                      <span
                        className="rounded-full overflow-hidden border-2 transition-all duration-300 group-hover:scale-110 shrink-0"
                        style={{
                          width: px, height: px,
                          borderColor: on ? "var(--accent)" : "rgba(255,255,255,0.15)",
                          boxShadow: on ? `0 0 18px -2px ${b.accent}` : "none",
                        }}
                      >
                        <img src={b.img} alt="" aria-hidden loading="lazy"
                             className="w-full h-full object-cover" style={{ background: b.accent }} />
                      </span>
                      <span className={`font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors ${on ? "text-accent" : "text-foreground/80 group-hover:text-foreground"}`}>
                        {b.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Detail tile. DESKTOP: slides in from the right. MOBILE: a bottom
            sheet that slides up (full-width, above the bottom bar), matching the
            Bodies/Tools sheets so the whole mobile experience is one language. */}
        <AnimatePresence>
          {open && (
            <motion.aside
              key={open.name}
              initial={mobile ? { opacity: 0, y: 60 } : { opacity: 0, x: 40 }}
              animate={mobile ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
              exit={mobile ? { opacity: 0, y: 60 } : { opacity: 0, x: 40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={mobile ? { paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" } : undefined}
              className="absolute z-40 overflow-y-auto border border-border bg-background/95 md:bg-background/90 backdrop-blur-md shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]
                left-0 right-0 bottom-0 max-h-[70vh] rounded-t-2xl border-b-0
                md:left-auto md:top-6 md:right-6 md:bottom-32 md:w-[26rem] md:max-h-none md:rounded-xl md:border-b"
            >
              <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-background/80 backdrop-blur">
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent">{open.tagline}</p>
                <button type="button" onClick={() => setOpenName(null)} data-cursor-hover aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-secondary/20 mb-4">
                  <GlobeViewer src={open.glb} />
                  <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-foreground/70 bg-background/50 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <Rotate3d className="h-3 w-3 text-accent" /> Drag · zoom
                  </span>
                </div>

                <h2 className="font-display text-3xl font-light tracking-[-0.01em] mb-3">{open.name}</h2>
                <p className="font-sans text-sm text-foreground/80 leading-relaxed mb-5">{open.blurb}</p>

                <dl className="grid grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden mb-5">
                  {open.facts.map((f) => (
                    <div key={f.label} className="bg-background p-3">
                      <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">{f.label}</dt>
                      <dd className="font-sans text-sm text-foreground tabular-nums">{f.value}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="space-y-2.5">
                  {open.features.map((feat) => (
                    <li key={feat.name} className="grid grid-cols-[auto_1fr] gap-2.5">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: open.accent }} />
                      <p className="font-sans text-sm text-foreground/80 leading-relaxed">
                        <span className="text-foreground">{feat.name}.</span> {feat.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Feature launcher — DESKTOP: a single "Explore" chip that expands to
            the tools. On MOBILE the same tools live in the Tools sheet (opened
            from the bottom bar), so this desktop chip is hidden there. Each tool
            is a deliberate click (Earth tiles stay key-gated + cost-protected). */}
        {!earthView && !marsView && (
          <div className="hidden md:flex absolute bottom-6 left-4 md:left-6 z-30 flex-col items-start gap-2">
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex flex-col gap-1.5 max-h-[62vh] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {/* Grouped so 12 tools scan fast. Closing the menu after a
                      pick keeps the desktop launcher tidy. */}
                  {renderToolItems(() => setMenuOpen(false))}
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              data-cursor-hover
              aria-expanded={menuOpen}
              aria-label="Explore tools"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2.5 font-mono text-[10px] tracking-widest uppercase text-foreground/90 backdrop-blur-sm transition-colors hover:border-foreground/40"
            >
              <span className={`transition-transform ${menuOpen ? "rotate-45" : ""}`}>✦</span>
              {menuOpen ? "Close" : "Explore"}
            </button>
          </div>
        )}

        {/* Bottom-left panels — passes / space weather / launches (exclusive). */}
        <AnimatePresence>
          {passesOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <OverheadPasses onClose={() => setPassesOpen(false)} />
            </div>
          )}
          {weatherOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <SpaceWeatherPanel onClose={() => setWeatherOpen(false)} />
            </div>
          )}
          {launchesOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <LaunchFeed onClose={() => setLaunchesOpen(false)} />
            </div>
          )}
          {transferOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <TransferTool onClose={() => setTransferOpen(false)} />
            </div>
          )}
          {stationOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <PassPlanner onClose={() => setStationOpen(false)} />
            </div>
          )}
          {issLiveOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <IssLivePanel onClose={() => setIssLiveOpen(false)} />
            </div>
          )}
          {porkchopOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <PorkchopPlot onClose={() => setPorkchopOpen(false)} />
            </div>
          )}
          {neoOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <NeoPanel onClose={() => setNeoOpen(false)} />
            </div>
          )}
          {inventoryOpen && (
            <div className="absolute bottom-24 left-4 md:left-6 z-40">
              <InventoryPanel onClose={() => setInventoryOpen(false)} />
            </div>
          )}
        </AnimatePresence>

        {/* ── MOBILE controls ──────────────────────────────────────────────
            One slim bar + drag-dismissable sheets replace the desktop rail +
            Explore chip + always-on timeline. The scene keeps the top of the
            screen; a scroll inside a sheet never fires a body select. */}
        {mobile && !earthView && !marsView && (
          <>
            {/* Hide the bar while a sheet or the detail tile is open so it
                doesn't peek under them. */}
            {!bodiesSheet && !toolsSheet && !timeSheet && !open && (
              <MobileBar
                onOpenBodies={() => { setToolsSheet(false); setTimeSheet(false); setBodiesSheet(true) }}
                onOpenTools={() => { setBodiesSheet(false); setTimeSheet(false); setToolsSheet(true) }}
                onOpenTime={() => { setBodiesSheet(false); setToolsSheet(false); setTimeSheet(true) }}
              />
            )}

            <AnimatePresence>
              {bodiesSheet && (
                <BodiesSheet
                  bodies={BODIES}
                  openName={openName}
                  onPick={(name) => { pick(name); setBodiesSheet(false) }}
                  onClose={() => setBodiesSheet(false)}
                />
              )}
              {toolsSheet && (
                <Sheet key="tools" title="Explore tools" onClose={() => setToolsSheet(false)}>
                  <div className="flex flex-col gap-1.5">
                    {renderToolItems(() => setToolsSheet(false))}
                  </div>
                </Sheet>
              )}
              {timeSheet && (
                <Sheet key="time" title="Timeline" onClose={() => setTimeSheet(false)}>
                  <div className="flex justify-center pb-2">
                    <TimelineControl />
                  </div>
                </Sheet>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {/* Photoreal Earth overlay — mounts (and starts streaming tiles) only after
          the click above; unmounts fully on exit so tiles stop. */}
      {earthView && <GoogleEarthView onClose={() => setEarthView(false)} />}

      {/* Mars coverage map — real MOLA globe + rover-site panoramas. */}
      {marsView && <MarsCoverage onClose={() => setMarsView(false)} />}
    </>
  )
}

/** A non-interactive section label in the Explore launcher menu. */
function MenuHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-2 pb-0.5 first:pt-0 font-mono text-[8px] tracking-[0.28em] uppercase text-foreground/40 select-none">
      {children}
    </p>
  )
}

/** One item in the Explore launcher menu. */
function MenuItem({ color, icon, label, onClick }: { color: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-cursor-hover
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-4 py-2.5 font-mono text-[10px] tracking-widest uppercase text-foreground/85 backdrop-blur-sm transition-colors hover:text-foreground"
      style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      <span style={{ color }}>{icon}</span>
      {label}
    </button>
  )
}
