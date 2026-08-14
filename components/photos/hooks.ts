"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { Artwork } from "./types"

/* ── navigation: current index + keyboard ─────────────────────────────────── */
export function useSliderNavigation({
  totalSlides,
  enableKeyboard = true,
}: {
  totalSlides: number
  enableKeyboard?: boolean
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToSlide = useCallback(
    (i: number) => setCurrentIndex(Math.max(0, Math.min(totalSlides - 1, i))),
    [totalSlides],
  )
  const goToNext = useCallback(
    () => setCurrentIndex((i) => Math.min(totalSlides - 1, i + 1)),
    [totalSlides],
  )
  const goToPrev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!enableKeyboard) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goToNext()
      else if (e.key === "ArrowLeft") goToPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enableKeyboard, goToNext, goToPrev])

  return { currentIndex, goToNext, goToPrev, goToSlide }
}

/* ── drag / swipe ─────────────────────────────────────────────────────────── */
export function useSliderDrag({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
}: {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  threshold?: number
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const startX = useRef(0)

  const pointX = (e: React.MouseEvent | React.TouchEvent) =>
    "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true)
    startX.current = pointX(e)
  }, [])

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging) return
      setDragX(pointX(e) - startX.current)
    },
    [isDragging],
  )

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragX <= -threshold) onSwipeLeft()
    else if (dragX >= threshold) onSwipeRight()
    setDragX(0)
  }, [isDragging, dragX, threshold, onSwipeLeft, onSwipeRight])

  return { isDragging, dragX, handleDragStart, handleDragMove, handleDragEnd }
}

/* ── wheel / trackpad horizontal scroll ───────────────────────────────────── */
export function useSliderWheel({
  sliderRef,
  onScrollLeft,
  onScrollRight,
  cooldown = 400,
}: {
  sliderRef: React.RefObject<HTMLDivElement | null>
  onScrollLeft: () => void
  onScrollRight: () => void
  cooldown?: number
}) {
  const last = useRef(0)
  useEffect(() => {
    const el = sliderRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 12) return
      const now = Date.now()
      if (now - last.current < cooldown) return
      last.current = now
      if (delta > 0) onScrollLeft()
      else onScrollRight()
    }
    el.addEventListener("wheel", onWheel, { passive: true })
    return () => el.removeEventListener("wheel", onWheel)
  }, [sliderRef, onScrollLeft, onScrollRight, cooldown])
}

/* ── ambient color extraction from each image ─────────────────────────────── */
const DEFAULT_COLORS = ["#3a3a55", "#55407a", "#2a2a3a"]

/** Extract three dominant-ish colors per artwork by sampling a tiny canvas.
 *  Robust: any failure (CORS, SVG, load error) falls back to defaults. */
export function useColorExtraction(items: Artwork[]) {
  const [colors, setColors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    let cancelled = false
    items.forEach((art) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          const size = 24
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (!ctx) throw new Error("no ctx")
          ctx.drawImage(img, 0, 0, size, size)
          const data = ctx.getImageData(0, 0, size, size).data
          // sample three regions (top-left, center, bottom-right) for variety
          const at = (px: number, py: number) => {
            const i = (py * size + px) * 4
            return `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`
          }
          const picked = [at(4, 4), at(12, 12), at(20, 20)]
          if (!cancelled) setColors((c) => ({ ...c, [art.id]: picked }))
        } catch {
          if (!cancelled) setColors((c) => ({ ...c, [art.id]: DEFAULT_COLORS }))
        }
      }
      img.onerror = () => {
        if (!cancelled) setColors((c) => ({ ...c, [art.id]: DEFAULT_COLORS }))
      }
      img.src = art.image
    })
    return () => {
      cancelled = true
    }
  }, [items])

  return colors
}

/** The three colors for the currently shown artwork (with a safe default). */
export function useCurrentColors(colors: Record<string, string[]>, id?: string) {
  return useMemo(() => (id && colors[id]) || DEFAULT_COLORS, [colors, id])
}
