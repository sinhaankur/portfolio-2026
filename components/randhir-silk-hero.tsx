"use client"

// A quiet cinematic header for Dr. Sinha's page: flowing silk threads, rendered in
// Blender (gold / cream / ice-blue strands weaving in warm light on a dark field) —
// the material his whole career was devoted to. A short seamless loop, ~380 KB.
//
// Muted + autoplay + loop (a decorative ambient header, never audio). If the viewer
// prefers reduced motion, we show the still poster instead of the moving video.

import { useEffect, useRef, useState } from "react"

export function RandhirSilkHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const on = () => setReduce(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])

  return (
    <figure className="relative -mt-2 mb-10 overflow-hidden rounded-2xl border border-border bg-[#05060a]">
      <div className="aspect-[16/9] w-full">
        {reduce ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/video/randhir-silk-poster.webp"
            alt="Flowing silk threads in warm light — a rendered tribute to a life in sericulture."
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            poster="/video/randhir-silk-poster.webp"
            aria-label="Flowing silk threads in warm light — a rendered tribute to a life in sericulture."
          >
            <source src="/video/randhir-silk.webm" type="video/webm" />
            <source src="/video/randhir-silk.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      {/* a soft gradient so the page's text below reads cleanly off the video */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#05060a] to-transparent" />
      <figcaption className="absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.15em] uppercase text-white/45">
        silk · the thread of a life&apos;s work
      </figcaption>
    </figure>
  )
}
