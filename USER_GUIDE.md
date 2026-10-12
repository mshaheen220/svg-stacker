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

*More sections (arranging levels, exporting, color changes) will be added as those features land.*
