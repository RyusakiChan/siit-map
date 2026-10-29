# Week 1 brief: phone viewer on sample data

Written 2026-10-29 by SIIT Main Orchestra. **Not started:** the owner starts the coding session when ready.

- **Milestone:** Week 1 (30 Oct – 5 Nov) in `PLAN.md`: viewer on sample rooms inside the real OSM outline, ready to go public by about 5 Nov.
- **Two runs, one after the other, both Sonnet 5.5 (orchestra.md routing):**
  - **Run A, effort xhigh:** tasks 1 (data) and 2 (map), plus a bare shell: floor picker, tap to select, the SAMPLE badge and the OSM credit. Report, then stop. The orchestrator reviews before Run B.
  - **Run B, effort high:** tasks 3 (screens, search, routes, Thai switch) and 4 (GoatCounter), on the same branch after the review.
  - If the 3D scene or camera stalls, stop and report instead of guessing.
- **Where:** its own git worktree on branch `week1-viewer`. Commit there in small steps. **Do not push, merge or deploy**: a push to `main` deploys the public site. The orchestrator reviews and merges. **The design canvas is read-only:** read it, never publish to it.

## Read first

1. `AGENTS.md` (project rules), `PLAN.md` (scope).
2. `docs/design/ui-spec.md`: approved screens, tokens, rules and Motion. **This file is the source of truth.**
3. The Pastel Mauve canvas (owner-private, open it with the Artifact tool's read action): https://claude.ai/artifact/Hv8GVgX8PZwLZjjNkwg7bn. It has 10 artboards (`project/Main.dc.html`, `SearchEmpty`, `Search`, `RoomPeek`, `Room`, `Department`, `YouAreHere`, `CrossFloor`, `RoomThai`, `About`). Copy the layout, sizes, icons and wording from them. Where the canvas and the spec differ, the spec wins.
4. `docs/design/map-app-research.md`, section "Data model changes".
5. The current code: `src/` is a placeholder (about 100 lines). Rewrite it freely.

## Design questions

Coding sessions do not make design decisions. If something is not covered by the spec or canvas and changes how the app looks or behaves (a new screen, a different control, a new color), send a message to SIIT Main Orchestra and wait. For small gaps (a spacing value, an empty-state line), choose what is closest to the canvas and list it under "Choices I made" in the report.

## Decisions already made for this brief

- **Routes (hash routing, for GitHub Pages):** `#/` map, `#/room/<id>`, `#/dept/<id>`, `#/at/<id>`, `#/about`. `#/at/<id>` and `#/room/<id>` become permanent once real data and printed codes exist: don't change their shape. Sample ids (`sample-*`) are **not** permanent and are never printed. They disappear when real floors land, so an unknown room id opens the map with a short "This room isn't on the map any more" note, and an unknown QR id opens the normal map. Share buttons copy `…/#/room/<id>` (Web Share API when available, otherwise the clipboard plus a short "Link copied" note).
- **Fonts self-hosted** with `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-sans-thai` (weights 400/500/600) and `@fontsource/ibm-plex-mono` (500), with exact versions pinned. Don't use Google Fonts, because the About page promises no personal data, and self-hosting also helps the stretch PWA.
- **No new UI, search or router libraries.** Use React, drei and zustand. Write the hash router, search and bottom sheet yourself. drei's `CameraControls` is fine for camera glides.
- **Search** runs in the app over the room name, Thai name, number, aliases (EN/TH), department name and type. Make it case- and space-insensitive, and match room numbers with or without the dash (`203` finds `2-03`). Group results as Rooms, then Departments, and show 5 rooms with "Show all".
- **Category chips and tiles** (Restrooms, Food & drink, Lifts & stairs, Study spaces, Services) open Search filtered to those room types. "More" lists all types.
- **Popular places** come from a `popular: true` flag on rooms. **Recent searches** live in `localStorage` (at most 5). Wrap every read and write in try/catch, and the app must work without it.
- **Thai:** the ไทย/EN switch works now. Keep UI strings in one table (`src/i18n/`) with English and draft Thai. Thai wording is polished in Week 3 with `kien-thai`, so mark the draft Thai strings with a comment. Thai screens use Plex Sans Thai first and line height 1.5.
- **"You are here":** only the route and data in Week 1. `#/at/<id>` with a known QR point switches to its floor and places the pin and wide cone. With an unknown id it opens the normal map. The full You-are-here sheet ("Near you", banner) is Week 3, so skip it.
- **About:** the group name comes from a config value (`src/config.ts`), with "TU100 student group" until the owner gives the name. Hide "Report a problem" until there is a form link in config. "Last updated" is the build date.

## Tasks

### 1. Data

- **Real outline:** fetch OSM way 195958489 (`https://api.openstreetmap.org/api/0.6/way/195958489/full.json`). Convert it to metres around its centroid with an equirectangular projection, with x east and z south (−z is north). Keep north true; don't rotate the building to fit the screen, because QR facing depends on it. Save the outline and the origin lat/lon in `building.json`. Add the script that did this (`scripts/osm-outline.mjs`) so it can be rerun. Set `building.name` to "SIIT Main Building".
- **Types** (`src/data/types.ts`):
  - Rooms get `aliases?: string[]`, `aliasesTh?: string[]` and `popular?: boolean`.
  - Departments get `letter` (A, B, C…), `aliases?` and `aliasesTh?`.
  - Add `amenities: Amenity[]` (`id`, `floor`, `position`, `type`), using IMDF amenity names such as `drinkingwater`, `defibrillator`, `charging`, `prayerroom` and `information`. Check the exact spellings in OGC 20-094 before using them.
  - Rename room types to IMDF unit categories where they fit: `classroom`, `laboratory`, `office`, `conferenceroom`, `lobby`, `foodservice`, `library`, `restroom`, `stairs`, `elevator`, `other`. Check the exact spellings first.
- **Sample content** across all 5 floors, about 10–14 rooms per floor:
  - Use obviously fake names only ("Sample Dept A", "Sample Lab 2-03"). No real SIIT names.
  - Use 3 sample departments with the spec's sky, violet and teal colors and letters A, B and C.
  - Give every floor restrooms, stairs at both ends and a lift.
  - Floor 1 gets a café and a lobby; one floor gets a library.
  - Add a few popular rooms, a couple of aliases, Thai names on some rooms, and one sample QR point (for example `sample-f2-lift`) for testing `#/at/`.
  - Every polygon must sit inside the outline.
- **Data tests** (`building.test.ts`): keep the current tests and add these:
  - every room polygon lies inside the outline;
  - no two rooms on the same floor overlap (a polygon-intersection check with a small tolerance);
  - department letters are unique;
  - QR points and amenities sit inside the outline on an existing floor;
  - room numbers are unique.
- **Colors:** department colors and letters live in code (`src/theme/`), keyed by department id. Room colors for each type come from the spec's tokens.

### 2. Map (3D)

- **All floors:** the 5 floors stacked, with upper slabs at about 55% opacity, as in the `Main` artboard. Show no room labels in this view.
- **One floor:** the other floors are hidden, with a thin base slab kept. Rooms are colored by department or type, and large rooms show their department letter or facility icon. Small rooms and icons appear when the camera is closer (spec "Labels by zoom"). Only the floor being viewed gets labels.
- **Touch:** rotate, pinch-zoom and pan, with limits so the building can't be lost or flipped. Tapping a room selects it.
- **Selection:** the room rises and gets an ink outline plus an ink number tag. Other rooms on the floor turn the dimmed-room grey.
- **Motion:** follow the spec's Motion section, including `prefers-reduced-motion`.
- **Performance:** keep it fast on a mid-range phone. Use one material per color, limit the number of `Html` labels, and use no shadows. Lazy-load the 3D scene so the search bar and controls render first, which may also fix the 1.15 MB bundle warning.

### 3. Screens

Build them in this order, matching the artboards:

1. `Main`: search field, language button, About button, chip row, SAMPLE DATA badge, vertical floor picker (All, 5–1), bottom bar with hint, Key button and OSM credit.
2. `SearchEmpty` and `Search`.
3. `RoomPeek` and `Room`: a bottom sheet with two snap points (peek and full) that follows the finger. Show the photo placeholder when there is no photo.
4. `CrossFloor`: picking a result on another floor switches floors and shows the banner. The picker gets a pink dot on the previous floor.
5. `Department`, then "Show all rooms on the map" (highlight that department's rooms).
6. `About`, then a **Key** sheet listing department letters and colors plus facility icons.
7. `RoomThai`: the Thai version of the full card.

Phone first: 360–430 px wide, safe-area insets, 44 px touch targets. On desktop the same layout sits in a centered column or with a side panel; keep it simple.

### 4. GoatCounter

- Load `https://gc.zgo.at/count.js` with `data-goatcounter` built from `src/config.ts`'s `goatcounterCode`. Leave the code **empty for now**; the owner will supply it. While it is empty, load no script.
- Count manually: the first view and every hash route change, as a path (`/`, `/room/<id>`, `/at/<id>`, …), so each QR spot shows up separately. Don't count in dev or on localhost.
- Don't set cookies or send any other data.

## Done when

- `npm run lint`, `npm test` and `npm run build` pass. Note any build warnings in the report.
- **Playwright** (`playwright-cli` skill) runs at 390×844 and 360×740 with touch:
  - load the map;
  - switch floors;
  - tap a room and open the full card;
  - search `203` and open the result;
  - search a room on another floor and see the cross-floor banner;
  - open a department;
  - open `#/room/<id>` and `#/at/sample-f2-lift` directly;
  - switch to Thai;
  - open About and Key.
- Save screenshots of each step to `docs/ai-handoffs/week1/`.
- Spot-check that the 3D view rotates and zooms by touch.
- Nothing real or personal is in the data, and the OSM credit is visible on the map and in About.
- The dev-only rule is unaffected: no trace tool yet.

## Report

Add `docs/ai-handoffs/week1-viewer-report.md` with:

- the commits (hashes);
- check results, with the build size before and after;
- screenshots;
- "Choices I made" (small gaps you filled);
- open problems;
- questions for the orchestrator;
- what's left for Week 2.

End with one line, `Verdict: DONE | PARTIAL | BLOCKED | NEEDS-DECISION`.
