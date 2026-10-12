# SVG Stacker (user guide)

SVG Stacker turns a colored SVG (for example a logo or an avatar drawn in Inkscape) into a stacked sign you can print on a single-extruder printer with manual filament changes. Each color gets its own level. Every level is solid under the levels above it, so nothing floats.

## 1. Import your SVG

Click **Choose SVG…** or drop a file onto the box. The preview shows exactly what was understood from the file. Tick **Show flattened outlines** to see the polygon outlines that will be printed.

- **Curve tolerance** controls how closely curves are followed. The default of 0.05 mm is finer than a 0.4 mm nozzle can print, so you rarely need to change it.
- Sizes come from the file's width and height (mm, in, or px at 96 dpi). You'll be able to set an exact target width when exporting.

### Preparing files in Inkscape

- Convert text to paths: **Path → Object to Path**.
- Unlink clones: **Edit → Clone → Unlink Clone**.
- Name shapes in the **Layers and Objects** panel. Those names become part names in OrcaSlicer.
- Gradients are replaced with a single solid color.

## 2. Check the parts

Shapes are grouped into **parts**. Each part is one filament color in the finished print.

- Shapes with the same Inkscape name and the same color become one part, named after the label. If one label covers several colors, each gets its own part, e.g. "background (white)" and "background (rose)".
- Unnamed shapes are grouped by color and named like "teal #008080".
- The preview's **Print** mode shows what will print, and **Original** shows the shapes as imported. See section 4.
- **Strokes** (left panel): each stroked shape can be set to **Outline**, which makes the stroke its own part (great for a colored border ring around a circle), or **Ignore**. Very thin strokes (under 0.2 mm) are ignored by default. They're usually leftovers from auto-tracing and too thin to print.

## 3. Arrange the levels

The **Levels** panel on the right lists levels from the bottom (Level 1, printed first) to the top. Each level is printed in one filament color, and by default each part gets its own level in the order it was drawn.

- **Reorder levels:** drag a level by its ⠿ handle, or use the ↑ / ↓ arrows. With the keyboard, focus the handle, press Space, move with the arrow keys, and press Space again to drop (Esc cancels).
- **Move parts between levels:** drag a part's ⠿ handle onto another level, or use its **Move…** menu. The menu can also create a new level at the top or bottom. Putting several parts on one level prints them in the same filament. If their colors differ, you'll see a warning and the first part's color is used.
- **Rename a part:** click its name and type. The name is used in OrcaSlicer. Clear it to go back to the default name.
- **Leave a part out:** untick its checkbox. A level with no ticked parts isn't printed.
- **Thickness:** set the **Base (level 1)** and **Other levels** defaults in the left panel. To override one level, type a value in its header. Leave it blank to use the default. Each level shows its Z range, and the panel shows the total height.
- **Highlighting:** hover a level or part to highlight it in the preview.

### Saving your arrangement

Your work is autosaved in this browser. Re-opening the same SVG keeps your arrangement. To keep it somewhere safe, or to use it on another computer, click **Save arrangement…** to download a small `.stacker.json` file. Later, import the same SVG and click **Load arrangement…**. If the SVG has changed, parts are matched by name and color, and you'll see a note. **Reset** returns everything to the defaults for the current SVG.

## 4. Support, plate and size

These settings are in the **Support & size** section of the left panel.

- **Support fill** (on by default) makes every level solid wherever any level above it has something, like a stepped wedding cake. Nothing ever prints in mid-air. If you turn it off, each level is only its own shape, and any level with nothing directly underneath gets a red "will float" warning.
- **Background plate** adds a bottom level that covers the whole design plus a **margin**, in a **color** you pick. It becomes Level 1 and uses the base thickness.
- **Clearance** shrinks every level above the base slightly inward. This is useful if your printer over-extrudes edges. Leave it at 0 otherwise.
- **Final size:** untick **Original size** to set a **target width** in mm. That's the full width, including any plate. The panel shows the final width × depth × height.
- **Nozzle:** anything narrower than 2 × nozzle width (0.8 mm for a 0.4 mm nozzle) is flagged. Those levels show a ⚠ with the affected area, and the preview hatches the spots in red. Thin features depend on the final size, so making the print bigger often fixes them. You can also thicken the lines in Inkscape.

### Checking it in the preview

**Print** mode shows the finished piece from above. Drag the **Levels 1–N** slider to watch it build up level by level. This is the easiest way to see the support fill at work. Tick or untick **Thin features** to show or hide the red hatching.

*More sections (arranging levels, exporting, color changes) will be added as those features land.*
