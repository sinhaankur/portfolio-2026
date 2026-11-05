# Animation skills — sinhaankur.com

The "20 animation styles you can ask for" list, checked against OUR actual
codebase. Two columns: what we **already use** (with proof) and what's a
**future skill** to reach for on the next thing.

**Our animation stack:** `framer-motion` (UI motion), `three` + `@react-three/fiber`
(WebGL/3D), hand-written GLSL shaders. No gsap/lottie — framer-motion + R3F
cover it. (See `reference_animejs_evaluated` memory: anime.js deferred.)

---

## ✅ Already in use (14 of 20) — proven in the codebase

| Style | Where we use it |
|---|---|
| **Liquid morph** | big-bang scene, story-experience (shader blends / morphing forms) |
| **ASCII art** | universe-engine, optical-flow pattern-render |
| **Holographic foil** | vera-mark, satellite-field, vera-tet (iridescent materials) |
| **Neon glow / bloom** | hero, lab, site-ai (glow + box-shadow + WebGL bloom) |
| **Dithering** | constellation-figures (ordered dither in the ink galaxy) |
| **Clay 3D** | sun-timeline (soft 3D forms) |
| **Halftone dots** | sky-dome |
| **Kinetic typography** | animated-number (count-up), hero text reveals |
| **Pixel art** | shaders.ts (pixelation effects) |
| **Particle swarm** | hero galaxy (119k-star THREE.Points field — the real one) |
| **Risograph print** | small-bodies (grain/print texture) |
| **Glitch effect** | sky-experience, orbit-ring (rgb-split / chromatic) |
| **Topographic lines** | lab, terrain-hud (contour lines on real DEMs) |
| **Glassmorphism** | hero, navbar (backdrop-blur panels) |
| **Flow fields** | vera-brain net-field (vector-field motion) |
| **Ray-marched fractals** | universe-engine, shaders.ts (black-hole geodesic march) |

*(That's actually 16 — the galaxy, engine, and Vera work use a LOT of these.)*

---

## ⬜ Future skills — not used yet, worth keeping in the kit

| Style | Why reach for it / where it'd fit |
|---|---|
| **Bauhaus shapes** | bold geometric primary-colour compositions — good for a playful section header or the games index. Pure CSS/SVG, cheap. |
| **Paper cutout** | layered soft-shadow depth (like the Jugnu teardown vibe). Nice for a story/writing page or a product case study. SVG + drop-shadow. |
| **Vaporwave / synthwave grid** | the retro perspective neon grid. Niche — only if a page wants an 80s/retro mood (maybe a game landing). Easy in CSS or a small shader. |
| **Metaballs** | gooey merging blobs (the `smin` SDF blend). We *almost* have this via the SDF shader work — a true metaball field would suit a Vera/organic visual. R3F fragment shader. |

---

## How to "ask for" one (the mental model)

Each of these is ONE focused technique. On the next page/section, pick the mood,
name the technique, and it's a small self-contained add — not a rebuild. The ones
we already use have reference implementations right here in the repo to copy from.

**Quick-reach recipes we own:**
- Particle swarm → copy the pattern in `deep-star-field.tsx` / `milky-way.tsx`
- Glassmorphism → `backdrop-blur-sm bg-background/55` (see hero/navbar)
- Kinetic number → `<AnimatedNumber value={...} />` (animated-number.tsx)
- Ray-march → the shader pattern in `shaders.ts`
- Scroll reveal / parallax → framer-motion (the house ease; see the framer-motion skill)
