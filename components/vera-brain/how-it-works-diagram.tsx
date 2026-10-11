"use client"

/**
 * How Vera works — a single, readable architecture diagram for the website.
 *
 * It shows the whole idea at a glance: your Mac holds the brain; your iPhone is a
 * window onto her; they talk over your PRIVATE Tailscale link (encrypted, device-
 * to-device, never the open internet); and they stay one companion by passing a
 * SEALED memory bundle through your own iCloud (Apple only ever holds ciphertext).
 *
 * Pure inline SVG — no dependencies, static-export safe, scales to any width, and
 * respects the site's accent colour + mono labels. Accessible: a <title>/<desc>
 * for screen readers, decorative strokes marked aria-hidden.
 */

export function HowItWorksDiagram() {
  return (
    <figure className="my-10 w-full">
      {/* MOBILE: a vertical, native-DOM stack. The wide SVG below squishes its
          labels to a few pixels on a phone, so on small screens we render the
          same architecture top-to-bottom with full-size, readable text. */}
      <MobileDiagram />

      {/* DESKTOP (md+): the single-glance horizontal SVG. */}
      <div className="hidden md:block rounded-xl border border-border bg-secondary/20 p-4 md:p-8">
        <svg
          viewBox="0 0 920 460"
          className="w-full h-auto"
          role="img"
          aria-labelledby="veraDiagTitle veraDiagDesc"
        >
          <title id="veraDiagTitle">How Vera works across your Mac and iPhone</title>
          <desc id="veraDiagDesc">
            Your Mac runs Vera&rsquo;s brain, which thinks entirely on-device. Your
            iPhone connects to it over a private, encrypted Tailscale link. The two
            devices stay in sync by passing a sealed, encrypted memory bundle through
            your own iCloud, so nothing readable ever leaves your machines.
          </desc>

          <defs>
            <linearGradient id="veraGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent, #c8992e)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--accent, #c8992e)" stopOpacity="0.45" />
            </linearGradient>
            <marker id="veraArrow" markerWidth="10" markerHeight="10" refX="7" refY="3"
                    orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3 L0,6 Z" fill="var(--accent, #c8992e)" />
            </marker>
            <marker id="veraArrowBack" markerWidth="10" markerHeight="10" refX="0" refY="3"
                    orient="auto" markerUnits="strokeWidth">
              <path d="M7,0 L0,3 L7,6 Z" fill="var(--accent, #c8992e)" />
            </marker>
          </defs>

          {/* ───────────────────────── MAC (the brain) ───────────────────────── */}
          <g>
            <rect x="40" y="150" width="300" height="200" rx="14"
                  fill="var(--card, #16130d)" stroke="url(#veraGold)" strokeWidth="1.5" />
            <text x="60" y="182" className="veraMono" fill="var(--accent, #c8992e)"
                  fontSize="12" letterSpacing="2">YOUR MAC</text>
            <text x="60" y="206" fill="var(--foreground, #efe9dd)" fontSize="17" fontWeight="600">
              Vera&rsquo;s brain
            </text>

            {/* the organs, compactly */}
            <text x="60" y="236" fill="var(--foreground, #efe9dd)" fillOpacity="0.72" fontSize="12.5">
              feeling · memory · judgment
            </text>
            <text x="60" y="258" fill="var(--foreground, #efe9dd)" fillOpacity="0.72" fontSize="12.5">
              retrieval (RAG) · persona
            </text>
            <text x="60" y="280" fill="var(--foreground, #efe9dd)" fillOpacity="0.72" fontSize="12.5">
              one local model (words only)
            </text>
            <text x="60" y="302" fill="var(--foreground, #efe9dd)" fillOpacity="0.72" fontSize="12.5">
              neural voice (Kokoro)
            </text>
            <text x="60" y="332" className="veraMono" fill="var(--foreground, #efe9dd)" fillOpacity="0.45"
                  fontSize="10.5" letterSpacing="1.5">
              RUNS ON-DEVICE · NOTHING UPLOADED
            </text>
          </g>

          {/* ───────────────────────── iPHONE (the window) ───────────────────── */}
          <g>
            <rect x="620" y="170" width="200" height="160" rx="22"
                  fill="var(--card, #16130d)" stroke="url(#veraGold)" strokeWidth="1.5" />
            <text x="720" y="200" textAnchor="middle" className="veraMono"
                  fill="var(--accent, #c8992e)" fontSize="12" letterSpacing="2">YOUR iPHONE</text>
            {/* the gold orb */}
            <circle cx="720" cy="250" r="30" fill="url(#veraGold)" />
            <circle cx="720" cy="250" r="30" fill="none" stroke="var(--accent, #c8992e)" strokeOpacity="0.5" />
            <text x="720" y="304" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                  fillOpacity="0.72" fontSize="12.5">she speaks, on-device</text>
          </g>

          {/* ───────────────── TAILSCALE: the private live link ──────────────── */}
          <g aria-hidden="true">
            <line x1="340" y1="230" x2="620" y2="230"
                  stroke="var(--accent, #c8992e)" strokeWidth="1.6"
                  markerEnd="url(#veraArrow)" markerStart="url(#veraArrowBack)" />
          </g>
          <rect x="398" y="196" width="164" height="28" rx="14"
                fill="var(--background, #0d0b07)" stroke="var(--accent, #c8992e)" strokeOpacity="0.4" />
          <text x="480" y="214" textAnchor="middle" className="veraMono"
                fill="var(--accent, #c8992e)" fontSize="11" letterSpacing="1.5">
            TAILSCALE · PRIVATE
          </text>
          <text x="480" y="250" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                fillOpacity="0.6" fontSize="11.5">
            encrypted, device-to-device
          </text>
          <text x="480" y="268" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                fillOpacity="0.6" fontSize="11.5">
            never the open internet
          </text>

          {/* ───────────────── iCLOUD: the sealed memory sync ────────────────── */}
          <g aria-hidden="true">
            {/* mac → cloud */}
            <path d="M190,150 C190,90 360,90 440,90" fill="none"
                  stroke="var(--accent, #c8992e)" strokeWidth="1.4" strokeDasharray="5 5"
                  markerEnd="url(#veraArrow)" />
            {/* cloud → iphone */}
            <path d="M520,90 C640,90 720,120 720,170" fill="none"
                  stroke="var(--accent, #c8992e)" strokeWidth="1.4" strokeDasharray="5 5"
                  markerEnd="url(#veraArrow)" />
          </g>
          <rect x="415" y="56" width="90" height="56" rx="12"
                fill="var(--card, #16130d)" stroke="url(#veraGold)" strokeWidth="1.5" />
          <text x="460" y="80" textAnchor="middle" className="veraMono"
                fill="var(--accent, #c8992e)" fontSize="11" letterSpacing="1.5">iCLOUD</text>
          <text x="460" y="99" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                fillOpacity="0.72" fontSize="11">sealed bundle</text>
          <text x="460" y="134" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                fillOpacity="0.5" fontSize="10.5">
            encrypted before it leaves — Apple holds only ciphertext
          </text>

          {/* ───────────────── YOU (the person) ──────────────────────────────── */}
          <g aria-hidden="true">
            <line x1="190" y1="350" x2="190" y2="404"
                  stroke="var(--accent, #c8992e)" strokeOpacity="0.5" strokeWidth="1.4"
                  markerEnd="url(#veraArrow)" markerStart="url(#veraArrowBack)" />
            <line x1="720" y1="330" x2="720" y2="404"
                  stroke="var(--accent, #c8992e)" strokeOpacity="0.5" strokeWidth="1.4"
                  markerEnd="url(#veraArrow)" markerStart="url(#veraArrowBack)" />
          </g>
          <text x="455" y="428" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                fontSize="14" fontWeight="600">You — talk to her from either device</text>
          <text x="455" y="449" textAnchor="middle" fill="var(--foreground, #efe9dd)"
                fillOpacity="0.55" fontSize="11.5">
            one companion · your keys · your hardware · no account of mine
          </text>
        </svg>
      </div>
      <figcaption className="mt-3 text-center text-xs text-foreground/50 font-mono tracking-wide">
        The whole idea: your Mac thinks, your iPhone connects over Tailscale, your
        iCloud keeps them in sync — all private, all yours.
      </figcaption>

      <style jsx>{`
        :global(.veraMono) {
          font-family: var(--font-mono, ui-monospace, monospace);
        }
      `}</style>
    </figure>
  )
}

/* ── Mobile: the same architecture, stacked vertically with readable text ───── */

function MobileDiagram() {
  return (
    <div
      className="md:hidden flex flex-col items-stretch gap-0 rounded-xl border border-border bg-secondary/20 p-4"
      role="img"
      aria-label="How Vera works: your Mac runs her brain on-device; your iPhone connects over a private, encrypted Tailscale link; the two stay in sync by passing a sealed, encrypted memory bundle through your own iCloud, so nothing readable leaves your machines."
    >
      {/* YOUR MAC — the brain */}
      <Node label="Your Mac" accentLabel>
        <p className="text-base font-semibold text-foreground">Vera&rsquo;s brain</p>
        <ul className="mt-2 space-y-1 text-sm text-foreground/70">
          <li>feeling · memory · judgment</li>
          <li>retrieval (RAG) · persona</li>
          <li>one local model (words only)</li>
          <li>neural voice (Kokoro)</li>
        </ul>
        <p className="mt-3 font-mono text-[10px] tracking-[0.15em] uppercase text-foreground/40">
          Runs on-device · nothing uploaded
        </p>
      </Node>

      {/* link: iCloud sealed sync (the dashed, out-of-band path) */}
      <Connector label="iCloud · sealed bundle" dashed>
        encrypted before it leaves — Apple holds only ciphertext
      </Connector>

      {/* link: Tailscale private live link */}
      <Connector label="Tailscale · private link">
        encrypted, device-to-device · never the open internet
      </Connector>

      {/* YOUR iPHONE — the window */}
      <Node label="Your iPhone" accentLabel>
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-9 w-9 shrink-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, var(--accent, #c8992e), color-mix(in srgb, var(--accent, #c8992e) 45%, transparent))",
            }}
            aria-hidden
          />
          <p className="text-sm text-foreground/70">
            A window onto the same companion — <span className="text-foreground/90">she speaks, on-device</span>.
          </p>
        </div>
      </Node>

      {/* YOU — the person */}
      <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-foreground">
          You — talk to her from either device
        </p>
        <p className="mt-1 text-xs text-foreground/55">
          one companion · your keys · your hardware · no account of mine
        </p>
      </div>
    </div>
  )
}

function Node({
  label,
  accentLabel,
  children,
}: {
  label: string
  accentLabel?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card/70 p-4">
      <p
        className={`font-mono text-[10px] tracking-[0.2em] uppercase ${
          accentLabel ? "text-accent" : "text-muted-foreground"
        } mb-2`}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function Connector({
  label,
  children,
  dashed,
}: {
  label: string
  children: React.ReactNode
  dashed?: boolean
}) {
  return (
    <div className="flex flex-col items-center py-2" aria-hidden>
      <span
        className={`h-5 w-px ${dashed ? "border-l border-dashed border-accent/50" : "bg-accent/50"}`}
      />
      <span className="my-1 rounded-full border border-accent/40 bg-background px-3 py-1 font-mono text-[10px] tracking-[0.12em] uppercase text-accent">
        {label}
      </span>
      <span className="max-w-[16rem] text-center text-[11px] leading-snug text-foreground/55">
        {children}
      </span>
      <span
        className={`h-5 w-px ${dashed ? "border-l border-dashed border-accent/50" : "bg-accent/50"}`}
      />
    </div>
  )
}
