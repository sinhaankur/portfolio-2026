import { ImageResponse } from "next/og"

/**
 * Default Open Graph image — generated once at build time as a 1200×630 PNG.
 *
 * Per-route overrides (e.g. case studies) can colocate their own
 * opengraph-image.tsx beside the route's page.tsx and Next.js will pick that
 * up instead. The canonical 1200×630 size works across LinkedIn, Slack, X,
 * Discord, and iMessage previews without cropping.
 */

// Generated at build time; `output: "export"` requires force-static.
export const dynamic = "force-static"
export const alt = "Ankur Sinha — Design × Engineering × AI"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(circle at 20% 30%, #1a1a1a 0%, #050505 70%)",
          color: "#fafafa",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Top row — brand mark + eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            fontFamily: "monospace",
            fontSize: "20px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "rgba(250,250,250,0.7)",
          }}
        >
          {/* Brand mark — same sun + orbits + planet as the favicon */}
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#fafafa" strokeOpacity="0.65" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="12" fill="none" stroke="#fafafa" strokeOpacity="0.55" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="5" fill="#ff3b30" />
            <circle cx="47" cy="18" r="3" fill="#fafafa" />
          </svg>
          <span style={{ display: "flex" }}>Ankur Sinha</span>
        </div>

        {/* Centre — just the headline. Big Inter-Light type, nothing else
            competing with it. */}
        <div
          style={{
            display: "flex",
            fontSize: "96px",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            fontWeight: 300,
            color: "#fafafa",
            maxWidth: "980px",
          }}
        >
          Design × Engineering × AI
        </div>

        {/* Bottom row — just the URL. Clean. */}
        <div
          style={{
            display: "flex",
            fontFamily: "monospace",
            fontSize: "22px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(250,250,250,0.75)",
          }}
        >
          sinhaankur.com
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
