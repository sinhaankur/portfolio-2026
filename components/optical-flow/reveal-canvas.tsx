"use client"

/**
 * reveal-canvas.tsx — the opt-in gate in front of the live camera demo.
 *
 * The page explains how the algorithms work FIRST; only when the visitor
 * clicks "Try it live on your camera" do we mount <FlowCanvas /> (which is the
 * only thing that ever touches getUserMedia). Until then there's no camera
 * prompt and no CV loop running — the page earns the click before asking for
 * anything. Matches the site's opt-in-media convention (cf. the galaxy music
 * chip: nothing starts until the user asks for it).
 */

import { useState } from "react"
import { Camera } from "lucide-react"
import { FlowCanvas } from "./flow-canvas"

export function RevealCanvas() {
  const [revealed, setRevealed] = useState(false)

  if (revealed) {
    return (
      <div>
        <FlowCanvas />
        <p className="mt-4 font-sans text-sm text-muted-foreground">
          Camera frames are processed entirely on your device and never leave
          it — there is no upload and no server in this page at all.
        </p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* a faint scatter of dots hinting at what's behind the button */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,180,120,0.55) 1px, transparent 1.5px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse at center, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 0%, transparent 70%)",
        }}
      />
      <div className="relative grid place-items-center px-6 py-16 md:py-20 text-center">
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
          Live · runs on your device
        </p>
        <p className="max-w-md font-sans text-base md:text-lg text-foreground/80 leading-relaxed mb-7">
          Want to see the algorithms run? Click below and step into your camera
          — corners get detected, then followed frame to frame, and you resolve
          into the moving point cloud.
        </p>
        <button
          onClick={() => setRevealed(true)}
          data-cursor-hover
          className="
            inline-flex items-center gap-2.5
            rounded-full bg-foreground text-background
            font-mono text-[11px] tracking-wider uppercase px-6 py-3.5
            hover:opacity-90 transition-opacity
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-4 focus-visible:ring-offset-background
          "
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          Try it live on your camera
        </button>
        <p className="mt-4 font-sans text-xs text-muted-foreground">
          Your camera is only requested after you click — nothing runs until then.
        </p>
      </div>
    </div>
  )
}
