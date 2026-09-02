# Ankur Sinha
**Principal UX Designer · Human-AI Interaction · Toronto, ON**

+1 647-548-6558 · sinhaankur827@gmail.com · [sinhaankur.com](https://www.sinhaankur.com) · [linkedin.com/in/sinhaankur27](https://linkedin.com/in/sinhaankur27) · [github.com/sinhaankur](https://github.com/sinhaankur)

---

## Summary

Engineer-turned-designer, 12+ years shipping enterprise SaaS across banking, supply chain, and cloud infrastructure. **Principal UX Designer at Oracle**, where I own the design end-to-end for cloud database operations in OCI — taking dangerous, expert-only tasks (encryption, key rotation, disaster-recovery failover) and turning them into safe, guided console flows a non-expert can run. I work at the design–engineering seam: I research, design, and prototype in code, then hand engineering a contract they can build against — not just Figma.

---

## Experience

**Oracle · 6+ years** — Cloud Database Tooling & Human–AI Interaction (OCI), Toronto

*Principal User Experience Designer · Sep 2023 – Present*
As databases gain autonomous, LLM-driven capabilities, I design the **trust layer** between operators and agents. My deliverable is no longer a mockup — it's the **permission handshake**.
- **Confidence-State UI.** When a system generates code or DB logic (PL/SQL) at varying certainty, the interface communicates the risk: a *confidence spectrum* — one-click auto-execute at high confidence, a review-&-edit canvas that highlights the least-certain logic at medium, and a co-pilot that asks for constraints (not a solution) at low.
- **Permission & governance UX.** *Friction-as-a-feature*: silent handshakes for reading data; **active-intent** multi-factor confirmation + a before/after diff for high-stakes changes (modifying production schemas). Every autonomous flow gets a prominent, always-available **kill switch**.
- **Invisible UX & audit trails.** For CLI/background agents (e.g. Claude Code) and MCP servers, the interface is *traceability* — a human-readable paper trail to undo, verify, or intervene, making the agent's reasoning (*why*) as visible as the result (*what*).

*Senior User Experience Designer · Feb 2020 – Sep 2023*
Sole designer on Oracle's Database-as-a-Service (DBaaS) console operations in OCI — end-to-end: research with DBAs, IA, flows, high-fidelity specs, and working code prototypes, then supporting engineering through build.
- **Encryption, made safe.** Console flows for Transparent Data Encryption (TDE) with OCI Vault/KMS — provisioning, host-wallet→KMS migration, key rotation across VM and bare-metal. Treated *recovery cost* as the design axis: irreversible steps interrupt and confirm, so customers encrypt production data without risking lockout.
- **PDB lifecycle in the console.** Brought pluggable-database management (DBCS/ExaCS/ExaCC) out of manual host-only SSH work into the OCI Console, SDK, and Terraform.
- **Disaster recovery you can trust.** Cross-Region Autonomous Data Guard — standby creation, buddy-region selection, automatic/manual failover — so applications reconnect seamlessly during a region outage.
- Shipped supporting surfaces: Refreshable Clone, Data Guard maintenance & patching, ADB time-zone updates, Spatial Studio.

**Deloitte Digital India · 2 years** — Bengaluru
*Assistant Manager · Jun 2019 – Feb 2020 · Deputy Manager · Mar 2018 – May 2019*
UX consultant / product strategist on enterprise and financial-services engagements. Brought user-centered design to Salesforce surfaces and supply-chain ERPs; ran end-to-end user-requirement analysis across Fortune 500/1000 clients; iterated IA and reporting surfaces with product, engineering, QA, and client stakeholders.

**Lead UX Designer** — Snowtint Technologies · Sep 2016 – Mar 2018
Founded and led the company's first UX team. Built a group of interaction designers and researchers; owned production and delivery across web, social, and mobile properties; set strategic UX direction.

**UX Designer (Jr → mid)** — Rage Communication · Jun 2015 – Jul 2016
Banking and consumer projects (Citibank NA / India / Philippines, HSBC, Deutsche Bank, Vodafone, Unilever, CEAT, Quikr). Wireframes, interaction design, end-user interviews, client presentation.

**IT Analyst** — IBM India · Jun 2013 – Jul 2014

---

## Independent Projects & Explorations

*Self-directed, open-source builds — not client or employer work. How I learn the human–AI seam hands-on: I ship the design argument as working software, in evenings and weekends.*

### Helm — Real-time oversight of LLM agents
[github.com/sinhaankur/Helm](https://github.com/sinhaankur/Helm) · [Live demo](https://sinhaankur.github.io/Helm/)

A prototype exploring how a human stays in the loop *while* an agent acts: every tool call previewed with intent, target, diff, and cost. Built around one idea — **reversibility (recovery cost), not "safety," is the policy axis**: auto-allow caps at reversible; irreversible steps always pause.

### Sentinel — Embeddable inline oversight layer for AI tools
[github.com/sinhaankur/Human-in-the-Loop](https://github.com/sinhaankur/Human-in-the-Loop) · [Live demo](https://sinhaankur.github.io/Human-in-the-Loop/)

A drop-in oversight-layer concept, prototyped **four ways** (React library, Chrome extension over ChatGPT, VS Code Copilot wrapper, Docker demo). Explores a calibrated-confidence vocabulary (Likely / Unsure / Low → exact % on hover), a distinct hallucination chip, and a verdict rail that blocks rubber-stamping once any claim is edited.

### Recourse — Consumer AI as advocate against institutional loops
[github.com/sinhaankur/Recourse](https://github.com/sinhaankur/Recourse) · [Live demo](https://sinhaankur.github.io/Recourse/)

A document-first workflow concept that helps people contest insurance denials with statute-anchored claims and a cadence engine that never lets a deadline slip. Explores flipping confidence language to action verbs (Settled / You verify / Ask a lawyer) and anchoring every claim to a real statute.

### Other explorations
[github.com/sinhaankur/GovLens](https://github.com/sinhaankur/GovLens) — context-aware overlay for government portals (translation, usability scoring, a three-engine translation cascade). · [github.com/sinhaankur/WatchTower](https://github.com/sinhaankur/WatchTower) — self-hosted deployment tooling (Python · Electron). · [github.com/sinhaankur/ideal-giggle](https://github.com/sinhaankur/ideal-giggle) — offline-first multi-modal AI companion with a deterministic fallback.

---

## How I work

- **I code my own prototypes** (React/TS, SwiftUI, Compose, Next.js) and hand off to engineering with the contract already in code — not just Figma.
- **Design-systems thinking for AI surfaces:** calibrated language over raw percentages, reusable verdict / approval / audit shapes, one visual primitive for category-different failure modes.
- **Reversibility, not "safety," is the policy axis** — recovery cost determines when a system must pause for the human.
- **Outcome-driven over task-driven** — design for the result the user actually wants, then let them steer the system there.

---

## Education & Certification

- **B.Tech, Computer Science** — BTLIT Bangalore, Visvesvaraya Technological University · 2008 – 2013
  - Academic projects that seeded my current lab work: **Image Processing — Pattern Matching**; **Measuring the Degree of Anonymity in P2P**; **Throughput Optimization of Data-Driven P2P Streaming** (IEEE base paper, NetBeans); **Rubik's Cube in OpenGL** (computer graphics).
- **HFI Certified Usability Analyst (CUA)**
- **Oracle IP Foundation** — Oracle · 2026
- **Verified International Academic Qualifications** — World Education Services (WES) · 2023

---

## Tools

Figma · Code (React/TS, SwiftUI, Kotlin Compose, Next.js, Tauri, Electron) · Supabase / Prisma · OpenAPI · Style Dictionary · Anthropic / OpenAI / Ollama SDKs · face-api.js · Adobe XD / Photoshop
