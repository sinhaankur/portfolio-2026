# Universe Engine — fidelity audit (research · gaps · fix plan)

> Started 2026-10-26. A per-sub-engine audit against the five ENGINE-STANDARDS
> pillars (Truth · Performance · Presentation · Robustness · Accessibility),
> with the **real technique + data** each domain *should* use (researched),
> what we **currently do**, the **pixel-level gaps**, and a **ranked fix plan**.
>
> North star (from ENGINE-STANDARDS): restore the real sky, faithfully +
> understandably; reverence over spectacle; real over invented; pure-GLSL.

## Sub-engines (from ENGINE-ARCHITECTURE)
1. Planet engine — planets + moons (textured globes, rings, atmospheres)
2. Star engine — 8,920 HYG bright stars + 358 named + constellations
3. Black-hole engine — lensed disk + shadow from real mass/spin
4. Nebula engine — raymarched volumetric gas + baked sprites
5. Galaxy engine — external galaxies (M31…) as 3D particle discs
6. Milky Way — our galaxy (4 arms + bulge + bar + HII + halo)
   (+ Sub-system / satellites — audited in a later pass)

Status legend: 🔴 big gap · 🟡 partial · 🟢 solid

---

## 1. Planet engine 🟢 (solid; one real fidelity gap)

**Real technique (researched):** photoreal browser planets layer NASA textures
in a multi-texture fragment shader — Blue Marble (day albedo) + Black Marble
(night city lights) + bathymetry/topo bump (dFdx/dFdy screen-space normals) +
a cloud layer + an atmosphere. Atmosphere fidelity ladder: Fresnel rim glow →
**O'Neil analytic Rayleigh/Mie** (GPU Gems 2) → **Bruneton precomputed
scattering** (LUTs, gold standard). Sources below.

**What we do (good):** real J2000 orbital elements per planet (`astronomy.ts`);
sRGB surface texture with 4K/8K/16K tiers + KTX2 GPU-compressed; **Black Marble
night texture** + day/night terminator shader (sun dir updated each frame,
per-body `terminatorSoftness`); **live near-real-time cloud composite**
(EUMETSAT via matteason, 2048×1024) + drifting band shells for gas giants;
MOLA/LOLA **displacement relief** (Mars/Moon `elevationUrl`+`elevationScale`);
aurora shell; Saturn's **real ring band structure (C/B/Cassini/A/F) + planet
shadow cast on rings** + ring shadow on planet. This is genuinely strong.

**Pixel-level gaps (ranked):**
1. 🟡 **Atmosphere is NOT physical scattering** — it's terminator-softness + a
   rim/limb glow, not Rayleigh/Mie. Earth's limb lacks the true blue
   forward-scatter halo + the orange sunset band at the terminator. HIGHEST
   visible-fidelity win: add O'Neil analytic scattering (one extra shell shader,
   ~GPU-cheap, no LUT) for Earth (+ Mars thin-atmo variant). Bruneton is overkill
   for this scale.
2. 🟡 **No specular ocean highlight** — Earth's oceans don't catch a sun glint
   (a signature Blue-Marble-from-space cue). Cheap: a specular term masked by the
   water/ocean channel.
3. 🟡 **Bump from topo only on Mars/Moon** (displacement), not screen-space
   dFdx/dFdy normals on Earth's terrain — Earth mountains don't catch grazing
   light at the terminator. Cheap per the research's dFdx trick.
4. 🟢 Textures: Earth 8K/16K ✓, Mars 4K ✓, but **Jupiter 117KB / Saturn 32KB /
   Venus 164KB are low-res** — gas giants read soft up close. Source higher-res
   Cassini/Juno maps (check texture budget).

**Fix plan:** (1) O'Neil atmosphere shell for Earth → biggest bang; (2) ocean
specular; (3) gas-giant texture upres. All honor pure-GLSL (no meshes).

Sources: [O'Neil GPU Gems 2 / THRASTRO shaders](https://github.com/THRASTRO/thrastro-shaders),
[Bruneton precomputed (Three.js port)](https://github.com/jeantimex/precomputed_atmospheric_scattering),
[@takram/three-atmosphere (R3F)](https://www.npmjs.com/package/@takram/three-atmosphere),
[realistic Earth shader walkthrough](https://sangillee.com/2024-06-07-create-realistic-earth-with-shaders/),
[NASA Blue/Black Marble dataset](https://fpsoftlab.com/reference/blue-marble-textures-and-credits/).

---

## 2. Star engine 🟢 (textbook-correct; near best-in-class)

**Real technique (researched):** real star maps use the HYG catalog (Hipparcos
distances + Yale Bright Star + Gliese) at true RA/Dec; colour via **B−V → T_eff
(Ballesteros 2012) → Planckian blackbody → sRGB**; size/brightness from apparent
magnitude (ideally flux-preserving `m = M + 5log₁₀(d) − 5`); point sprites with
core+halo, additive blend; diffraction spikes on the brightest only. CAUTION from
the research: for a *truthful* catalog map, avoid synthetic cinematic twinkle +
exaggerated glare (camera-frame spikes can flicker).

**What we do:** HYG v3.7 (public domain), **8,920 real stars** at true RA/Dec,
sized by apparent magnitude, coloured via the **exact Ballesteros formula**
(`bvToTemp` = `4600·(1/(0.92t+1.7)+1/(0.92t+0.62))`) → Planckian `tempToRgb` →
RGB — i.e. "a star's colour IS its temperature," done right. **Real proper
motion** baked from HYG pmra/pmdec at J2000, advanced by sim time. Diffraction
spikes gated to the brightest (vBrightness > 0.65). **NearbyStars3D** places named
stars at their TRUE heliocentric depth from real parallax distance (ly→scene
units) — so pulling the camera out past the planets parallaxes real stars. 358
named stars fully inspectable; every un-named star pickable with honest data.

**Pixel-level gaps (ranked):**
1. 🟡 **Twinkle is synthetic** (low-amp sine, `bright-star-field.tsx` ~L129).
   Defensible (it's gentle + atmospheric), but per the "truthful map" caution a
   toggle to disable it for the honest/teaching view would be more correct.
2. 🟡 **Size→brightness is cosmetic, not flux-preserving** — a mag-pair (m vs
   m+2.5) won't integrate to the true ~10:1 flux ratio. Only matters if we ever
   claim photometric accuracy; for presentation it's fine.
3. 🟢 Colour, positions, proper motion, depth: all real + correct. Leave alone.

**Fix plan:** low priority — this engine is already right. Optional: a "no
twinkle / honest" toggle tied to the teaching mode. Don't gold-plate it.

Sources: [HYG catalog star maps (webstar)](https://github.com/KarlSmith400/webstar),
[Ballesteros B−V→T + blackbody pipeline (Aether)](https://github.com/Hussaincodes01/Aether-Space-Program),
[flux-preserving PSF vs cosmetic sizing (cosmolabe #218)](https://github.com/AaronPlave/cosmolabe/issues/218),
[diffraction spikes (Wikipedia)](https://en.wikipedia.org/wiki/Diffraction_spike),
[truthful-map twinkle/spike caution](https://github.com/AaronPlave/cosmolabe/issues/218).

---

## 3. Black-hole engine 🔴 (real physics in the NUMBERS, faked in the PIXELS)

**Real technique (researched):** physically-based browser black holes BACKWARDS
ray-trace per pixel through curved spacetime — null-geodesic raymarching
(Schwarzschild, or Kerr with a Lense-Thirring frame-drag term). The shadow
(image of the photon sphere, critical impact parameter **b_c = 3√3/2·r_s ≈
2.598 r_s**, shadow ⌀ ≈ 5.2 r_s), the **photon ring at √27/2·r_s**, the disk's
far side lensed up-and-over, Doppler **beaming (δ³ boost)** + gravitational
redshift, and lensed background stars all EMERGE from the geometry. The whole
effect fits in **~290 lines of GLSL** (sayed1145) — it's achievable in real time.

**What we do:** real physics drives the GEOMETRY only — `computeBlackHoleProportions`
uses real `schwarzschildRadiusMeters` / `kerrHorizonRadiusMeters(mass,spin)`,
photon ring at 1.5 r_s, ISCO 6 r_s → ~1 r_s interpolated by spin, real masses
(Cygnus X-1 → TON 618). Doppler asymmetry is approximated (brighter approaching
side) without per-pixel beaming. BUT the **lensing is explicitly FAKED** (code
comment L259: "Real lensing is a ray-trace problem; we fake it") — the render is
billboard/ring meshes + `blackhole.glb` (one of the few sanctioned GLB
exceptions), NOT pure GLSL. A GLSL geodesic raymarch WAS trialled 2026-07-17 and
**reverted** (commit 3c54d13e) because it didn't beat the GLB's look yet
(ENGINE-STANDARDS L64).

**Pixel-level gaps (ranked) — this is the biggest fidelity gap of all sub-engines:**
1. 🔴 **No true gravitational lensing.** The signature black-hole image — the
   disk's far side bending OVER and UNDER the shadow, the Einstein-ring warp of
   background stars — isn't physically rendered. This is THE recognisable feature
   and we fake it.
2. 🔴 **Not pure-GLSL** — depends on `blackhole.glb`, against the engine's
   pure-GLSL pillar (sanctioned only "until the shader beats it").
3. 🟡 **Doppler beaming approximated**, not the δ³ relativistic boost; no
   gravitational redshift gradient across the disk.
4. 🟢 The NUMBERS (radii, ISCO, photon ring, masses) are real + correct.

**Fix plan (highest-impact, but hardest):** revisit the reverted geodesic
raymarch using a proven minimal reference (sayed1145 ~290 lines, or
ibra-kdbra's dual Schwarzschild/Kerr). Target: a pure-GLSL shell that beats the
GLB on the lensed-disk + photon-ring + Doppler δ³, retiring blackhole.glb and
satisfying the pure-GLSL pillar. Validate against known constants (b_c = 3√3/2 r_s,
shadow 5.2 r_s). This is a real project, not a tweak — flag for a dedicated pass.

Sources: [glsl-black-hole ~290 lines, Interstellar-style](https://github.com/sayed1145/glsl-black-hole),
[ibra-kdbra dual Schwarzschild/Kerr geodesics](https://github.com/ibra-kdbra/black-hole),
[web-blackhole (conservation-law validated)](https://github.com/theanandprasad/web-blackhole),
[Singularity — explicit physics markers (ISCO/photon ring/shadow)](https://github.com/nikhiltomar2712/blackhole),
[Black Hole Shadows, Photon Rings & Lensing Rings (2019)](https://arxiv.org/pdf/1906.00873),
[interactive thin-disc Schwarzschild (arXiv 1206.4259)](https://arxiv.org/pdf/1206.4259).

---

## 4. Nebula engine 🟢 (real raymarched volume; solid)

**Real technique (researched):** nebulae are emissive VOLUMES — raymarch a 3D
density field (FBM of Perlin+Worley noise), accumulate emission/absorption with
**Beer-Lambert law** (`exp(-density)`), early-exit when opaque, optionally bake
the field to a 3D texture for perf. Render inside a bounding box or full-screen
quad. Real-data tools (iDaVIE) raymarch actual data cubes with a colourmap.

**What we do:** `VolumetricNebula` = "true raymarched 3D gas volume on close
approach" (cloud or ring/shell mode), per-nebula palette in `VOLUMETRIC_NEBULAE`;
Blender-baked sprite for M42's far LOD + `NebulaDetail` cloudlets on hover; soft
halo otherwise. Nebulae sit at **real RA/Dec**, anchored on the same spiral-arm
math as the stars so they **parallax against the star field** for real depth.
FBM value-noise substrate present. Showcase set is the real famous ones (M42,
M16, Carina, M57 ring, M1 Crab, Helix).

**Pixel-level gaps (ranked):** mostly 🟢.
1. 🟡 Verify the raymarch uses **Beer-Lambert absorption** (not just additive
   emission) for self-shadowing depth — the research's key realism cue. If it's
   emission-only, adding `exp(-τ)` absorption gives the gas real internal depth.
2. 🟢 Real positions, per-nebula palettes, LOD hand-off, parallax: all good.

**Fix plan:** low priority — spot-check the absorption term; otherwise leave.

Sources: [nebula shader anatomy (Toni Sagristà)](https://tonisagrista.com/blog/2024/rendering-aurorae-nebulae/),
[volumetric raymarching + Beer's law (Maxime Heckel)](https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/),
[WebGL unit-cube volume rendering (Will Usher)](https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl/),
[iDaVIE real data-cube raymarching](https://arxiv.org/pdf/2603.15490).

---

## 5. Galaxy engine (external galaxies) 🟢 (true 3D discs; solid)

**Real technique (researched):** best external-galaxy renders model the real disc
geometry — tilt to the galaxy's **measured inclination** (M31 = 77°), vertical
Gaussian thickness, 4-arm logarithmic spiral, central bulge, and crucially
**dust lanes that absorb** (extinction → brown lanes in front of the bulge).
Hybrid real+representative stars (brightest real, rest drawn from measured light).

**What we do:** `Galaxy3D` = true 3D particle disc tilted to each galaxy's
**inclination** (arms + bar + bulge + thickness), per-galaxy palette + real
relative `scale` (M31 largest), config in `GALAXY_3D`. Covers the grand-design
spirals (Andromeda, Triangulum, Whirlpool, Sombrero…). **Dust lanes present** +
a nice touch: Andromeda's dust lifts in the **infrared band** (multi-wavelength
awareness). Real RA/Dec + curated facts. Far-LOD falls back to a warm halo.

**Pixel-level gaps (ranked):** mostly 🟢.
1. 🟡 Dust lanes exist but are hover-gated to Andromeda — could extend the
   absorbing-dust model to the other edge-on-ish spirals (Sombrero especially).
2. 🟡 Stars are representative, not the "brightest-real" hybrid (cosmoscope
   does real Hubble-measured brightest stars for M31) — only matters at extreme
   zoom, low priority.
3. 🟢 Inclination, structure, scale, palettes: real + good.

**Fix plan:** low priority — optional Sombrero dust lane; leave the rest.

Sources: [Cosmoscope M31 (77° tilt, real+representative stars)](https://cosmoscope.space/m31),
[Helio965 procedural M31 (differential rotation, absorbing dust)](https://github.com/Helio965/Galaxia_de_Andromeda/pull/1),
[Galaxy Explorer (4-arm log spiral, Gaussian thickness)](https://github.com/Enbidi77/galaxy-explorer),
[GLEN per-Hubble-type GLSL (TheGalaxyDB)](https://thegalaxydb.org/),
[NASA Hubble M31 mosaic (ground truth)](https://science.nasa.gov/image-detail/m31-2/).

---

## 6. Milky Way 🟢 (just improved 2026-10-26, commit 536b8ce8)

**Real technique (researched earlier):** detailed real-data browser galaxies use
Gaia/HYG at 100–250k `THREE.Points`, blackbody colour, distance-attenuated core
bloom (Charlie Hoey Gaia map, HELIOS 119k HYG, ESA Gaia Sky, Google 100,000 Stars).

**What we do (post-fix):** 4 spiral arms + bulge + bar + HII knots + globular
halo, population palettes, dust-haze spine + dark lanes. Density raised to ~95k
points desktop (was ~46k); core bloom now **fades with camera distance** so the
core no longer swallows the view up close.

**Remaining gaps:** 🟡 colour is palette-based, not per-star blackbody from a real
catalog (the arms are procedural, not Gaia points) — a "real stars" upgrade would
be the next step but is a big data-pipeline job. 🟢 density + core now good.

**Fix plan:** eyeball the new density on a real GPU first; the Gaia-point upgrade
is a future project, not a tweak.

Sources: [HELIOS 119k HYG](https://github.com/OskariKaile/Galaxy_Simulation),
[Charlie Hoey Gaia map](https://cdn.charliehoey.com/threejs-demos/gaia_dr1.html),
[Google 100,000 Stars](https://web.dev/100000stars/), [ESA Gaia Sky](https://www.cosmos.esa.int/web/gaia-users/archive/visualisation).

---

## Summary — fidelity ranking + what to fix first

| Sub-engine | Grade | Biggest gap | Effort |
|---|---|---|---|
| Black-hole | 🔴 | **No true geodesic lensing** (faked; uses a GLB) | High (real project) |
| Planet | 🟢 | No physical Rayleigh/Mie atmosphere; no ocean specular | Med (one shader) |
| Milky Way | 🟢 | Procedural arms, not real Gaia stars | High (data pipeline) |
| Nebula | 🟢 | Verify Beer-Lambert absorption | Low (spot-check) |
| Galaxy | 🟢 | Dust lanes limited to Andromeda | Low (optional) |
| Star | 🟢 | Synthetic twinkle; cosmetic (not flux) sizing | Low (leave) |

**Recommended order to actually FIX (impact ÷ effort):**
1. **Planet atmosphere (O'Neil Rayleigh/Mie) + ocean specular** — biggest
   visible-fidelity win for reasonable effort; Earth is the hero body.
2. **Gas-giant texture upres** (Jupiter/Saturn/Venus are low-res) — trivial, high
   payoff up close.
3. **Black-hole geodesic lensing** — the single most impactful *truth* fix, but a
   dedicated project (revisit the reverted raymarch vs. sayed1145 ~290-line ref).
4. Nebula Beer-Lambert spot-check; everything else is already solid — don't
   gold-plate the Star engine (it's textbook-correct).

**Truth note:** the two 🔴/weakest items (black-hole lensing, Milky-Way real
stars) are exactly the ones that "bend the truth for effect" per the standards —
worth a dedicated pass even though they're the hardest.


