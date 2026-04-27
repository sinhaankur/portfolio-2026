# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Hand-written **static portfolio site**, deployed at `https://sinhaankur-portfolio.netlify.app/`. No build step, no test suite, no package manager — plain HTML/CSS/JS.

## Local development
The static site is plain files — open them in a browser or serve the root over HTTP:

```bash
python3 -m http.server 8080
```

`.vscode/launch.json` is preconfigured to launch Chrome against `http://localhost:8080`. There is no build, no lint, no test. Edits go live on the next reload.

Deployment is via Netlify pointed at the repo root; there is no `netlify.toml`, so Netlify just publishes the root directory as-is.

## Page layout and navigation
- `index.html` — landing page. Loads jQuery + Materialize, embeds the chat-bot widget, and links into the case studies.
- `projects/*.html` — case-study pages (Oracle, Deloitte, Snowtint, Rage, etc.). Each one links back to `../index.html` and uses `../css/` and `../img/` paths — keep relative paths consistent when adding new project pages.
- `booking.html`, `technical-insights.html`, `tools-experiments.html` — top-level standalone pages. These are newer and layer **Material Design 3 CSS variables** (inline `<style>` with `--md-sys-color-*` tokens) on top of the older Materialize stylesheet. The older pages use only Materialize. Match the style of whichever neighbour you're editing rather than mixing them.
- `webgames/` — the games subsection (Gamelist + individual games like `emojittetris.html`) follows a **separate "retro / neobrutalism" design system** built around `webgames/css/retro.css`. Tokens come from the `Retro UI Project/` reference (DM Sans + Space Mono fonts, 0px radius, hard 4×4 black offset shadows, deep red / bright yellow / deep blue on warm off-white). New game pages should `<link>` retro.css and lean on its component classes (`.retro-card`, `.retro-btn`, `.retro-btn--primary`, `.retro-icon-btn`, `.retro-panel`, `.retro-eyebrow`). Light/dark via `data-theme` on `<html>`. Do **not** try to unify these pages with the Materialize/Material Design 3 styling used by the rest of the site — they are intentionally a different visual language.
- `404.html` — Netlify error page.
- `_archive/` — old pages no longer linked. Don't restore from here without checking with the user.

## The "Ankur AI" chat-bot widget on the home page
The fake Messenger bot inside the iPhone mockup on `index.html` is **data-driven**. To change what the bot says or which quick replies appear, edit **`js/bot-config.js`** (the `BOT_CONFIG.conversation` array of step objects: `start`, `typingIndicator`, `message`, `template`, `quickReplies`, `customMessage`). `js/bot.js` is the engine that walks that array and shouldn't normally need changes.

The `customMessage` handler `handleBookingMentorship` in `bot.js` deep-links into `booking.html` by building a URL with `?name=&email=&date=&time=` (booking) or `?name=&email=&topic=&sessionType=mentoring` (mentorship). If you change parameter names on either side, change them on both — `booking.html`'s `prefillBookingFormFromURL()` reads these params and auto-submits when all required fields are present.

## Booking form (EmailJS)
`booking.html` posts via the EmailJS browser SDK (no backend). Credentials are inline at the top of the script block:

- `EMAILJS_SERVICE_ID = 'service_dimyux6'`
- `EMAILJS_TEMPLATE_ID = 'template_wlojvia'`
- `EMAILJS_PUBLIC_KEY = 'rBWTRCahNRhuNW_GE'` — public/browser key, intentionally committed; **do not** treat this as a leaked secret.

Submissions are sent to `sinhaankur827@gmail.com`. To change the recipient, update `to_email` inside the `formData` object (not the EmailJS template).

## Asset and library conventions
- `css/materialize.css` + `js/materialize.js` are vendored (both minified and unminified copies exist). Don't upgrade Materialize casually — the older project pages depend on its specific class names (`tabs`, `carousel`, `side-nav`, `modal`, `button-collapse`, `chip`, `card-hover`, `responsive-img`).
- `js/animations.js` is an **ES module** that imports **Motion One** from `cdn.jsdelivr.net` (pinned to `motion@11.11.17`). It drives the entrance fade-ups on the home page. `index.html` has a small inline pre-hide style gated by a `.js-animate` class on `<html>`, plus a 2.5s fallback that removes the class if Motion never initializes (e.g. the CDN is blocked). Respects `prefers-reduced-motion`. Only `index.html` uses it; project pages don't load it.
- `js/init.js` wires up Materialize plugins (`sideNav`, `modal`, `tabs`, `carousel`) and the `.video` hover-to-play behaviour on case-study pages — `img/IMG_*.MP4` files are paired with same-named `.JPG` poster frames and played via the `.video` class.
- jQuery 2.1.1 is loaded from a CDN; everything depends on it being present before `bot.js`/`init.js`.
- `index.html` has a `#language-dropdown` `<select>` but **no translation logic is implemented** anywhere. Don't assume i18n exists.

## Things to avoid

- Don't introduce a build step, package manager, or framework — the site is intentionally dependency-free server-side.
- Don't refactor `js/materialize.js` or remove jQuery — too many pages depend on the exact API.
- The `_archive/`, `_resources/`, and `Mocks/` directories hold reference material (PDFs, old pages, sketch plugin XML); don't link to them from live pages.
