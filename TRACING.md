# Tracing a floor (guide for the group)

This guide is for tracing one floor of the SIIT Main Building from a photo of its fire-exit map. You do not need to write code. Work on a laptop with a mouse, and trace **one floor at a time**.

## 1. Start the tool

1. Open a terminal in the project folder.
2. Run `npm install` (only the first time), then:

   ```bash
   npm run dev
   ```

3. Open **http://localhost:5173/trace.html** in Chrome or Edge. (The normal map is at http://localhost:5173/.)

The tool only exists while `npm run dev` runs. It is never part of the published website.

## 2. Pick a floor and load the photo

- Click the floor number (1 to 5) at the top. A floor that has not been traced yet starts **empty**: the sample rooms are not copied, so nothing invented ends up in real data.
- Under **Floor plan photo** choose the picture file. The photo stays inside this browser tab. It is not uploaded and not saved anywhere.
- Use **Align photo**: click **3 spots on the photo** (building corners work best, far apart from each other), then the **same 3 spots on the black building outline**. The photo snaps into place, even if it was taken at a slant.
- Fine tune with the arrows, the rotate buttons and the size buttons. Move the opacity slider to see through the photo.

## 3. Trace the rooms (tool: Room)

- Click each corner of a room. Click the first point again (or press **Enter**) to close it. **Esc** cancels. **Backspace** removes the last point.
- Corners and walls snap to the outline and to neighbouring rooms, so shared walls match exactly. Right angles snap too; hold **Shift** to draw a free angle.
- With **Select**, click a room to fill in its details on the right: number, name, Thai name, type, department, other names, opening hours, contact, a short description in your own words. Drag a corner to move it, click the small dot in the middle of a wall to add a corner, select a corner and press **Delete** to remove it.
- Only type what you can see or have checked. Leave a field empty if you do not know it.

## 4. Corridors, doors, lifts and stairs

1. **Corridor node:** click along the middle of each corridor: every corner, junction and end. Clicking on an existing line splits it.
2. **Corridor line:** click one node, then the next, to join them. Press **Esc** to stop.
3. **Door:** click the wall of a room where its door is. The tool puts a door point just outside and joins it to the nearest corridor point. **Every room needs a door**, including restrooms, lifts and stairs.
4. **Lift / stairs:** click **+ New lift** or **+ New stairs** (or pick an existing one in the list), then click the lift or stairs room on each floor. One lift or stair shaft is one connector across all floors it serves.

Blue dots are corridor points, green dots are doors, a purple ring marks a lift or stairs door, an orange dot is not joined to anything.

## 5. QR points

Choose **QR point**, click the spot where the sign will be, drag the arrow to the direction a person faces when they scan it, then type an id (lowercase letters, digits and dashes, for example `lobby-north`).

**QR ids are permanent.** Printed codes link to `#/at/<id>`, so after you save, an id must never change or be reused. The tool refuses an id that is already used anywhere, including ids that were used before.

## 6. Fix the red list, then save

- The **Checks** box updates after every change. Click a problem to jump to it. Red items must be fixed; orange items are reminders (for example a room without a name yet).
- Press **Save floor**. If problems are left, the tool lists them and asks first. Saving writes your floor into `src/data/building.json`, keeps a copy of the old file in `.trace-backups/` (the newest 20) and marks the floor as traced. The **SAMPLE** badge in the app disappears once every floor is traced.
- Check the result in the app at http://localhost:5173/ : switch to your floor, tap rooms, and try **Directions** between two rooms.
- Undo with **Ctrl+Z**, redo with **Ctrl+Shift+Z**. Your work is autosaved in this browser as you go (without the photo), so a closed tab does not lose it. If saving fails, **Copy floor JSON** copies the floor data so you can send it to the project owner.

## Rules

- **No people** in photos, and no private notices or personal details. The photo is only for tracing and is never committed.
- **No copied text** from SIIT pages or signs. Write short descriptions in your own words.
- **Ids are permanent**: room ids, QR ids and node ids are created once and never reused. The tool handles room and node ids for you.
- Do not edit `src/data/building.json` by hand while the tool is open.
- Do not put names or personal data in any file in the repository.
