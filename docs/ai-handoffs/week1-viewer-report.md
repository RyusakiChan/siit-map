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

(Run A verdict: DONE. The final verdict is at the end of the Run B section.)

## Run B (screens, search, routes, Thai, GoatCounter), 2026-10-29, Sonnet 5.5

Scope: brief tasks 3 and 4, plus the orchestrator's additions: demand rendering, outline fade-out, favicon, self-hosted fonts, and the real peek card instead of the bare chip.

### Commits (not pushed)

| Hash | What |
|---|---|
| `f758d6d` | Screens, search, hash router, i18n, config, fonts, favicon, demand rendering, outline fade, you-are-here pin |
| `3154b05` | Camera and animation fixes for demand rendering, Thai card fix, screenshots |

### Checks

- `npm run lint`: pass. `npm test`: 22 pass (13 data, 6 search, 3 router). `npm run build`: pass; the Vite warning for the 995 kB scene chunk remains.
- Build size now: main JS 281 kB (84 kB gzip), CSS 36 kB (12 kB gzip, includes the font rules), scene chunk 995 kB (264 kB gzip). The 18 font files are only fetched when their unicode range is used (Latin, Thai, Latin-ext).
- **Demand rendering** (measured with Playwright in headless Edge): floor-switch glides animate over about 0.8 s (target height 13.3, 9.9, 6.9 … 1.0 at 100 ms steps); with the QR pin on screen the pulse keeps drawing (885 draw calls in 1.5 s); an idle map draws 0. R3F's first frame after idle sees a huge delta and would finish every glide at once, so `FrameBridge` resets the clock on each wake-up and `ease` caps its step.
- The only console message in the Playwright runs is "Attempted to synchronously unmount a root while React was already rendering", logged on each `about:blank` navigation between test steps (React teardown, not seen in normal use). I did not chase it further.

### Screenshots

`docs/ai-handoffs/week1/b01…b22-*-390x844.png` and `*-360x740.png`, one per Done-when step: map, floor switch, room peek and full card, search empty, search `203`, result opened, search `5-02`, cross-floor banner, Restrooms category, department search, department screen, "Show all rooms on the map", `#/room/<id>`, `#/at/sample-f2-lift`, unknown room id, unknown QR id, About, Key, Thai map, Thai full card, Thai About. They come from a throw-away script in the session scratchpad (not in the repo). The Run A shots (`1-` to `4-`) are still there.

### What was built

- **Router** (`src/router.ts`): `#/`, `#/room/<id>`, `#/dept/<id>`, `#/at/<id>`, `#/about`. An unknown room or department id opens the map with a short "isn't on the map any more" note; an unknown QR id opens the normal map. A known QR id switches to its floor, glides to the spot with the camera facing the QR's direction, and draws the pin, a wide cone and the pulsing halo.
- **Search** (`src/search.ts`, tested): case- and space-insensitive over name, Thai name, number (`203` finds `2-03`), aliases (EN/TH), department and type words. Rooms first (5 shown, then "Show all"), then departments; "Try also" chips; category chips and tiles open a filtered list; "More" lists all types; Popular comes from `popular: true`; Recent (5 at most) is in `localStorage` inside try/catch.
- **Room card:** two snap points (peek, full) that follow the finger (pointer events on the header), a tap or the hint button toggles, a close button on the full card, a photo placeholder, share (Web Share API, else clipboard plus a "Link copied" note).
- **Cross-floor banner** slides down once, the picker shows a pink dot on the previous floor.
- **Department** screen with "Show all rooms on the map" (other rooms go grey, a chip clears it), **About** (group name from `src/config.ts`, last updated = build date, "Report a problem" hidden while `reportUrl` is empty), **Key** sheet (departments and facility icons).
- **Thai switch** (ไทย/EN, remembered in `localStorage`; defaults to Thai on a Thai browser): all UI strings in `src/i18n/strings.ts`, draft Thai flagged in a comment, Thai-first font stack and line height 1.5.
- **GoatCounter** (`src/analytics.ts`): no script and no counting while `goatcounterCode` in `src/config.ts` is empty (it is), and never in dev or on localhost. With a code it loads `gc.zgo.at/count.js` with `no_onload`, counts the first view and every hash change by path (`/`, `/room/<id>`, `/at/<id>`, `/dept/<id>`, `/about`). This is untested against a real GoatCounter account.
- **Fonts** self-hosted with `@fontsource` (Plex Sans 400/500/600, Plex Sans Thai 400/500/600, Plex Mono 500), pinned to 5.3.0. **Favicon** is `public/favicon.svg`. The selection outline now fades out on deselect.

### Choices I made

- **Search field** on the map is a button that opens the search screen, not a live input.
- **Services** tile and chip filter to lobbies only until real data says which rooms are student services; Study spaces filters to libraries.
- **Tapping a room** selects it without changing the hash; only Share and a direct link use `#/room/<id>`, which opens the full card.
- **Room card layout:** the full card has no map strip (it covers most of the screen); the canvas Room artboard was not read in detail, so the card follows the spec text.
- **OSM credit** sits in the bottom bar, or inside the card header while a card is open.
- **Desktop:** the same phone layout in a 430 px column, centred.
- **Department rooms list** shows only rooms that have a number.
- **Cone** is drawn over the rooms (no depth test) so it stays visible behind blocks.

### Open problems

- Not tested on a real phone or GPU, or in Safari; the Web Share path was not exercised.
- The department screen has no office, hours or contact rows (not in the data model yet), and the summaries are the fake placeholder text.
- The key sheet and screens are not tested with a screen reader; focus is not trapped inside the key sheet.
- Thai wording is a draft (Week 3).
- Bundle: the scene chunk is still 995 kB.

### Questions for the orchestrator

1. Should the full room card keep part of the map visible (as in the Room artboard), or is covering most of the map fine?
2. Is "Services = lobby only" fine until real data?

### What's left for Week 2

Real traced floors and department data, real photos, the review of the label threshold, a real-device performance and touch check, GoatCounter code, the report form link and the group name in `src/config.ts`, and the Thai polish with `kien-thai`.

(Run B verdict: DONE. The fix round below follows.)

## Run B fix round, 2026-10-29, Sonnet 5.5

Four review points from the orchestrator. Same branch, not pushed.

### What changed

1. **Full room card keeps the map visible.** The sheet is now 53% of the screen height, so at full the card top sits at about 47% (398 px of 844, 348 px of 740). The body follows the Room artboard: 96 px photo thumbnail beside the details, then the description and the Department details button; long content scrolls inside the sheet. The OSM credit left the card header: while the card is full it floats just above the sheet edge on the map (always visible, still links to the copyright page); in peek it stays in the card. At full the floor picker packs tighter (36 px buttons, moved up) so floor 1 is not hidden behind the card. That is below the 44 px touch target, only while the full card is open.
2. **Camera framing.** The old picker nudge is gone. The camera now uses a view offset that centres the map in the free area: below the top bar, chips and status row, above the bottom bar or the peek card or the full card, left of the picker. The offset eases when the card changes snap point. The fit distance is computed from the free width and height. Tapping a room on the map now also focuses it (as search does), so the room is framed in the free area above the card. The stacked view is tilted a little more from above (polar 0.85) and fills the free width; on a portrait phone the near-square building is width-limited, so a band of empty space above and below remains. I tried a lower azimuth to widen the fill, but the lower floors then ran off the left edge, so I kept 0.4. The room focus distance is a bit wider (0.72 of the floor distance) so more of the floor shows around the room.
3. **Language default.** English unless a remembered choice is saved. Checked with a `th-TH` browser: first visit is English; after switching to Thai and a reload it stays Thai.
4. **Empty rows.** Confirmed: Hours and Contact rows render only when the data has a value, and none of the sample rooms have one, so no `[HOURS]` placeholder can appear. The card shows only Where.

### Bug found and fixed on the way

The selected room's number tag (the black "2-06" label) was missing when a page opened directly on a room link (`#/room/<id>`), because drei's `Html` loses its content when it mounts in the very first commit. It now mounts one animation frame later. Tap and search selections were not affected.

### Checks

- `npm run lint`: pass. `npm test`: 22 pass. `npm run build`: pass (the 995 kB scene chunk warning remains).
- Screenshots retaken at 390×844 and 360×740 for all 22 steps (`docs/ai-handoffs/week1/b01…b22`), including the changed ones: b01, b02, b03, b04, b07, b09, b13, b14, b15, b21. I looked at b01, b03, b04, b09, b13, b14, b15, b21 and the 360×740 pair of b01, b04, b14, b15.
- Full card at 360×740: sheet top at 348 px, the picker ends at about 337 px.

### Open problems

- The room name can break at the hyphen ("Sample Meeting Room 2-" / "06") on a narrow card.
- Still not tested on a real phone or GPU.
- The picker's compact 36 px buttons below the 44 px target (full card only).

### Second pass on framing (after the orchestrator's review of the first fix)

The first fit used fixed padding, so single-floor views still ran under the picker. It is now measured:

- `fitPose` in `BuildingScene.tsx` projects the building outline (the one floor, or the whole stack) through the real camera at the current angles and searches for the camera distance at which its screen bounding box fits the free rectangle; then it shifts the picture so the box is centred in that rectangle.
- Free rectangle: left 16 px; right = screen width − 62 px (picker plus 8 px gap); top 158 px (below top bar, chips, status row and banner); bottom = bottom bar, or the top of the peek card minus 8 px, or the top of the full card minus 24 px (room for the floating OSM credit).
- A selected room no longer zooms in: the whole floor is fitted above the card, with the room outlined and tagged. Search, tap, route and QR all use this. QR keeps its facing direction. The fit re-runs when the card changes between none, peek and full, and on resize, keeping the user's current angles.
- Tilt is a little more top-down (0.6 stacked, 0.65 single floor) and the start azimuth is 0.15, which the exact fit now allows without clipping the lower floors.
- Fixed a bug in the first fix: the full-card bottom was measured as 53% of the screen height instead of from the card's top.
- Checked in b01, b02, b03, b04, b07, b09, b13, b14, b15 at both sizes: the whole outline sits inside the rectangle, no badge is cut off, nothing under the picker.
- The stacked view is still width-limited: on a 390 px phone the near-square building fills the 312 px free width and about 260 px of the 580 px free height. It cannot grow further without cropping.
- Retaken: all 22 screenshots at both sizes. `npm run lint`, `npm test` (22) and `npm run build` pass.

Verdict: DONE

