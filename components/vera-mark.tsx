"use client"

import { useReducedMotion } from "framer-motion"

/**
 * VeraMark — Vera's orb, matching the macOS app's SiriOrb.
 *
 * A soft, multicolor iridescent sphere: a dark base with blurred color blobs
 * (pink / purple / blue / cyan / orange) swirling inside a circular mask over a
 * bright bloom, a white-hot core, a glassy top-left highlight, and a crisp rim.
 * It breathes at rest. Pure CSS/SVG, reduced-motion safe. (No chakra — this is
 * the same orb the app shows in the chat and menubar.)
 *
 * `size` in px. `active` toggles the living animation.
 */
export function VeraMark({
  size = 96,
  className = "",
  active = true,
  phase = "idle",
  level,
}: {
  size?: number
  className?: string
  active?: boolean
  /** Drives phase-specific motion so the orb visibly LISTENS, THINKS, SPEAKS. */
  phase?: "idle" | "listening" | "thinking" | "speaking"
  /** 0..1 live voice loudness — when provided (while speaking), the inner wave
   *  rides the REAL audio amplitude instead of a fixed loop, like the Vera app. */
  level?: number
}) {
  const reduce = useReducedMotion()
  const on = active && !reduce
  // When a live level is supplied, feed it to the wave height var; the CSS wave
  // keeps flowing (translateX) but its amplitude now tracks the actual voice.
  const liveWave =
    typeof level === "number" && phase === "speaking"
      ? ({ ["--wv" as string]: (0.4 + level * 1.4).toFixed(2) } as React.CSSProperties)
      : undefined

  return (
    <div
      className={`vera-siri ${on ? "vera-siri--on" : ""} vera-siri--${phase} ${liveWave ? "vera-siri--live-wave" : ""} ${className}`}
      style={{ width: size, height: size, position: "relative", isolation: "isolate", ...liveWave }}
      role="img"
      aria-label="Vera"
    >
      {/* soft outer halo that tints with her phase — the first thing you feel */}
      <span className="vs-halo" aria-hidden />
      {/* phase auras: a listening ripple ring + a speaking glow, below the orb */}
      <span className="vs-ripple" aria-hidden />
      <span className="vs-ripple vs-ripple-2" aria-hidden />
      <span className="vs-ripple vs-ripple-3" aria-hidden />
      {/* outer bloom (spills beyond the sphere) */}
      <span className="vs-bloom" aria-hidden />

      {/* the orb body: swirling color blobs inside a circular mask */}
      <span className="vs-body" aria-hidden>
        {/* slow iridescent conic wash behind the blobs — adds depth + motion */}
        <span className="vs-iris" />
        <span className="vs-blob vs-pink" />
        <span className="vs-blob vs-purple" />
        <span className="vs-blob vs-blue" />
        <span className="vs-blob vs-cyan" />
        <span className="vs-blob vs-orange" />
        {/* counter-rotating inner layer so the swirl never reads as plain circles */}
        <span className="vs-blob vs-inner vs-magenta" />
        <span className="vs-blob vs-inner vs-teal" />
        <span className="vs-core" />
        {/* a faint spark that orbits the core while she's thinking */}
        <span className="vs-spark" />
        {/* fine grain/shimmer — the texture that makes it feel lit, not flat */}
        <span className="vs-grain" />
        {/* phase tint wash — blue idle · pink listening · amber speaking, so the
            state reads at a glance exactly like the Vera app's orb */}
        <span className="vs-tint" />
        {/* reactive voice wave — the "alive" layer from the app: luminous ripples
            swelling in the middle, tapering at the edges. The path is a full sine
            train twice the orb's width; sliding it left scrolls real peaks through
            the orb (clipped by the body), so it reads as a flowing wave — the
            Siri-style ripple, pure SVG, portable everywhere. */}
        <svg className="vs-wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g className="vs-wave-scroll">
            <path className="vs-wave-a" d="M-100 50 Q -87 38 -75 50 T -50 50 T -25 50 T 0 50 T 25 50 T 50 50 T 75 50 T 100 50 T 125 50 T 150 50 T 175 50 T 200 50" />
          </g>
          <g className="vs-wave-scroll vs-wave-scroll-2">
            <path className="vs-wave-b" d="M-100 50 Q -89 58 -78 50 T -56 50 T -34 50 T -12 50 T 10 50 T 32 50 T 54 50 T 76 50 T 98 50 T 120 50 T 142 50 T 164 50 T 200 50" />
          </g>
        </svg>
      </span>

      {/* glassy specular highlight (top-left) */}
      <span className="vs-gloss" aria-hidden />
      {/* a soft secondary highlight bottom-right (fresnel fill) */}
      <span className="vs-gloss vs-gloss-2" aria-hidden />
      {/* crisp rim */}
      <span className="vs-rim" aria-hidden />

      <style>{`
        .vera-siri { display:inline-block; border-radius:50%; }
        .vs-bloom {
          position:absolute; inset:-14%; border-radius:50%;
          background: radial-gradient(circle at 50% 50%,
            rgba(255,255,255,.28) 0%, rgba(158,77,255,.34) 32%, rgba(0,0,0,0) 70%);
          filter: blur(14px);
        }
        .vs-body {
          position:absolute; inset:0; border-radius:50%; overflow:hidden;
          background:#0a0714;                 /* dark base → colors read as luminous */
          /* lighter inner shadow so the vivid swirl isn't eaten at small sizes;
             keep a soft outer drop for presence on the page. */
          box-shadow: inset 0 0 18px rgba(0,0,0,.55), 0 6px 24px rgba(30,12,60,.55);
        }
        .vs-blob {
          position:absolute; width:64%; height:64%; border-radius:50%;
          filter: blur(9px); mix-blend-mode:screen; opacity:1;
          top:18%; left:18%;
          transform-origin:center;
        }
        /* each blob orbits from a different start angle via its own wrapper spin */
        .vs-pink   { background: radial-gradient(circle, #ff4590 0%, rgba(255,69,144,0) 62%); }
        .vs-purple { background: radial-gradient(circle, #9e4dff 0%, rgba(158,77,255,0) 62%); }
        .vs-blue   { background: radial-gradient(circle, #3385ff 0%, rgba(51,133,255,0) 62%); }
        .vs-cyan   { background: radial-gradient(circle, #2ed9f2 0%, rgba(46,217,242,0) 62%); }
        .vs-orange { background: radial-gradient(circle, #ff9e33 0%, rgba(255,158,51,0) 62%); }
        .vs-core {
          position:absolute; inset:40%; border-radius:50%;
          background: radial-gradient(circle at 50% 48%,
            rgba(255,250,255,.7) 0%, rgba(255,240,255,0) 70%);
          mix-blend-mode:screen; filter:blur(4px);
        }
        .vs-gloss {
          position:absolute; inset:0; border-radius:50%; pointer-events:none;
          background: radial-gradient(42% 34% at 34% 28%,
            rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 60%);
          mix-blend-mode:screen;
        }
        .vs-rim {
          position:absolute; inset:0; border-radius:50%; pointer-events:none;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.22),
                      inset 0 0 14px 2px rgba(120,80,255,.10);
        }

        /* soft outer halo — a diffuse glow that spills well beyond the sphere and
           picks up the current phase's tint. Gives the orb real presence on the
           page instead of ending abruptly at its rim. */
        .vs-halo {
          position:absolute; inset:-40%; border-radius:50%; pointer-events:none;
          background: radial-gradient(circle at 50% 50%,
            rgba(158,77,255,.30) 0%, rgba(51,133,255,.16) 38%, rgba(0,0,0,0) 68%);
          filter: blur(22px); opacity:1;
          transition: background 800ms ease;
        }

        /* iridescent conic wash behind the blobs — slow sweep adds depth/motion */
        .vs-iris {
          position:absolute; inset:-10%; border-radius:50%;
          background: conic-gradient(from 0deg,
            rgba(255,69,144,.65), rgba(158,77,255,.65), rgba(51,133,255,.65),
            rgba(46,217,242,.65), rgba(255,158,51,.6), rgba(255,69,144,.65));
          filter: blur(16px); mix-blend-mode:screen; opacity:.75;
        }

        /* inner counter-layer: smaller, tighter blobs so the swirl has two scales */
        .vs-inner { width:52%; height:52%; top:24%; left:24%; filter:blur(8px); opacity:.8; }
        .vs-magenta { background: radial-gradient(circle, #ff5ec4 0%, rgba(255,94,196,0) 60%); }
        .vs-teal    { background: radial-gradient(circle, #28f0c8 0%, rgba(40,240,200,0) 60%); }

        /* a faint spark that rides around the core (most visible while thinking) */
        .vs-spark {
          position:absolute; width:8%; height:8%; top:46%; left:46%; border-radius:50%;
          background: radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 70%);
          mix-blend-mode:screen; opacity:0;
        }

        /* fine grain + a traveling sheen — the premium "it's lit" texture */
        /* grain removed — the dot pattern read as noise over the swirl, not texture.
           A smooth glowing orb is the identity; the moving blobs are the texture. */
        .vs-grain { display:none; }

        .vs-gloss-2 {
          background: radial-gradient(34% 26% at 70% 76%,
            rgba(120,180,255,.30) 0%, rgba(120,180,255,0) 60%);
        }
        .vs-ripple-3 { border-color: rgba(255,158,51,.3); }

        .vera-siri--on .vs-body,
        .vera-siri--on .vs-bloom { animation: vs-breathe 5s ease-in-out infinite; }
        .vera-siri--on .vs-core  { animation: vs-pulse 2.8s ease-in-out infinite; }
        /* distinct speeds + directions → a rich, never-repeating swirl (quicker so it reads as alive) */
        .vera-siri--on .vs-pink   { animation: vs-orbit1 5s   linear infinite; }
        .vera-siri--on .vs-purple { animation: vs-orbit2 6.5s linear infinite; }
        .vera-siri--on .vs-blue   { animation: vs-orbit1 7.5s linear infinite; }
        .vera-siri--on .vs-cyan   { animation: vs-orbit2 4.5s linear infinite; }
        .vera-siri--on .vs-orange { animation: vs-orbit1 8.5s linear infinite; }
        /* inner layer counter-rotates (different sign + speed) for a two-scale swirl */
        .vera-siri--on .vs-magenta { animation: vs-orbit2 4s   linear infinite; }
        .vera-siri--on .vs-teal    { animation: vs-orbit1 3.5s linear infinite reverse; }
        /* the conic wash turns slowly; the grain sheen drifts across the face */
        .vera-siri--on .vs-iris  { animation: vs-spin 26s linear infinite; }
        .vera-siri--on .vs-grain { animation: vs-sheen 6s ease-in-out infinite; }

        @keyframes vs-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
        @keyframes vs-pulse   { 0%,100%{opacity:.7} 50%{opacity:1} }
        /* orbit = translate out, spin around center, so blobs sweep the body */
        @keyframes vs-orbit1 {
          0%   { transform: rotate(0deg)   translateX(26%) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(26%) rotate(-360deg); }
        }
        @keyframes vs-orbit2 {
          0%   { transform: rotate(0deg)   translateX(30%) rotate(0deg); }
          100% { transform: rotate(-360deg) translateX(30%) rotate(360deg); }
        }
        /* ── phase auras: ripple rings that emanate when she's active ── */
        .vs-ripple {
          position:absolute; inset:0; border-radius:50%; pointer-events:none;
          border:1.5px solid rgba(158,77,255,.45);
          opacity:0; transform:scale(1);
        }
        .vs-ripple-2 { border-color: rgba(46,217,242,.4); }

        /* ── phase tint wash (matches the Vera app: blue idle · pink listening ·
           amber speaking). A soft-light circle over the swirl so the STATE reads
           at a glance while the iridescence still shows underneath. ── */
        .vs-tint {
          position:absolute; inset:0; border-radius:50%; pointer-events:none;
          mix-blend-mode:screen; opacity:.7; transition: background 600ms ease, opacity 600ms ease;
          background: radial-gradient(circle at 50% 45%, rgba(45,110,255,.6), rgba(25,60,170,.3) 68%, rgba(0,0,0,0) 82%);
        }
        .vera-siri--listening .vs-tint {
          background: radial-gradient(circle at 50% 45%, rgba(255,60,135,.72), rgba(195,35,105,.35) 68%, rgba(0,0,0,0) 82%); opacity:.82; }
        .vera-siri--thinking .vs-tint {
          background: radial-gradient(circle at 50% 45%, rgba(150,75,255,.6), rgba(95,45,185,.3) 68%, rgba(0,0,0,0) 82%); opacity:.7; }
        .vera-siri--speaking .vs-tint {
          mix-blend-mode: screen;
          background: radial-gradient(circle at 50% 45%, rgba(255,150,40,.7), rgba(220,110,20,.35) 68%, rgba(0,0,0,0) 82%); opacity:.85; }

        /* ── reactive voice wave — the app's "alive" layer. Two luminous ripples
           across the middle, swelling in the centre, tapering at the edges. At
           idle it's a calm low ripple; listening/speaking make it taller + faster. ── */
        .vs-wave {
          position:absolute; inset:0; width:100%; height:100%; pointer-events:none;
          mix-blend-mode:plus-lighter; overflow:visible;
          opacity:.5; transition: opacity 500ms ease;
        }
        .vs-wave path { fill:none; stroke-linecap:round; vector-effect:non-scaling-stroke; }
        .vs-wave-a { stroke: rgba(255,255,255,.85); stroke-width:1.6; }
        .vs-wave-b { stroke: rgba(180,210,255,.7); stroke-width:1.1; }
        /* the sine train slides left so real peaks scroll through the orb; the
           group's own vertical scale sets the wave height (calm at idle, tall when
           active). One slide cycle = 100 units = one wavelength, so it loops
           seamlessly. */
        .vs-wave-scroll {
          --wv: 0.5;                 /* idle wave height; phases raise it */
          transform-origin:center;
          animation: vs-wave-flow 3.4s linear infinite;
        }
        .vs-wave-scroll-2 { --wv: 0.5; animation-duration: 2.5s; animation-direction: reverse; }
        /* live voice: the inline --wv on the root drives the amplitude, overriding
           the per-phase presets so the wave rides the REAL audio loudness. */
        .vera-siri--live-wave .vs-wave-scroll,
        .vera-siri--live-wave .vs-wave-scroll-2 { --wv: inherit; }
        @keyframes vs-wave-flow {
          from { transform: translateX(0)    scaleY(var(--wv, 0.4)); }
          to   { transform: translateX(-25%) scaleY(var(--wv, 0.4)); }
        }

        /* LISTENING — gentle ripples radiate outward, like she's receiving you */
        .vera-siri--listening .vs-ripple  { animation: vs-ring 1.9s ease-out infinite; }
        .vera-siri--listening .vs-ripple-2 { animation: vs-ring 1.9s ease-out .95s infinite; }
        .vera-siri--listening .vs-bloom   { animation: vs-breathe 2.6s ease-in-out infinite; }
        /* wave jumps tall + quick while receiving you */
        .vera-siri--listening .vs-wave { opacity:1; }
        .vera-siri--listening .vs-wave-scroll   { --wv: 1.1; animation-duration: 1.4s; }
        .vera-siri--listening .vs-wave-scroll-2 { --wv: 1.1; animation-duration: 1.0s; }
        /* bias warm/cool balance toward PINK while listening */
        .vera-siri--listening .vs-orange { opacity:.3; }
        .vera-siri--listening .vs-pink,
        .vera-siri--listening .vs-magenta { opacity:1; transform:scale(1.1); }

        /* THINKING — the swirl slows and dims a touch, the core flickers softly,
           a quiet 'turning it over' feel */
        .vera-siri--thinking .vs-body { animation: vs-breathe 3.4s ease-in-out infinite; }
        .vera-siri--thinking .vs-core { animation: vs-think-flicker 1.1s ease-in-out infinite; }
        .vera-siri--thinking .vs-pink,
        .vera-siri--thinking .vs-purple,
        .vera-siri--thinking .vs-blue,
        .vera-siri--thinking .vs-cyan,
        .vera-siri--thinking .vs-orange { animation-duration: 22s; opacity:.6; }

        /* SPEAKING — everything quickens + brightens: the colours swirl fast, the
           bloom pulses with her voice, the core glows hot */
        .vera-siri--speaking .vs-bloom { animation: vs-speak-glow 0.9s ease-in-out infinite; }
        .vera-siri--speaking .vs-core  { animation: vs-pulse 0.7s ease-in-out infinite; }
        /* wave flows fast + bright + tall while speaking */
        .vera-siri--speaking .vs-wave { opacity:1; }
        .vera-siri--speaking .vs-wave-scroll   { --wv: 1.4; animation-duration: 1.0s; }
        .vera-siri--speaking .vs-wave-scroll-2 { --wv: 1.4; animation-duration: 0.75s; }
        /* bias the swirl WARM when speaking (dim cool blobs, lift the orange) so
           the orb actually reads amber like the app, not just a warm wash on top */
        .vera-siri--speaking .vs-blue,
        .vera-siri--speaking .vs-cyan,
        .vera-siri--speaking .vs-teal   { opacity:.25; }
        .vera-siri--speaking .vs-orange { opacity:1; transform:scale(1.15); }
        .vera-siri--speaking .vs-pink   { opacity:.8; }
        /* thinking — wave settles to a slow low ripple */
        .vera-siri--thinking .vs-wave { opacity:.5; }
        .vera-siri--thinking .vs-wave-scroll   { --wv: 0.45; animation-duration: 5s; }
        .vera-siri--thinking .vs-wave-scroll-2 { --wv: 0.45; animation-duration: 4s; }
        .vera-siri--speaking .vs-pink   { animation-duration: 4.2s; }
        .vera-siri--speaking .vs-purple { animation-duration: 5s; }
        .vera-siri--speaking .vs-blue   { animation-duration: 5.8s; }
        .vera-siri--speaking .vs-cyan   { animation-duration: 3.6s; }
        .vera-siri--speaking .vs-orange { animation-duration: 6.4s; }

        @keyframes vs-ring {
          0%   { opacity:.7; transform:scale(1); }
          100% { opacity:0;  transform:scale(1.45); }
        }
        @keyframes vs-think-flicker {
          0%,100% { opacity:.55; } 40% { opacity:.9; } 70% { opacity:.4; }
        }
        @keyframes vs-speak-glow {
          0%,100% { transform:scale(1);    opacity:.85; }
          50%     { transform:scale(1.09); opacity:1; }
        }
        @keyframes vs-spin  { to { transform: rotate(360deg); } }
        @keyframes vs-sheen { 0%,100%{opacity:.06; transform:translateX(-4%)}
                              50%{opacity:.16; transform:translateX(4%)} }
        /* spark orbiting the core */
        @keyframes vs-spark-orbit {
          0%   { opacity:0;   transform: rotate(0deg)   translateX(120%) rotate(0deg); }
          20%  { opacity:.95; }
          80%  { opacity:.95; }
          100% { opacity:0;   transform: rotate(360deg) translateX(120%) rotate(-360deg); }
        }
        @keyframes vs-third-ring {
          0%   { opacity:.5; transform:scale(1); }
          100% { opacity:0;  transform:scale(1.7); }
        }

        /* ── phase tinting of the outer halo (what you sense first) ── */
        .vera-siri--listening .vs-halo {
          background: radial-gradient(circle at 50% 50%,
            rgba(46,217,242,.30) 0%, rgba(51,133,255,.14) 40%, rgba(0,0,0,0) 70%); }
        .vera-siri--thinking .vs-halo {
          background: radial-gradient(circle at 50% 50%,
            rgba(158,77,255,.26) 0%, rgba(120,80,255,.12) 40%, rgba(0,0,0,0) 70%); }
        .vera-siri--speaking .vs-halo {
          background: radial-gradient(circle at 50% 50%,
            rgba(255,110,160,.30) 0%, rgba(255,158,51,.16) 42%, rgba(0,0,0,0) 72%); }

        /* THINKING extras: the spark rides around the core */
        .vera-siri--thinking .vs-spark { animation: vs-spark-orbit 2.6s linear infinite; }
        /* LISTENING extra: a third, slower outer ring */
        .vera-siri--listening .vs-ripple-3 { animation: vs-third-ring 2.6s ease-out .4s infinite; }
        /* SPEAKING extra: inner blobs quicken with the voice */
        .vera-siri--speaking .vs-magenta { animation-duration: 3.4s; }
        .vera-siri--speaking .vs-teal    { animation-duration: 3s; }

        @media (prefers-reduced-motion: reduce) {
          .vera-siri--on .vs-body, .vera-siri--on .vs-bloom, .vera-siri--on .vs-core,
          .vera-siri--on .vs-blob, .vera-siri--on .vs-iris, .vera-siri--on .vs-grain,
          .vs-ripple, .vs-spark { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
