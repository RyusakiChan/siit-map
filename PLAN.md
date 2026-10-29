# SIIT Map: Project Plan

Agreed 2026-10-29, revised the same day after the TU100 course context (`docs/context/`). This file is the source of truth for scope and decisions.

## What and who

- A 3D map of the 5-floor **SIIT Main Building**, Thammasat University Rangsit campus. It shows where each department, room and facility is.
- Mainly for visitors and students opening it on their phones.
- **Project 2 of TU100 Civic Engagement** (semester 1/2026), built by a student group of about 10. The owner leads and builds the app; members take roles such as data collection, photos, staff interviews, QR printing and the presentation.
- **Final presentation: Fri 20 Nov 2026**, a live demo of the web map plus a presentation. The instructor judges effectiveness by **traffic** (how many people use the map).
- No proposal form and no budget (0 baht), confirmed by the instructor.
- One building first, built so other SIIT buildings can be added later.
- English by default with a Thai switch. Each room and department can have a Thai name.

## Credit and branding

- The app has no official SIIT branding (no logos).
- The app's About and the printed QR signs say "TU100 student project, SIIT, Thammasat University" plus the group name. No student names in the app or the public repo.

## Stack and hosting

- Vite + React + TypeScript; Three.js through `@react-three/fiber` and `@react-three/drei` (one matching version set).
- Public GitHub repo, deployed to GitHub Pages: https://mint-bkl.github.io/siit-map/
- **Traffic counter: GoatCounter.** Free for non-commercial use, no cookies, no personal data. Counts page views and each QR link (`/at/<id>`) as its own path, so QR scans per spot are visible. Offline visits are not counted. The owner creates the GoatCounter account and gives the site code.
- Offline/installable PWA is a **stretch goal**, only if Week 3 has time.

## Data

- **Building outline:** OpenStreetMap footprint of the SIIT Main Building (OSM way 195958489, "อาคารหลัก สถาบันเทคโนโลยีนานาชาติสิรินธร"). The map must credit "© OpenStreetMap contributors" (ODbL).
- **Floor count:** 5, confirmed by the owner. OSM has no level tag for this building.
- **Rooms:** polygon outlines, not rectangles. Fields: id, number, name, Thai name, floor, department, type, description, hours, contact, photo.
- **Facilities:** restrooms, stairs, elevators, cafe, library and lobby are room types, not a separate system.
- **Departments:** a separate list. Each has a short summary written from the SIIT website in our own words, plus a link to the official page. Rooms refer to a department by id.
- **QR points:** id, floor, position and facing direction.
- **Interior source:** nothing room-level is public (checked 2026-10-29). The group photographs each floor's fire-exit evacuation map and walks each floor to note room names and numbers, **starting now**, in parallel with the viewer. The instructor will help reach SIIT staff for room information.
- **Until real data is in:** the real OSM outline with obviously fake sample rooms (for example "Sample Dept A") and a visible "SAMPLE" badge. Real floors replace the samples one at a time.
- **Photos:** taken by group members, no people or private notices in frame, resized to small WebP files in `public/photos`.
- **All data in one file:** `src/data/building.json`, with TypeScript types beside it.

## 3D look

- Simple colored blocks on floor slabs, colored by department or type, with a legend.
- Polygon rooms let walls, doors or an imported model be added later without re-entering data.

## Features for the 20 Nov demo

1. 3D view with all floors spread apart, or one floor at a time (lower floors faded).
2. Tap a room to highlight it and open its info panel: name, number, department, department details, hours, contact, photo.
3. Search by name, number or department; the map switches floor and moves the camera to the room.
4. English/Thai switch.
5. "You are here" QR codes:
   - At key junctions: elevator and stair lobbies, entrances and corridor ends, about 4 to 6 per floor.
   - Each code stores a facing direction, so the camera matches the scanner's real view.
   - Link format is fixed, for example `…/#/at/<id>` (hash routing for GitHub Pages). Once codes are printed, this format and the ids must never change.
6. Labels only on the floor being viewed, to keep phones fast.
7. Phone-first layout with touch rotate and zoom.
8. GoatCounter traffic counting, including per-QR-spot counts.
9. An About panel with the credit line and the OSM credit.

## Trace tool (dev-only, not deployed)

The full trace editor is cut down to a **minimal trace tool**, to save time:

- Load a floor-plan photo, scale and align it to the outline.
- Click room corners and copy the polygon coordinates; room details are typed into `building.json` by hand.
- Click a spot and drag an arrow to get a QR point's position and facing.
- The data check (duplicate ids, overlapping rooms, rooms outside the outline, unknown floors or departments) runs as a test, not in the tool.
- A printable sheet of labeled QR codes is generated by a small script in Week 3.

## QR codes on walls

- Demo with printed codes the group holds.
- Stick codes on SIIT walls only after staff approve; ask through the instructor early, since wall QR codes drive traffic.

## Schedule (3 weeks to the 20 Nov demo)

1. **Week 1 (30 Oct – 5 Nov): viewer and go-live.** 3D viewer on sample rooms inside the real OSM outline: floors, tap for info, search, legend, About, GoatCounter. **Share the link publicly by about 5 Nov** with the SAMPLE badge, to start building traffic. In parallel, the group photographs fire-exit maps, walks the floors, and asks staff (through the instructor) for room information and QR approval.
2. **Week 2 (6 – 12 Nov): real data.** Minimal trace tool; trace the real floors and enter names, numbers, departments, photos and department summaries. Real floors replace the samples as they are done; the SAMPLE badge goes when all five are real.
3. **Week 3 (13 – 19 Nov): QR and polish.** QR points and printable sheet, put codes up (if approved), Thai text, phone polish, accessibility check, rehearse the demo. Offline PWA only if time allows.
4. **Fri 20 Nov:** live demo and presentation, with the GoatCounter traffic numbers.

**If time runs short, cut in this order:** offline PWA, printable QR sheet styling (print plain codes instead), Thai polish beyond the key labels, room photos.

## Later (not in the demo)

- Route-finding between rooms via stairs and elevators.
- Walls and doors, or an imported 3D model.
- Accessibility routes.
- Other SIIT buildings.

## Open items

- Confirm on site that the Main Building has 5 floors and that the OSM footprint matches it.
- Get SIIT staff approval before posting QR codes (through the instructor).
- Owner: create the GoatCounter account and give the site code.
- Owner: choose the group name for the credit line, and assign group roles.
