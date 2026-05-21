# Ankur Sinha
**Principal UX Designer · Human-AI Interaction · Toronto, ON**

[sinhaankur.com](https://www.sinhaankur.com) · [linkedin.com/in/sinhaankur27](https://linkedin.com/in/sinhaankur27) · [github.com/sinhaankur](https://github.com/sinhaankur) · sinhaankur827@gmail.com

---

## Summary

Engineer-turned-designer, 12+ years shipping enterprise SaaS and AI-assisted product surfaces across banking, supply chain, oil & gas, e-commerce, and cloud database tooling. I design the seam between humans and AI agents — the moment of decision, override, and trust — and ship working code prototypes of those interaction patterns, not just Figma. Currently focused on agentic workflows, calibrated-confidence UX, and design systems that scale across enterprise products.

---

## Selected Work — Agentic & Human-AI Interaction

A connected trilogy of production-quality code prototypes (React 19 / TypeScript / Tailwind v4) exploring three faces of the same problem: **AI claims become trustworthy only when their uncertainty is legible and their basis is checkable.** Each ships with a live demo, full README, and shares a deliberate design vocabulary (calibrated confidence, cross-hatch failure-mode pattern, evidence anchors, per-decision audit object).

### Helm — Real-time oversight of LLM agents
[github.com/sinhaankur/Helm](https://github.com/sinhaankur/Helm) · [Live demo](https://sinhaankur.github.io/Helm/)

Puts the human back in the loop *while* the agent is acting. Every tool call is previewed with intent, target, diff, and cost notice. Designed six load-bearing primitives — `ToolBadge`, `ReversibilityChip` (trivial / reversible / danger / destructive), `ConfidenceTag`, `DiffView`, `ApprovalGate`, `AgentStream` — that resolve the central agentic-UX question: *how does a user guide, refine, confirm, or override an agent in flight without becoming a babysitter?* Reversibility (recovery cost) is the policy axis, not "safety." Auto-allow has a fixed ceiling at reversible — irreversible steps always pause. The diff is part of the gate, not a separate view.

### Sentinel — Embeddable inline oversight layer for AI tools
[github.com/sinhaankur/Human-in-the-Loop](https://github.com/sinhaankur/Human-in-the-Loop) · [Live demo](https://sinhaankur.github.io/Human-in-the-Loop/)

A single oversight layer any AI tool can drop in. Same primitives, same intervention model, same audit shape — whether the host AI is a radiology workstation, a contract review tool, or a fraud case manager. Ships **four ways**: React component library, Chrome extension that overlays on real ChatGPT, VS Code chat participant that wraps Copilot Chat responses, and a Docker demo. Designed the calibrated-confidence vocabulary (Likely / Unsure / Low) that progressive-discloses to exact percentages on hover, the hallucination chip (visually distinct from low confidence — they demand different responses), and a verdict rail that morphs from "Accept all" to "Submit with corrections" the moment any claim is edited, blocking rubber-stamping.

### Recourse — Consumer AI as advocate against institutional loops
[github.com/sinhaankur/Recourse](https://github.com/sinhaankur/Recourse) · [Live demo](https://sinhaankur.github.io/Recourse/)

A document-first workflow (not a chatbot) that helps end users contest insurance denials with statute-anchored claims and a cadence engine that never lets the deadline clock slip. Designed for the non-expert reader: confidence vocabulary flipped from `High/Likely/Unsure/Low` to action verbs (`Settled / You verify / Ask a lawyer`), and every claim anchored to a real statute with operative excerpt, verified-on date, and a plain-language gloss. Demonstrates outcome-driven design — the product's win condition is being *unexhaustible* against an adversarial workflow.

---

## Selected Work — Enterprise SaaS & Workflow Products

### BuildingSync — Multi-tenant property management SaaS
[github.com/BuildingAi-Cloud](https://github.com/BuildingAi-Cloud)

Founder, designer, and full-stack engineer of a three-platform product (Next.js web/admin, native iOS SwiftUI, native Kotlin/Compose Android) on a shared Supabase backend, currently in MVP. Designed for **11 personas** (tenant, resident, BM, FM, concierge, property manager, owner, vendor, guest, admin, cross-cutting) and **5 building-type variants** (rental tower, condo, commercial, mixed-use, student housing) that drive divergent payment, lease, and feature surfaces. Architected an OpenAPI-contract layer so generated clients keep all three apps in sync as the SaaS expands. Authored the canonical design tokens (warm paper / dark ink / vermilion) that the native apps replicate.

### GovLens — Context-aware overlay for government portals
[github.com/sinhaankur/GovLens](https://github.com/sinhaankur/GovLens)

Chrome extension that activates on any of 25+ national gov TLDs and surfaces translation (100+ languages), structural navigation, cross-language search, a 0–100 usability score across 8 axes, and a region-aware jargon explainer (PAN, GSTIN, HMRC, NIN, SSN, FAFSA…). Designed a **three-engine translation cascade** — on-device AI → free Google Translate → premium Anthropic Claude (BYOK) — with the side panel showing *which engine will answer before you click.* The interaction surfaces what the system is doing and lets the user steer it.

### WatchTower — Self-hosted deployment platform for developers
[github.com/sinhaankur/WatchTower](https://github.com/sinhaankur/WatchTower) (Python · Electron · 4★)

Operator-facing tooling for container auto-updates, multi-node deployment, and guided host operations across the user's own machines. Ships as macOS DMG, Windows NSIS, Linux AppImage/deb, Snap Store, PyPI package, and a VS Code extension. Designed the integrations dashboard for six interconnected tools (Podman / Nginx / Tailscale / Cloudflare / Coolify / Watchdog) so a single operator can see live status and recover from any of them.

### EMPATHEIA — Multi-modal AI companion (offline-first)
[github.com/sinhaankur/ideal-giggle](https://github.com/sinhaankur/ideal-giggle)

Next.js + AI SDK PWA. Camera-based facial-expression detection feeds mood-aware tone adaptation in responses. Designed **hybrid intelligence fallback**: if the model runtime fails, empathy-map quadrants still update via deterministic sentiment + keyword heuristics — the user never sees a dead surface. Two clean provider paths (local Ollama or cloud API), installable on every OS.

---

## Experience

**Principal UX Designer** — Oracle, Cloud Database Tooling & AI Orchestration · Feb 2020 – Present
Lead designer for cloud database tooling and AI orchestration surfaces. Specifics under NDA.

**UX Designer / Product Strategist** — Deloitte Touche Tohmatsu India · Apr 2018 – Feb 2020
Brought UCD process to enterprise channels (Salesforce, Supply Chain ERPs). Conducted E2E user-requirement analysis; iterated information architecture and reporting surfaces with stakeholders across product, engineering, QA, and clients.

**Lead UX Designer** — Snowtint Technologies · Sep 2016 – Mar 2018
Founded and led the company's first UX team. Built a group of interaction designers and researchers; owned production and delivery across web, social, and mobile properties; set strategic UX direction.

**UX Designer (Jr → mid)** — Rage Communication · Jun 2015 – Jul 2016
Banking and consumer projects (Citibank NA / India / Philippines, HSBC, Deutsche Bank, Vodafone, Unilever, CEAT, Quikr). Wireframes, interaction design, end-user interviews, client presentation.

**IT Analyst** — IBM India · Jun 2013 – Jul 2014

---

## How I work

- **Code my own prototypes.** React/TS, SwiftUI, Compose, Tauri, Electron, Next.js. I ship the prototype that makes the design argument unambiguously, then hand off to engineering with the contract already in code.
- **Design systems thinking applied to AI surfaces.** Calibrated language over raw percentages. Cross-hatch as a category-difference primitive across hallucination, fabricated source, and irreversible action. Reusable verdict / approval / audit shapes.
- **Reversibility as the policy axis.** "Is this safe?" is the wrong binary. *What is the recovery cost?* is the right scale, and it's what determines when to pause for the human.
- **Outcome-driven over task-driven.** Recourse's cadence engine, BuildingSync's persona-divergent flows, GovLens's "which engine answers" pre-disclosure — all surface the *outcome* the user wants and let them steer the system there.

---

## Education & Certification

- **B.Tech, Computer Science** — BTLIT Bangalore, VTU · 2008 – 2013
- **HFI Certified Usability Analyst (CUA)**

---

## Tools

Figma · Code (React/TS, SwiftUI, Kotlin Compose, Next.js, Tauri, Electron) · Supabase / Prisma · OpenAPI · Style Dictionary · Anthropic / OpenAI / Ollama SDKs · face-api.js · Adobe XD / Photoshop
