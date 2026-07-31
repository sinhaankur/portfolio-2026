# Universal Experience Framework 1.0

**A working guide — Laws of UX & Cognition, heuristics, standards, and an applied method.**

Author: **Ankur Sinha** · Design × Engineering × AI · [sinhaankur.com](https://www.sinhaankur.com)
Live, interactive edition: [sinhaankur.com/framework](https://www.sinhaankur.com/framework)
Generated: 2026-07-31

---

> **Licence — Ankur Sinha UXD.** © 2026 Ankur Sinha. This
> framework — its structure, curation, principles, mnemonics and applied method —
> is the authored work of Ankur Sinha, released under **Ankur Sinha UXD** for
> personal reference and learning. You may read, share and cite it **with
> attribution to Ankur Sinha**; do not present it as your own or sell it. The
> underlying UX canon it assembles (Nielsen, Norman, Garrett, Yablonski, W3C
> WCAG 2.2, et al.) belongs to its original authors and is cited at the end.
> Structure after the Citi GS+DT "Universal Experience Framework 1.0" (2013).
>
> **Not a substitute for user research.** These are principles and heuristics to
> reason with, not laws of physics — validate with real users.

---

## How to use this

Read it once end-to-end for the model, then return to sections during design
and review. Each item states the **rule**, the **why** (the law or evidence
behind it), and an **apply** note for a real mock. When a spec and a principle
conflict, the principle wins — and the spec gets fixed.

## 1 · The experience principles

The tie-breakers. When two designs are both plausible, the one that honours
more of these wins.

1. **One primary action per screen** — Every screen gets exactly one visually dominant action tied to the user's goal; everything else recedes. Kills the equal-weight-buttons problem.
2. **Signal over surface area** — The scarce, valuable thing — the outcome your product exists to create — gets the boldest treatment; vanity metrics get demoted.
3. **Answers you can act on** — Every number and every AI answer carries its next step — a citation to jump to, a person to contact. No dead-end data.
4. **One system, not six** — A single tokenised system (colour, type, spacing) makes the product feel built by one team and handoff trivial.
5. **Progressive disclosure** — Show the 20% that matters by default; let power users expand into the rest. Density is a choice, not a default.
6. **Prevent, then forgive** — Design so errors are hard to make; when they happen, explain plainly and make recovery cheap and reversible.
7. **Accessible by default** — Every experience meets WCAG 2.2 AA as a floor — contrast, target size, keyboard, never meaning-by-colour-alone. A baseline, not a feature.

## 2 · Laws of UX & Cognition

The *why* behind the rules — the human wiring the framework is built on. Each
law carries a one-line **mnemonic** to remember it by.

### 4.1 · Decision & cognitive load

_How much thinking a screen demands, and how many choices it forces, largely determines whether people succeed._

#### Hick's Law
> _"More choices = more time."_

The time to make a decision rises roughly with the logarithm of the number of options — T = b·log₂(n+1). Two choices are quick; twenty make the user freeze and re-read. It's not just count: complexity and unfamiliarity add to it too.

**Helps users:** Fewer, well-ordered choices let people decide fast and confidently instead of stalling — the difference between a menu they scan and one they abandon.
**Apply:** Collapse a long list of choices into one menu with a default.

#### Miller's Law
> _"Hold about seven — so chunk it."_

Short-term memory can juggle only a handful of items at once. But a 'chunk' is flexible: 1-4-1-5-9-2-6-5-3 is nine chunks, while 141-559-2653 is three. Grouping turns an unmemorable string into a holdable one.

**Helps users:** Chunked phone numbers, dates and menus mean users don't drop information between steps — less re-checking, fewer errors.
**Apply:** Group a long list into 3–5 themed buckets.

#### Cognitive load
> _"Cut the UI tax, not the task."_

Every screen spends a fixed mental budget. Intrinsic load is the real task; germane load is useful learning; extraneous load is everything the interface makes you deal with that isn't the task — clutter, jargon, hunting. Only extraneous load is pure waste.

**Helps users:** Stripping interface noise leaves more of the user's attention for the thing they actually came to do.
**Apply:** One primary action per screen; remove competing chrome.

#### Tesler's Law
> _"Someone bears the complexity — let it be you."_

A task has a floor of complexity that can't be removed, only moved. The choice is where it lands: inside the product (smart defaults, inference, the system doing the work) or on the user (fields to fill, rules to learn). Good design pulls it inward.

**Helps users:** When the product absorbs the hard parts, the user gets a simple surface over a capable system — power without the burden.
**Apply:** Let the system carry the complexity so the user doesn't have to.

### 4.2 · Interaction & time

_The physics of pointing, and the psychology of waiting and progress._

#### Fitts's Law
> _"Big and close = fast."_

Movement time is proportional to the 'index of difficulty' — log₂(distance/size + 1). Doubling the distance costs a little; halving the size costs more. Screen edges and corners act as infinitely large targets because the cursor stops at them.

**Helps users:** Large, nearby primary buttons are physically faster and less error-prone to hit — especially on touch and for motor-impaired users.
**Apply:** ≥ 40px targets; keep primary actions large and reachable.

#### Doherty Threshold
> _"Answer under 400 ms or they drift."_

When the machine responds in under ~400 ms, the user and system enter a fast back-and-forth and attention stays locked in. Cross that line and people disengage, task-switch, and feel the product is slow — even if the total work is the same.

**Helps users:** Instant-feeling responses keep users in flow and doing more, instead of waiting and wandering off.
**Apply:** Show a thinking state; never a blank pause.

#### Goal-gradient effect
> _"The closer the finish, the harder they push."_

Effort accelerates as a goal nears — the classic 'the last stretch feels fastest.' Showing progress, and honestly crediting early progress (a punch card that starts with two stamps), pulls people toward completion.

**Helps users:** A visible finish line and progress bar make people more likely to complete a signup, checklist, or checkout.
**Apply:** Show a step bar and the path ahead in any multi-step flow.

#### Steering / paths
> _"Long, narrow paths cost time."_

Steering the cursor down a thin corridor — a nested fly-out menu — costs time in proportion to how long and how narrow it is. Deep menus that require staying inside a sliver are slow and error-prone.

**Helps users:** Flat, wide navigation lets users reach anything in a couple of confident moves instead of threading a maze.
**Apply:** Flatten navigation; label the spine.

#### Flow & latency
> _"Perceived speed beats real speed."_

Users judge speed by feedback, not milliseconds. An instant acknowledgement (a press state, a spinner) makes a slow operation feel responsive; a fast one with no feedback feels broken. Manage the perception, not just the clock.

**Helps users:** Immediate feedback reassures users the system heard them, so they don't double-tap, give up, or feel lost.
**Apply:** Immediate hover/press feedback on every control.

#### Response times (Miller)
> _"0.1s instant · 1s flow · 10s limit."_

Three human thresholds govern waiting: ~0.1 s feels like direct manipulation, ~1 s keeps the train of thought unbroken (no spinner needed), and ~10 s is the ceiling of held attention — past it, background the work and let people move on.

**Helps users:** Matching loaders to these thresholds keeps the interface feeling alive and respects the user's attention.
**Apply:** Skeleton any content that loads in under 1 s.

### 4.3 · Memory, attention & perception

_What people remember, notice, and expect — the psychology behind where things go._

#### Serial-position effect
> _"First and last stick."_

In any list, the first items (primacy) and last items (recency) are recalled best; the middle sags. That's why the ends of a nav bar, a menu, or a sentence carry the most weight.

**Helps users:** Putting the most important actions at the start and end of a list means users remember and find them.
**Apply:** Put primary nav + key actions at the ends, not buried in the middle.

#### Peak–End rule
> _"They remember the peak and the end."_

Memory of an experience isn't an average of every moment — it's dominated by the single most intense point (the peak) and the final moment (the end). A flow with one delightful high and a clean finish is remembered as great, even if the middle was ordinary.

**Helps users:** Designing a clear peak moment and a graceful ending makes the whole product feel better in memory — and more likely to be returned to.
**Apply:** Engineer one 'aha' moment; end flows on a clean, positive note.

#### Zeigarnik effect
> _"Unfinished things nag at you."_

Incomplete tasks occupy memory more than finished ones — the mind keeps an open loop until it's closed. A profile that's '60% complete' or a checklist with items left creates a gentle pull to finish.

**Helps users:** Progress indicators and 'resume where you left off' use that pull to help users complete setup instead of drifting away.
**Apply:** Show a completion bar; let users resume an unfinished flow.

#### Von Restorff (isolation)
> _"The one that stands out wins."_

When several items are alike, the one that's visually different is the one noticed, remembered, and acted on. But it only works if it's the ONLY standout — two 'primary' buttons cancel each other and you're back to a flat field.

**Helps users:** One clearly distinct primary action guides the eye straight to the thing you want the user to do.
**Apply:** Make exactly one action the bold, filled one; everything else recedes.

#### Jakob's Law
> _"Yours should work like the rest."_

People spend almost all their time on OTHER products, so they arrive with a model of how things should work — where the cart icon is, what a link looks like, how search behaves. Matching that model means zero relearning; breaking it charges a tax you must be sure is worth it.

**Helps users:** Following familiar conventions makes a product instantly usable — people already know how to drive it.
**Apply:** Use the pattern users already know; deviate only for a real payoff.

#### Aesthetic–usability
> _"Pretty feels easier."_

People rate attractive interfaces as more usable — even when they aren't measurably easier — and forgive small flaws in a polished product. The trap: beauty can hide real usability defects in testing, so don't let polish substitute for function.

**Helps users:** Visual polish earns trust and patience, making the whole experience feel smoother and more credible.
**Apply:** Polish the surface — but validate that it's actually usable, not just pretty.

#### Postel's Law
> _"Accept messy in; give clean out."_

Be forgiving of what users type and strict about what you produce. Accept a phone number with spaces, dashes, or none; accept any date format; accept upper or lower case — then normalise it internally and show a clean, consistent result.

**Helps users:** Forgiving input means users don't get punished for formatting — fewer failed submissions and frustrated retries.
**Apply:** Accept spaces in card numbers, any date format, any case.

#### Law of Prägnanz
> _"The eye picks the simplest read."_

The brain resolves ambiguous visuals into the simplest, most regular interpretation it can — a cluster of shapes reads as one clean form if that's the simplest explanation. Simple, regular layouts are processed faster and feel calmer.

**Helps users:** A layout that reads as simple structure at a glance is quicker to understand and less tiring to use.
**Apply:** Reduce visual complexity; let the structure read in one glance.

#### Selective attention
> _"People miss what they're not seeking."_

Attention is a spotlight: people see what they're looking for and are genuinely blind to the rest — ad-shaped things in ad-shaped places get skipped entirely ('banner blindness'), even when they hold the answer. Put must-see signals in the natural scan path, not the periphery.

**Helps users:** Placing key information where the eye actually goes means users find it instead of scrolling right past.
**Apply:** Put key signals in the content scan path, never in ad-shaped corners.

### 4.4 · Gestalt principles of grouping

_How the eye assembles separate marks into meaning — these govern layout, spacing, and what reads as one group._

#### Proximity
> _"Close = related."_

Things near each other are read as a group; things apart, as separate. Spacing alone — no lines, no boxes — is the strongest grouping tool you have. Most 'cluttered' layouts are really evenly-spaced ones: even spacing destroys grouping.

**Helps users:** Correct spacing lets users parse a layout instantly — labels stay with their fields, items with their groups.
**Apply:** Give related things less space than their neighbours.

#### Similarity
> _"Same look = same kind."_

Elements sharing a visual trait — colour, shape, size — are perceived as belonging together, even when spread apart. It's how a scattered set of links all read as 'links.' Deliberately breaking similarity is how you say 'this one is special.'

**Helps users:** Consistent styling tells users what's the same kind of thing — and a break in it flags what's different.
**Apply:** Style a category the same; break the pattern for the odd one out.

#### Common region
> _"A shared border binds."_

Enclosing elements in a shared boundary — a card, a panel, a tinted background — groups them powerfully, even overriding proximity: two items in one box read as together even if a third is physically closer outside it.

**Helps users:** Cards and panels let users see at a glance which pieces belong together, no matter the spacing.
**Apply:** Wrap a set in a card when spacing alone can't carry the grouping.

#### Closure
> _"The mind completes the shape."_

Given partial cues, the brain fills in the rest to see a whole, familiar shape — a circle drawn with gaps still reads as a circle. This is why minimal icons work and why a few aligned corners imply a container that isn't fully drawn.

**Helps users:** Users recognise minimal icons and implied shapes instantly, so interfaces can be cleaner without losing meaning.
**Apply:** Trust the eye to complete a shape; don't over-draw every border.

#### Continuity
> _"The eye follows the line."_

The eye prefers to follow smooth, continuous paths — a line, an edge, a column of aligned elements — and reads things along that path as connected. This is the perceptual reason the grid works: alignment creates invisible lines that link content.

**Helps users:** Aligning elements to shared lines makes a layout feel ordered and guides the eye through it smoothly.
**Apply:** Align to a shared grid so the eye flows down connected lines.

#### Figure / ground
> _"Lift the object off the page."_

The eye instantly splits a scene into a 'figure' (the object of focus) and 'ground' (the background behind it). Contrast, shadow and a dimmed scrim are what make a modal or menu read as floating ABOVE the page rather than part of it.

**Helps users:** Clear figure/ground separation tells users exactly where to focus — a dialog reads as 'deal with me first.'
**Apply:** Use elevation + a scrim so overlays sit clearly above the page.

## 3 · Nielsen's ten usability heuristics

The evaluation checklist — inspect any screen against these.

1. **Visibility of system status** — Keep users informed through timely feedback — loading states, saved confirmations, current location.
2. **Match system & real world** — Speak the users' language; follow real-world conventions; natural, logical order.
3. **User control & freedom** — Clearly-marked exits, undo and redo; never trap the user in a state they can't leave.
4. **Consistency & standards** — Same words, actions and patterns mean the same thing everywhere; follow platform conventions.
5. **Error prevention** — Prevent problems before they occur — constraints, good defaults, confirmation on destructive actions.
6. **Recognition over recall** — Make objects, actions and options visible; don't force users to remember across the interface.
7. **Flexibility & efficiency** — Accelerators (shortcuts, presets) for experts, without slowing novices.
8. **Aesthetic & minimalist** — Every extra unit of information competes with the relevant ones. Keep only what serves the task.
9. **Recognise & recover from errors** — Plain-language messages that state the problem precisely and suggest a fix.
10. **Help & documentation** — Ideally none needed; when it is, make it searchable, task-focused, and concrete.

## 4 · Foundations

### The five planes (Garrett) — abstract to concrete

| # | Plane | Question it answers | What lives here |
| - | ----- | ------------------- | --------------- |
| 1 | Strategy | Why does this exist? Whose needs, whose goals? | User needs (JTBD) + business objectives. The North-Star and the core loop. |
| 2 | Scope | What features & content fulfil the strategy? | The set of features and content that satisfies the strategy. |
| 3 | Structure | How is it organised & how do users move? | Information architecture + interaction design: the nav spine. |
| 4 | Skeleton | What arrangement of elements enables use? | Interface, navigation & information design: layout, wireframes, the grid. |
| 5 | Surface | What does it look and feel like? | Visual design: the token system — colour, type, elevation, motion. |

### The core loop

**Discover** (Arrive with a need.) → **Onboard** (Grasp the value fast.) → **Core action** (Do the one valuable thing.) → **Feedback** (See the result / progress.) → **Return** (Come back; form the habit.)

## 5 · Accessibility — POUR & WCAG 2.2 AA

AA is the floor, not a feature.

- **Perceivable** — Text alternatives for non-text; captions; never colour alone; contrast ≥ 4.5:1 text / 3:1 large & UI; reflow to 320px and 400% zoom.
- **Operable** — Everything works by keyboard with visible focus order; targets ≥ 24px (40px recommended); no traps; honour reduced-motion.
- **Understandable** — Predictable behaviour and navigation; clear labels; inline error identification and suggestions; consistent components.
- **Robust** — Valid, semantic markup; correct name/role/value for every control (ARIA only when native won't do); status announced.

## 6 · The applied method — run it on every screen

1. **Frame it** — Which loop step and which job (JTBD) does this screen serve?
2. **One primary action** — Name the single thing the user should do; make it visually dominant (Von Restorff).
3. **Pick the pattern** — Choose the layout/component the relevant law or heuristic favours.
4. **Lay it out** — On the grid, using spacing, colour and type tokens; group by proximity.
5. **Design the states** — Empty, loading, error, success — not just the happy path.
6. **Write the words** — Action labels, helper text, error copy — verbs, blameless, with a fix.
7. **Accessibility pass** — Contrast, targets, focus, colour-independence — WCAG 2.2 AA.
8. **Critique it** — Score against the ten heuristics; note severity.

### Pre-ship checklist

- [ ] Exactly one primary action, clearly dominant.
- [ ] Everything on the grid; spacing from the scale.
- [ ] One brand colour; data/semantic colours consistent.
- [ ] Type from the scale; body ≥ 14px; ≤ 75-char lines.
- [ ] Empty / loading / error states designed.
- [ ] Labels are verbs; errors say what & how to fix.
- [ ] AA contrast; targets ≥ 40px; visible focus; not colour-only.
- [ ] Keyboard-operable; icons have labels.
- [ ] The screen visibly advances the core loop.

## Appendix · The canon

The shoulders this stands on:

- Nielsen — 10 Usability Heuristics
- Norman — The Design of Everyday Things
- Garrett — The Elements of User Experience
- Yablonski — Laws of UX
- Krug — Don't Make Me Think
- Tidwell — Designing Interfaces
- Wroblewski — Web Form Design
- W3C — WCAG 2.2
- Rodden et al. — HEART framework
- Citi GS+DT — Universal Experience Framework 1.0 (structural basis)

---

© 2026 Ankur Sinha — **Ankur Sinha UXD**. Attribution required.
Generated from the live framework at sinhaankur.com/framework.
