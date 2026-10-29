# SIIT Map: Project Plan

Agreed 2026-10-29. No code exists yet; this file is the source of truth for scope and decisions.

## What and who

- A 3D map of the 5-floor **SIIT Main Building**, Thammasat University Rangsit campus. It shows where each department, room and facility is.
- Mainly for visitors and students opening it on their phones.
- A solo student project with no official SIIT branding.
- One building first, built so other SIIT buildings can be added later.
- English by default with a Thai switch. Each room and department can have a Thai name.

## Stack and hosting

- Vite + React + TypeScript; Three.js through `@react-three/fiber` and `@react-three/drei` (one matching version set).
- Public GitHub repo, deployed to GitHub Pages.
- Works offline after the first visit, installable to the home screen (PWA).

## Data

- **Building outline:** OpenStreetMap footprint of the SIIT Main Building (OSM way 195958489, "อาคารหลัก สถาบันเทคโนโลยีนานาชาติสิรินธร"). The map must credit "© OpenStreetMap contributors" (ODbL).
- **Floor count:** 5, confirmed by the owner. OSM has no level tag for this building.
- **Rooms:** polygon outlines, not rectangles. Fields: id, number, name, Thai name, floor, department, type, description, hours, contact, photo.
- **Facilities:** restrooms, stairs, elevators, cafe, library and lobby are room types, not a separate system.
- **Departments:** a separate list. Each has a short summary written from the SIIT website in our own words, plus a link to the official page. Rooms refer to a department by id.
- **QR points:** id, floor, position and facing direction.
- **Interior source:** nothing room-level is public (checked 2026-10-29: no floor plans, room lists, room-number scheme or department-by-floor data online). Photograph each floor's fire-exit evacuation map to trace, then walk each floor once to note room names and numbers.
- **Until real data is in:** the real OSM outline with obviously fake sample rooms (for example "Sample Dept A") and a visible "SAMPLE" badge. Real floors replace the samples one at a time.
- **Photos:** taken by the owner, no people or private notices in frame, resized to small WebP files in `public/photos`.
- **All data in one file:** `src/data/building.json`, with TypeScript types beside it.

## 3D look

- Simple colored blocks on floor slabs, colored by department or type, with a legend.
- Polygon rooms let walls, doors or an imported model be added later without re-entering data.

## v1 features

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

## Trace editor (dev-only, not deployed)

- Load a floor-plan photo, scale and align it to the outline.
- Click room corners to draw polygons and fill in room details.
- Place QR points and drag an arrow for the facing direction.
- Check the data before export: duplicate ids, overlapping rooms, rooms outside the outline, unknown floors or departments.
- Export `building.json` and a printable sheet of labeled QR codes.

## QR codes on walls

- Demo with printed codes the owner holds.
- Stick codes on SIIT walls only after staff approve.

## Schedule (one month, one milestone per week)

1. **Week 1:** 3D viewer on sample rooms inside the real OSM outline: floors, tap for info, search, legend.
2. **Week 2:** trace editor and data checks.
3. **Week 3:** photograph fire-exit maps, trace the real floors, walk the floors for names and numbers, add photos and department details.
4. **Week 4:** QR points and printable sheet, offline PWA, English/Thai polish, deploy to GitHub Pages.

## Later (not in v1)

- Route-finding between rooms via stairs and elevators.
- Walls and doors, or an imported 3D model.
- Accessibility routes.
- Other SIIT buildings.

## Open items

- Confirm on site that the Main Building has 5 floors and that the OSM footprint matches it.
- Get SIIT staff approval before posting QR codes.
