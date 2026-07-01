# Ankur Sinha
**Principal UX Designer · Human-AI Interaction · Toronto, ON**

+1 647-548-6558 · sinhaankur827@gmail.com · [sinhaankur.com](https://www.sinhaankur.com) · [linkedin.com/in/sinhaankur27](https://linkedin.com/in/sinhaankur27) · [github.com/sinhaankur](https://github.com/sinhaankur)

---

## Summary

Engineer-turned-designer, 12+ years shipping enterprise SaaS and AI-assisted product surfaces across banking, supply chain, oil & gas, e-commerce, and cloud database tooling. I design the seam between humans and AI agents — the moment of decision, override, and trust — and ship working code prototypes of those interaction patterns, not just Figma. Currently focused on agentic workflows, calibrated-confidence UX, and design systems that scale across enterprise products.

---

## Selected Work — Agentic & Human-AI Interaction

A connected trilogy of production-quality code prototypes (React 19 / TypeScript / Tailwind v4) on one thesis: **AI claims become trustworthy only when their uncertainty is legible and their basis is checkable.** Each ships with a live demo and a shared design vocabulary (calibrated confidence, cross-hatch failure-mode pattern, evidence anchors, per-decision audit object).

### Helm — Real-time oversight of LLM agents
[github.com/sinhaankur/Helm](https://github.com/sinhaankur/Helm) · [Live demo](https://sinhaankur.github.io/Helm/)

Puts the human back in the loop *while* the agent acts: every tool call is previewed with intent, target, diff, and cost. Designed six primitives (ToolBadge, ReversibilityChip, ConfidenceTag, DiffView, ApprovalGate, AgentStream) around a single idea — **reversibility (recovery cost), not "safety," is the policy axis**: auto-allow caps at reversible; irreversible steps always pause.

### Sentinel — Embeddable inline oversight layer for AI tools
[github.com/sinhaankur/Human-in-the-Loop](https://github.com/sinhaankur/Human-in-the-Loop) · [Live demo](https://sinhaankur.github.io/Human-in-the-Loop/)

A drop-in oversight layer any AI tool can adopt, shipped **four ways** (React library, Chrome extension over real ChatGPT, VS Code Copilot wrapper, Docker demo). Designed the calibrated-confidence vocabulary (Likely / Unsure / Low → exact % on hover), a distinct hallucination chip, and a verdict rail that blocks rubber-stamping the moment any claim is edited.

### Recourse — Consumer AI as advocate against institutional loops
[github.com/sinhaankur/Recourse](https://github.com/sinhaankur/Recourse) · [Live demo](https://sinhaankur.github.io/Recourse/)

A document-first workflow (not a chatbot) that helps people contest insurance denials with statute-anchored claims and a cadence engine that never lets a deadline slip. Confidence language flipped to action verbs (Settled / You verify / Ask a lawyer); every claim anchored to a real statute with excerpt and plain-language gloss. Outcome-driven design — the win condition is being *unexhaustible* against an adversarial process.

---

## Selected Work — Enterprise SaaS & Workflow Products

### BuildingSync — Multi-tenant property management SaaS
[github.com/BuildingAi-Cloud](https://github.com/BuildingAi-Cloud)

Founder, designer, and full-stack engineer of a three-platform product (Next.js web/admin, SwiftUI iOS, Kotlin/Compose Android) on a shared Supabase backend. Designed for **11 personas** and **5 building-type variants** that drive divergent payment, lease, and feature surfaces; architected an OpenAPI-contract layer so all three apps stay in sync as the product grows.

### GovLens — Context-aware overlay for government portals
[github.com/sinhaankur/GovLens](https://github.com/sinhaankur/GovLens)

Chrome extension for 25+ national gov TLDs: translation (100+ languages), structural navigation, a 0–100 usability score across 8 axes, and a region-aware jargon explainer. Designed a **three-engine translation cascade** (on-device AI → Google Translate → Anthropic Claude, BYOK) with the panel showing *which engine will answer before you click.*

### WatchTower — Self-hosted deployment platform for developers
[github.com/sinhaankur/WatchTower](https://github.com/sinhaankur/WatchTower) (Python · Electron · 4★)

Operator tooling for container auto-updates, multi-node deployment, and guided host ops. Ships across macOS/Windows/Linux, Snap, PyPI, and VS Code. Designed the integrations dashboard for six interconnected tools (Podman / Nginx / Tailscale / Cloudflare / Coolify / Watchdog) so one operator sees live status and can recover any of them.

### EMPATHEIA — Multi-modal AI companion (offline-first)
[github.com/sinhaankur/ideal-giggle](https://github.com/sinhaankur/ideal-giggle)

Next.js + AI SDK PWA with camera-based expression detection feeding mood-aware tone. Designed a **hybrid-intelligence fallback**: if the model runtime fails, empathy-map quadrants still update via deterministic heuristics — the user never hits a dead surface. Local (Ollama) or cloud provider paths.

---

## Experience

**Principal UX Designer** — Oracle, Cloud Database Tooling & AI Orchestration · Feb 2020 – Present
Lead designer on Oracle's Database-as-a-Service (DBaaS) and database-tooling surfaces in OCI. I design at the design–engineering seam: I own flows end-to-end and prototype them in code, not just Figma.
- Designed the console flows for **Transparent Data Encryption (TDE) with OCI Vault/KMS** — provisioning, host-wallet→KMS migration, and key rotation across VM and bare-metal database services.
- Designed **PDB (pluggable database) lifecycle management** for DBCS/ExaCS/ExaCC, bringing previously host-only, manual operations into the OCI Console, SDK, and Terraform.
- Designed **Cross-Region Autonomous Data Guard** — standby creation, buddy-region selection, and automatic/manual failover, so applications reconnect seamlessly to the new primary.
- Shipped supporting surfaces: Refreshable Clone (scheduled/continuous refresh), Autonomous Data Guard maintenance & patching, ADB time-zone updates, and Spatial Studio (DB Tools).

**UX Designer / Product Strategist** — Deloitte Touche Tohmatsu India · Apr 2018 – Feb 2020
Brought UCD process to enterprise channels (Salesforce, Supply Chain ERPs). Conducted E2E user-requirement analysis; iterated information architecture and reporting surfaces with stakeholders across product, engineering, QA, and clients.

**Lead UX Designer** — Snowtint Technologies · Sep 2016 – Mar 2018
Founded and led the company's first UX team. Built a group of interaction designers and researchers; owned production and delivery across web, social, and mobile properties; set strategic UX direction.

**UX Designer (Jr → mid)** — Rage Communication · Jun 2015 – Jul 2016
Banking and consumer projects (Citibank NA / India / Philippines, HSBC, Deutsche Bank, Vodafone, Unilever, CEAT, Quikr). Wireframes, interaction design, end-user interviews, client presentation.

**IT Analyst** — IBM India · Jun 2013 – Jul 2014

---

## How I work

- **I code my own prototypes** (React/TS, SwiftUI, Compose, Next.js) and hand off to engineering with the contract already in code — not just Figma.
- **Design-systems thinking for AI surfaces:** calibrated language over raw percentages, reusable verdict / approval / audit shapes, one visual primitive for category-different failure modes.
- **Reversibility, not "safety," is the policy axis** — recovery cost determines when a system must pause for the human.
- **Outcome-driven over task-driven** — design for the result the user actually wants, then let them steer the system there.

---

## Education & Certification

- **B.Tech, Computer Science** — BTLIT Bangalore, VTU · 2008 – 2013
- **HFI Certified Usability Analyst (CUA)**

---

## Tools

Figma · Code (React/TS, SwiftUI, Kotlin Compose, Next.js, Tauri, Electron) · Supabase / Prisma · OpenAPI · Style Dictionary · Anthropic / OpenAI / Ollama SDKs · face-api.js · Adobe XD / Photoshop
