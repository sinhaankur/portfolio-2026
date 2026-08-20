"use client"

/**
 * SpacecraftGallery — a full-screen reference catalog of real human-made craft,
 * one at a time: a live rotating 3D model of the craft's actual GLB mesh beside
 * its real agency / orbit / launch / size and a paragraph of history.
 *
 * Immersive art-gallery-slider style (ambient colour-shift background, drag /
 * arrow-key / wheel / dot navigation). Reference-only — it doesn't fly the engine;
 * it's a browsable catalog. The 3D viewer lazy-loads so the ~R3F chunk doesn't
 * block first paint, and each card renders its own small canvas.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react"
import { SPACECRAFT } from "@/lib/spacecraft-catalog"

const CraftViewer = dynamic(
  () => import("./craft-viewer").then((m) => m.CraftViewer),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-white/[0.03]" /> },
)

// A subtle per-craft accent for the ambient background, cycling warm→cool so
// each craft feels distinct as you move through the catalog.
const ACCENTS = ["#e07a4f", "#5aa9e0", "#c9b06a", "#7ee0a5", "#c8b6ff", "#e0956a", "#6ac4d9"]

export function SpacecraftGallery() {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const total = SPACECRAFT.length
  const craft = SPACECRAFT[index]
  const accent = ACCENTS[index % ACCENTS.length]
  const accent2 = ACCENTS[(index + 3) % ACCENTS.length]

  const go = useCallback((d: number) => {
    setDir(d)
    setIndex((i) => (i + d + total) % total)
  }, [total])

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1)
      else if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go])

  // Touch/drag swipe.
  const startX = useRef<number | null>(null)
  function onPointerDown(e: React.PointerEvent) { startX.current = e.clientX }
  function onPointerUp(e: React.PointerEvent) {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
    startX.current = null
  }

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-[#0a0a0c] text-white"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Ambient colour-shift background per craft */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 28% 25%, ${accent}22 0%, transparent 55%), radial-gradient(ellipse at 75% 78%, ${accent2}1c 0%, transparent 55%), linear-gradient(180deg, #0a0a0c 0%, #0d0d12 100%)`,
          }}
        />
      </AnimatePresence>

      {/* Header */}
      <header className="pointer-events-auto absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 md:px-8 md:py-6">
        <Link
          href="/lab/celestial"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-white/60 transition-colors hover:text-white"
        >
          <ChevronLeft size={14} /> Satellite Engine
        </Link>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">Reference</div>
          <div className="font-mono text-[11px] tracking-widest text-white/70">Spacecraft catalog</div>
        </div>
      </header>

      {/* Main card */}
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center gap-6 px-5 py-20 md:flex-row md:gap-12 md:px-10">
        {/* 3D viewer */}
        <div className="relative h-[38vh] w-full shrink-0 md:h-[62vh] md:w-[52%]">
          <AnimatePresence mode="wait">
            <motion.div
              key={craft.id}
              initial={{ opacity: 0, scale: 0.94, x: dir * 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.94, x: dir * -40 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full"
            >
              <CraftViewer url={craft.model} frame={craft.frame} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Data panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={craft.id + "-info"}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full md:w-[48%]"
          >
            <span
              className="inline-block rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              {craft.kind}
            </span>
            <h1 className="mt-3 font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] md:text-5xl">
              {craft.name}
            </h1>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-[11px] md:text-[12px]">
              <Field label="Agency" value={craft.agency} />
              <Field label="Launched" value={craft.launched} />
              <Field label="Where" value={craft.orbit} />
              <Field label="Size" value={craft.size} />
            </dl>
            <p className="mt-5 max-w-prose font-sans text-sm leading-relaxed text-white/75 md:text-[15px]">
              {craft.fact}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="pointer-events-auto absolute bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-5 md:bottom-8">
        <button
          onClick={() => go(-1)}
          aria-label="Previous spacecraft"
          className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/70 backdrop-blur transition-colors hover:border-white/40 hover:text-white"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-white/70">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-mono text-[11px] text-white/35">/ {total}</span>
        </div>
        <button
          onClick={() => go(1)}
          aria-label="Next spacecraft"
          className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/70 backdrop-blur transition-colors hover:border-white/40 hover:text-white"
        >
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Dots */}
      <div className="pointer-events-auto absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-1.5 md:flex">
        {SPACECRAFT.map((c, i) => (
          <button
            key={c.id}
            onClick={() => { setDir(i > index ? 1 : -1); setIndex(i) }}
            aria-label={c.name}
            title={c.name}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? 18 : 6,
              background: i === index ? accent : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</dt>
      <dd className="mt-0.5 text-white/85">{value}</dd>
    </div>
  )
}
