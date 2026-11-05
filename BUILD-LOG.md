# Build log — sinhaankur.com

A plain-English record of what gets built, why, and where to see it. Newest at
the top. Not git commit messages — this is the human-readable story, so you
always know what changed without reading code or diffs.

**Where to see things**
- Live site: https://www.sinhaankur.com
- Code diffs (every change, line by line): https://github.com/sinhaankur/portfolio-2026/commits/main
- Deploy status: GitHub → Actions → "Deploy to GitHub Pages"

---

## 2026-11-05 — Clean-designer declutter, Satellite Engine, φ type, smarter copilot

A session that trims the noise and tightens the proportions. All committed and
pushed.

### 1. Home hero — one line, not a paragraph
**What:** The first thing you read was a dense 4-sentence paragraph that buried
the galaxy. Cut all three verbosity tiers to one confident, breathing line —
the galaxy itself is the proof, so the copy gets out of its way.
**Why:** the north star is "clean designer, not AI slop". A wall of text reads
as templated; a single line reads as intentional.
**Also:** the meteor-shower observing guide (a dense "how to spot it / camera
tips" block) now shows ONLY in the interactive explorer, not on the passive
landing hero.

### 2. Satellite Engine — overlapping panels fixed + the copilot floats
**What:** On `/lab/celestial` the satellite-detail panel and the search cluster
were fighting for the same top-right corner and literally overlapping. The
detail panel now drops below the search with a capped height so it never runs
into the search or the timeline. The AI copilot used to be a near-opaque slab
covering the right third of the scene (it read as empty darkness when sparse);
it now floats as an inset, blurred card so the universe shows *through* it.
**Also:** the live swarm count ("18,744 tracked objects") now counts up.

### 3. Named it "The Satellite Engine"
**What:** promoted the page title / social card / structured data to **The
Satellite Engine** (matching the Universe Engine family), keeping the old name
as an alias so nothing breaks in search.

### 4. The AI copilot picks a model your machine can actually run
**What you felt:** "the AI doesn't understand me." **Why:** it always forced the
tiniest 0.5B model — too small to follow instructions. Now a strong machine
(lots of RAM + cores + a real GPU) automatically gets the 1.5B "best" model (a
different league of answer quality); a weak/unknown device still gets the fast
one. Your explicit pick always wins. Still fully on-device, no key.

### 5. /llm — Claude-style editorial polish
Airier spacing, a confident serif headline, body set to a readable ~62-character
measure, links that underline on hover with a visible focus ring, and cards that
react softly (warming hairline + gentle lift) instead of sitting flat.

### 6. φ as the whole-site type scale
**What:** re-pointed Tailwind's entire `text-*` ramp onto the golden ladder —
so every heading across the site inherits φ proportion without touching a single
component. Body sizes stay close to today's (no reflow surprises in dense
chrome); the headings snap onto true φ powers, where the ratio actually reads.
Fully reversible (delete one CSS block).

### 7. Roadmap
Added the "living point-cloud portrait, from one photo" idea to `/upcoming`
(on-device depth → a breathing particle field).

### Hygiene
lint 0 errors, build verified (full static export), full-route smoke test clean.
Parked (by choice, not committed): the φ overlay icon component (needs a real-φ
page to mount on), an ISS teardown experiment, a black-hole prototype.

---

## 2026-11-03 — Galaxy, HD view, real stars, declutter

A session focused on the home hero galaxy and the Universe Engine's quality.
All of it is **live** on www.sinhaankur.com.

### 1. Fixed the galaxy "slop"
**What:** The Milky Way had an ugly asymmetric streak ("tail") off one side, a
blown-white core in dark mode, and a black ink-blot core in light mode.
**Why it looked bad:** faraway halo star-clusters were too big/bright and randomly
clumped into the streak; the core glow was over-cranked; the light-mode ink was
nearly solid black at the centre.
**Fix:** dimmed + shrank the halo clusters (streak gone), toned the core to a soft
amber glow in dark / a soft grey in light. The pink nebula knots now follow the
real spiral instead of lumping off it.
**See it:** the hero galaxy, both light and dark themes. Commit `92337203`.

### 2. Restored the HD view — the big one
**What you felt:** "The Sun was beautiful a few weeks ago; now it all looks bad."
**Why:** Two regressions from recent "performance" changes had quietly downgraded
quality on strong machines:
  - Your M1 Max was being mis-classified as "high" tier instead of "ultra"
    (a Safari quirk — it doesn't report memory, so the score fell one short).
    "high" tier gets NO supersampling (SSAA) on close-ups → the Sun/planets
    looked soft and aliased.
  - 16K super-clear textures had been made manual-only, so even ultra machines
    defaulted to 8K.
**Fix:** a top-end GPU (M-Max, RTX 30+) now reliably reaches "ultra", and 16K
auto-loads again when you fly in close. **You confirmed the overlay now says
"ultra" and the HD look is back.**
**See it:** add `?perf` to the URL to see your tier; fly in on the Sun — it's
crisp again. Commit `80a412f7`.

### 3. Real stars for the Milky Way (119,625 of them)
**What:** The engine's resolved stars were procedurally *invented* positions. Now
every one is a **real catalogued star** from the HYG v4.1 astronomical database —
true position (RA/Dec), true colour (from its measured B-V colour index →
temperature → blackbody colour), true brightness (apparent magnitude).
**How it ships:** a compact 1.1 MB binary (`/data/deep-stars.bin`) that loads a
beat after the page appears, so the hero stays fast. Capped by device (ultra gets
all 119k; a phone gets a bright subset).
**Why it matters:** the engine's north star is "real over invented" — this applies
it to the galaxy itself. The luminous band forms naturally because real stars
genuinely crowd the galactic plane.
**See it:** live now; the real stars enrich the sky-shell views. Commits
`b510bbfe` (the reference spec) + `ed36054a` (the stars).

### 4. Decluttered the home hero
**What:** The first screen had THREE stacked "you can interact" hint pills fighting
for the same strip, burying the galaxy. Cut to one. Also removed dead scratch
(`phi-demo` route, an abandoned spacecraft-anatomy experiment).
**See it:** the hero centre is calmer now. Commit `76b1ccd2`.

### 5. Hygiene
Ran a full check: lint 0 errors, TypeScript 0 errors, build verified, no dead
links, no accidental data bloat committed. Caught + fixed one deploy landmine —
a component (`animated-number`) that was used but not tracked, which would have
broken a future deploy. Commit `a6b18045`.

### Not done (parked, by choice)
- The home hero stays the "outside spiral" view (your call); the real stars shine
  in the inside/sky views.
- A few routes + the galaxy's top-right info panel are still candidates for a
  future declutter pass.
