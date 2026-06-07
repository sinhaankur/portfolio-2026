# Nomi Ecosystem Blueprint (Home + Laptop + TV)

This document defines a top-tier deployment ecosystem for Nomi so the personal agent works seamlessly across home systems, laptops, and Smart TV surfaces.

## Product Goal

- One personal agent identity (Nomi)
- Local-first reasoning with cloud-optional fallback
- Device-to-device continuity with secure sync
- Ambient surfaces: desktop app, mobile companion, TV display endpoints

## Recommended Core Repositories

### 1) Desktop product shell (already selected)
- Repo: `tauri-apps/tauri`
- Why: Rust security model, native performance, small bundle size, first-class macOS/Linux/Windows packaging.

### 2) Local model runtime
- Repo: `ollama/ollama`
- Why: local model serving standard for personal systems, simple API, broad model ecosystem.

### 3) Home automation and Smart TV bridge
- Repo: `home-assistant/core`
- Why: strongest open ecosystem for home devices and automations; can trigger TV notifications/cards/routines.

### 4) Zero-trust connectivity across home + laptop
- Repo: `tailscale/tailscale`
- Why: secure encrypted mesh networking across devices without exposing public ports.

### 5) Event bus for multi-device orchestration
- Repo: `nats-io/nats-server`
- Why: lightweight, high-reliability pub/sub and request/reply for agent events and device coordination.

### 6) Optional web operator console
- Repo: `open-webui/open-webui`
- Why: fast local UI for model operations/testing if you want a browser control surface.

## Reference Architecture

1. Nomi Desktop (Tauri, Rust core) is the control brain for personal workflows.
2. Ollama runs locally on primary machine for inference.
3. NATS provides event fabric for multi-device state and command fan-out.
4. Tailscale secures private connectivity to laptop and home nodes.
5. Home Assistant subscribes to NATS or HTTP hooks from Nomi.
6. Smart TV receives state via Home Assistant dashboard/card or cast endpoint.

## Installation Sequence (Home System)

1. Install Nomi desktop app.
2. Install Ollama and pull baseline model set.
3. Install Tailscale on home machine + laptop; verify private mesh connectivity.
4. Install NATS server on home primary node.
5. Install Home Assistant (separate home node or VM).
6. Connect Nomi -> NATS -> Home Assistant webhooks/events.
7. Configure Smart TV entity in Home Assistant (Android TV / Cast / vendor integration).

## Connectivity Modes

### Local-only mode (default)
- No external APIs.
- All prompts and memory remain on local network.

### Hybrid mode
- Local first with selective cloud fallback for heavy tasks.
- Strict policy gate required for cloud egress.

## Smart TV Integration Strategy

1. Dashboard mode:
- Nomi summary card on TV (focus mode, reminders, next action).

2. Notification mode:
- Time-bound prompts routed as TV notifications (quiet hours policy aware).

3. Ambient mode:
- Universe scene as passive visualization with current daily state.

## Security Baseline

- Device identity bound to owner account and machine fingerprint.
- Signed local IPC for desktop commands.
- Zero-trust network via Tailscale.
- Secrets in OS keychain only.
- Audit trail for every cross-device command.

## Delivery Plan

### Phase 1 (now)
- Desktop shell + Rust agent commands + universe UX layer.

### Phase 2
- Add local memory and schedule connectors.
- Add NATS event bridge.

### Phase 3
- Home Assistant actions + TV display card.
- Cross-device continuity (laptop/home desktop).

### Phase 4
- Production packaging and signed release pipeline.
- Beta cohort + telemetry-driven hardening.
