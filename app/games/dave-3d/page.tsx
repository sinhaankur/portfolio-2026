"use client"

import { useEffect } from "react"

/**
 * Legacy redirect: /games/dave-3d → /games/ritam-3d. The game was renamed to
 * Ritam 3D; this keeps old links working. Static export can't do a server
 * redirect, so we redirect client-side (replace, so Back doesn't bounce) with a
 * <meta http-equiv> fallback for no-JS. noindex is set in layout.tsx.
 */
const TARGET = "/games/ritam-3d/"

export default function Dave3DRedirect() {
  useEffect(() => {
    window.location.replace(TARGET)
  }, [])

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${TARGET}`} />
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#05060c",
          color: "rgba(255,255,255,0.6)",
          fontFamily: "monospace",
          fontSize: 12,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Redirecting to Ritam 3D…{" "}
        <a href={TARGET} style={{ color: "#7fbfff", marginLeft: 8 }}>
          Continue
        </a>
      </div>
    </>
  )
}
