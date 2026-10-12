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
- Hover a part in the list to highlight it in the preview. The preview's **Parts** mode shows the merged geometry. **Original** shows the shapes as imported.
- **Strokes:** each stroked shape can be set to **Outline**, which makes the stroke its own part (great for a colored border ring around a circle), or **Ignore**. Very thin strokes (under 0.2 mm) are ignored by default. They're usually leftovers from auto-tracing and too thin to print.

*More sections (arranging levels, exporting, color changes) will be added as those features land.*
