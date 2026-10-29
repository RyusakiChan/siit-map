# SIIT Map: Main Orchestra state

Running state of the coordinator session ("SIIT Main Orchestra"). Read this file first at the start of every session with the orchestrator role and after every `/clear`, before doing anything else. Keep it current: nothing important may live only in chat.

Last updated: 2026-10-29

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

- **Phase:** planning done; Week 1 not started (owner said "not yet" on 2026-10-29).
- **Repo:** no git repo yet. No app code, no packages installed.
- **Files:** `PLAN.md` (agreed plan), `AGENTS.md` (project rules and skill guide), `CLAUDE.md` (imports AGENTS.md), `orchestra.md` (this file), `.agents/skills/` (8 project skills, linked from `.claude/skills`).
- **Live site:** none.
- **Pending sessions or cards:** none.
- **Live temporary changes:** none.

## Decisions log

The full set of decisions is in `PLAN.md`. Changes after 2026-10-29:

- 2026-10-29: Taste Skill v2 (`design-taste-frontend`, app-screen run) copied into the project in place of the separate "minimalist" skill, which no longer exists in the repo.
- 2026-10-29: Model routing set: Opus 5.5 for orchestration and UI/UX design, Sonnet 5.5 (medium to xhigh) for coding.

## Open items

- Confirm on site that the Main Building has 5 floors and the OSM outline (way 195958489) matches it.
- Get SIIT staff approval before posting QR codes on walls.
- In a new session, check which `design-taste-frontend` loads (project copy or older global copy).

## Next steps

1. When the owner says go: Week 1. The orchestrator settles the UI/UX design first (phone layout, colors, panels), then briefs a Sonnet 5.5 coding session to set up the repo and build the 3D viewer on sample rooms inside the OSM outline.
2. Week 2: trace editor. Week 3: real data collection and tracing. Week 4: QR points, PWA, Thai/English polish, GitHub Pages deploy.
