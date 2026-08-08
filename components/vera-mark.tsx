"use client"

import { useReducedMotion } from "framer-motion"

/**
 * VeraMark — Vera's emblem, an Ashokan GOLD ORB.
 *
 * A warm sandstone/gold sphere (the crowning orb of the Lion Capital of Sarnath):
 * soft blobs swirl inside under soft-light, an ember glows, a bright core pulses,
 * a glass highlight sits top-left, and a faint 24-spoke gold Ashoka Chakra turns
 * over it. Matches Ankur's ashoka-orb reference — circular, gold, alive. Not a
 * Siri rainbow orb; the palette is Mauryan sandstone + ember.
 *
 * Pure SVG/CSS + a little inline style, reduced-motion safe. `size` in px.
 */
export function VeraMark({
  size = 96,
  className = "",
  active = true,
}: {
  size?: number
  className?: string
  active?: boolean
}) {
  const reduce = useReducedMotion()
  const on = active && !reduce

  const cx = 100
  const cy = 100
  const rim = 86
  const hub = 10
  const gold = "#f0dca6"
  // 24-spoke chakra geometry (matches the reference).
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15) * (Math.PI / 180)
    const s = Math.sin(a)
    const c = Math.cos(a)
    return {
      x1: cx + s * hub, y1: cy - c * hub,
      x2: cx + s * (rim - 4), y2: cy - c * (rim - 4),
      bx: cx + s * (rim - 10), by: cy - c * (rim - 10),
    }
  })

  return (
    <div
      className={`vera-orb ${on ? "vera-orb--on" : ""} ${className}`}
      style={{ width: size, height: size, position: "relative", isolation: "isolate" }}
      role="img"
      aria-label="Vera"
    >
      {/* warm bloom behind the orb */}
      <span className="vera-bloom" aria-hidden />

      {/* the orb sphere with swirling interior */}
      <span className="vera-sphere" aria-hidden>
        <span className="vera-blob vera-b1" />
        <span className="vera-blob vera-b2" />
        <span className="vera-blob vera-b3" />
        <span className="vera-ember" />
        <span className="vera-core" />
        <span className="vera-gloss" />
      </span>

      {/* faint 24-spoke gold chakra over the orb */}
      <svg
        viewBox="0 0 200 200"
        className="vera-chakra"
        aria-hidden
        fill="none"
      >
        <circle cx={cx} cy={cy} r={rim} stroke={gold} strokeWidth="1.4" opacity="0.85" />
        {spokes.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={gold} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
        ))}
        {spokes.map((s, i) => (
          <circle key={`b${i}`} cx={s.bx} cy={s.by} r="1.5" fill={gold} opacity="0.75" />
        ))}
        <circle cx={cx} cy={cy} r={hub} stroke={gold} strokeWidth="1.3" />
      </svg>

      <style>{`
        .vera-orb { display: inline-block; }
        .vera-bloom {
          position: absolute; top: -8%; left: 50%; transform: translateX(-50%);
          width: 96%; height: 96%; border-radius: 50%;
          background: radial-gradient(circle at 50% 46%,
            rgba(232,147,78,.34) 0%, rgba(217,179,102,.14) 34%, rgba(0,0,0,0) 70%);
          filter: blur(18px);
        }
        .vera-sphere {
          position: absolute; inset: 0; border-radius: 50%; overflow: hidden;
          box-shadow:
            inset 0 0 22px rgba(74,51,64,.5),
            inset -8px -10px 26px rgba(28,19,15,.6),
            inset 7px 8px 22px rgba(230,199,154,.2),
            0 0 26px rgba(232,147,78,.3),
            0 8px 22px rgba(0,0,0,.5);
        }
        .vera-sphere::before {
          content:""; position:absolute; inset:0; border-radius:50%;
          background: radial-gradient(circle at 42% 34%, #e6c79a 0%, #c99a6b 36%, #7a5c50 68%, #33251f 100%);
        }
        .vera-blob { position:absolute; border-radius:50%; filter:blur(12px); mix-blend-mode:soft-light; }
        .vera-b1 { inset:-18%; background:radial-gradient(circle at 38% 40%, #e6c79a 0%, rgba(230,199,154,0) 60%); }
        .vera-b2 { inset:-24%; background:radial-gradient(circle at 62% 44%, #4a3340 0%, rgba(74,51,64,0) 60%); }
        .vera-b3 { inset:-16%; background:radial-gradient(circle at 50% 68%, #5f7570 0%, rgba(95,117,112,0) 58%); }
        .vera-ember {
          position:absolute; inset:-8%; border-radius:50%;
          background:radial-gradient(circle at 48% 58%, #e8934e 0%, rgba(232,147,78,0) 46%);
          mix-blend-mode:screen; opacity:.85;
        }
        .vera-core {
          position:absolute; inset:34%; border-radius:50%;
          background:radial-gradient(circle at 46% 56%, rgba(255,244,224,.92) 0%, rgba(255,217,160,.55) 34%, rgba(232,147,78,0) 72%);
          filter:blur(4px); mix-blend-mode:screen;
        }
        .vera-gloss {
          position:absolute; inset:0; border-radius:50%; pointer-events:none;
          background:radial-gradient(52% 40% at 36% 24%, rgba(240,236,225,.25) 0%, rgba(240,236,225,0) 60%);
        }
        .vera-chakra {
          position:absolute; inset:14%; width:72%; height:72%; pointer-events:none;
          filter:drop-shadow(0 0 2px rgba(255,217,160,.4)); mix-blend-mode:overlay; opacity:.8;
        }

        .vera-orb--on .vera-bloom,
        .vera-orb--on .vera-sphere { animation: vera-breathe 7.5s ease-in-out infinite; }
        .vera-orb--on .vera-core   { animation: vera-pulse 4s ease-in-out infinite; }
        .vera-orb--on .vera-b1     { animation: vera-spin1 16s linear infinite; }
        .vera-orb--on .vera-b2     { animation: vera-spin2 20s linear infinite; }
        .vera-orb--on .vera-b3     { animation: vera-spin1 13s linear infinite; }
        .vera-orb--on .vera-ember  { animation: vera-spin2 22s linear infinite; }
        .vera-orb--on .vera-chakra { animation: vera-spin1 70s linear infinite; }

        @keyframes vera-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes vera-pulse   { 0%,100%{opacity:.72;transform:scale(1)} 50%{opacity:.95;transform:scale(1.1)} }
        @keyframes vera-spin1   { to { transform: rotate(360deg); } }
        @keyframes vera-spin2   { to { transform: rotate(-360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .vera-orb--on .vera-bloom, .vera-orb--on .vera-sphere, .vera-orb--on .vera-core,
          .vera-orb--on .vera-b1, .vera-orb--on .vera-b2, .vera-orb--on .vera-b3,
          .vera-orb--on .vera-ember, .vera-orb--on .vera-chakra { animation: none; }
        }
      `}</style>
    </div>
  )
}
