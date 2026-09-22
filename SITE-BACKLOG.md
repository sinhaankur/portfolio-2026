# Site backlog — sinhaankur.com

Working queue for the **site-builder** agent (`.claude/agents/site-builder.md`,
launched via `/site`). Top unchecked item in the current section is next.

Rules of the road (full contract in the agent file):

- Real over fake; substance over chrome; mobile-first; terse copy in Ankur's
  voice. Don't invent case studies / `/works` entries / narrative prose — those
  are Ankur's to author.
- Verify: `pnpm build` green + `pnpm lint` 0 errors + `pnpm test:site` for any
  engine / hero / full-screen change. Engine *feel* and cinematic timing need
  Ankur at the keyboard — flag, don't claim.
- New route = update `app/sitemap.ts` + `scripts/smoke-site.mjs` ROUTES +
  `CLAUDE.md` site map (all three).
- Push only to `origin`, no `Co-Authored-By`. Pushing publishes to
  `www.sinhaankur.com` — build + smoke green first.

---

## Now (verify / close open threads)

- [ ] **UX-audit remainders (small):** consent banner → compact corner toast
      on engine routes (site-wide component, wants Ankur's eye on consent UX);
      phone notable-labels collide (show only ISS below 640px).
- [x] **Game (Helion Drift) general-user audit — DONE 2026-09-15, passes.**
      Walked launcher → launch → flight headless: LAUNCH button prominent,
      rotating hint bar teaches W/S/A/D, Shift, Q/E, R, AND "C auto-cruise ·
      Tab shifts to Jet" (game-canvas.tsx:3408) + H help; live speed readout;
      Back to Universe chip; no console errors. Only finding = the shared
      consent-banner overlap (tracked above). No game changes needed.
- [ ] **Neural rendering — scope DONE, pilot awaits Ankur's pick.** See
      `NEURAL-RENDERING-SCOPE.md` (untracked, repo-local): 3DGS in WebGL2 is
      the fit; recommended pilot = Splat-ISS Ultra tier from our own Cycles
      renders; 3 open questions at the bottom are Ankur's.

These are open items already flagged in memory. Most need Ankur's eye at the
end (GPU/feel), so: do the buildable part, verify what's headless-verifiable,
then hand the look/feel check to Ankur.

- [ ] **Date-slider freeze guard.** Code-verified (clampToSpaceAge + finitePos
      still wrap every propagate call after the picker changes) — but the live
      scrub to far past/future on `/lab/celestial` still wants a real-GPU pass.
      `project_celestial_testing_fixes_2026_08`.
- [ ] **Drone loudness pass.** `lib/space-drone.ts` loudness still "needs
      Ankur's ear" per `project_site_music`. Surface the current gain, propose a
      level, hand to Ankur to confirm — don't just change it blind.
- [ ] **Waves engine — is it pushed?** `project_waves_engine` notes the /waves
      + /lab/wave work was committed (2d180ad3) but NOT pushed. Confirm current
      state vs origin; if it's genuinely ready and Ankur wants it live, that's a
      push gate — ask first.

## Depth — the engines (Ankur, 2026-09-14: "Universe engine needs more depth and so does Satellite engine")

The north star is `components/universe-engine/ENGINE-STANDARDS.md`: real over
invented, reverence over spectacle, be EXACT from known data (NASA/JPL/ESA/HYG/
SIMBAD), label inference as inference. "Depth" = more real, more legible, not more
chrome. These are look/feel gates — build the real-data part, verify no-crash +
screenshot, then hand to Ankur to judge the feel.

Universe engine (`/` hero + engines sharing `scene.tsx`):

- [ ] **Propose a depth plan first.** Before building, write a short ranked list
      of the highest-leverage depth additions (candidates: more real bodies from
      `astronomy.ts`, deeper star data / spectral truth, better nebula/galaxy
      sub-type fidelity, honest scale legibility, richer InfoPanel real-data).
      Ankur picks; don't build the whole list blind. `project_universe_engine_real_bodies`.
- [ ] Each depth item: source the real data, cite it (third-party sources always
      credited; Ankur's own work stays his), render it, and label any inference.

Satellite engine (`/lab/celestial`):

- [ ] **Propose a depth plan first** (candidates: more of the real catalogue
      surfaced legibly, deeper per-satellite real readouts, more constellation/
      debris families, better ground→orbit progressive detail, mission-analysis
      depth per `project_mission_analysis_oss`). Ankur picks.
- [ ] Keep the truth floor: real TLE/SGP4, NaN-guarded far-past scrubs, honest
      sizes — don't trade correctness for spectacle.

## Polish (buildable, then Ankur looks)

- [ ] **HUD spacing audit sweep.** Walk the engine overlays against the spacing
      system (`project_engine_hud_spacing`): edge gutter `left-4 md:left-6` /
      `right-4 md:right-6` everywhere (no stray `left-8/12`), bottom ladder
      correct, InfoPanel scrolls instead of bleeding. Verify by focusing a body
      with long text (e.g. Pluto) at 1280×390.
- [ ] **Cinematic tour captions collision check.** Confirm home-hero journey
      captions stay lower-third (minimalControls) and never collide with the
      DESIGN × ENGINEERING × AI headline (`project_cinematic_tour_captions`).
- [ ] **Mobile pass on newest engine work.** Re-verify `/lab/celestial` and
      `/waves` at ≤640px: tap-vs-scroll correct, no fixed-element overlap,
      touch targets ≥44px (`project_celestial_mobile`).

## Health (keep the baseline)

- [ ] **Asset size budget.** Run `pnpm check:assets`; if anything's over budget,
      report it (don't touch the deliberately-heavy paths —
      `project_engine_perf_pass_2026_08`).
- [ ] **Perf pass.** Run `pnpm test:perf` and report the tier the site converges
      to on this machine; flag regressions, not the known-heavy truths.

## Icebox (needs Ankur to author / decide first)

- DNA legacy note copy — `components/dna/dna-legacy-note.tsx` has a
  `TODO(Ankur)` placeholder. Author-driven; leave it for Ankur.
- Any new case study, `/works` entry, or long-form prose — Ankur authors.

---

## Shipped

- [x] **Satellite click-to-select regression FIXED** — e43f467b. The DOM
      nearest-dot picker (dc36a079) ran unguarded on every wrapper click: orbit
      drags selected random satellites on mouseup, HUD clicks double-fired, and
      it picked filter-hidden + Earth-occluded dots. Now canvas-target-only +
      6px drag guard + stopPropagation on real picks; isDotVisible mirrors the
      shader's full vHidden; Earth-sphere occlusion test added. Verified:
      build/lint/smoke green + headless behavioral (drag selects nothing, click
      near shell selects; 18,902-sat swarm). 16K path also verified: R2 CDN
      serving earth/moon-16k.webp with prod CORS, env wired in deploy.yml.
