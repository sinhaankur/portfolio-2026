"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * WatchLive — actually watch, live, for free.
 *
 * The engine already shows where everything IS (real TLE + SGP4). This is the
 * "see it with your eyes" half: the free, keyless, publicly-published live feeds.
 *
 *  · ISS cams   — NASA's live external Earth-viewing camera (YouTube). The
 *                 closest thing to "connect to a satellite and watch live":
 *                 real footage of Earth passing below. Dark on the night side.
 *  · Weather    — GOES / Himawari near-real-time full-disk Earth from orbit
 *                 (NOAA / JMA public imagery, refreshed every few minutes).
 *  · Night sky  — public observatory all-sky cameras (watch the real sky from
 *                 the ground). Uptime varies by source — labelled honestly.
 *
 * Why no paid telescope service: pointing a real scope costs money, so those all
 * charge. The always-on FREE feeds are the spacecraft ones (NASA/NOAA publish
 * them as public data) — which is exactly the mission: real, free, keyless.
 *
 * "Fly to it" nudges the 3D engine to the live subject (the ISS) so the model and
 * the real view line up.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Radio, X, ExternalLink, MapPin } from "lucide-react"
import { selectedSatRef } from "@/components/universe-engine/satellite-refs"
import { satsRef } from "@/components/universe-engine/satellite-data"
import { fetchHimawariLatest, frameAge, type HimawariFrame } from "@/lib/himawari"

type Tab = "iss" | "weather" | "sky"

// ISS live external camera — NASA's public stream. If one mirror goes offline the
// user can pop out to YouTube search for the current official stream.
const ISS_YT_EMBED = "https://www.youtube.com/embed/DIgkvm2nmHc?autoplay=1&mute=1"
const ISS_YT_WATCH = "https://www.youtube.com/results?search_query=nasa+iss+live+earth+from+space"

// Weather-sat full-disk imagery — public, near-real-time, no key. Cache-busted
// each open so it isn't a stale frame. (Static images, not video — that's how
// weather sats publish: a fresh full-disk every ~10 min.)
const WEATHER_FEEDS = [
  {
    id: "goes-east",
    label: "GOES-East · Americas",
    note: "NOAA GOES-16 · full disk, GeoColor",
    url: "https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/latest.jpg",
  },
  {
    id: "goes-west",
    label: "GOES-West · Pacific",
    note: "NOAA GOES-18 · full disk, GeoColor",
    url: "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/latest.jpg",
  },
  {
    id: "himawari",
    label: "Himawari · Asia-Pacific",
    note: "JAXA/JMA Himawari-9 · full disk",
    // Fallback still (fixed-name IR frame). When NICT's real-time true-colour
    // feed is reachable we swap this for the freshest timestamped frame below.
    url: "https://www.data.jma.go.jp/mscweb/data/himawari/img/fd_/fd__b13_0000.jpg",
  },
] as const

// Public all-sky / observatory ground cams. These are third-party feeds; uptime
// and daylight/cloud are out of our hands, so we send the user out to the source
// (many block hot-linking / iframes) rather than pretend an embed is always live.
const SKY_CAMS = [
  { label: "Subaru Telescope · Maunakea", note: "Live all-sky (Hawaii)", url: "https://sukubaru.naoj.org/" },
  { label: "ESO Paranal · all-sky", note: "Atacama, Chile", url: "https://www.eso.org/public/live/" },
  { label: "Lowell Observatory cams", note: "Arizona, USA", url: "https://lowell.edu/" },
] as const

export function WatchLive({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<Tab>("iss")
  const [feed, setFeed] = useState<(typeof WEATHER_FEEDS)[number]["id"]>("goes-east")
  // Cache-bust weather images so we get a fresh frame, not a cached one.
  const [bust] = useState(() => Date.now())
  // Live Himawari-9 true-colour frame from NICT (timestamped). Null until it
  // loads or if the service is slow/offline — then the fixed JMA still is used.
  const [himawari, setHimawari] = useState<HimawariFrame | null>(null)

  useEffect(() => {
    let alive = true
    fetchHimawariLatest().then((f) => { if (alive && f) setHimawari(f) })
    return () => { alive = false }
  }, [])

  const flyToIss = () => {
    // Find the station in the loaded catalogue and select it, so the engine flies
    // to the same object the camera is bolted to.
    const all = satsRef.current
    const iss = all.find((s) => /(^|\s)(ISS|ZARYA)(\s|$)/i.test(s.name) || s.name.toUpperCase().includes("ISS (ZARYA)"))
    if (iss) {
      selectedSatRef.current = iss.id
      window.dispatchEvent(new Event("celestial:sat-selected"))
    }
  }

  const active = WEATHER_FEEDS.find((f) => f.id === feed)!

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[#8ab6ff]/40 bg-background/95 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#8ab6ff]">
          <Radio className="h-3.5 w-3.5" /> Watch live · free
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-2 py-2">
        {([
          ["iss", "ISS cams"],
          ["weather", "Earth · weather"],
          ["sky", "Night sky"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-cursor-hover
            onClick={() => setTab(id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              tab === id ? "bg-[#8ab6ff]/15 text-[#8ab6ff]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === "iss" && (
          <>
            <div className="relative overflow-hidden rounded-lg border border-border bg-black aspect-video">
              <iframe
                title="ISS live Earth-viewing camera"
                src={ISS_YT_EMBED}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              NASA&apos;s live external camera on the ISS — real Earth passing below.
              The view goes dark on the station&apos;s night side (~45 min of every
              ~92-min orbit) and switches cameras periodically. That&apos;s the real
              thing, not a simulation.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" data-cursor-hover onClick={flyToIss}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#8ab6ff]/40 px-2.5 py-1 text-[11px] text-[#8ab6ff] hover:bg-[#8ab6ff]/10">
                <MapPin className="h-3 w-3" /> Fly to the ISS
              </button>
              <a href={ISS_YT_WATCH} target="_blank" rel="noreferrer noopener" data-cursor-hover
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" /> Feed offline? Find the stream
              </a>
            </div>
          </>
        )}

        {tab === "weather" && (
          <>
            <div className="mb-2 flex flex-wrap gap-1">
              {WEATHER_FEEDS.map((f) => (
                <button key={f.id} type="button" data-cursor-hover onClick={() => setFeed(f.id)}
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] tracking-wide transition-colors ${
                    feed === f.id ? "bg-[#8ab6ff]/15 text-[#8ab6ff]" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            {(() => {
              // Prefer NICT's live timestamped true-colour disk for Himawari.
              const liveHimawari = active.id === "himawari" && himawari
              const imgSrc = liveHimawari ? himawari!.url : `${active.url}?t=${bust}`
              return (
                <>
                  <div className="overflow-hidden rounded-lg border border-border bg-black">
                    <img
                      key={liveHimawari ? himawari!.url : active.id}
                      src={imgSrc}
                      alt={`${active.label} full-disk Earth`}
                      className="block w-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {active.note} — near-real-time full-disk Earth from geostationary
                    orbit (~35,786 km up). Published free by the agencies; refreshes
                    every ~10 min.
                    {liveHimawari ? (
                      <> Live true-colour frame captured <span className="text-foreground/80">{frameAge(himawari!.at)}</span> (via NICT).</>
                    ) : (
                      <> Reopen the panel for the latest frame.</>
                    )}
                  </p>
                </>
              )
            })()}
          </>
        )}

        {tab === "sky" && (
          <>
            <div className="flex flex-col gap-1.5">
              {SKY_CAMS.map((c) => (
                <a key={c.label} href={c.url} target="_blank" rel="noreferrer noopener" data-cursor-hover
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-secondary/40">
                  <span>
                    <span className="block text-[12px] text-foreground">{c.label}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{c.note}</span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Public observatory all-sky cameras — watch the real night sky from the
              ground, free. These open at the source (most block embedding). Uptime,
              daylight and clouds are up to the site, not us. For a live map of the
              sky above <em>your</em> spot right now, use “The sky above you”.
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}
