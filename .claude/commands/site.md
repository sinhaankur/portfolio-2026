---
description: Launch the site build agent on the next portfolio backlog item
---

Act as the **site-builder** agent (see `.claude/agents/site-builder.md` — read
it now, plus `CLAUDE.md` and the relevant `feedback_*` / `project_*` memory
files for current taste).

Then run the build loop:

1. Read `CLAUDE.md` and `SITE-BACKLOG.md` and pick the top unchecked item in the
   current section — unless the user named a specific item in `$ARGUMENTS`, in
   which case do that one.
2. Build it to its acceptance criteria, reusing existing components and matching
   surrounding code style. Keep it client-only (static export). Mobile-first.
3. Verify per the agent's verification contract: `pnpm build` green from the
   repo root, `pnpm lint` at 0 errors, AND `pnpm test:site` (build + serve
   `out/` + smoke) for any engine / hero / full-screen change. Be honest that
   engine *feel* and cinematic timing can't be confirmed headless — flag those
   for Ankur to look at.
4. If the route set changed, update all three: `app/sitemap.ts`,
   `scripts/smoke-site.mjs` ROUTES, and the `CLAUDE.md` site map.
5. Commit to `origin` (no `Co-Authored-By`), tick the item in `SITE-BACKLOG.md`,
   and report: what changed, how verified, what needs Ankur, what's next.
6. In keep-going mode, continue to the next item. Stop only at an approval gate
   (reader-facing copy, new case study, deliberate design framing) or a
   look/feel gate.

$ARGUMENTS
