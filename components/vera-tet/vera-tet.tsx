"use client"

// VeraTet — the HUD-prism form of Vera, as a drop-in alternative to <VeraMark />.
//
// A true-3D faceted prism (R3F) carrying Vera's iridescent palette, wrapped in a
// minimalist HUD frame (ring + dashes + crosshairs) — the bridge between the warm
// orb and the sharp Oblivion "Tet". Same props shape as VeraMark (size, phase) so
// the form switcher can swap one for the other with no caller changes.

import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { TetMesh, type TetPhase } from "./tet-mesh"

export function VeraTet({
  size = 96,
  className = "",
  phase = "idle",
}: {
  size?: number
  className?: string
  phase?: TetPhase
}) {
  // halo tint follows phase, same cues as the orb
  const halo =
    phase === "listening"
      ? "rgba(46,217,242,.28)"
      : phase === "thinking"
      ? "rgba(158,77,255,.26)"
      : phase === "speaking"
      ? "rgba(255,110,160,.30)"
      : "rgba(120,100,255,.20)"

  return (
    <div
      className={`vera-tet ${className}`}
      style={{ width: size, height: size, position: "relative", isolation: "isolate" }}
      role="img"
      aria-label="Vera"
    >
      {/* soft outer halo — gives the form presence beyond its frame */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: "-36%",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${halo} 0%, rgba(0,0,0,0) 68%)`,
          filter: "blur(18px)",
          transition: "background 800ms ease",
        }}
      />

      {/* the HUD frame — ring + outer dashed ring + crosshair ticks */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(210,218,235,.30)" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r="49"
          fill="none"
          stroke="rgba(210,218,235,.16)"
          strokeWidth="0.5"
          strokeDasharray="2 3"
        />
        {/* crosshair ticks at N/E/S/W */}
        {[
          [50, 1, 50, 7],
          [50, 93, 50, 99],
          [1, 50, 7, 50],
          [93, 50, 99, 50],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(210,218,235,.35)" strokeWidth="0.6" />
        ))}
      </svg>

      {/* the 3D prism */}
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 3.6], fov: 38 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
        }}
        style={{ position: "absolute", inset: "8%" }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[2, 3, 4]} intensity={2.1} />
        <directionalLight position={[-3, -1, 2]} intensity={0.8} color="#8ea0ff" />
        {/* a warm rim from below-right so a third facet catches a different light */}
        <pointLight position={[1.5, -2, 1]} intensity={0.9} color="#ff9e6a" />
        <TetMesh phase={phase} />
      </Canvas>
    </div>
  )
}
