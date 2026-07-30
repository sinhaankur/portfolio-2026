/**
 * framework-data — Ankur Sinha's Universal Experience Framework 1.0, as
 * structured data for the site-native /framework page.
 *
 * Rebuilt from the authored document (Universal Experience Framework 1.0,
 * comprehensive edition, 2026) into the site's own design language. Structure
 * after the Citi GS+DT "Universal Experience Framework 1.0" (2013); content is
 * the contemporary UX canon — cognitive laws, heuristics, tokens, accessibility
 * (WCAG 2.2), research + metrics — assembled as a personal working guide.
 *
 * The page groups everything under three layers (A: Principles & Laws, B:
 * System & Standards, C: Applied), matching §1.2 of the document.
 */

export type FrameworkLaw = {
  name: string
  what: string
  /** the concrete "apply it on a mock" note. */
  apply?: string
}

export type FrameworkGroup = {
  id: string
  /** section number from the document (e.g. "4.1"). */
  no: string
  title: string
  /** one-line framing. */
  lead: string
  laws: FrameworkLaw[]
}

/* ── LAYER A · PRINCIPLES & LAWS ──────────────────────────────────────────── */

export const PRINCIPLES: FrameworkLaw[] = [
  { name: "One primary action per screen", what: "Every screen gets exactly one visually dominant action tied to the user's goal; everything else recedes. Kills the equal-weight-buttons problem." },
  { name: "Signal over surface area", what: "The scarce, valuable thing — the outcome your product exists to create — gets the boldest treatment; vanity metrics get demoted." },
  { name: "Answers you can act on", what: "Every number and every AI answer carries its next step — a citation to jump to, a person to contact. No dead-end data." },
  { name: "One system, not six", what: "A single tokenised system (colour, type, spacing) makes the product feel built by one team and handoff trivial." },
  { name: "Progressive disclosure", what: "Show the 20% that matters by default; let power users expand into the rest. Density is a choice, not a default." },
  { name: "Prevent, then forgive", what: "Design so errors are hard to make; when they happen, explain plainly and make recovery cheap and reversible." },
  { name: "Accessible by default", what: "Every experience meets WCAG 2.2 AA as a floor — contrast, target size, keyboard, never meaning-by-colour-alone. A baseline, not a feature." },
]

export const LAW_GROUPS: FrameworkGroup[] = [
  {
    id: "decision-load",
    no: "4.1",
    title: "Decision & cognitive load",
    lead: "How much thinking a screen demands, and how many choices it forces, largely determines whether people succeed.",
    laws: [
      { name: "Hick's Law", what: "Decision time grows with the number and complexity of choices. Reduce options, group and rank them, use progressive disclosure.", apply: "Collapse a long list of choices into one menu with a default." },
      { name: "Miller's Law", what: "Working memory holds ≈ 7 ± 2 chunks. Chunk long content and numbers; don't rely on users to remember across steps.", apply: "Group a long list into 3–5 themed buckets." },
      { name: "Cognitive load", what: "Total effort = intrinsic (the task) + extraneous (the UI) + germane (learning). Ruthlessly cut extraneous load — clutter, jargon, redundant choices.", apply: "One primary action per screen; remove competing chrome." },
      { name: "Tesler's Law", what: "Conservation of complexity — every system has irreducible complexity; someone must bear it. Absorb it in the product, not the user.", apply: "Let the system carry the complexity so the user doesn't have to." },
    ],
  },
  {
    id: "interaction-time",
    no: "4.2",
    title: "Interaction & time",
    lead: "The physics of pointing, and the psychology of waiting and progress.",
    laws: [
      { name: "Fitts's Law", what: "Time to hit a target grows with distance and shrinks with size. Make primary targets large and close; use edges and corners.", apply: "≥ 40px targets; keep primary actions large and reachable." },
      { name: "Doherty Threshold", what: "Keep system response under ~400 ms and productivity + engagement stay high. Respond instantly; optimistic UI, skeletons, progress.", apply: "Show a thinking state; never a blank pause." },
      { name: "Goal-gradient effect", what: "Motivation rises closer to a goal. Show progress and, where honest, endow early progress.", apply: "Show a step bar and the path ahead in any multi-step flow." },
      { name: "Steering / paths", what: "Moving through a constrained path (nested menus) costs time proportional to its length and narrowness. Shorten and widen hit-paths.", apply: "Flatten navigation; label the spine." },
      { name: "Flow & latency", what: "Perceived speed matters more than raw speed. Acknowledge within 100 ms, show progress by 1 s, keep attention past 10 s.", apply: "Immediate hover/press feedback on every control." },
      { name: "Response times (Miller)", what: "0.1 s feels instant · 1 s keeps flow · 10 s is the attention limit. Design loaders to these thresholds.", apply: "Skeleton any content that loads in under 1 s." },
    ],
  },
  {
    id: "memory-attention",
    no: "4.3",
    title: "Memory, attention & perception",
    lead: "What people remember, notice, and expect — the psychology behind where things go.",
    laws: [
      { name: "Serial-position effect", what: "First and last items are best remembered. Place key actions and nav at the start and end." },
      { name: "Peak–End rule", what: "People judge an experience by its most intense moment and its end. Engineer the peak (an 'aha' answer) and a graceful end." },
      { name: "Zeigarnik effect", what: "Unfinished tasks stay in mind. Use progress checklists and 'resume where you left off'." },
      { name: "Von Restorff (isolation)", what: "The item that differs is remembered and clicked. Make the single primary action visually distinct — and only one." },
      { name: "Jakob's Law", what: "Users expect your product to work like the others they know. Honour conventions; deviate only for real payoff." },
      { name: "Aesthetic–usability", what: "Attractive interfaces are perceived as easier to use — and buy goodwill for minor flaws. Polish, but don't let it mask real defects." },
      { name: "Postel's Law", what: "Be liberal in what you accept, conservative in what you emit. Forgive messy input; output clean, predictable results." },
      { name: "Law of Prägnanz", what: "People perceive the simplest possible interpretation. Reduce visual complexity; let structure read at a glance." },
      { name: "Selective attention", what: "People miss what they're not looking for (banner blindness). Place key signals in the scan path, not the periphery." },
    ],
  },
  {
    id: "gestalt",
    no: "4.4",
    title: "Gestalt principles of grouping",
    lead: "How the eye assembles separate marks into meaning — these govern layout, spacing, and what reads as one group.",
    laws: [
      { name: "Proximity", what: "Elements placed close together are seen as related. Spacing is your primary grouping tool — stronger than lines or boxes." },
      { name: "Similarity", what: "Things that share colour, shape or size are seen as a set. Use it for categories; break it to signal 'this one is different'." },
      { name: "Common region", what: "A shared boundary (a card) groups its contents strongly, even overriding proximity." },
      { name: "Closure", what: "The mind completes familiar shapes from partial cues — enabling minimal icons and implied containers." },
      { name: "Continuity", what: "The eye follows lines and alignment. Aligned elements read as connected — the basis of the grid." },
      { name: "Figure / ground", what: "We separate an object from its background. Use contrast and elevation to lift modals and menus above the page." },
    ],
  },
]

/* ── HEURISTICS ───────────────────────────────────────────────────────────── */

export const HEURISTICS: { n: number; name: string; what: string }[] = [
  { n: 1, name: "Visibility of system status", what: "Keep users informed through timely feedback — loading states, saved confirmations, current location." },
  { n: 2, name: "Match system & real world", what: "Speak the users' language; follow real-world conventions; natural, logical order." },
  { n: 3, name: "User control & freedom", what: "Clearly-marked exits, undo and redo; never trap the user in a state they can't leave." },
  { n: 4, name: "Consistency & standards", what: "Same words, actions and patterns mean the same thing everywhere; follow platform conventions." },
  { n: 5, name: "Error prevention", what: "Prevent problems before they occur — constraints, good defaults, confirmation on destructive actions." },
  { n: 6, name: "Recognition over recall", what: "Make objects, actions and options visible; don't force users to remember across the interface." },
  { n: 7, name: "Flexibility & efficiency", what: "Accelerators (shortcuts, presets) for experts, without slowing novices." },
  { n: 8, name: "Aesthetic & minimalist", what: "Every extra unit of information competes with the relevant ones. Keep only what serves the task." },
  { n: 9, name: "Recognise & recover from errors", what: "Plain-language messages that state the problem precisely and suggest a fix." },
  { n: 10, name: "Help & documentation", what: "Ideally none needed; when it is, make it searchable, task-focused, and concrete." },
]

/* ── FOUNDATIONS ──────────────────────────────────────────────────────────── */

export const PLANES: { n: number; name: string; q: string; lives: string }[] = [
  { n: 1, name: "Strategy", q: "Why does this exist? Whose needs, whose goals?", lives: "User needs (JTBD) + business objectives. The North-Star and the core loop." },
  { n: 2, name: "Scope", q: "What features & content fulfil the strategy?", lives: "The set of features and content that satisfies the strategy." },
  { n: 3, name: "Structure", q: "How is it organised & how do users move?", lives: "Information architecture + interaction design: the nav spine." },
  { n: 4, name: "Skeleton", q: "What arrangement of elements enables use?", lives: "Interface, navigation & information design: layout, wireframes, the grid." },
  { n: 5, name: "Surface", q: "What does it look and feel like?", lives: "Visual design: the token system — colour, type, elevation, motion." },
]

export const CORE_LOOP = [
  { n: "01", name: "Discover", note: "Arrive with a need." },
  { n: "02", name: "Onboard", note: "Grasp the value fast." },
  { n: "03", name: "Core action", note: "Do the one valuable thing." },
  { n: "04", name: "Feedback", note: "See the result / progress." },
  { n: "05", name: "Return", note: "Come back; form the habit." },
]

/* ── LAYER C · THE APPLIED METHOD ─────────────────────────────────────────── */

export const METHOD: { n: number; step: string; detail: string }[] = [
  { n: 1, step: "Frame it", detail: "Which loop step and which job (JTBD) does this screen serve?" },
  { n: 2, step: "One primary action", detail: "Name the single thing the user should do; make it visually dominant (Von Restorff)." },
  { n: 3, step: "Pick the pattern", detail: "Choose the layout/component the relevant law or heuristic favours." },
  { n: 4, step: "Lay it out", detail: "On the grid, using spacing, colour and type tokens; group by proximity." },
  { n: 5, step: "Design the states", detail: "Empty, loading, error, success — not just the happy path." },
  { n: 6, step: "Write the words", detail: "Action labels, helper text, error copy — verbs, blameless, with a fix." },
  { n: 7, step: "Accessibility pass", detail: "Contrast, targets, focus, colour-independence — WCAG 2.2 AA." },
  { n: 8, step: "Critique it", detail: "Score against the ten heuristics; note severity." },
]

export const PRE_SHIP: string[] = [
  "Exactly one primary action, clearly dominant.",
  "Everything on the grid; spacing from the scale.",
  "One brand colour; data/semantic colours consistent.",
  "Type from the scale; body ≥ 14px; ≤ 75-char lines.",
  "Empty / loading / error states designed.",
  "Labels are verbs; errors say what & how to fix.",
  "AA contrast; targets ≥ 40px; visible focus; not colour-only.",
  "Keyboard-operable; icons have labels.",
  "The screen visibly advances the core loop.",
]

/* ── POUR (accessibility) ─────────────────────────────────────────────────── */

export const POUR: { name: string; what: string }[] = [
  { name: "Perceivable", what: "Text alternatives for non-text; captions; never colour alone; contrast ≥ 4.5:1 text / 3:1 large & UI; reflow to 320px and 400% zoom." },
  { name: "Operable", what: "Everything works by keyboard with visible focus order; targets ≥ 24px (40px recommended); no traps; honour reduced-motion." },
  { name: "Understandable", what: "Predictable behaviour and navigation; clear labels; inline error identification and suggestions; consistent components." },
  { name: "Robust", what: "Valid, semantic markup; correct name/role/value for every control (ARIA only when native won't do); status announced." },
]

/* ── The reference canon ──────────────────────────────────────────────────── */

export const CANON: string[] = [
  "Nielsen — 10 Usability Heuristics",
  "Norman — The Design of Everyday Things",
  "Garrett — The Elements of User Experience",
  "Yablonski — Laws of UX",
  "Krug — Don't Make Me Think",
  "Tidwell — Designing Interfaces",
  "Wroblewski — Web Form Design",
  "W3C — WCAG 2.2",
  "Rodden et al. — HEART framework",
  "Citi GS+DT — Universal Experience Framework 1.0 (structural basis)",
]
