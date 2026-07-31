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
  /** a fuller plain-language explanation shown in the click-through pop view. */
  deep?: string
  /** the "how it helps users" line — the human payoff, in the pop view. */
  helps?: string
  /** a short, sticky takeaway to REMEMBER the law by — the one line that stays
   *  with you after the page. Shown prominently in the pop view. */
  mnemonic?: string
  /** which bespoke visualization the pop view renders (see LawViz). Laws
   *  without one still open the pop view with text + a generic diagram. */
  viz?: LawVizKey
}

/** The visualizations the pop view can render, one per law that has a bespoke
 *  diagram. Everything else falls back to a generic before/after panel. */
export type LawVizKey =
  | "hicks" | "miller" | "cognitive-load" | "teslers"
  | "fitts" | "doherty" | "goal-gradient" | "response-times"
  | "serial-position" | "peak-end" | "zeigarnik" | "von-restorff"
  | "jakobs" | "aesthetic" | "postels" | "pragnanz" | "selective-attention"
  | "proximity" | "similarity" | "common-region" | "closure" | "continuity" | "figure-ground"
  | "generic"

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
      { name: "Hick's Law", viz: "hicks", mnemonic: "More choices = more time.",
        what: "Decision time grows with the number and complexity of choices. Reduce options, group and rank them, use progressive disclosure.",
        deep: "The time to make a decision rises roughly with the logarithm of the number of options — T = b·log₂(n+1). Two choices are quick; twenty make the user freeze and re-read. It's not just count: complexity and unfamiliarity add to it too.",
        helps: "Fewer, well-ordered choices let people decide fast and confidently instead of stalling — the difference between a menu they scan and one they abandon.",
        apply: "Collapse a long list of choices into one menu with a default." },
      { name: "Miller's Law", viz: "miller", mnemonic: "Hold about seven — so chunk it.",
        what: "Working memory holds ≈ 7 ± 2 chunks. Chunk long content and numbers; don't rely on users to remember across steps.",
        deep: "Short-term memory can juggle only a handful of items at once. But a 'chunk' is flexible: 1-4-1-5-9-2-6-5-3 is nine chunks, while 141-559-2653 is three. Grouping turns an unmemorable string into a holdable one.",
        helps: "Chunked phone numbers, dates and menus mean users don't drop information between steps — less re-checking, fewer errors.",
        apply: "Group a long list into 3–5 themed buckets." },
      { name: "Cognitive load", viz: "cognitive-load", mnemonic: "Cut the UI tax, not the task.",
        what: "Total effort = intrinsic (the task) + extraneous (the UI) + germane (learning). Ruthlessly cut extraneous load — clutter, jargon, redundant choices.",
        deep: "Every screen spends a fixed mental budget. Intrinsic load is the real task; germane load is useful learning; extraneous load is everything the interface makes you deal with that isn't the task — clutter, jargon, hunting. Only extraneous load is pure waste.",
        helps: "Stripping interface noise leaves more of the user's attention for the thing they actually came to do.",
        apply: "One primary action per screen; remove competing chrome." },
      { name: "Tesler's Law", viz: "teslers", mnemonic: "Someone bears the complexity — let it be you.",
        what: "Conservation of complexity — every system has irreducible complexity; someone must bear it. Absorb it in the product, not the user.",
        deep: "A task has a floor of complexity that can't be removed, only moved. The choice is where it lands: inside the product (smart defaults, inference, the system doing the work) or on the user (fields to fill, rules to learn). Good design pulls it inward.",
        helps: "When the product absorbs the hard parts, the user gets a simple surface over a capable system — power without the burden.",
        apply: "Let the system carry the complexity so the user doesn't have to." },
    ],
  },
  {
    id: "interaction-time",
    no: "4.2",
    title: "Interaction & time",
    lead: "The physics of pointing, and the psychology of waiting and progress.",
    laws: [
      { name: "Fitts's Law", viz: "fitts", mnemonic: "Big and close = fast.",
        what: "Time to hit a target grows with distance and shrinks with size. Make primary targets large and close; use edges and corners.",
        deep: "Movement time is proportional to the 'index of difficulty' — log₂(distance/size + 1). Doubling the distance costs a little; halving the size costs more. Screen edges and corners act as infinitely large targets because the cursor stops at them.",
        helps: "Large, nearby primary buttons are physically faster and less error-prone to hit — especially on touch and for motor-impaired users.",
        apply: "≥ 40px targets; keep primary actions large and reachable." },
      { name: "Doherty Threshold", viz: "doherty", mnemonic: "Answer under 400 ms or they drift.",
        what: "Keep system response under ~400 ms and productivity + engagement stay high. Respond instantly; optimistic UI, skeletons, progress.",
        deep: "When the machine responds in under ~400 ms, the user and system enter a fast back-and-forth and attention stays locked in. Cross that line and people disengage, task-switch, and feel the product is slow — even if the total work is the same.",
        helps: "Instant-feeling responses keep users in flow and doing more, instead of waiting and wandering off.",
        apply: "Show a thinking state; never a blank pause." },
      { name: "Goal-gradient effect", viz: "goal-gradient", mnemonic: "The closer the finish, the harder they push.",
        what: "Motivation rises closer to a goal. Show progress and, where honest, endow early progress.",
        deep: "Effort accelerates as a goal nears — the classic 'the last stretch feels fastest.' Showing progress, and honestly crediting early progress (a punch card that starts with two stamps), pulls people toward completion.",
        helps: "A visible finish line and progress bar make people more likely to complete a signup, checklist, or checkout.",
        apply: "Show a step bar and the path ahead in any multi-step flow." },
      { name: "Steering / paths", viz: "generic", mnemonic: "Long, narrow paths cost time.",
        what: "Moving through a constrained path (nested menus) costs time proportional to its length and narrowness. Shorten and widen hit-paths.",
        deep: "Steering the cursor down a thin corridor — a nested fly-out menu — costs time in proportion to how long and how narrow it is. Deep menus that require staying inside a sliver are slow and error-prone.",
        helps: "Flat, wide navigation lets users reach anything in a couple of confident moves instead of threading a maze.",
        apply: "Flatten navigation; label the spine." },
      { name: "Flow & latency", viz: "response-times", mnemonic: "Perceived speed beats real speed.",
        what: "Perceived speed matters more than raw speed. Acknowledge within 100 ms, show progress by 1 s, keep attention past 10 s.",
        deep: "Users judge speed by feedback, not milliseconds. An instant acknowledgement (a press state, a spinner) makes a slow operation feel responsive; a fast one with no feedback feels broken. Manage the perception, not just the clock.",
        helps: "Immediate feedback reassures users the system heard them, so they don't double-tap, give up, or feel lost.",
        apply: "Immediate hover/press feedback on every control." },
      { name: "Response times (Miller)", viz: "response-times", mnemonic: "0.1s instant · 1s flow · 10s limit.",
        what: "0.1 s feels instant · 1 s keeps flow · 10 s is the attention limit. Design loaders to these thresholds.",
        deep: "Three human thresholds govern waiting: ~0.1 s feels like direct manipulation, ~1 s keeps the train of thought unbroken (no spinner needed), and ~10 s is the ceiling of held attention — past it, background the work and let people move on.",
        helps: "Matching loaders to these thresholds keeps the interface feeling alive and respects the user's attention.",
        apply: "Skeleton any content that loads in under 1 s." },
    ],
  },
  {
    id: "memory-attention",
    no: "4.3",
    title: "Memory, attention & perception",
    lead: "What people remember, notice, and expect — the psychology behind where things go.",
    laws: [
      { name: "Serial-position effect", viz: "serial-position", mnemonic: "First and last stick.",
        what: "First and last items are best remembered. Place key actions and nav at the start and end.",
        deep: "In any list, the first items (primacy) and last items (recency) are recalled best; the middle sags. That's why the ends of a nav bar, a menu, or a sentence carry the most weight.",
        helps: "Putting the most important actions at the start and end of a list means users remember and find them.",
        apply: "Put primary nav + key actions at the ends, not buried in the middle." },
      { name: "Peak–End rule", viz: "peak-end", mnemonic: "They remember the peak and the end.",
        what: "People judge an experience by its most intense moment and its end. Engineer the peak (an 'aha' answer) and a graceful end.",
        deep: "Memory of an experience isn't an average of every moment — it's dominated by the single most intense point (the peak) and the final moment (the end). A flow with one delightful high and a clean finish is remembered as great, even if the middle was ordinary.",
        helps: "Designing a clear peak moment and a graceful ending makes the whole product feel better in memory — and more likely to be returned to.",
        apply: "Engineer one 'aha' moment; end flows on a clean, positive note." },
      { name: "Zeigarnik effect", viz: "zeigarnik", mnemonic: "Unfinished things nag at you.",
        what: "Unfinished tasks stay in mind. Use progress checklists and 'resume where you left off'.",
        deep: "Incomplete tasks occupy memory more than finished ones — the mind keeps an open loop until it's closed. A profile that's '60% complete' or a checklist with items left creates a gentle pull to finish.",
        helps: "Progress indicators and 'resume where you left off' use that pull to help users complete setup instead of drifting away.",
        apply: "Show a completion bar; let users resume an unfinished flow." },
      { name: "Von Restorff (isolation)", viz: "von-restorff", mnemonic: "The one that stands out wins.",
        what: "The item that differs is remembered and clicked. Make the single primary action visually distinct — and only one.",
        deep: "When several items are alike, the one that's visually different is the one noticed, remembered, and acted on. But it only works if it's the ONLY standout — two 'primary' buttons cancel each other and you're back to a flat field.",
        helps: "One clearly distinct primary action guides the eye straight to the thing you want the user to do.",
        apply: "Make exactly one action the bold, filled one; everything else recedes." },
      { name: "Jakob's Law", viz: "jakobs", mnemonic: "Yours should work like the rest.",
        what: "Users expect your product to work like the others they know. Honour conventions; deviate only for real payoff.",
        deep: "People spend almost all their time on OTHER products, so they arrive with a model of how things should work — where the cart icon is, what a link looks like, how search behaves. Matching that model means zero relearning; breaking it charges a tax you must be sure is worth it.",
        helps: "Following familiar conventions makes a product instantly usable — people already know how to drive it.",
        apply: "Use the pattern users already know; deviate only for a real payoff." },
      { name: "Aesthetic–usability", viz: "aesthetic", mnemonic: "Pretty feels easier.",
        what: "Attractive interfaces are perceived as easier to use — and buy goodwill for minor flaws. Polish, but don't let it mask real defects.",
        deep: "People rate attractive interfaces as more usable — even when they aren't measurably easier — and forgive small flaws in a polished product. The trap: beauty can hide real usability defects in testing, so don't let polish substitute for function.",
        helps: "Visual polish earns trust and patience, making the whole experience feel smoother and more credible.",
        apply: "Polish the surface — but validate that it's actually usable, not just pretty." },
      { name: "Postel's Law", viz: "postels", mnemonic: "Accept messy in; give clean out.",
        what: "Be liberal in what you accept, conservative in what you emit. Forgive messy input; output clean, predictable results.",
        deep: "Be forgiving of what users type and strict about what you produce. Accept a phone number with spaces, dashes, or none; accept any date format; accept upper or lower case — then normalise it internally and show a clean, consistent result.",
        helps: "Forgiving input means users don't get punished for formatting — fewer failed submissions and frustrated retries.",
        apply: "Accept spaces in card numbers, any date format, any case." },
      { name: "Law of Prägnanz", viz: "pragnanz", mnemonic: "The eye picks the simplest read.",
        what: "People perceive the simplest possible interpretation. Reduce visual complexity; let structure read at a glance.",
        deep: "The brain resolves ambiguous visuals into the simplest, most regular interpretation it can — a cluster of shapes reads as one clean form if that's the simplest explanation. Simple, regular layouts are processed faster and feel calmer.",
        helps: "A layout that reads as simple structure at a glance is quicker to understand and less tiring to use.",
        apply: "Reduce visual complexity; let the structure read in one glance." },
      { name: "Selective attention", viz: "selective-attention", mnemonic: "People miss what they're not seeking.",
        what: "People miss what they're not looking for (banner blindness). Place key signals in the scan path, not the periphery.",
        deep: "Attention is a spotlight: people see what they're looking for and are genuinely blind to the rest — ad-shaped things in ad-shaped places get skipped entirely ('banner blindness'), even when they hold the answer. Put must-see signals in the natural scan path, not the periphery.",
        helps: "Placing key information where the eye actually goes means users find it instead of scrolling right past.",
        apply: "Put key signals in the content scan path, never in ad-shaped corners." },
    ],
  },
  {
    id: "gestalt",
    no: "4.4",
    title: "Gestalt principles of grouping",
    lead: "How the eye assembles separate marks into meaning — these govern layout, spacing, and what reads as one group.",
    laws: [
      { name: "Proximity", viz: "proximity", mnemonic: "Close = related.",
        what: "Elements placed close together are seen as related. Spacing is your primary grouping tool — stronger than lines or boxes.",
        deep: "Things near each other are read as a group; things apart, as separate. Spacing alone — no lines, no boxes — is the strongest grouping tool you have. Most 'cluttered' layouts are really evenly-spaced ones: even spacing destroys grouping.",
        helps: "Correct spacing lets users parse a layout instantly — labels stay with their fields, items with their groups.",
        apply: "Give related things less space than their neighbours." },
      { name: "Similarity", viz: "similarity", mnemonic: "Same look = same kind.",
        what: "Things that share colour, shape or size are seen as a set. Use it for categories; break it to signal 'this one is different'.",
        deep: "Elements sharing a visual trait — colour, shape, size — are perceived as belonging together, even when spread apart. It's how a scattered set of links all read as 'links.' Deliberately breaking similarity is how you say 'this one is special.'",
        helps: "Consistent styling tells users what's the same kind of thing — and a break in it flags what's different.",
        apply: "Style a category the same; break the pattern for the odd one out." },
      { name: "Common region", viz: "common-region", mnemonic: "A shared border binds.",
        what: "A shared boundary (a card) groups its contents strongly, even overriding proximity.",
        deep: "Enclosing elements in a shared boundary — a card, a panel, a tinted background — groups them powerfully, even overriding proximity: two items in one box read as together even if a third is physically closer outside it.",
        helps: "Cards and panels let users see at a glance which pieces belong together, no matter the spacing.",
        apply: "Wrap a set in a card when spacing alone can't carry the grouping." },
      { name: "Closure", viz: "closure", mnemonic: "The mind completes the shape.",
        what: "The mind completes familiar shapes from partial cues — enabling minimal icons and implied containers.",
        deep: "Given partial cues, the brain fills in the rest to see a whole, familiar shape — a circle drawn with gaps still reads as a circle. This is why minimal icons work and why a few aligned corners imply a container that isn't fully drawn.",
        helps: "Users recognise minimal icons and implied shapes instantly, so interfaces can be cleaner without losing meaning.",
        apply: "Trust the eye to complete a shape; don't over-draw every border." },
      { name: "Continuity", viz: "continuity", mnemonic: "The eye follows the line.",
        what: "The eye follows lines and alignment. Aligned elements read as connected — the basis of the grid.",
        deep: "The eye prefers to follow smooth, continuous paths — a line, an edge, a column of aligned elements — and reads things along that path as connected. This is the perceptual reason the grid works: alignment creates invisible lines that link content.",
        helps: "Aligning elements to shared lines makes a layout feel ordered and guides the eye through it smoothly.",
        apply: "Align to a shared grid so the eye flows down connected lines." },
      { name: "Figure / ground", viz: "figure-ground", mnemonic: "Lift the object off the page.",
        what: "We separate an object from its background. Use contrast and elevation to lift modals and menus above the page.",
        deep: "The eye instantly splits a scene into a 'figure' (the object of focus) and 'ground' (the background behind it). Contrast, shadow and a dimmed scrim are what make a modal or menu read as floating ABOVE the page rather than part of it.",
        helps: "Clear figure/ground separation tells users exactly where to focus — a dialog reads as 'deal with me first.'",
        apply: "Use elevation + a scrim so overlays sit clearly above the page." },
    ],
  },
]

/* ── HEURISTICS ───────────────────────────────────────────────────────────── */

export type Heuristic = {
  n: number
  name: string
  what: string
  /** fuller explanation for the pop view. */
  deep: string
  /** how it helps users. */
  helps: string
  /** a sticky one-liner to remember it by. */
  mnemonic: string
  /** a concrete good-vs-bad example. */
  bad: string
  good: string
}

export const HEURISTICS: Heuristic[] = [
  { n: 1, name: "Visibility of system status", mnemonic: "Always tell the user what's happening.",
    what: "Keep users informed through timely feedback — loading states, saved confirmations, current location.",
    deep: "Users should never wonder whether the system heard them or what state they're in. Timely, appropriate feedback — a spinner, a 'Saved' toast, a highlighted current step, a progress bar — keeps them oriented and in control.",
    helps: "Constant, honest status means users trust the system and don't double-submit, refresh, or give up in confusion.",
    bad: "Click 'Save' → nothing visibly changes; did it work?",
    good: "Click 'Save' → button shows a spinner, then a 'Saved' toast." },
  { n: 2, name: "Match system & the real world", mnemonic: "Speak their language, not the database's.",
    what: "Speak the users' language; follow real-world conventions; natural, logical order.",
    deep: "Use words, phrases and concepts familiar to the user rather than internal jargon. Present information in a natural order that matches how people think about the task — a trash can, not a 'soft-delete flag'.",
    helps: "Familiar language and metaphors let users apply what they already know, so nothing needs translating.",
    bad: "Error: 'NULL constraint violated on field usr_eml.'",
    good: "'Please enter your email address.'" },
  { n: 3, name: "User control & freedom", mnemonic: "Always leave an exit.",
    what: "Clearly-marked exits, undo and redo; never trap the user in a state they can't leave.",
    deep: "People choose actions by mistake. They need a clearly-marked 'emergency exit' to leave an unwanted state without a long detour — undo and redo, a visible cancel, a back that works. Prefer reversible actions over blocking confirmations.",
    helps: "Knowing they can always back out lets users explore confidently instead of fearing every click.",
    bad: "A modal with no close button; only 'Confirm'.",
    good: "Delete shows an 'Undo' toast for a few seconds." },
  { n: 4, name: "Consistency & standards", mnemonic: "Same thing, same word, same place.",
    what: "Same words, actions and patterns mean the same thing everywhere; follow platform conventions.",
    deep: "Users shouldn't have to wonder whether different words, situations or actions mean the same thing. Follow platform and industry conventions (Jakob's Law) — internal consistency within your product, external consistency with the world.",
    helps: "Consistency means a pattern learned once works everywhere — no relearning per screen.",
    bad: "'Delete' here, 'Remove' there, 'Trash' elsewhere — same action.",
    good: "One verb for one action, product-wide." },
  { n: 5, name: "Error prevention", mnemonic: "Stop the error before it happens.",
    what: "Prevent problems before they occur — constraints, good defaults, confirmation on destructive actions.",
    deep: "Even better than a good error message is a design that prevents the problem in the first place — constraints, smart defaults, disabling invalid options, and confirming (or making reversible) destructive actions.",
    helps: "Fewer errors are even possible, so users hit fewer walls and lose less work.",
    bad: "A free-text date field that accepts '31/02/2026'.",
    good: "A date picker that can't offer an invalid day." },
  { n: 6, name: "Recognition over recall", mnemonic: "Show it; don't make them remember it.",
    what: "Make objects, actions and options visible; don't force users to remember across the interface.",
    deep: "Minimise memory load by making elements, actions and options visible. The user shouldn't have to remember information from one part of the interface to another — show recently-used items, autocomplete, and visible options instead of memorised commands.",
    helps: "Recognising an option is far easier than recalling it — less mental effort, fewer mistakes.",
    bad: "A blank command box: type the exact command from memory.",
    good: "A searchable list with recents + suggestions as you type." },
  { n: 7, name: "Flexibility & efficiency of use", mnemonic: "Fast lane for experts, clear road for novices.",
    what: "Accelerators (shortcuts, presets) for experts, without slowing novices.",
    deep: "Accelerators — keyboard shortcuts, saved states, presets, macros — let experts speed through while staying invisible to novices. Let people tailor frequent actions to their own flow.",
    helps: "Power users move fast and beginners aren't overwhelmed — the interface grows with skill.",
    bad: "Every user must click through the same 6-step wizard, every time.",
    good: "A saved preset + a keyboard shortcut for the frequent path." },
  { n: 8, name: "Aesthetic & minimalist design", mnemonic: "Every extra word dilutes the rest.",
    what: "Every extra unit of information competes with the relevant ones. Keep only what serves the task.",
    deep: "Interfaces shouldn't contain information that's irrelevant or rarely needed — every extra unit competes with the relevant units and diminishes their visibility. Keep only what serves the current task; defer the rest.",
    helps: "A focused screen makes the important thing obvious instead of burying it in noise.",
    bad: "A dashboard with 20 equally-loud widgets.",
    good: "The key metric leads; the rest is one click away." },
  { n: 9, name: "Recognise & recover from errors", mnemonic: "Say what broke and how to fix it.",
    what: "Plain-language messages that state the problem precisely and suggest a fix.",
    deep: "When errors happen, express them in plain language (no codes), state the problem precisely, and constructively suggest a solution. Show the error where it happened, keep the user's data, and move focus to the fix.",
    helps: "A clear, blameless error with a fix turns a dead end into a next step.",
    bad: "'Error 0x8007. Something went wrong.'",
    good: "'That email isn't verified — ask them to confirm, or turn off verification in Settings.'" },
  { n: 10, name: "Help & documentation", mnemonic: "Best help is needing none.",
    what: "Ideally none needed; when it is, make it searchable, task-focused, and concrete.",
    deep: "It's best if the system needs no explanation, but some help may be necessary. When it is, make it easy to search, focused on the user's task, list concrete steps, and keep it short — placed in context where possible.",
    helps: "Task-focused, in-context help gets people unstuck fast without leaving what they were doing.",
    bad: "A 90-page PDF manual, separate from the product.",
    good: "A contextual tip + searchable, task-based articles." },
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
