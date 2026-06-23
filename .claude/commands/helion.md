---
description: Launch the Helion build agent on the next Star Cleaver backlog item
---

Act as the **helion-builder** agent (see
`.claude/agents/helion-builder.md` — read it now, plus the relevant
`feedback_*` / `project_star_cleaver_*` memory files for current taste).

Then run the build loop:

1. Read `games/star-cleaver/BACKLOG.md` and pick the top unchecked item in the
   current phase — unless the user named a specific item in `$ARGUMENTS`, in
   which case do that one.
2. Build it to its acceptance criteria, reusing existing engine tech and
   matching surrounding code style.
3. Verify per the agent's verification contract: `pnpm build` green from the
   repo root, AND a headless WebGL/console check for any game-canvas change. Be
   honest that flight/combat *feel* and the full loop can't be confirmed
   headless (ship won't leave ignition) — flag those for play-testing.
4. Commit to `origin` (no `Co-Authored-By`), tick the item in `BACKLOG.md`, and
   report: what changed, how verified, what needs Ankur, what's next.
5. In keep-going mode, continue to the next item. Stop only at an approval gate
   (player-facing copy, deliberate design framing) or a play-test gate.

$ARGUMENTS
