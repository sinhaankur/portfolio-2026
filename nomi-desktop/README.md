# Nomi Desktop Agent

Nomi is a Rust-first personal desktop agent built with Tauri v2.

## Why this stack

- Rust core for deterministic command logic and safer memory model
- Thin React shell for UI composition and fast iteration
- Tauri packaging for macOS, Linux, and Windows from one codebase

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
