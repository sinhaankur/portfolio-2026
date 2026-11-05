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

### 8. Follow-up: fixed a phone overflow on /math
**What:** After the φ type work I ran a headless overflow audit (every text-heavy
page, desktop + phone widths). It caught one real bug: the `/math` hero heading
"Mathematics, made visible." at the big golden display size was ~12px wider than
a phone screen and pushed a sideways scroll. (Pre-existing — from the original
φ /math layout, not the new ramp.) Fixed with a `clamp()` so the heading keeps
its golden size on wide screens and scales down to fit the narrowest phone.
Re-audited: no horizontal overflow on any page, desktop or phone.

### 9. More hero declutter: dropped the idle "Hover any body for data" hint
**What:** On the passive landing hero, a small prompt read "Hover any body for
data" — but on the landing you *scroll or click to enter* explore mode, you
don't hover. So the hint was misleading noise on the clean first view (and it
carried a redundant "© Ankur Sinha" credit the hero already shows). Now it only
appears once you're actually exploring; real hover data still shows then.
**Verified:** headless check confirms the hint is gone on the passive hero and
present in explore mode; your name still reads on the hero. Full-route smoke
clean.

### 10. /rag now matches /llm (the two explainers are companions)
**What:** The "What is a RAG system?" page still used the old flat styling while
its sibling /llm page had already been given the Claude-style editorial look.
Brought /rag up to match exactly — airier header, confident serif headline, a
readable lede, softly-reacting cards, roomier rhythm, links that underline on
hover with a focus ring — and added the reciprocal "companion to how a language
model works" link so the two pages point at each other.
**Verified:** /rag and /llm now render identical chrome (headline 68px desktop /
44px phone, card radius 16px), no overflow at either width, full-route smoke
clean.

### 11. Engine fidelity — the interstellar probes, true as of today
**What:** The Universe / Satellite Engine places Voyager 1 & 2, New Horizons and
the rest from real orbital data. The deep-space probes' distances had gone stale
(frozen at early-2025), so I refreshed them to **November 2026** from NASA/JPL:
Voyager 1 is now at ~173 AU (25.9 billion km — it just crossed a full **light-day**
out, so its radio signal takes a whole day to reach us), Voyager 2 at ~145 AU,
New Horizons at ~66 AU. Their position is a pure function of time at a known
constant speed, so this is simply telling the truth, not reinterpreting it.
**Also:** updated the AI copilot's knowledge so it agrees with the scene — ask it
about Voyager 1 and it now tells the one-light-day story (true right now).
**See it:** fly to the probes in the engine, or ask the ✦ copilot about Voyager.

### Hygiene
lint 0 errors, build verified (full static export), full-route smoke test clean,
headless overflow audit clean (desktop + mobile).
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
