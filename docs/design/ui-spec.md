# SIIT Map: phone UI spec (Week 1, draft for owner review)

Mockups: Claude Design canvas "SIIT Map – Phone UI" (private to the owner until shared): https://claude.ai/artifact/7efu23pMgeHkUzourZdjoA

Status: **draft, not yet approved by the owner.** The coding session builds from this file plus the canvas once approved.

## Screens (390 × 844 phone frames)

| Screen | What it shows |
|---|---|
| Map · all floors | Search field, language button (ไทย/EN), About button; SAMPLE DATA badge; all 5 floors stacked; bottom panel with floor switcher (All, 1–5), legend, OSM credit |
| Search | Focused search; results grouped Rooms / Departments, each room with a department color bar, mono room number, name, department and floor; "Try also" chips (Restrooms, Lifts, Café, Student services) |
| Room selected | Floor view with other rooms greyed out and the chosen room raised, outlined and tagged; bottom sheet with photo, number, name, Thai name, department, where / hours / contact, one-line description, "Department details" and Share |
| Department | Color bar, name, Thai name, short summary, office / hours / contact, link to the official page, room list, "Show all rooms on the map" |
| You are here (from QR) | Banner "You are here · Floor 2 · lift lobby, facing …"; map turned to the scanner's view with a pin and facing cone; "Near you" list; "Find a room from here" |
| Room selected · Thai | Same as Room selected in Thai, IBM Plex Sans Thai first, taller line height |
| About | What it is; credit card "[GROUP NAME] · TU100 student project, SIIT, Thammasat University · Not an official SIIT service"; data note with SAMPLE, OSM/ODbL credit, last updated; report-a-problem link; "Visits are counted without cookies or personal data" |

## Tokens

| Token | Value | Use |
|---|---|---|
| ground | `#F4F3EF` | Map background |
| surface | `#FFFFFF` | Panels, sheets, buttons |
| ink | `#15171C` | Text, primary buttons, selected floor, selection outline |
| muted | `#565B66` | Secondary text (passes 4.5:1 on both grounds) |
| line | `#DEDBD3` | Borders, dividers |
| subtle line | `#EFEDE8` | List row dividers |
| placeholder fill | `#ECEAE4` | Photo placeholders |
| you-are-here | `#C2255C` | Pin, facing cone (22% fill), banner icon only |
| floor slab | top `#EEECE6`, sides `#D3D0C8` / `#C3BFB6` | Unselected floors; upper floors at ~55% opacity in the stacked view |
| dimmed room | top `#E3E0D9`, sides `#CCC8BF` / `#BCB8AE` | Rooms not selected |

Department and type colors (top / sides; sample names until real departments are known). Each differs in lightness as well as hue:

| Category | Top | Sides |
|---|---|---|
| Dept A | `#3B6FD9` | `#2D57AD` / `#24488F` |
| Dept B | `#E07B28` | `#B5611D` / `#934E17` |
| Dept C | `#2E9E8F` | `#237C70` / `#1C655B` |
| Restrooms, café, other facilities | `#D6D1C4` | `#B9B4A7` / `#A29D90` |
| Stairs, lifts | `#8E95A1` | `#6F7682` / `#5C626D` |

More departments will need more colors: run them through `/dataviz` before real data lands.

## Type

- IBM Plex Sans (English) and IBM Plex Sans Thai (Thai), weights 400/500/600; IBM Plex Mono 500 for room numbers. Google Fonts.
- Thai screens put Plex Sans Thai first and use line height 1.35–1.6.
- Sizes: screen title 28, room name 22 (Thai 21), body 14–15, labels 12 uppercase with 0.06em tracking.

## Rules

- Color goes on data (rooms, department bars, the pin), not on chrome. Primary buttons are ink, not colored.
- Touch targets at least 44 px; corner radius 12 for controls, 16 for sheets.
- Selection: the chosen room is raised, outlined in ink and tagged with its number; other rooms on that floor turn grey.
- Floor labels only on the floor being viewed (the stacked view shows F1–F5 at the slab edges).
- Real buttons, links and labels; icon-only buttons have `aria-label`.
- No emoji, gradients or shadows.
