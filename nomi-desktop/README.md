# Nomi Desktop Agent

Nomi is a Rust-first personal desktop agent built with Tauri v2.

## Why this stack

- Rust core for deterministic command logic and safer memory model
- Thin React shell for UI composition and fast iteration
- Tauri packaging for macOS, Linux, and Windows from one codebase

## UX direction

- Website-inspired interaction language (hero typography, glass HUD panels, cosmic atmosphere)
- Dedicated universe-style 3D backdrop tuned for desktop performance in Tauri
- Rust command layer for deterministic agent responses

## Quick start

```bash
pnpm install
pnpm icons
pnpm tauri dev
```

## Build checks

```bash
pnpm check:desktop
```

## Packaging

```bash
pnpm tauri build
```

The generated installers and bundles are emitted under `src-tauri/target/release/bundle`.

## Branding assets

- Source logo for app UI: `public/nomi-mark.svg`
- Source logo for package icons: `src-tauri/icons/nomi-logo.svg`

Regenerate all platform icons from the source mark:

```bash
pnpm icons
```

This refreshes `.icns` (macOS), `.ico` (Windows), and `.png` bundle sizes (Linux and app stores).

## Ecosystem blueprint

For home-system + laptop + Smart TV continuity and top-tier repo selection, see:

- `docs/ecosystem-system-blueprint.md`

## Unhosted reference integration

Nomi now includes a Rust LLM command path that targets OpenAI-compatible APIs.
This allows direct use of an Unhosted gateway endpoint in the desktop UI.

In the app:

1. Open the LLM Core panel.
2. Paste your Unhosted endpoint URL (OpenAI-compatible path).
3. Set model + API key.
4. Run a personal agent task.

You can also switch endpoint to local Ollama or LM Studio for local-only mode.
