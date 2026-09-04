"use client"

/**
 * WaveVideo — the AI-generated "wave" film for the Universe & Wave concept.
 *
 * Follows the site's video convention (public/video/*.mp4 + .webm + .webp
 * poster): autoplay-muted-loop-playsInline so it behaves like a living
 * backdrop, with a poster for first paint and a graceful text fallback if
 * the file isn't there yet. Drop the real clip at:
 *   public/video/wave.mp4  ·  public/video/wave.webm  ·  public/video/wave-poster.webp
 * and it just works. Until then the poster/gradient stands in.
 */

import { useRef, useState } from "react"

export function WaveVideo({
  className = "",
  caption,
}: {
  className?: string
  caption?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a1a2f] to-[#05070f]">
        {failed ? (
          // Fallback: an animated CSS wave sheen so the section never looks empty.
          <div className="relative flex aspect-video items-center justify-center">
            <div className="wave-fallback absolute inset-0 opacity-60" aria-hidden />
            <p className="relative z-10 px-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-white/60">
              Wave — film loading
            </p>
          </div>
        ) : (
          <video
            ref={ref}
            className="aspect-video w-full object-cover"
            poster="/video/wave-poster.webp"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          >
            <source src="/video/wave.webm" type="video/webm" />
            <source src="/video/wave.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption>
      )}
      <style jsx>{`
        .wave-fallback {
          background:
            radial-gradient(120% 80% at 50% 120%, rgba(56, 189, 248, 0.35), transparent 60%),
            repeating-linear-gradient(
              100deg,
              rgba(56, 189, 248, 0.08) 0px,
              rgba(56, 189, 248, 0.08) 2px,
              transparent 2px,
              transparent 14px
            );
          animation: waveShift 8s ease-in-out infinite alternate;
        }
        @keyframes waveShift {
          from { transform: translateY(6px) scaleY(1); }
          to { transform: translateY(-6px) scaleY(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wave-fallback { animation: none; }
        }
      `}</style>
    </figure>
  )
}
