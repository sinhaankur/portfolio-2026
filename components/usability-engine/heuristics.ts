/**
 * Usability Engine — heuristics catalog.
 *
 * Nielsen's 10 heuristics rewritten for modern product surfaces, plus
 * extensions for AI / agentic interfaces. Each entry is a row of data;
 * the engine handles rendering, demo lookup, and audit aggregation.
 *
 * Each heuristic also declares its `checkability` — how it would be
 * automated if the engine had a backend (script / llm / hybrid / manual)
 * — and an `automationSpec` describing what that check would actually
 * do. The fields drive the audit detail when a verdict is marked Fail.
 *
 * Add a row, the scene picks it up. To add an interactive demo for a
 * heuristic, register it in `demos/registry.ts` and reference the key
 * here under `demo`.
 */

import type { Heuristic } from "./types"

export const heuristics: Heuristic[] = [
  {
    id: "visibility-of-status",
    number: "01",
    title: "Visibility of system status",
    claim: "The interface should always tell the user what's happening.",
    story:
      "The user clicks. Something happens — or maybe doesn't. Without immediate feedback, the user is left guessing: did it work? Should I click again? Am I online? Silence is the most expensive UX bug because the user fills the gap with anxiety, and often with a second click.",
    appliesTo: ["website", "application", "form", "mobile-app"],
    severity: "blocker",
    auditQuestion:
      "Does every user action show feedback within 100 ms — visual, audio, or haptic?",
    fix: "Add a state transition for every interactive element: idle → pressed → working → resolved. Use spinners, progress bars, optimistic updates, or colour changes. If something is going to take more than 1 second, show a determinate progress indicator.",
    checkability: "hybrid",
    automationSpec:
      "A script can enumerate every <button> / <a> / interactive ARIA role and check for visible state transitions on click (aria-busy, aria-disabled, class toggles, focus rings). An LLM judges the *quality* of the feedback — is the loading copy informative or just a spinner?",
    demo: "visibility-status",
  },
  {
    id: "real-world-match",
    number: "02",
    title: "Match the user's world, not the system's",
    claim: "Use the user's vocabulary, not your engineering one.",
    story:
      "Your database calls it a 'transaction_id'. Your finance team calls it a 'receipt number'. Your user just calls it 'that thing you give me when I pay'. When the interface uses the system's words, the user has to translate before they can act — and translation has a failure rate.",
    appliesTo: ["website", "application", "form"],
    severity: "major",
    auditQuestion:
      "Have you tested every label, error, and tooltip with a user who's never seen the codebase?",
    fix: "Run a 'jargon audit': open the product, list every noun and verb the UI uses, and ask 5 users to define each one. Replace anything that gets defined differently by 2+ users.",
    checkability: "llm",
    automationSpec:
      "An LLM walks the rendered text on the page, flags tokens that match a developer-vocabulary list (id, uuid, payload, token, hash, sync, async, idempotent), and proposes plain-language substitutes. The model also reads each label in isolation and judges whether a non-technical user would understand it without context.",
  },
  {
    id: "user-control",
    number: "03",
    title: "User control & freedom",
    claim: "Always offer an exit. Always offer an undo.",
    story:
      "Users wander. They click the wrong button, open the wrong file, send the wrong message. The question isn't whether they will — it's how cheaply they can recover when they do. An interface that traps users into commitment turns small mistakes into support tickets.",
    appliesTo: ["website", "application", "form", "mobile-app"],
    severity: "blocker",
    auditQuestion:
      "Can every destructive or commitment action be undone within at least 5 seconds, without a confirmation modal?",
    fix: "Default to soft-delete with an 'Undo' snackbar (Gmail pattern) over hard-delete with a confirmation modal. Modals interrupt the flow without giving real recovery; snackbars don't interrupt and give you a real escape.",
    checkability: "hybrid",
    automationSpec:
      "Script finds every destructive verb in button copy ('delete', 'remove', 'discard', 'archive', 'cancel') and follows the click. LLM evaluates the resulting flow: is the action reversible? Within how long? Is the recovery affordance visible without a modal?",
    demo: "undo",
  },
  {
    id: "consistency-standards",
    number: "04",
    title: "Consistency & standards",
    claim: "Same word, same icon, same action — everywhere.",
    story:
      "If the cancel button is bottom-left on one screen and top-right on another, the user has to relearn the surface every time they open it. Internal consistency is cheap to design and expensive to repair later. External consistency — following the conventions of the platform — is even cheaper.",
    appliesTo: ["website", "application", "form", "mobile-app"],
    severity: "major",
    auditQuestion:
      "Does the same concept (e.g. 'save', 'cancel', 'delete') always use the same word, icon, and position across your product?",
    fix: "Build a design system. Even a tiny one. A single source of truth for buttons, colours, spacing, and copy means the team can't accidentally invent a fourth version of 'Delete' on a Tuesday.",
    checkability: "script",
    automationSpec:
      "Crawl the site, collect every button by accessible name, cluster by intent (Save / Cancel / Delete / Submit / OK). Flag clusters with more than one unique label. Same for icons: hash visual fingerprints, flag duplicates with mismatched copy or vice versa.",
  },
  {
    id: "error-prevention",
    number: "05",
    title: "Error prevention",
    claim: "The best error message is the one that's never needed.",
    story:
      "Error messages are a tax the system pays on the user's behalf when prevention failed. Better than great error messages: a design that makes the error impossible to commit. Better than that: a design that catches the error inline, while the user is still typing — before the form is even submitted.",
    appliesTo: ["website", "application", "form"],
    severity: "blocker",
    auditQuestion:
      "Does your form validate inline as the user types — not after they hit Submit?",
    fix: "Validate on the blur event of each field (when the user moves to the next one), not on Submit. Show specific, helpful guidance ('Need an @ sign and a dot') not generic refusal ('Invalid email'). Disable Submit until the form is in a submittable state.",
    checkability: "script",
    automationSpec:
      "For every <form>, simulate intentionally-bad input in each field (invalid email, future date in past field, 25-char name, etc.). Record whether validation fires on blur, on submit, or never. Flag any field with submit-only validation as a fail.",
    demo: "error-prevention",
  },
  {
    id: "recognition-over-recall",
    number: "06",
    title: "Recognition over recall",
    claim: "Show options. Don't make the user remember them.",
    story:
      "Human working memory holds about four things at once. Every blank input is asking the user to lift something out of long-term memory and hold it long enough to type it. Recently-used items, autocomplete, common defaults, and recognisable icons are all ways of doing that work for them.",
    appliesTo: ["website", "application", "form", "mobile-app"],
    severity: "major",
    auditQuestion:
      "Do you offer recent / suggested / autocomplete options on every input where the user might be looking for something they've used before?",
    fix: "Audit your inputs. For each one, ask: 'Where would the user have stored this answer?' If the answer is 'somewhere I can show them' — show them. Recent searches, recently used files, last-shipped-to addresses, frequent collaborators.",
    checkability: "hybrid",
    automationSpec:
      "Script enumerates inputs and detects autocomplete attributes, listbox roles, datalist presence. LLM evaluates whether each input *should* have suggestions (search vs new-form-field) — the script alone can't tell which inputs would benefit from history.",
    demo: "recognition",
  },
  {
    id: "flexibility-efficiency",
    number: "07",
    title: "Flexibility & efficiency",
    claim: "Beginners and experts use the same surface differently.",
    story:
      "Beginners walk through the form. Experts use ⌘+K. Power users build muscle memory and resent any path that demands a click when a keystroke would do. A good interface holds both — clear guided paths for new users, fast shortcuts for returning ones, and discoverability between them.",
    appliesTo: ["website", "application", "form"],
    severity: "minor",
    auditQuestion:
      "Can a power user complete the three most common tasks without leaving the keyboard?",
    fix: "Ship a command palette (⌘K). Surface keyboard shortcuts on hover or in a help menu. Let returning users pre-fill, batch, or skip steps that first-time users need.",
    checkability: "script",
    automationSpec:
      "Headless browser presses ⌘+K, ?, /, Esc and checks for a command palette or shortcut help overlay. Also enumerates accessKey attributes and aria-keyshortcuts to detect declared shortcuts. Heuristic: at least one global shortcut should be discoverable.",
  },
  {
    id: "minimalist-design",
    number: "08",
    title: "Aesthetic & minimalist design",
    claim: "Every extra element competes with the essential ones.",
    story:
      "Designers love adding. Stakeholders love adding. Marketing wants a banner; product wants a tip; legal wants a disclaimer; engineering wants a status indicator. Each one is reasonable in isolation; collectively they form a chorus that drowns out the one thing the user came to do.",
    appliesTo: ["website", "application", "form", "mobile-app"],
    severity: "major",
    auditQuestion:
      "Take any screen. Cover everything that isn't the primary action. Can the user still complete their task?",
    fix: "Practice the 'cover-it' test weekly. Anything that doesn't survive the test moves to a secondary surface (modal, drawer, tooltip, settings page) or gets deleted.",
    checkability: "manual",
    automationSpec:
      "Resists automation. An LLM can rank visual density and flag screens with > N attention-grabbing elements, but 'is this minimalist?' is fundamentally a taste judgment that requires knowing the user's primary task — and primary tasks vary by user segment, not by URL.",
  },
  {
    id: "recognize-recover",
    number: "09",
    title: "Recognize, diagnose, recover",
    claim: "When an error happens, name it plainly and offer a way out.",
    story:
      "'Error 503: Service Unavailable' is not an error message — it's a coordinate. A good error message tells the user three things: what went wrong, why it went wrong (in their terms), and what they can do next. The 'what they can do next' is the hard one and the one most teams skip.",
    appliesTo: ["website", "application", "form"],
    severity: "blocker",
    auditQuestion:
      "Does every error message in your product name the action that would resolve it?",
    fix: "Write errors as 'X happened because Y. Try Z.' If you can't write the Z, you need to redesign the flow until you can. Errors without a recovery path are just blame.",
    checkability: "llm",
    automationSpec:
      "Trigger every error path (network failure, validation failure, 4xx, 5xx, edge inputs). Pipe the resulting error copy through an LLM that scores it on three axes: names what happened? names why? names what to do next? Anything that scores 2/3 or lower fails the heuristic.",
  },
  {
    id: "help-and-docs",
    number: "10",
    title: "Help & documentation, when they're needed",
    claim: "Help should appear where the user needs it, not in a separate menu.",
    story:
      "The classic UX advice — 'good design needs no documentation' — is half true. Most things don't need docs. Some things do: regulated workflows, irreversible actions, complex domain concepts. The mistake isn't writing the docs; it's hiding them three clicks deep.",
    appliesTo: ["website", "application", "form"],
    severity: "minor",
    auditQuestion:
      "Where the user needs help, does the help appear inline (tooltip, contextual link), or do they have to leave the surface?",
    fix: "Replace 'See documentation' links with inline disclosure. A '?' icon next to a field that opens a one-paragraph explanation is worth more than a 4,000-word knowledge-base article behind a search bar.",
    checkability: "script",
    automationSpec:
      "Crawl for elements with aria-describedby, title, [data-tooltip], or '?' icon patterns. Flag form fields with technical labels (UUID, ISIN, IBAN, etc.) that lack inline help. Flag any 'See documentation' links that lead off-domain.",
  },
  // ----- Extensions beyond Nielsen's 10 -----
  {
    id: "ai-uncertainty-legibility",
    number: "11",
    title: "Uncertainty must be legible",
    claim: "An AI's claim is only trustworthy if you can read how sure it is.",
    story:
      "Generative interfaces output confident prose regardless of how much they actually know. Without a visible confidence signal, the user has no way to weight the output — and over time, repeated overconfidence erodes trust in the whole system. Calibrated language ('Likely / Unsure / Low confidence') outperforms raw percentages.",
    appliesTo: ["application", "website"],
    severity: "blocker",
    auditQuestion:
      "Does every AI claim in your product display its confidence level — and can the user check the basis?",
    fix: "Adopt a calibrated vocabulary: 'Confident', 'Likely', 'Unsure', 'Low'. Reserve raw percentages for power users who hover. Show the source citation or basis for every confident claim.",
    checkability: "llm",
    automationSpec:
      "An LLM reads any AI-generated surface (chat response, suggestion, summary, prediction) and checks for: a confidence label, a source/basis the user can click to verify, and language calibrated to the confidence ('possibly' for low, 'likely' for medium). Generated prose without any of those signals fails.",
  },
  {
    id: "reversibility-as-policy",
    number: "12",
    title: "Reversibility is the policy axis",
    claim: "Don't ask 'is this safe?' — ask 'can the human undo this, and how fast?'",
    story:
      "'Safety' is too vague a property to design around. 'Recovery cost' is the lever: how quickly, how completely, and at what cognitive cost can the user reverse the agent's action? Surfaces where recovery is instant and complete can afford to act autonomously. Surfaces where recovery is slow and partial must pause for human review.",
    appliesTo: ["application"],
    severity: "blocker",
    auditQuestion:
      "Have you mapped every agentic action in your product to its recovery cost — and gated the high-cost ones with an approval surface?",
    fix: "Build a reversibility chip into your agent UX (Helm's pattern). For each action: cheap to undo → run autonomously; expensive to undo → present for human approval first. Make the recovery path part of the design, not an afterthought.",
    checkability: "manual",
    automationSpec:
      "An LLM can list every agentic action surface in a product and propose a recovery-cost rating, but the actual judgment requires reading the system architecture (does undo restore the original state? at what blast radius?) and the user model (which users have authority to approve?). That's design review territory, not pattern detection.",
  },
]
