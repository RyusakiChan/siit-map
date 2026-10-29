# Week 1 viewer: report

## Run A (data layer and 3D map), 2026-10-29, Sonnet 5.5

Scope: brief tasks 1 and 2 plus a bare shell (floor picker, tap to select, SAMPLE badge, OSM credit). Run B (screens, search, routes, Thai switch, fonts, GoatCounter) not started.

### Commits (branch `claude/week1-viewer-4318f6`, not pushed)

| Hash | What |
|---|---|
| `591fd82` | Real OSM outline, IMDF types, sample floors, data tests |
| `923d103` | 3D map scene, floor picker, bare shell |
| `41e91cc` | Framing, label and stack-spacing tuning |
| `5e57c1b` | Map nudged clear of the picker; Run A screenshots |

(The session worktree branch is `claude/week1-viewer-4318f6`, not a branch named `week1-viewer`.)

### Checks

- `npm run lint`: pass. `npm test`: 13 pass (6 old + 7 new). `npm run build`: pass.
- Build size: before, one 1.15 MB chunk (316 kB gzip). After: main 243 kB (73 kB gzip) plus a lazy `BuildingScene` chunk of 994 kB (264 kB gzip). The controls render before three.js loads. The Vite warning for chunks over 500 kB remains (the scene chunk is three.js); not fixed.
- Touch spot-check (Playwright with CDP touch events, Edge, 390×844 and 360×740): a one-finger drag changed the azimuth (0.40 to -0.49 and -0.62); a two-finger pinch-out changed the distance (336 to 206, 319 to 196). Tapping room 2-06 selected it.
- Console: no errors except a 404 for the favicon (none exists yet).

### Screenshots (`docs/ai-handoffs/week1/`)

For each of 390×844 and 360×740: `1-stacked`, `2-floor2`, `3-selected`, `4-back-to-stacked`. They come from a throw-away script in the session scratchpad, not from the repo.

### What was built

- **Data:** `scripts/osm-outline.mjs` fetches OSM way 195958489 and writes a 13-point outline (about 71 × 62 m, north true) plus the origin lat/lon and `osmWay` into `building.json`. `scripts/gen-sample-data.mjs` writes 72 sample rooms (13/16/13/15/15 per floor), 3 departments (A, B, C), 2 QR points (`sample-f2-lift`, `sample-f1-lobby`) and 9 amenities. Each floor has restrooms, stairs at both ends and a lift; floor 1 has a lobby and a café; floor 3 has a library; floors 2 and 4 have an L-shaped room. All names start with "Sample", and Thai names are marked as draft.
- **Types:** IMDF unit names checked against OGC 20-094. `lab`, `meeting` and `cafe` became `laboratory`, `conferenceroom` and `foodservice`; `other` stays our own fallback. Amenity names `drinkingwater` and `charging` do not exist in IMDF, so the types use `drinkingfountain` and `powerchargingstation`. `defibrillator`, `prayerroom` and `information` are valid as written.
- **Tests:** room inside outline, no same-floor overlaps, unique department letters, QR points and amenities inside the outline, unique room numbers, a fake-names guard, and unit tests of the polygon helpers (`src/data/geometry.ts`).
- **Colors:** `src/theme/colors.ts`, with department colors keyed by department id.
- **Map:** the 5 stacked floors with upper slabs at about 55% opacity and no labels; a single-floor view with the others sliding apart and fading while a thin base slab stays; touch rotate, pinch and pan with limits (polar angle, distance, pan box); tap to select (the room rises, gets an ink outline and number tag, and the others go grey); department letter badges and facility icons by zoom; `prefers-reduced-motion` makes all moves instant. Camera glides use drei's `CameraControls`.

### Choices I made

- **Tap in the stacked view** selects the room and switches to its floor.
- **Floors are drawn 1.75× further apart** than their data elevation, for a readable stack (`STACK_SPREAD` in `BuildingScene.tsx`).
- **Camera:** the building is nudged left, with the fit padded, so the floor picker doesn't cover it on a phone.
- **Labels:** rooms of 200 m² or more are always labelled in the single-floor view; everything else appears when zoomed in. Every sample room is large, so this threshold will need a re-check on real data.
- **Bare-shell selected chip** at the bottom-left, showing number and name. It is a placeholder for the Run B peek card.
- **Dev handle:** `window.__rig` (camera controls) is set in dev only, for browser tests.
- **Room type names** follow IMDF with `other` kept (the brief's list).
- **Per-room materials** (two each, 144 in total) instead of one per color, so each room can fade to grey. Still no shadows.
- **Rendering** runs a continuous loop (`frameloop="always"`).
- **Fonts** not self-hosted yet (Run B); the shell uses system fonts, with IBM Plex named first in the CSS.

### Open problems

- Selection outline pops out instantly on deselect instead of fading.
- The scene chunk is 994 kB; splitting three.js further was not tried.
- Continuous rendering costs battery on phones; demand rendering was not attempted.
- Not verified on a real phone or GPU (swiftshader in headless Edge only). Performance on a mid-range phone is untested.
- Sample rooms tile the floor in a simple grid, so the sample map looks regular.

### Questions for the orchestrator

1. Is the 1.75× stack spread and the 200 m² label threshold fine, or do you want the artboard checked pixel for pixel before Run B?
2. Should tapping a room in the stacked view switch to its floor (as built), or only select it?

### What's left for Run B and Week 2

- Run B: fonts, hash router, search, peek and full room cards, department and About screens, Key sheet, Thai switch, QR route (`#/at/`) with the pin, GoatCounter.
- Week 2: real traced floors replace the samples; a label threshold review; real-device performance check.

Verdict: DONE
