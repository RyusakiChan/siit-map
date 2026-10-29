# SIIT Map: Main Orchestra state

Running state of the coordinator session ("SIIT Main Orchestra"). Read this file first at the start of every session with the orchestrator role and after every `/clear`, before doing anything else. Keep it current: nothing important may live only in chat.

Last updated: 2026-10-29 (after TU100 context)

## Role

The orchestrator session plans, makes design and product decisions, does the main UI/UX design, writes briefs, delegates building, reviews results and talks to the owner. It does not do large coding tasks itself; it hands them to coding sessions or subagents and checks their work.

## Model routing

| Work | Model | Effort |
|---|---|---|
| Orchestration, planning, decisions, scope changes | Opus 5.5 (`claude-opus-5-5`) | default |
| Main UI/UX design: layout, visual style, interaction, design reviews | Opus 5.5 (`claude-opus-5-5`) | default |
| Coding: routine, small or well-specified (config, data wiring, copy, small fixes) | Sonnet 5.5 (`claude-sonnet-5-5`) | medium |
| Coding: normal features (viewer UI, search, panels, PWA, QR sheet) | Sonnet 5.5 (`claude-sonnet-5-5`) | high |
| Coding: hard parts (3D scene and camera, trace editor geometry, polygon checks, tricky bugs) | Sonnet 5.5 (`claude-sonnet-5-5`) | xhigh |

- Coding goes to Sonnet 5.5 sessions or subagents (`model: "sonnet"`, effort per the table). The owner asked for this routing, so setting the effort explicitly is authorized.
- A coding brief that needs a design decision stops and asks the orchestrator; it does not decide the design itself.
- Read-only lookups can use a cheaper model.
- Codex is not used (subscription expired 2026-10-19).

## Delegation rules

- One coding session per set of files at a time; parallel sessions get their own worktree.
- Every brief names: the milestone, files or area, what done looks like, the checks to run, and the relevant `PLAN.md` and `AGENTS.md` rules.
- The orchestrator checks the diff or result before telling the owner something is done.
- After each milestone or release: write a report in `docs/ai-handoffs/` (commits, test results, decisions, open problems, next steps), update this file, then tell the owner `/clear` is safe and to start from `orchestra.md`.

## Current state

- **Phase:** base stack set up; plan revised to 3 weeks for the 20 Nov demo; Week 1 viewer not started.
- **Repo:** https://github.com/Mint-BKL/siit-map (public, branch `main`). First commit `3ff8707` (plan, rules, skills, base stack).
- **Base stack** (exact versions pinned in `package.json`): Vite 8.3.5, React 19.3.1, TypeScript 6.0.3 (held below 7 because typescript-eslint 8.72.1 supports <6.1), three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, zustand 5.0.16, Vitest 5.0.5, ESLint 10.13.0. No PWA, QR, router or i18n library yet (later weeks).
- **App today:** placeholder scene: 5 floor slabs, sample rooms on floor 1 extruded from `src/data/building.json`, tap to highlight, SAMPLE DATA badge, OSM credit. Lint, 6 data tests and build pass. Build warns the JS bundle is ~1.15 MB (316 kB gzipped) because of three.js; code-splitting is deferred.
- **Deploy:** `.github/workflows/deploy.yml` runs lint, tests, build, then deploys to GitHub Pages (Pages source set to Actions). Site: https://mint-bkl.github.io/siit-map/ First deploy (run 40858566689) succeeded on 2026-10-29; site returns 200.
- **Not in the public repo:** skills without a license file (`kien-thai`, `ui-ux-pro-max`, `web-design-guidelines`, `write-prose`) are git-ignored and stay local only. `.claude/skills` is ignored too; after cloning, run `Sync-CodexWorkspace.ps1 -Project <folder>`.
- **Files:** `PLAN.md` (agreed plan), `AGENTS.md` (project rules and skill guide), `CLAUDE.md` (imports AGENTS.md), `orchestra.md` (this file), `README.md`, `.agents/skills/` (8 project skills, 4 published).
- **Pending sessions:** "SIIT Map: presentation and context prep" (`local_860d1cec-b2e3-43c5-bdaf-688a920e35c3`), owner-driven. It writes only to `docs/context/` and `docs/presentation/`; plan-changing context comes back via `docs/context/proposed-plan-changes.md`.
- **Week 1 design:** draft phone mockups (10 screens, revised after map-app research in `docs/design/map-app-research.md`) on the Claude Design canvas https://claude.ai/artifact/7efu23pMgeHkUzourZdjoA (private to the owner until shared); tokens and rules in `docs/design/ui-spec.md`. **Awaiting owner review/approval** before the coding brief. A Pastel Mauve color variant of the same 10 screens is on a separate canvas for comparison: https://claude.ai/artifact/Hv8GVgX8PZwLZjjNkwg7bn (mauve neutrals, pink actions with dark labels for contrast, pastel sky/violet/teal departments, pill buttons). Owner to pick original or mauve.
- **Live temporary changes:** none.

## Decisions log

The full set of decisions is in `PLAN.md`. Changes after 2026-10-29:

- 2026-10-29: Taste Skill v2 (`design-taste-frontend`, app-screen run) copied into the project in place of the separate "minimalist" skill, which no longer exists in the repo.
- 2026-10-29: Model routing set: Opus 5.5 for orchestration and UI/UX design, Sonnet 5.5 (medium to xhigh) for coding.
- 2026-10-29: Repo created as `siit-map` (public) on the owner's request; base stack scaffolded by a Sonnet 5.5 agent (medium) and reviewed here. Workflow actions bumped to current majors (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5). Line endings forced to LF via `.gitattributes`.
- 2026-10-29: TU100 course context (`docs/context/`) changed the plan; owner decided: 3-week schedule to the **Fri 20 Nov live demo**, group collects data now in parallel; **GoatCounter** for traffic (the instructor's KPI); go public with sample data by ~5 Nov; credit "TU100 student project, SIIT, Thammasat University" + group name, no student names; full trace editor cut to a minimal trace tool; offline PWA is a stretch goal. Applied in `PLAN.md`.
- 2026-10-29: After map-app research, owner chose a vertical floor picker on the right and approved adding category chips, search empty state, room peek state, cross-floor hint, department letter badges, facility icons and a Key button. Data model to add aliases (EN/TH) and optional point amenities (IMDF names).

## Open items

- Confirm on site that the Main Building has 5 floors and the OSM outline (way 195958489) matches it.
- Get SIIT staff approval before posting QR codes on walls (through the instructor).
- Owner: create the GoatCounter account and give the site code (Claude must not create accounts).
- Owner: choose the group name for the credit line; assign group roles.
- In a new session, check which `design-taste-frontend` loads (project copy or older global copy).

## Next steps

1. **Week 1 (30 Oct – 5 Nov):** owner reviews the design draft (canvas + `docs/design/ui-spec.md`); after approval the orchestrator then briefs a Sonnet 5.5 coding session to build the viewer on sample rooms inside the real OSM outline, plus GoatCounter. Share the link publicly by ~5 Nov.
2. **Week 2 (6 – 12 Nov):** minimal trace tool; enter real floors as the group's data arrives.
3. **Week 3 (13 – 19 Nov):** QR points and printable sheet, Thai, polish, accessibility check, rehearsal. PWA only if time allows.
4. **Fri 20 Nov:** live demo with traffic numbers.
