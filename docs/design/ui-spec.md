# SIIT Map: phone UI spec (Week 1, draft for owner review)

Mockups (Claude Design canvases, private to the owner until shared):

- **Pastel Mauve (chosen colors, 2026-10-29):** https://claude.ai/artifact/Hv8GVgX8PZwLZjjNkwg7bn
- Original colors (layout reference only): https://claude.ai/artifact/7efu23pMgeHkUzourZdjoA

Status: **approved by the owner 2026-10-29** (Pastel Mauve colors, the 10 screens and the Motion section). The coding session builds from this file plus the Pastel Mauve canvas. Where the canvas and this file differ, this file wins (for example, the canvas's font stack starts with Inter; the app uses IBM Plex as below).

## Screens (390 × 844 phone frames)

Revised 2026-10-29 after `docs/design/map-app-research.md`: vertical floor picker on the right, quick-category chips, search empty state, room peek state, cross-floor hint, department letter badges, facility icons, Key button instead of an always-on legend.

| Screen | What it shows |
|---|---|
| Map · all floors | Search field, language button (ไทย/EN), About button; quick-category chips (Restrooms, Food & drink, Lifts & stairs, Study spaces); SAMPLE DATA badge; all 5 floors stacked; vertical floor picker on the right (All, 5–1); slim bottom bar with hint, Key button and OSM credit |
| Search · before typing | "Find nearby" category tiles (Restrooms, Food & drink, Lifts & stairs, Study spaces, Services, More), Popular places, Recent searches (kept on the phone only) |
| Room · peek | Single floor, chosen room raised and tagged; small card with name, code, floor, department letter badge, Share; swipe up for the full card |
| Search | Focused search; results grouped Rooms / Departments, each room with a department color bar, mono room number, name, department and floor; "Try also" chips (Restrooms, Lifts, Café, Student services) |
| Room · full card | Floor view with other rooms greyed out and the chosen room raised, outlined and tagged; bottom sheet with photo, number, name, Thai name, department, where / hours / contact, one-line description, "Department details" and Share |
| Department | Color bar, name, Thai name, short summary, office / hours / contact, link to the official page, room list, "Show all rooms on the map" |
| You are here (from QR) | Banner "You are here · Floor 2 · lift lobby · facing … when you scanned"; map turned to the scanner's view with a pin and a wide facing cone; department letters and facility icons on the rooms; "Near you" list; "Find a room from here" |
| Result on another floor | Map switches to the result's floor; banner "Now showing Floor 3 · You were on Floor 2 · go up one floor by lift or stairs"; lifts marked; picker shows the current floor and a dot on the previous one; peek card |
| Room selected · Thai | Same as Room selected in Thai, IBM Plex Sans Thai first, taller line height |
| About | What it is; credit card "[GROUP NAME] · TU100 student project, SIIT, Thammasat University · Not an official SIIT service"; data note with SAMPLE, OSM/ODbL credit, last updated; report-a-problem link; "Visits are counted without cookies or personal data" |

## Tokens (Pastel Mauve, chosen 2026-10-29)

Taken from the Pastel Mauve canvas. The original palette is kept in git history (commit `fb73861`).

| Token | Value | Use |
|---|---|---|
| ground | `#F3F1F3` | Map background |
| surface | `#FFFFFF` | Panels, sheets, secondary buttons |
| ink | `#1D161E` | Text, selection outline, room-number tag, SAMPLE badge |
| muted | `#594C5B` | Secondary text (passes 4.5:1 on ground and surface) |
| line | `#E7E4E7` | Borders, dividers, sheet grab handle |
| subtle line | `#F3F1F3` | List row dividers, floor picker dividers |
| placeholder fill | `#ECE7ED` | Photo placeholders |
| action | fill `#FCCEE8`, 1 px inset edge `#F9A8D4`, ink label | Primary buttons ("Department details", "Find a room from here"); pill shape |
| selected floor | fill `#FCE7F3`, 2 px inset ring `#F9A8D4`, label `#A3155F` | Current floor in the picker |
| you-are-here | `#F6339A` | Pin (white edge), facing cone (22% fill), halo (18% fill), banner icon only |
| floor slab | top `#F7F4F8` (viewed floor `#FFFFFF`), sides `#DDD5DE` / `#CBC1CC` | Floors; upper floors at ~55% opacity in the stacked view |
| dimmed room | top `#EBE6EC`, sides `#D6CFD7` / `#C6BDC8` | Rooms not selected |

Department and type colors (top / sides; sample names until real departments are known). Each differs in lightness as well as hue:

| Category | Top | Sides |
|---|---|---|
| Dept A (sky) | `#7CC8F8` | `#5AAEE0` / `#4796C4` |
| Dept B (violet) | `#B9A3FF` | `#9B84E6` / `#8670CC` |
| Dept C (teal) | `#5FDCC8` | `#3FC0AC` / `#2FA594` |
| Restrooms, café, other facilities | `#EADFEB` | `#D2C4D3` / `#BCAEBD` |
| Stairs, lifts | `#A89EA9` | `#8F8490` / `#7A6F7B` |

Pastel fills are too light for text on them: room numbers and letters sit on white badges or the ink tag, never directly on a pastel fill.

More departments will need more colors: run them through `/dataviz` before real data lands.

## Type

- IBM Plex Sans (English) and IBM Plex Sans Thai (Thai), weights 400/500/600; IBM Plex Mono 500 for room numbers. Google Fonts.
- Thai screens put Plex Sans Thai first and use line height 1.35–1.6.
- Sizes: screen title 28, room name 22 (Thai 21), body 14–15, labels 12 uppercase with 0.06em tracking.

## Rules

- Strong color goes on data (rooms, department bars, the pin). Chrome stays white and mauve-grey; the only colored chrome is the pale pink action fill and the selected-floor ring, both much lighter than the pin so the pin still stands out.
- Touch targets at least 44 px; corner radius 12 for square controls, 16 for sheets; primary buttons, the language button and chips are pills.
- Selection: the chosen room is raised, outlined in ink and tagged with its number; other rooms on that floor turn grey.
- Floor picker: vertical, right edge, 44 px buttons, current floor in the selected-floor style; a you-are-here pink dot marks the floor you came from.
- Color is never the only cue: each department has a letter badge (outlined in its color, ink letter) on the map and in lists; facilities have icons.
- Labels by zoom: in single-floor view big rooms always show their letter/name, small rooms and facility icons appear when zoomed in; the stacked view shows no room labels.
- Search results on another floor switch the floor automatically and say how to get there.
- The QR facing cone stays wide and is worded "when you scanned": the direction comes from the QR's wall, and people turn.
- Real buttons, links and labels; icon-only buttons have `aria-label`.
- No emoji, gradients or shadows.

## Motion (approved 2026-10-29)

Not shown on the canvases (they are static). For the coding session:

- Camera glides to a search result or QR spot (0.6–0.8 s) instead of jumping.
- Floor switch: from All to one floor, other floors slide apart and fade out (about 0.5 s); reverse when going back.
- Selected room rises and its outline fades in (about 0.25 s); other rooms fade to grey.
- "You are here" ring pulses softly every 2–3 s (the only looping animation).
- Room card slides up into peek and follows the finger to the full card.
- Buttons shrink to 98% when pressed; cross-floor banner slides down once.
- Gentle ease-out curves (Pastel Mauve's ease-out-expo); with `prefers-reduced-motion`, jump instead of glide and stop the pulse; keep 3D moves cheap for low-end phones.
