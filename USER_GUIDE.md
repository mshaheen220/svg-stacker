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

The **Levels** panel on the right is ordered like the design: the level on top of the print is at the top of the list, and the base (Level 1, printed first) is at the bottom. Each card has a stripe in its filament color down its left edge. Each level is printed in one filament color, and by default each part gets its own level in the order it was drawn.

- **Reorder levels:** drag a level by its ⠿ handle, or use the ↑ / ↓ arrows, which move it up or down one level.
- **Jump a level to the top or the base:** use ⤒ (top of the design) and ⤓ (base) on its card. To see "what if the black outline were the top layer", click ⤒ on the black level.
- **Reverse the whole stack:** **⇅ Reverse stack** flips the print order of every level, so the top color prints first. The plate, if on, stays at the bottom. Press it again to get your original order back. With artwork whose first color is a big background shape, reversing puts that shape on top and covers everything else, so the per-level buttons are usually quicker for trying ideas. With the keyboard, focus the handle, press Space, move with the arrow keys, and press Space again to drop (Esc cancels).
- **Move parts between levels:** drag a part's ⠿ handle onto another level, or use its **Move…** menu. The menu can also create a new level at the top or bottom. Putting several parts on one level prints them in the same filament. If their colors differ, you'll see a warning and the first part's color is used.
- **Rename a part:** click its name and type. The name is used in OrcaSlicer. Clear it to go back to the default name.
- **Leave a part out:** untick its checkbox. A level with no ticked parts isn't printed.
- **Thickness:** set the **Base (level 1)** and **Other levels** defaults in the left panel's **Layers & thickness** section. To override one level, type a value in its header. Leave it blank to use the default. Each level shows its Z range, and the panel shows the total height.
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

## 5. Layers, filament swaps and opacity

The **Layers & thickness** section of the left panel makes sure the stack prints cleanly.

- Set **Layer height** and **First layer** to match your OrcaSlicer process. Both default to 0.2 mm.
- **Whole layers only** (on by default) rounds every level to a whole number of layers, so each color change falls exactly between two layers. A level card shows the rounding when it applies, for example "1.00 → 1.12 mm" at 0.28 mm layers.
- Each level card shows its **layer range** and what happens there:
  - **load … to start:** the filament to load before printing.
  - **⇄ swap to … before layer N:** where the printer should pause for the filament change.
  - **same filament as below, no swap:** two adjacent levels in the same color. You might merge them.
- **Opacity check:** a color only shows its own level's thickness on top of the level below. Light colors over dark ones are translucent when thin, for example white over black or yellow over brown. When a level is too thin to hide the color below it, its card shows a ⚠ with the thickness it needs. Click **Fix** to raise that level, or **Normalize all levels** to fix every level at once. Levels are only ever made thicker, never thinner.
  - **Dark colors need** (default 0.4 mm) and **White over black needs** (default 1.2 mm) set the range. Other color pairs fall in between, depending on how light the top color is and how much darker the color under it is. If your filaments are thin or translucent, raise the white-over-black value and normalize again.

## 6. 3D preview

Switch the preview to the **3D** tab to see the finished piece. It's built from the exact solid models that will be exported.

- **Drag** to orbit, **scroll** to zoom, and **right-drag** (or two-finger drag) to pan. **Reset view** brings the camera back.
- The **Levels 1–N** slider is shared with the 2D view. Drag it to watch the print build up color by color.
- **Explode** spreads the levels apart vertically, so you can see each level's shape and the wedding-cake support underneath.
- The legend lists each visible level with an upper-bound filament estimate in grams of PLA (as if printed solid), and the top bar shows the total size.
- Hover a level or part in the Levels panel to highlight it in 3D.

## 7. Export to OrcaSlicer

The **Export** section in the left panel creates the file you open in OrcaSlicer.

1. Check the **Object name**. It becomes the object's name in Orca.
2. Choose how **Filament swaps** are embedded:
   - **M600 filament change:** the printer runs its own filament-change routine. This needs firmware with M600 support, such as Marlin with *Advanced Pause*. Many Ender-3 V2 firmwares have it, some stock ones don't.
   - **M25 pause:** the printer pauses, you swap filament by hand, then resume from the screen. This works on stock Ender-3 V2 firmware when printing from the SD card.
   - **Printer profile's pause:** uses your OrcaSlicer printer profile's pause command (M25 on the Ender-3 V2 profile). These show up as pause markers on Orca's layer slider, where you can edit them.
   - **None:** no swaps in the file. Add them yourself in Orca using the layer numbers on each level card.

   With M600 and M25, the printer's screen shows which filament to load next, for example "Load L3 white #ffffff".
3. Set your **bed size** (220 × 220 mm for an Ender-3 V2). The object is centered on it, and you'll get a warning if it doesn't fit.
4. Click **Download 3MF for OrcaSlicer** and open the file in Orca. You'll see one object whose parts are named after your levels ("1. skin", "2. brown", …), already stacked at the right heights. Your current printer, filament and process settings stay selected.

**Important:** set Orca's **layer height** and **first layer height** to the values in **Layers & thickness** (0.2 / 0.2 by default). The swaps are placed for those layer heights.

**STL fallback:** **Download all levels as STL** gives you a zip with one STL per level, and single levels are under **Single-level STLs**. Each STL keeps its height, so importing them all as parts of one object rebuilds the stack. You'd then add the pauses by hand.

The gram figure in the 3D view assumes a 100% solid print, so it's an upper bound. Orca's estimate, with your infill, will be lower.

*More sections (arranging levels, exporting, color changes) will be added as those features land.*
