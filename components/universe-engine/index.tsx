"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * The Universe Engine — its scene composition, custom GLSL shaders,
 * constellation catalog, planet table, scale model, and HUD chrome — is
 * the original work of Ankur Sinha and is published under the terms of
 * the LICENSE file at the repository root. It is NOT open source and
 * may not be redistributed, repurposed, or used as the basis for another
 * portfolio, template, or product without prior written permission.
 *
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * ---
 * Universe Engine — public entry.
 *
 * Mounts the R3F <Canvas>, wires OrbitControls + viewport/motion detection,
 * manages hover state, and lays out the HUD chrome (info panel, time-warp
 * slider, music chip, reset button). Consumers only need <UniverseEngine />.
 *
 * Module layout:
 *   types.ts       Shared types (BodyInfo, Constellation, Planet, etc.)
 *   astronomy.ts   Real-world data + scale + helpers (no React, no R3F)
 *   shaders.ts     GLSL for the spiral-arm point field
 *   scene.tsx      All R3F components, composed via <SceneContents />
 *   hud.tsx        DOM overlays (InfoPanel, TimelineControl, ResetViewButton)
 *   index.tsx      <UniverseEngine /> + public re-exports (this file)
 *
 * Limitations:
 *   - Only one engine instance per page (shared timeWarpRef singleton).
 *   - GalaxyMusic is fully opt-in: the SoundCloud iframe + Widget API only
 *     load on the first click of the music chip (see galaxy-music.tsx).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { TOUCH, Vector3 } from "three"
import { useFrame as useDollyFrame, useThree } from "@react-three/fiber"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

import {
  DEFAULT_JOURNEY,
  SOLAR_SYSTEM_POSITION,
  SUN_OFFSET_SCENE,
  cancelFlyTo,
  cancelFollow,
  flyToRef,
  focusDepthRef,
  followRef,
  requestFlyTo,
  cloudsVisibleRef,
  satellitesVisibleRef,
  scaleModeRef,
  deviceTierRef,
  heavyEffectsRef,
  timeScaleRef,
  REALTIME_TIME_SCALE,
  setSimMs,
} from "./astronomy"
import { SceneContents } from "./scene"
import {
  initDeviceTier, qualityForTier, perfTierRef, superClearRef, deviceProfileRef, adaptTier, TIER_ORDER, dprForCanvas, type DeviceTier,
} from "@/lib/device-tier"
import { DestinationsMenu, InfoPanel, LayersMenu, ResetViewButton, TimelineControl } from "./hud"
import { TonightSky } from "./tonight-sky"
import { LearnTicker } from "./learn-ticker"
import { selectedSatRef } from "./satellite-field"

// Ride-speed presets while following a craft — honest time multiples.
// 1× = the astronaut's window view; 60× = a full LEO orbit in ~90 s;
// 600× = the orbit as a sweep. No hidden warp states.
const FOLLOW_SPEEDS = [
  { mult: 1, label: "Real time" },
  { mult: 60, label: "60×" },
  { mult: 600, label: "600×" },
]
// Following a PLANET (the default Earth view, or a body you jumped to) isn't worth
// a banner — the Following chrome is only meaningful when chasing a satellite.
const PLANET_NAMES = new Set([
  "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune",
  "Pluto", "Moon (Luna)", "Sun", "The Moon", "Moon",
])
import { MobileBodySheet } from "./mobile-sheet"
import { StaticStarfield } from "./static-starfield"
import { LoadingBar } from "./loading-bar"
import { GalaxyMusic } from "../galaxy-music"
import type { BodyInfo, HoverHandler } from "./types"

export type UniverseEngineProps = {
  /** Enable drag-to-rotate + scroll-to-zoom. Defaults to false (passive backdrop). */
  interactive?: boolean
  /** 0..1 page-scroll progress (a ref, read per-frame — no re-renders). When
   *  provided and NOT in explore mode, scroll dollies the camera back through
   *  the scene: the wembi-style scrub, but over a real sky. */
  scrollDriveRef?: React.MutableRefObject<number>
  /** Show the bottom-right HUD cluster (music + time-warp). Defaults to true. */
  showHud?: boolean
  /** Show the music opt-in chip in the HUD cluster. Defaults to true. */
  showMusic?: boolean
  /**
   * Force chart-mode rendering (ink stars on cream paper). When omitted,
   * the engine reads the page theme via next-themes and inverts itself in
   * light mode automatically.
   */
  invert?: boolean
  /**
   * Boot in true-scale (real ratio) mode rather than the compressed "explore"
   * layout. Defaults to false. The Scale toggle still flips it at runtime.
   */
  defaultTrueScale?: boolean
  /**
   * Focus purely on our solar system — hide constellations, named stars, the
   * Milky Way, and deep-sky/exoplanet points. Used by /lab/celestial.
   */
  solarOnly?: boolean
  /**
   * Hide the advanced toggle cluster (clouds, satellites, scale, destinations,
   * gravity, deep-dive). Keeps the experience calm on the home hero, where those
   * power-user controls overwhelm the first impression. The dedicated explorer
   * (/lab/celestial) leaves them on. Defaults to false (show everything).
   */
  minimalControls?: boolean
  /**
   * On MOBILE only, hide the engine's always-on bottom chrome (the LearnTicker
   * and the ever-present TimelineControl bar) so a consumer can supply its own
   * mobile UX and keep the screen scene-first. Desktop is unaffected. The
   * /lab/celestial explorer sets this and provides its own bottom bar + sheets
   * (which surface the timeline on demand). Defaults to false.
   */
  quietMobileChrome?: boolean
  /**
   * Open at REAL Earth-observed time — 1 real second = 1 real second, so the
   * planets creep at their true pace and the stars sit fixed like the actual
   * night sky, instead of the lively 24-second-orbit default. The solar-only
   * explorer already forces this; setting `realtime` gives the same anchored-to-
   * now behaviour on the home hero. Users can still fast-forward via the
   * timeline. Defaults to false.
   */
  realtime?: boolean
}

export function UniverseEngine({
  interactive = false,
  scrollDriveRef,
  showHud = true,
  showMusic = true,
  invert: invertProp,
  defaultTrueScale = false,
  solarOnly = false,
  minimalControls = false,
  quietMobileChrome = false,
  realtime = false,
}: UniverseEngineProps) {
  // Set the module-scoped scale ref synchronously on first render so the very
  // first scene mount already lays bodies out at true ratios (the effect below
  // keeps it in sync afterwards).
  if (typeof window !== "undefined" && defaultTrueScale) {
    scaleModeRef.current = "true"
  }
  // The solar-only explorer runs at the user's REAL current time — 1 real second
  // = 1 real second — so it opens anchored to "now" and bodies + satellites drift
  // at their true pace instead of racing (the old 0.12 scale still advanced ~1.8
  // days/sec). Restore normal pace on unmount so the home hero keeps its lively
  // 24-second-orbit feel. The TimelineControl scrubber still lets users
  // fast-forward whenever they want.
  useEffect(() => {
    if (!solarOnly && !realtime) return
    setSimMs(Date.now())               // anchor to the user's actual current instant
    timeScaleRef.current = REALTIME_TIME_SCALE
    return () => {
      timeScaleRef.current = 1.0
    }
  }, [solarOnly, realtime])
  const [mounted, setMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mobile, setMobile] = useState(false)
  // ?perf overlay — a tiny live FPS / p95-frametime / tier readout so real
  // choppiness can be MEASURED on the actual device (headless can't). Off unless
  // the URL has ?perf. Updated by the adaptive controller's frame-time window,
  // written straight to a DOM node (no React churn).
  const [perfOverlay, setPerfOverlay] = useState(false)
  const perfNodeRef = useRef<HTMLDivElement | null>(null)
  // Adaptive quality: detected device tier (low/mid/high) → per-tier DPR + density.
  const [tier, setTier] = useState<DeviceTier>("mid")
  // Gates the render loop: the hero is h-screen, so once the user scrolls past
  // it the Canvas is fully off-screen yet keeps rendering at 60fps. Pausing the
  // frameloop while hidden frees the GPU for the rest of the page.
  const [onScreen, setOnScreen] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState<BodyInfo | null>(null)
  // DOM-side mirror of the satellite follow state (module ref, R3F-side) —
  // drives chrome step-asides (legend + ticker) while chasing a craft.
  const [satFollowed, setSatFollowed] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      setSatFollowed((prev) => {
        const now = selectedSatRef.current != null
        return now === prev ? prev : now
      })
    }, 400)
    return () => clearInterval(t)
  }, [])
  // Sticky selection — mobile devices fire pointerover/pointerout in pairs on
  // each tap, so `hovered` clears immediately. `selectedBody` latches on the
  // most-recent tap and only clears when the user dismisses the bottom sheet.
  const [selectedBody, setSelectedBody] = useState<BodyInfo | null>(null)
  const [showGravityOverlay, setShowGravityOverlay] = useState(false)
  const [showDeepDive, setShowDeepDive] = useState(false)
  // Earth cloud-shell visibility — drives the module-scoped ref the scene reads.
  const [showClouds, setShowClouds] = useState(true)
  useEffect(() => {
    cloudsVisibleRef.current = showClouds
  }, [showClouds])
  // Human-made satellite shells (Earth/Mars orbiters) — drives the module ref.
  // The solar-only explorer is all about satellites, so show them by default
  // there; the home hero keeps them off until toggled.
  const [showSatellites, setShowSatellites] = useState(solarOnly)
  useEffect(() => {
    satellitesVisibleRef.current = showSatellites
  }, [showSatellites])
  // Flip the whole view between the deep-space UNIVERSE and the EARTH-ORBIT /
  // solar explorer. Entering solar mode turns the satellite shells ON (that mode
  // is all about them); leaving it turns them back off so the galaxy reads clean.
  const setSolarView = useCallback((on: boolean) => {
    setSolarMode(on)
    setShowSatellites(on)
  }, [])
  // Scale mode: "explore" (compressed, default) vs "true" (real ratios). Writes
  // the module ref AND bumps a key so the scene subtree remounts and re-lays
  // every body at the new scale.
  const [trueScale, setTrueScale] = useState(defaultTrueScale)
  useEffect(() => {
    scaleModeRef.current = trueScale ? "true" : "explore"
  }, [trueScale])
  // Sync the heavy-effects gate to the current tier so the most expensive optional
  // effect (the raymarched volumetric nebula) is dropped on low/mid and kept on
  // high/ultra. Re-runs when the adaptive controller changes the tier, so a device
  // that downgrades under load also sheds the volume, and one that climbs regains it.
  useEffect(() => {
    heavyEffectsRef.current = qualityForTier(tier).allowHeavyEffects
  }, [tier])
  // SUPER CLEAR — user override to the highest-resolution view. Pins the tier to
  // "ultra" (max DPR + density + heavy effects + 8K/4K textures via the tier-gated
  // knobs) and flips superClearRef so the adaptive controller stops auto-downgrading.
  // Turning it off restores the auto system from the real detected tier.
  const [superClear, setSuperClear] = useState(false)
  const toggleSuperClear = useCallback(() => {
    setSuperClear((on) => {
      const next = !on
      superClearRef.current = next
      if (next) {
        perfTierRef.current = "ultra"
        setTier("ultra")
      } else {
        // hand back to the automatic system at the real detected tier
        const detected = deviceProfileRef.current?.tier ?? "mid"
        perfTierRef.current = detected
        setTier(detected)
      }
      return next
    })
  }, [])
  // View scale: the whole engine is ONE view that flips between the deep-space
  // UNIVERSE (galaxy, stars, constellations, deep-sky) and the EARTH-ORBIT /
  // solar explorer (solarOnly: hides deep space, shows the satellite tools +
  // solar backdrop). `solarOnly` is the INITIAL mode; `solarMode` state lets a
  // HUD toggle flip it in place — "one common view with such split". Bumps the
  // same remount key so the scene re-lays cleanly (same pattern as trueScale).
  const [solarMode, setSolarMode] = useState(solarOnly)
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  // Timestamp of the last user drag/zoom. Drives idle-only autoRotate: the
  // contemplative spin STOPS the instant you grab the scene and only resumes
  // after a few seconds of stillness, so you're never fighting a drifting
  // camera while trying to look at something (the "hard to navigate" fix).
  const lastInteractRef = useRef(0)
  const { resolvedTheme } = useTheme()
  // Prop override wins; otherwise the engine flips to chart mode automatically
  // when the page theme is light. Gated on `mounted` to avoid the SSR/CSR
  // mismatch that next-themes deliberately introduces.
  const invert = invertProp ?? (mounted && resolvedTheme === "light")

  useEffect(() => {
    setMounted(true)
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const mobileMq = window.matchMedia("(max-width: 768px)")
    setReducedMotion(motionMq.matches)
    setMobile(mobileMq.matches)
    try { if (new URLSearchParams(window.location.search).has("perf")) setPerfOverlay(true) } catch { /* ignore */ }
    // Adaptive quality — detect the real device tier (GPU / cores / RAM / OS) and
    // scale DPR + scene density to fit, so strong machines get the full scene and
    // weak ones stay smooth. Keeps deviceTierRef (mobile/desktop) for the texture
    // gate; the finer low/mid/high tier drives DPR + density below.
    const profile = initDeviceTier()
    setTier(profile.tier)
    if (process.env.NODE_ENV !== "production") console.info("[universe-engine] device:", profile.reason)
    // Gate the 4K textures: desktop loads hi-res, mobile keeps 2K (perf budget).
    deviceTierRef.current = mobileMq.matches ? "mobile" : "desktop"
    const onMotion = () => setReducedMotion(motionMq.matches)
    const onMobile = () => {
      setMobile(mobileMq.matches)
      deviceTierRef.current = mobileMq.matches ? "mobile" : "desktop"
    }
    motionMq.addEventListener("change", onMotion)
    mobileMq.addEventListener("change", onMobile)
    return () => {
      motionMq.removeEventListener("change", onMotion)
      mobileMq.removeEventListener("change", onMobile)
    }
  }, [])

  // Continuous adaptive quality — "best experience on any device". The static
  // tier is a GUESS; real frames are truth, so we keep watching them and converge
  // each device on its best SUSTAINABLE tier:
  //   • rolling ~2 s window of frame times → a median each window;
  //   • too slow  → step the tier DOWN immediately (protect smoothness), and
  //     remember it as a CEILING so we never try that heavy again here;
  //   • comfortably fast for a window → step UP one, spending spare headroom,
  //     but never past the ceiling — so it settles instead of oscillating.
  // A cooldown after each change lets the new tier's cost settle before judging
  // again. This is the method: measure → adapt → converge, forever, per device.
  useEffect(() => {
    if (!mounted) return
    let raf = 0
    let last = performance.now()
    // Shorter initial settle so a device that "lags big time" gets its FIRST
    // correction ~1.2s in, not 4.5s in (2.5s settle + 2s window). Textures keep
    // streaming after, but the frame COST is representative almost immediately.
    let windowStart = last + 1200
    const gaps: number[] = []
    let cooldownUntil = windowStart
    let ceiling: DeviceTier | null = null
    const WINDOW_MS = 1200
    const COOLDOWN_MS = 2000

    const tick = () => {
      const now = performance.now()
      const dt = now - last
      last = now
      if (now < windowStart) { raf = requestAnimationFrame(tick); return }
      gaps.push(dt)
      // Judge once per window, but only when the cooldown has elapsed. Super
      // Clear pins fidelity to max: the user chose the highest-resolution view,
      // so the adaptive controller stands down entirely (no auto-downgrade).
      if (now - windowStart >= WINDOW_MS) {
        // Per-window frame stats — computed once, then used for the ?perf
        // overlay AND published on window.__uePerf so the perf test (and any
        // external probe) can read structured numbers instead of scraping text.
        if (gaps.length > 0) {
          const s = gaps.slice().sort((a, b) => a - b)
          const p50 = s[s.length >> 1]
          const p95v = s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]
          const max = s[s.length - 1]
          const fps = Math.round(1000 / p50)
          const stats = { fps, p50, p95: p95v, max, tier: perfTierRef.current, superClear: superClearRef.current, frames: gaps.length }
          if (perfNodeRef.current) {
            perfNodeRef.current.textContent =
              `${fps} fps · p50 ${Math.round(p50)}ms · p95 ${Math.round(p95v)}ms · max ${Math.round(max)}ms · ${perfTierRef.current}${superClearRef.current ? " · SUPER" : ""}`
          }
          if (typeof window !== "undefined") {
            ;(window as unknown as { __uePerf?: typeof stats }).__uePerf = stats
          }
        }
        // Lowered from 30 → 12: when a device is lagging BADLY it may only post a
        // dozen frames in the window, and that's exactly when we must be allowed
        // to judge + downgrade — the old floor let the worst devices never adapt.
        if (!superClearRef.current && gaps.length >= 12 && now >= cooldownUntil) {
          const sorted = gaps.slice().sort((a, b) => a - b)
          // Judge on the p95 (near-worst frame), NOT the median: perceived
          // choppiness is the stutter, not the typical frame. A device can post
          // a smooth median while 1-in-10 frames spike — that spike is what
          // reads as "laggy", so the p95 is what must drive the downgrade.
          const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
          const { tier: next, direction } = adaptTier(perfTierRef.current, p95, ceiling)
          if (direction !== "hold" && next !== perfTierRef.current) {
            // A downgrade sets the ceiling: the tier we just left proved too heavy,
            // so don't climb back above the one below it. This converges the loop.
            if (direction === "down") ceiling = perfTierRef.current
            perfTierRef.current = next
            setTier(next)
            cooldownUntil = now + COOLDOWN_MS
            if (process.env.NODE_ENV !== "production") {
              console.info(`[universe-engine] adapt ${direction} → ${next} (p95 ${Math.round(p95)}ms, ceiling ${ceiling ?? "none"})`)
            }
          }
        }
        gaps.length = 0
        windowStart = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mounted])

  // Pause the render loop when the engine scrolls out of view. A small
  // negative rootMargin keeps it running through the scroll transition so the
  // scene is already live when it re-enters, never caught mid-freeze.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px", threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mounted])

  // Latch of the body currently under the pointer — used by the long-press
  // detector on touch so we know WHAT to open when the hold completes.
  const hoverLatchRef = useRef<BodyInfo | null>(null)
  const onHover = useCallback<HoverHandler>((info) => {
    setHovered(info)
    hoverLatchRef.current = info
    // Latch the most-recent body so the mobile sheet has something to show
    // after pointerout fires (touch always pairs over/out per tap). On TOUCH
    // devices we do NOT auto-open on a plain tap — the long-press handler below
    // opens the sheet on tap-and-hold, so scrolling/panning doesn't keep
    // popping the drawer. On mouse (hover), the old behaviour stays.
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches
    if (info && !coarse) setSelectedBody(info)
    // Broadcast the hover state so the custom cursor can adapt — e.g. switch
    // into target-ring + body-label mode without coupling the cursor to the
    // engine via props. detail.body is null when the pointer leaves a body.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("universe:hover", {
          detail: { body: info, clickable: Boolean(info?.clickable) },
        }),
      )
    }
  }, [])
  // Long-press → open the mobile info sheet. On touch, a plain tap must not
  // pop the drawer (that made scrolling/panning constantly open it); instead the
  // visitor taps AND HOLDS ~500 ms on a body to open its details. A move beyond
  // a small slop cancels the press (so it's a hold, not a drag).
  useEffect(() => {
    if (typeof window === "undefined") return
    const coarse = window.matchMedia?.("(pointer: coarse)").matches
    if (!coarse) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let startX = 0
    let startY = 0
    const HOLD_MS = 500
    const SLOP = 12
    const clear = () => { if (timer) { clearTimeout(timer); timer = null } }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      startX = e.clientX
      startY = e.clientY
      clear()
      timer = setTimeout(() => {
        // Only open if the hold ended on a real body (the hover latch tracks it).
        const body = hoverLatchRef.current
        if (body) {
          setSelectedBody(body)
          // subtle haptic confirmation where supported
          try { navigator.vibrate?.(15) } catch { /* ignore */ }
        }
      }, HOLD_MS)
    }
    const onMove = (e: PointerEvent) => {
      if (timer && (Math.abs(e.clientX - startX) > SLOP || Math.abs(e.clientY - startY) > SLOP)) clear()
    }
    window.addEventListener("pointerdown", onDown, { passive: true })
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerup", clear, { passive: true })
    window.addEventListener("pointercancel", clear, { passive: true })
    return () => {
      clear()
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", clear)
      window.removeEventListener("pointercancel", clear)
    }
  }, [])

  // Stamp the interaction clock on wheel-zoom + pointer grab. OrbitControls'
  // onStart covers drag/pinch but NOT wheel-zoom (that only fires onChange),
  // so autoRotate could sneak back in mid-scroll without this. Keeps idle-only
  // autoRotate honest: any way you move the camera pauses the drift.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const stamp = () => { lastInteractRef.current = performance.now() }
    el.addEventListener("wheel", stamp, { passive: true })
    el.addEventListener("pointerdown", stamp, { passive: true })
    return () => {
      el.removeEventListener("wheel", stamp)
      el.removeEventListener("pointerdown", stamp)
    }
  }, [mounted])

  const handleReset = useCallback(() => {
    // Cancel any sustained follow first; otherwise the controller would
    // immediately re-target the followed body and undo the reset.
    cancelFollow()
    // Snap-OUT, smoothly. The old orbitRef.reset() teleported the camera back in
    // a single frame — a hard, jarring snap. Instead fly back to the exact home
    // pose (the Canvas's default camera + the solar-system target) through the
    // SAME eased fly-to the rest of navigation uses, so leaving a body glides out
    // to the wide view the way arriving glided in — seamless both directions.
    requestFlyTo(
      { x: SUN_OFFSET_SCENE, y: 0, z: 0 },
      13, // matches the default camera distance
      undefined,
      { cameraPos: { x: SUN_OFFSET_SCENE + 4, y: 6, z: 13 } },
    )
    // Clear any per-focus deep-zoom near-plane override so the wide view isn't
    // stuck with a tight clip range on the way out.
    focusDepthRef.current = null
    // Broadcast a sky-focus clear so any persistent detail blooms (galaxy
    // spiral, nebula reveal) collapse back to their idle halos.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("universe:sky-focus", { detail: { pointId: null } }),
      )
    }
  }, [])
  const dismissSheet = useCallback(() => setSelectedBody(null), [])

  // Escape → smooth snap-out. The universal "get me out" gesture: if anything is
  // focused (following a body, a fly-to in flight, a selected satellite, or an
  // open body card), Escape glides the camera back to the wide view via the same
  // eased handleReset — and STOPS there, so it doesn't also drop explore mode.
  // Only when nothing is focused does Escape fall through to the hero's
  // explore-exit. Capture phase so we intercept before the hero's handler.
  useEffect(() => {
    if (!interactive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const focused =
        followRef.current != null ||
        flyToRef.current.active ||
        selectedSatRef.current != null ||
        selectedBody != null
      if (focused) {
        e.stopPropagation()
        if (selectedSatRef.current != null) selectedSatRef.current = null
        setSelectedBody(null)
        handleReset()
      }
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [interactive, selectedBody, handleReset])

  // Following-mode banner. Polls the module-scoped followRef on a 200ms
  // interval — cheap enough vs. re-rendering on every frame, fresh enough
  // that the banner appears/disappears in step with the user's actions.
  const [followingLabel, setFollowingLabel] = useState<string | null>(null)
  // Ride-speed selector state (multiples of real time). Reset to real time
  // whenever a new follow starts — selection snaps the clock to 1× and the
  // chips must agree with reality.
  const [followSpeed, setFollowSpeed] = useState(1)
  useEffect(() => {
    const tick = () => {
      const label = followRef.current?.label ?? null
      setFollowingLabel((prev) => {
        if (label && !prev) setFollowSpeed(1) // new follow → real time
        return label
      })
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [])

  // Narrative caption from the active journey waypoint (Pale Blue Dot,
  // etc.). Same 200ms-poll pattern as followingLabel. Null when the
  // current waypoint doesn't carry a caption, which is most of them.
  const [caption, setCaption] = useState<{
    text: string
    source: string | null
  } | null>(null)
  useEffect(() => {
    const tick = () => {
      const f = flyToRef.current
      const text = f.active ? f.caption : null
      setCaption(text ? { text, source: f.captionSource ?? null } : null)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [])
  const stopFollowing = useCallback(() => {
    cancelFollow()
    setFollowingLabel(null)
  }, [])

  // Default journey — auto-cycles canonical sights while the user hasn't
  // entered explore mode. When `interactive` flips true the journey
  // cleans up and the in-flight fly-to is cancelled so the camera stops
  // moving and hands control to the user.
  useEffect(() => {
    if (interactive) {
      cancelFlyTo()
      return
    }
    if (reducedMotion) return

    let cancelled = false
    let i = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastWasFocus = false

    const tick = () => {
      if (cancelled) return
      const wp = DEFAULT_JOURNEY[i]
      if (wp.focusPointId) {
        // Focus-driven stop (black holes): ride the same channel a user
        // click/Jump-to uses — the SkyPointMesh listener flies with true
        // depth, physics framing and the above-plane vantage, AND engages
        // the detail so the accretion disk blooms during the tour. The
        // listener runs synchronously inside dispatchEvent, so patching the
        // caption onto the now-active fly right after is race-free.
        window.dispatchEvent(
          new CustomEvent("universe:sky-focus", { detail: { pointId: wp.focusPointId } }),
        )
        flyToRef.current.label = wp.label
        flyToRef.current.caption = wp.caption ?? null
        flyToRef.current.captionSource = wp.captionSource ?? null
        lastWasFocus = true
      } else if (wp.target && wp.distance !== undefined) {
        // Leaving a focus stop for a plain waypoint: clear the sky focus so
        // the engaged detail collapses instead of staying lit behind us.
        if (lastWasFocus) {
          window.dispatchEvent(
            new CustomEvent("universe:sky-focus", { detail: { pointId: null } }),
          )
          lastWasFocus = false
        }
        requestFlyTo(wp.target, wp.distance, wp.label, {
          cameraPos: wp.cameraPos,
          caption: wp.caption,
          captionSource: wp.captionSource,
        })
      }
      i = (i + 1) % DEFAULT_JOURNEY.length
      timer = setTimeout(tick, wp.linger)
    }

    // Initial delay so the page can paint + the user can read the hero
    // typography before the camera starts to move.
    timer = setTimeout(tick, 3500)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [interactive, reducedMotion])

  if (!mounted) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-background">
        <StaticStarfield />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-foreground/60">
            Loading Universe
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full ue-engine-fade-in">
      <Canvas
        // Click empty space → smooth snap-out. R3F fires onPointerMissed only on
        // a genuine CLICK that hit no object (not a drag), so rotating the view
        // never triggers it. Gated to when something's focused, so an idle wide-
        // view click does nothing. Reuses the eased handleReset glide.
        onPointerMissed={() => {
          if (!interactive) return
          const focused =
            followRef.current != null || flyToRef.current.active ||
            selectedSatRef.current != null || selectedBody != null
          if (!focused) return
          if (selectedSatRef.current != null) selectedSatRef.current = null
          setSelectedBody(null)
          handleReset()
        }}
        // Camera default: close to the solar system on the Orion Arm.
        // far raised so you can pull the camera out toward the true-3D
        // solar-neighbourhood stars (NearbyStars3D, LY_SCALE 20: Alpha Cen ≈ 86,
        // Sirius ≈ 172 scene units). maxDistance (below) keeps the everyday feel.
        camera={{ position: [SUN_OFFSET_SCENE + 4, 6, 13], fov: 50, near: 0.004, far: 3000 }}
        // Cap device-pixel-ratio: on a Retina/high-DPR display, rendering this
        // full-screen scene at 2× means ~78% more shaded pixels than 1.5× for a
        // starfield where the visual gain is negligible — a real frame-rate cost
        // (the fill-rate / overdraw the profiler flags). 1.5 stays crisp; phones
        // cap tighter still. This is the single biggest smoothness win on Retina.
        // Adaptive DPR from the detected tier: high → up to 2× (crisp on a strong
        // GPU), mid → 1.5×, low → 1.25×. Replaces the old binary mobile/desktop
        // guess so a weak desktop GPU is also throttled, and a strong one isn't.
        dpr={dprForCanvas(qualityForTier(tier).dpr)}
        // Stop drawing entirely while scrolled past the hero (see onScreen).
        frameloop={onScreen ? "always" : "never"}
        // Antialias is a real GPU-memory cost on mobile GPUs — and MSAA is a
        // documented trigger for iOS Safari dropping the WebGL context on
        // memory-constrained iPhones. Disable it on phones (the DPR cap already
        // keeps edges crisp enough); keep it on desktop. `powerPreference` +
        // not failing on a perf caveat give the best chance of a live context.
        gl={{
          antialias: !mobile,
          alpha: true,
          toneMappingExposure: 1.05,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        className="w-full h-full"
        // pointerEvents stays auto so hover hit-tests work in both passive and
        // explore modes; OrbitControls.enabled gates drag/zoom independently.
        style={{ pointerEvents: "auto" }}
        onCreated={({ gl }) => {
          // Tell the intro preloader the universe is actually live, so it can
          // hand off without a snap. Wait two RAFs + a beat so the first real
          // frames (and texture decodes) have painted under the curtain.
          // iOS Safari can drop the WebGL context under memory pressure. If that
          // happens the canvas goes permanently black — so signal a fallback so
          // the hero can reveal the static starfield instead of a dead screen.
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault() // allow a potential restore
              window.dispatchEvent(new CustomEvent("universe-context-lost"))
            },
            { once: true },
          )
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent("universe-ready"))
              }, 250)
            })
          )
        }}
      >
        <SceneContents
          // Remount when the scale mode OR the universe/solar view flips, so
          // every body re-lays and the deep-space vs solar layers rebuild cleanly
          // (orbit radii are computed at build time via compressRadius).
          key={`${trueScale ? "true" : "explore"}-${solarMode ? "solar" : "universe"}`}
          enableMotion={!reducedMotion}
          onHover={onHover}
          onResetView={handleReset}
          mobile={mobile}
          invert={invert}
          interactive={interactive}
          showGravityOverlay={showGravityOverlay}
          showDeepDive={showDeepDive}
          solarOnly={solarMode}
          // Decorative density from the device tier: ultra machines get a
          // richer Milky Way / nebula field, low/mid a lighter one. Recomputes
          // if the live FPS probe steps the tier down.
          densityScale={qualityForTier(tier).densityScale}
        />

        {/* Scroll-scrubbed camera dolly — passive mode only. Explore mode
            hands the camera back to OrbitControls untouched. */}
        {scrollDriveRef && !interactive && <ScrollDolly driveRef={scrollDriveRef} />}

        {/* NavFeel scales rotate/zoom speed by distance + gates autoRotate to
            idle so moving around the space feels predictable at every scale. */}
        {interactive && (
          <NavFeel
            controlsRef={orbitRef}
            lastInteractRef={lastInteractRef}
            autoRotateWanted={!reducedMotion && !followingLabel}
          />
        )}
        {/* Passive HOME hero only: soften render resolution during active page
            scroll so the heavy backdrop never fights the scroll (snaps back
            crisp on stop). Not in explore mode — you want full sharpness there. */}
        {!interactive && !reducedMotion && (
          <ScrollDprGuard
            baseDpr={Math.min(
              typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              (() => { const d = dprForCanvas(qualityForTier(tier).dpr); return Array.isArray(d) ? d[1] : d })(),
            )}
          />
        )}

        <OrbitControls
          ref={orbitRef as React.Ref<OrbitControlsImpl>}
          enabled={interactive}
          // Stamp the interaction clock when the user GRABS the scene (drag /
          // pinch / wheel via the pointer). NOT onChange — that fires while
          // autoRotate itself moves the camera and would deadlock the resume.
          onStart={() => { lastInteractRef.current = performance.now() }}
          // Pan available in explore mode so keyboard arrows + right-click drag
          // let users drift past the default radius around the Sun. Screen-space
          // panning keeps the gesture predictable across viewing angles.
          enablePan={interactive}
          screenSpacePanning
          keyPanSpeed={8}
          enableDamping
          // Lighter damping (0.12 vs 0.08) so the camera SETTLES faster after a
          // drag instead of gliding on — a big part of the "won't sit still" feel.
          dampingFactor={0.12}
          // minDistance 0.02 (paired with camera near 0.012) lets you zoom in
          // as close as the renderer allows — right down to a Starlink point in
          // LEO, the Moon's surface, a comet nucleus — without near-plane
          // clipping. "Zoom till possible." far stays 1000 so the depth-buffer
          // ratio is still safe enough to avoid z-fighting on distant bodies.
          minDistance={0.006}
          maxDistance={600}
          // Pause autoRotate while in follow mode — otherwise the
          // contemplative spin fights the user's drag and the camera
          // feels "stuck." Resumes the moment follow is cleared (via
          // Reset or by switching to a new body's fly-to).
          autoRotate={!reducedMotion && !followingLabel}
          autoRotateSpeed={0.15}
          rotateSpeed={0.5}
          zoomSpeed={0.7}
          touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
          target={SOLAR_SYSTEM_POSITION}
          makeDefault
        />
      </Canvas>

      {/* Single hairline progress bar at the very bottom while assets stream in
          — makes the "quality blooms with time" warmup visible instead of
          reading as jank. Real load %, fades out when done. */}
      <LoadingBar invert={invert} />

      {/* ?perf overlay — live FPS / frame-time / tier readout for diagnosing
          real choppiness on-device. Written directly by the adaptive tick. */}
      {perfOverlay && (
        <div
          ref={perfNodeRef}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none rounded-full bg-black/70 px-3 py-1 font-mono text-[11px] tracking-tight text-emerald-300 tabular-nums"
        >
          measuring…
        </div>
      )}

      {showHud && (
        <>
          {/* Corner info panel — desktop only. Mobile gets the bottom sheet
              instead (richer, dismissable, doesn't fight with the time-warp HUD). */}
          {!mobile && (
            // max-h + overflow so a long body description (Pluto, Earth) can
            // never grow tall enough to reach the timeline bar / bottom chrome —
            // overlapping panels were the recurring complaint. It scrolls inside
            // its own bounds instead of bleeding over neighbours.
            <div className="absolute bottom-32 left-4 md:bottom-32 md:left-6 z-20 pointer-events-none max-w-70 max-h-[min(46vh,22rem)] overflow-y-auto overscroll-contain">
              <InfoPanel info={hovered} hideIdle={solarMode} />
            </div>
          )}

          {/* Ambient teaching — rotating real facts about the bodies. Steps aside
              while a body is focused so it never collides with its info panel.
              Hidden on mobile when the consumer runs its own quiet chrome, and on
              the celestial explorer (solarOnly) — its own dense Earth-tools + the
              timeline already own the bottom of the screen; the big fact bubble
              floating over Earth was pure clutter there. */}
          {!(quietMobileChrome && mobile) && !solarMode && (
            <LearnTicker suppressed={Boolean(hovered) || satFollowed} />
          )}

          {/* Deep Dive legend — compact key for the orbital overlays. */}
          {showDeepDive && !mobile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-6 left-4 md:left-6 z-30 pointer-events-none max-w-72"
            >
              <div className="rounded-2xl border border-foreground/12 bg-background/70 backdrop-blur-xl px-4 py-3.5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-foreground/45">
                    Deep Dive
                  </span>
                  <span className="font-mono text-[8px] tracking-[0.24em] uppercase text-cyan-300/70">
                    Orbital overlays
                  </span>
                </div>
                <ul className="space-y-2 font-mono text-[10px] text-foreground/70">
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-px w-4 rounded-full bg-cyan-400/80" />
                    Planet + comet orbit paths
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
                    Live position marker
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full border border-cyan-300/50 bg-cyan-300/10" />
                    Hill sphere — local gravity boundary
                  </li>
                </ul>
                <p className="mt-3 pt-2.5 border-t border-foreground/10 font-sans text-[10px] leading-4 text-foreground/45">
                  Paths from real orbital elements (J2000). Hill radius r_H = a·(m/3M)<sup>1/3</sup>.
                </p>
              </div>
            </motion.div>
          )}

          {/* Satellites legend — color key for the orbital shells, shown while
              the Satellites layer is on. Steps aside during a follow: the
              operator card + FOLLOWING chip carry the context then, and the
              legend was colliding with the right rail + timeline cluster. */}
          {showSatellites && !mobile && !satFollowed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-6 right-4 md:right-6 z-30 pointer-events-none max-w-56"
            >
              {/* Minimal, lightweight note — the swarm is now a single unified
                  veil, so a 4-colour key would be false. Just the essentials, on a
                  near-invisible surface so it doesn't read as a boxy panel. */}
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#cfe0ff" }} />
                <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-foreground/55">
                  18,600+ tracked objects · real orbits
                </span>
              </div>
              <p className="mt-1.5 font-sans text-[10px] leading-4 text-foreground/40 max-w-60">
                Click any point to chase it live.
              </p>
            </motion.div>
          )}

          {showDeepDive && mobile && (
            // bottom-32 (Level-1 ladder) keeps it clear of the timeline bar.
            <div className="absolute bottom-32 left-4 right-4 z-30 pointer-events-none">
              <div className="mx-auto max-w-md rounded-full border border-foreground/12 bg-background/78 px-4 py-2.5 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-[8px] text-cyan-200">
                    ●
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[9px] tracking-[0.24em] uppercase text-foreground/45">
                      Deep Dive
                    </div>
                    <div className="font-mono text-[10px] text-foreground/75 truncate leading-tight">
                      Orbit trails and Hill spheres are visible
                    </div>
                    <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-foreground/45 truncate leading-tight">
                      Gravity + speed + orbit shape drive the motion
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HUD cluster — anchored bottom-right alongside UPCOMING (which lives
              at bottom-6 right-6). On phones the cluster sits ABOVE the UPCOMING
              pill (bottom-20, flush to right-6) so the two can never collide
              horizontally no matter how wide the UPCOMING label gets. On desktop
              it returns to the same baseline as UPCOMING, sitting to its left
              with a horizontal gap (right-56). */}
          <div className="absolute bottom-20 right-6 md:bottom-6 md:right-56 z-30 pointer-events-auto flex flex-row items-center gap-2">
            {/* Overlay toggles stay desktop-only — too wide on phones, they
                would push the cluster into UPCOMING. Touch users still get
                pinch-zoom + drag + tap-to-explore. */}
            {/* Advanced power-user toggles — hidden on the home hero
                (minimalControls) so the landing feels calm; shown in the
                dedicated explorer. */}
            {!minimalControls && (
              // All overlay/scale/jump controls collapse into one "Layers"
              // popover so the explorer's bottom-right stays a single chip
              // instead of a six-chip row plus a wrapping filter strip.
              // The "Tonight" companion sits alongside it — the observatory-grade
              // "what's above your horizon right now" readout (opt-in location).
              <div className="hidden md:flex items-center gap-2">
                <TonightSky />
                <LayersMenu
                  solarView={solarMode}
                  onToggleSolarView={() => setSolarView(!solarMode)}
                  // Super Clear (max fidelity) — offered only where the detected
                  // device could plausibly sustain it (mid tier or better); a
                  // phone/low-end isn't tempted into a slideshow.
                  superClear={superClear}
                  onToggleSuperClear={
                    ["mid", "high", "ultra"].includes(deviceProfileRef.current?.tier ?? "mid")
                      ? toggleSuperClear
                      : undefined
                  }
                  showClouds={showClouds}
                  onToggleClouds={() => setShowClouds(v => !v)}
                  showSatellites={showSatellites}
                  onToggleSatellites={() => setShowSatellites(v => !v)}
                  showSatGroups={Boolean(solarMode && showSatellites)}
                  trueScale={trueScale}
                  onToggleScale={() => setTrueScale(v => !v)}
                  showGravity={showGravityOverlay}
                  onToggleGravity={() => setShowGravityOverlay(v => !v)}
                  showDeepDive={showDeepDive}
                  onToggleDeepDive={() => setShowDeepDive(v => !v)}
                />
              </div>
            )}
            {/* Jump-to destinations — wayfinding, not a power-user toggle, so it
                shows even with minimalControls (the home hero). Without it the
                black holes were unreachable: idle they render as a dark dot
                with no halo (honestly — nothing escapes), so a browsable list
                is the only real affordance to FIND one. Desktop chip; the
                mobile sheet is the touch path (jump list there is a follow-up). */}
            {interactive && (
              <div className="hidden md:block">
                <DestinationsMenu />
              </div>
            )}
            {showMusic && <GalaxyMusic />}
          </div>

          {/* Timeline — the time machine. Bottom-centre so it reads as the
              primary control on every viewport. Only shown in interactive mode
              since it drives the shared simulation clock; the passive hero
              render keeps a still, present-day sky. On mobile with quiet chrome
              the consumer surfaces the timeline in its own sheet instead, so we
              hide the always-on bar there (desktop keeps it). */}
          {interactive && !(quietMobileChrome && mobile) && (
            <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30 flex justify-center">
              {/* While following a body the ride-speed chips in the Following
                  banner own the speed; hide this panel's cycler so there's one
                  speed control, not two. */}
              <TimelineControl hideSpeed={!!followingLabel} />
            </div>
          )}

          {interactive && <ResetViewButton onClick={handleReset} />}

          {/* Following indicator — only when follow mode is active. Same
              bottom-left slot the destinations menu used to live in. Click
              the chip to stop following; Reset (top-right) also clears it. */}
          {interactive && followingLabel && !PLANET_NAMES.has(followingLabel) && (
            // Only show the Following banner when chasing a SATELLITE — following
            // the default Earth (or any planet) view isn't news, it's just the
            // scene, and the banner + speed chips were clutter at startup.
            // Mobile: sit above the bottom-20 timeline bar; desktop: original slot.
            // One unit: label chip + ride speed share the timeline's surface
            // (bg-background/60 · backdrop-blur-md · foreground/25 border) so the
            // Following banner reads as part of the same control system, not a
            // second, differently-styled widget.
            <div className="absolute bottom-32 left-4 md:bottom-32 md:left-6 z-30 pointer-events-auto flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={stopFollowing}
                aria-label={`Stop following ${followingLabel}`}
                className="
                  inline-flex items-center gap-2 px-3 py-1.5
                  border border-accent/60 rounded-full
                  bg-background/60 backdrop-blur-md
                  font-mono text-[10px] tracking-[0.25em] uppercase
                  text-foreground hover:border-accent
                  transition-colors duration-300
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                "
              >
                <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                  <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                Following · {followingLabel}
                <span aria-hidden="true" className="text-foreground/60 ml-1">×</span>
              </button>
              {/* Ride speed — explicit, human control. Real time is the
                  astronaut's window view; the boosts are labeled honestly as
                  time multiples, not hidden warp state. Styled to match the
                  timeline's speed cycler (accent-active = border-accent/70
                  text-accent) so both speed reads look identical. */}
              <div className="inline-flex items-center gap-1 rounded-full border border-foreground/25 bg-background/60 backdrop-blur-md px-1.5 py-1">
                {FOLLOW_SPEEDS.map((s) => (
                  <button
                    key={s.mult}
                    type="button"
                    onClick={() => { timeScaleRef.current = REALTIME_TIME_SCALE * s.mult; setFollowSpeed(s.mult) }}
                    aria-pressed={followSpeed === s.mult}
                    className={`min-h-6 px-2 py-0.5 rounded-full font-mono text-[9px] tracking-[0.18em] uppercase tabular-nums border transition-colors ${
                      followSpeed === s.mult
                        ? "border-accent/70 text-accent"
                        : "border-transparent text-foreground/60 hover:text-foreground hover:border-accent/40"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mobile && (
            <MobileBodySheet
              body={selectedBody}
              onDismiss={dismissSheet}
              onAction={handleReset}
            />
          )}

          {/* Narrative caption — renders during journey waypoints that carry
              text. Centered and held within a narrow column so each passage
              reads cinematically rather than dashed across the viewport.

              Position depends on the surface. On the standalone explorer
              (full HUD) it sits near the TOP, where the frame is clear. On the
              HOME HERO (minimalControls) the top-left carries the DESIGN ×
              ENGINEERING × AI headline + Oracle line, so a top caption
              COLLIDES with it — anchor the home-hero caption to the LOWER
              third instead, above the auto-tour button, and grow it upward so
              even the long Andromeda passage stays clear of both the headline
              and the bottom chrome. */}
          {caption && (
            <div
              key={caption.text}
              className={`
                pointer-events-none
                absolute left-1/2 -translate-x-1/2
                z-20 max-w-md md:max-w-lg px-6 text-center
                ${minimalControls
                  ? "bottom-56 md:bottom-40 flex flex-col justify-end"
                  : "top-32 md:top-40"}
              `}
              style={{ animation: "ue-label-in 700ms ease-out both" }}
            >
              <p className="font-serif italic text-foreground/85 text-[15px] md:text-[18px] leading-relaxed [text-shadow:0_1px_12px_var(--background)]">
                {caption.text}
              </p>
              {caption.source && (
                <p className="mt-3 font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/55 [text-shadow:0_1px_8px_var(--background)]">
                  {caption.source}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export type { BodyInfo, HoverHandler } from "./types"
export type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  MoonData,
  Planet,
  ScenePlanet,
} from "./types"
export { constellations, planetsData, moons } from "./astronomy"

/**
 * ScrollDolly — passive-mode camera scrub. Captures the camera's resting pose
 * on its first frame, then eases it backward along its own view axis (plus a
 * gentle lift) as the page scrolls: the hero recedes like a title shot. Pure
 * function of the scroll ref — releasing scroll returns the exact framing.
 */
function ScrollDolly({ driveRef }: { driveRef: React.MutableRefObject<number> }) {
  const base = useRef<{ pos: Vector3; back: Vector3; up: Vector3 } | null>(null)
  const eased = useRef(0)
  useDollyFrame(({ camera }, delta) => {
    if (!base.current) {
      const back = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion)
      const up = new Vector3(0, 1, 0)
      base.current = { pos: camera.position.clone(), back, up }
    }
    // critically-damped ease toward the target progress → scrub feels weighty
    const k = 1 - Math.exp(-8 * delta)
    eased.current += (Math.min(1, Math.max(0, driveRef.current)) - eased.current) * k
    const p = eased.current
    if (p < 0.0005) return // resting — leave the camera bit-identical
    const { pos, back, up } = base.current
    camera.position
      .copy(pos)
      .addScaledVector(back, p * 26)   // dolly out through the arm
      .addScaledVector(up, p * 6)      // rise gently above the ecliptic
  })
  return null
}

/*
 * NavFeel — makes moving around the space feel PREDICTABLE across the engine's
 * enormous zoom range (0.006 → 600 units, a 100,000× span). Two problems it
 * solves, both "hard to navigate" complaints:
 *
 *   1. DISTANCE-SCALED SPEED. OrbitControls uses a fixed rotateSpeed, so the
 *      same drag whips the camera when you're close to a body yet barely moves
 *      it when you're far out. We scale rotateSpeed by how far the camera is
 *      from its target, so a drag covers a consistent ANGULAR amount at every
 *      scale — close-up framing stops feeling twitchy, wide shots stop feeling
 *      stuck. Zoom speed eases the same way so a scroll never over/undershoots.
 *
 *   2. IDLE-ONLY AUTOROTATE. The contemplative spin resumes only after ~2.5s of
 *      stillness; any drag/zoom stamps lastInteractRef and the spin cuts out, so
 *      you never fight a drifting camera while trying to look at something.
 */
function NavFeel({
  controlsRef,
  lastInteractRef,
  autoRotateWanted,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>
  lastInteractRef: React.MutableRefObject<number>
  autoRotateWanted: boolean
}) {
  useDollyFrame(({ camera }) => {
    const c = controlsRef.current
    if (!c) return
    // Distance from camera to the orbit target = the natural "scale" we're at.
    const dist = camera.position.distanceTo(c.target)
    // Map distance → a rotate speed that keeps angular drag roughly constant.
    // Clamped so extremes stay usable (very close ~0.28, very far ~0.85).
    const rot = Math.min(0.85, Math.max(0.28, 0.28 + dist * 0.02))
    c.rotateSpeed = rot
    // Zoom speed a touch gentler when close so you don't punch through a body.
    c.zoomSpeed = Math.min(0.9, Math.max(0.45, 0.45 + dist * 0.015))
    // Idle-only autorotate: resume only after 2.5s of no interaction.
    const idle = performance.now() - lastInteractRef.current > 2500
    c.autoRotate = autoRotateWanted && idle
  })
  return null
}

/*
 * ScrollDprGuard — smoothness during page scroll on the HOME hero. The full
 * engine (~90 per-frame callbacks) renders behind the hero while you scroll the
 * opening, competing with the browser's scroll compositing → the "heavy scroll"
 * feel. GPU cost is dominated by shaded-pixel count, so while the page is
 * ACTIVELY scrolling we drop the render resolution (DPR) to ~0.72× of base —
 * the scroll motion masks the softness completely — then ease it back to full
 * the instant scrolling stops, so the resting sky is pixel-crisp. Passive mode
 * only (never in explore/celestial, where you want full sharpness while still).
 */
function ScrollDprGuard({ baseDpr }: { baseDpr: number }) {
  const { gl } = useThree()
  const scrollingUntil = useRef(0)
  const current = useRef(baseDpr)
  useEffect(() => {
    const onScroll = () => { scrollingUntil.current = performance.now() + 140 }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  useDollyFrame((_, delta) => {
    const scrolling = performance.now() < scrollingUntil.current
    const target = scrolling ? baseDpr * 0.72 : baseDpr
    // Ease so the resolution change is never a visible pop.
    const k = 1 - Math.exp(-(scrolling ? 22 : 9) * delta)
    const next = current.current + (target - current.current) * k
    if (Math.abs(next - current.current) > 0.01) {
      current.current = next
      gl.setPixelRatio(next)
    }
  })
  return null
}
