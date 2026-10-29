# SIIT Map

3D web map of the 5-floor SIIT Main Building, Thammasat University Rangsit campus. Read `PLAN.md` first: it holds the agreed scope, decisions and the weekly milestones. Change scope only with the owner's agreement, and update `PLAN.md` when a decision changes.

## Orchestrator role

The coordinator session ("SIIT Main Orchestra") reads `orchestra.md` first, at its start and after every `/clear`, before doing anything else, and keeps it current. `orchestra.md` also sets which model does what: Opus 5.5 for planning, decisions and main UI/UX design; Sonnet 5.5 (medium to xhigh effort) for coding. Coding sessions follow their brief and ask the orchestrator before making design decisions.

## Project rules

- **No invented real data.** Until a floor is traced from real sources, rooms use obviously fake names ("Sample Dept A", "Sample Lab 3-02") and the app shows a "SAMPLE" badge. Never put real SIIT department names on made-up rooms.
- **All building content lives in `src/data/building.json`.** Rooms are polygon outlines. Facilities (restrooms, stairs, elevators, cafe, library, lobby) are room types. Departments are a separate list that rooms refer to by id.
- **QR links are permanent.** The format `…/#/at/<id>` and every printed QR id must never change or be reused. Add new ids instead.
- **Credit OpenStreetMap.** The building outline comes from OSM way 195958489 (ODbL); the map must show "© OpenStreetMap contributors".
- **Public repo.** Photos must show no people or private notices, and are stored as small WebP files in `public/photos`. No credentials or personal data in the repo.
- **Department text** is a short summary in our own words with a link to the official SIIT page; never copy SIIT text wholesale.
- **The trace editor is dev-only** and must not ship in the GitHub Pages build.
- **Phone first.** Check every UI change at phone width with touch controls.

## Skills

Project skills live in `.agents/skills/` (`.claude/skills` links to it). They are copies, so they don't change when the global versions are updated.

| Skill | Use it for | When |
|---|---|---|
| `ui-ux-pro-max` | Phone layout and usability: info panel, search, floor switcher, legend | Weeks 1, 2, 4 |
| `design-taste-frontend` | Taste Skill v2 visual style. Follow its app-screen run (`references/app-screens.md`), not the landing-page run | Weeks 1, 4 |
| `playwright-cli` | Browser tests at phone size: tap a room, search, open a QR link | Weeks 1, 4 |
| `kien-thai` | Natural Thai for room names, department names and app text | Weeks 3, 4 |
| `write-prose`, `anti-ai-writing-slop` | Short department summaries and README text | Week 3 |
| `web-design-guidelines` | Accessibility and usability review before deploy | Week 4 |
| `security-best-practices` | Light check before going public: repo contents, PWA cache | Week 4 |

These come with Claude Code and are not copied here: `/init`, `/run` (launch the app and check a change), `/dataviz` (department and room-type colors, legend), `/code-review` and `/simplify` (before closing each milestone), `/security-review`.

Taste Skill's scripts need Node 22+ and a local Chrome or Edge; `assets.mjs` calls public image APIs. Its source and review notes are in `.agents/skills/design-taste-frontend/SOURCE.txt`.
