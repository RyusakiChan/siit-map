# How public map apps organise and design things

Research for the SIIT Map phone UI, done 2026-10-29 by a research agent (about 47 web lookups), reviewed by the orchestrator. Sources: Apple Maps and its design guidelines, Google Maps, Apple's indoor data standard (IMDF, now an OGC standard), MazeMap (as used at VUB and Oulu universities), Mappedin, MapsIndoors, Mapbox's indoor guide, Esri Indoors, the University of Melbourne and MIT campus maps, Material 3, WCAG and ISO 7001. Links are in the source list at the end.

## What they do

### Categories

- **Three kinds of thing, kept apart.** IMDF separates **units** (physical spaces: classroom, laboratory, office, restroom, elevator, stairs…), **amenities** (point facilities: drinking fountain, ATM, charging point, prayer room, first aid, defibrillator, student services…) and **occupants** (who is inside: a department, a shop). A room is a unit; a department is an occupant of it.
- **Only a few categories are shown as quick buttons**, almost always facility-style: food and drink, restrooms, first aid/AED, bike parking, services (MazeMap). Google shows a short chip row with a "More" button.
- **One place can be in several categories** (Mappedin, MapsIndoors), with at most one level of sub-category.
- **Every name can have aliases in several languages** (IMDF `name` and `alt_name`). Campus maps also make room codes searchable; MIT's codes carry the floor (`26-100` is floor 1).

### Search

- Search sits at the top and shows results as you type; short result lists (Melbourne shows 5) with a way to see more.
- Result rows show the name, the room code, and the building and floor.
- The empty search state shows popular places (Mappedin "Top locations").
- Share and Save sit on results and place cards (Google).

### Place card

- A sheet from the bottom with a grab handle and two states: a small **peek** (name, type, floor) and a **full** view (Material 3, Apple).
- Order on Apple's card: picture, name, category, then tiles for hours, contact and address.
- Main actions sit near the top: Directions, Share (a link to the place), Save (MazeMap). Related places shown up front, not behind "show more" (Mappedin).
- Keep the chosen place visible on the map while the card is open (Apple).

### Floors

- Floor picker is a small control on the **side or corner** (Google bottom-right, Apple top-right, MazeMap right side), shown only when zoomed into a building.
- Short labels: a list of floor numbers is enough (Apple).
- **Other floors are hidden, not dimmed**, in single-floor view; a thin base slab keeps the building shape visible (Mapbox).
- When something is on another floor, Mappedin shows hints at the stairs and lifts ("go to floor 3").

### Map look

- A **muted base map** so the important content stands out (Apple's "muted" style).
- The selected item gets an **outline and a color change** (Apple).
- Labels appear as you zoom in, without overlapping; overlapping pins are grouped (Apple, Mappedin).
- **Color is never the only cue**: pair it with an icon, letter or text (WCAG 1.4.1, Apple).
- Legends are rare; apps rely on icons plus color.
- "You are here": a dot with a beam showing direction; a wide beam means the direction is uncertain (Google). Phone compasses are unreliable indoors (Pointr).
- Avoid safety-sign colors (the ISO 3864 greens, reds, blues and yellows) for ordinary categories (ISO 7001, secondary source).

## How our draft compares

| Area | Our draft (`docs/design/ui-spec.md`) | Common practice | Verdict |
|---|---|---|---|
| Data | Rooms with a `type`, plus departments | Units, amenities and occupants kept apart | Close. Rooms = units, departments = occupants. **Add small point amenities** (water, AED, charging, prayer room) later. |
| Names | Name + Thai name | Name + aliases in each language | **Add aliases** (old names, common nicknames, room code variants). |
| Quick categories | Chips only on the Search screen | Chip row on the main screen | **Add a chip row** under the search bar on the map. |
| Search results | Color bar, room code, name, department, floor | Name, code, floor | Matches. **Add an empty state** with popular places. |
| Room card | One half-height sheet | Peek and full states | **Add a peek state**; full view on swipe up. |
| Card actions | "Department details" + Share | Share, Save, Directions near the top | Fine without routing. Save is optional (no accounts; could be saved on the phone). |
| Floor picker | Full-width row at the bottom (All, 1–5) | Small vertical picker on the side | **Decision for the owner** (see below). |
| Other floors | Hidden in single-floor view, stacked in "All" | Hidden, with a thin slab | Matches. |
| Floor numbering | 1–5 | Match the building's own signs | Matches, **check on site** (G or 1 for the ground floor). |
| Cross-floor results | Not designed | Hint which floor and how to get there | **Add**: auto-switch floor and say "Floor 3 · take the lift". |
| Base map | Muted greys, color on rooms | Muted base, color on content | Matches. |
| Color only cue | Department color bars and legend | Color plus icon or letter | **Add a letter or icon** to each department color; facilities get icons. |
| Legend | Always-visible legend in the bottom panel | Rare; icons do the work | **Shrink it** to a "Key" button, once rooms have icons. |
| Labels | Floor labels only on the viewed floor | Labels by zoom, no overlap | **Add zoom rules**: big rooms always, small rooms and icons when zoomed in. |
| You are here | Pin + fixed facing cone from the QR code's stored direction | Dot + beam, wide when uncertain | Ours is better than a compass (the QR knows its wall), but people turn: **label it "facing … when you scanned"** and keep the cone wide. |
| Colors | Blue, orange, teal, warm grey, cool grey, raspberry pin | Avoid safety colors | Fine; avoid pure safety green, red and yellow for future departments. |

## Proposed changes to the mockups

1. Add a **quick-category chip row** under the search bar on the map: Restrooms, Food & drink, Lifts & stairs, Study spaces, Services, More.
2. Add an **empty search state** with popular places and recent searches.
3. Give the room card a **peek state** (name, code, floor, department) and the **full state** we have now.
4. Add a **cross-floor hint**: when a result is on another floor, the map switches and shows "Floor 3 · take the lift or stairs".
5. Give each **department a letter badge** (A, B, C…) next to its color, and **facility icons** (restroom, lift, stairs, café) on the map; turn the always-on legend into a **Key** button.
6. Reword the QR banner to **"Facing the north rooms when you scanned"**, and keep the cone wide.
7. **Floor picker**: either keep the full-width bottom row (thumb-friendly, clear "All") or move to a small vertical picker on the right like Google, Apple and MazeMap (frees space for the chip row). Owner decides.

## Data model changes (for the coding brief, not the mockups)

- Add `aliases` (English and Thai) to rooms and departments, searched alongside names and codes.
- Add optional point **amenities** (`id`, `floor`, `position`, `type`: drinking water, AED, charging, prayer room, info desk…), separate from rooms, using IMDF's amenity names.
- Use IMDF's unit category names for room `type` where they fit (classroom, laboratory, office, restroom, elevator, stairs, foodservice, library, lobby).

## Not found or uncertain

- Google and Apple indoor place-card details and search placeholder wording; Apple's own floor-picker guidance (the top-right placement comes from a third-party article).
- Any Thai university map with room-level indoor data.
- Heathrow, Westfield, Stanford and current Changi map details; AIGA symbol details.
- IMDF category names were read through a summarising tool: re-check exact spellings before using them in code.
- MazeMap details come from university deployments, not MazeMap's own design docs.

## Sources

- IMDF (OGC 20-094): https://docs.ogc.org/cs/20-094/index.html · Unit: https://docs.ogc.org/cs/20-094/Unit/index.html · Categories: https://docs.ogc.org/cs/20-094/Categories/index.html
- Apple Human Interface Guidelines, Maps: https://developer.apple.com/design/human-interface-guidelines/maps
- Apple indoor program FAQ: https://register.apple.com/resources/indoor/program/faq
- Google Maps help: https://support.google.com/maps/answer/3092445 · indoor floors: https://support.google.com/maps/answer/2803784
- Google blog, direction beam: https://blog.google/products/maps/always-know-which-way-youre-headed-with/
- MazeMap at VUB: https://www.vub.be/en/explore-vub-campus-with-mazemap · Oulu user manual: https://ict.oulu.fi/wp-content/uploads/2025/02/v1.2-mazemap-user-manual-for-oulu-university-english.pdf
- Mappedin web app v2: https://www.mappedin.com/resources/blog/product-launch-responsive-web-app-v2/ · Blue dot: https://developer.mappedin.com/web-sdk/blue-dot
- MapsIndoors categories: https://docs.mapsindoors.com/products/cms/categories
- Mapbox indoor mapping: https://docs.mapbox.com/help/dive-deeper/indoor-mapping.md
- Esri floor filter: https://doc.esri.com/en/arcgis-pro/latest/help/data/indoors/visualize-floor-aware-data-using-the-floor-filter.html
- Material 3 bottom sheets: https://m3.material.io/components/bottom-sheets/guidelines
- WCAG 2.2, Use of Color: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- OSM indoor levels: https://wiki.openstreetmap.org/wiki/Tag:indoor=level
- University of Melbourne maps: https://maps.unimelb.edu.au/about · MIT maps: https://web.mit.edu/Facilities/maps/index.html
- Pointr FAQ: https://www.pointr.tech/technology/faq
- ISO 7001 (Wikipedia summary): https://en.wikipedia.org/wiki/ISO_7001
