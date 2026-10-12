# SVG Stacker (developer guide)

A browser-only tool that turns a multicolor SVG into a stacked "wedding cake" 3MF for OrcaSlicer: one color per level, every level solid wherever a level above needs support, ready for manual filament swaps (M600) on a single-extruder printer.

End-user instructions are in [USER_GUIDE.md](USER_GUIDE.md).

## Quick start

```bash
# Docker, hot reload        → http://localhost:5181
docker compose -f docker-compose.dev.yml up --build -V   # -V refreshes node_modules after dependency changes

# Docker, production build  → http://localhost:8181
docker compose up --build

# Or natively (Node 24)
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5181 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Vitest suite (unit tests + sample-SVG sanity tests) |
| `npm run typecheck` | `tsc -b --noEmit` |

Sample-SVG tests read from `samples/` and are skipped when a file is missing. To eyeball parser output against the originals, run `RENDER_DIR=/some/dir npx vitest run tests/render-samples.test.ts`, which writes the flattened geometry back out as SVG.

## Architecture

Client-only: React 19 + TypeScript + Tailwind v4, built with Vite. No backend. All files stay in the browser.

```
src/
  lib/svg/      SVG → flattened mm-space shapes
    parse.ts      DOM walk: styles (attr < <style> < style=), inheritance,
                  nested transforms, viewBox/units, Inkscape labels/layers
    flatten.ts    svgpath normalization + tolerance-bounded bezier flattening
    colors.ts     CSS color parsing, friendly names ("teal")
    matrix.ts     transform parsing/composition
    units.ts      mm/in/pt/px (96 dpi) lengths
  lib/geometry/ region.ts: clipper2-ts wrapper. Regions are integer µm Paths64
                (outer +, holes -), fill-rule-aware fills, stroke outlines
  lib/layers.ts planLevels(): filament color per level, swap points, and
                the opacity check; normalizeArrangement()
  lib/geometry/stack.ts  arrangement → printed solids: scaling to target
                width, support fill, plate, clearance, visible regions,
                thin-feature and floating-area checks
  lib/geometry/mesh.ts  manifold-3d (WASM) extrusion of each level's solid
                into a watertight mesh (print coords, Z up, y flipped up)
  lib/export/   threemf.ts (OrcaSlicer project 3MF), stl.ts (binary STL, zip)
  workers/      stack.worker.ts: computeStack, then buildMeshes, off the
                main thread
  lib/parts.ts  shapes → parts (merge key "label|#color"), footprints
  lib/arrangement.ts  levels (bottom → top), per-part name/enabled, thickness
                settings, reconcile-with-parts, Z ranges, sidecar validation
  store/        useProject: zustand store; persist middleware autosaves to
                localStorage (only source data + arrangement; parse/parts are
                re-derived). useStack: debounced worker results (stack +
                meshes). useView: shared preview state (tab, level slider,
                explode)
  components/   UI (levels/ = dnd-kit level editor; preview/ = 2D SVG view,
                lazy-loaded react-three-fiber 3D view, error boundary)
  hooks/        useTheme (day / night / system)
tests/          vitest
scripts/orca/   slice-check.sh: slice an export with the OrcaSlicer CLI and
                report where each swap landed
```

The parser walks the DOM itself instead of using `getComputedStyle`/`getScreenCTM`, so it behaves the same in the browser and in Node tests.

Coordinates are millimetres, y-down, page origin. The flip to y-up happens at mesh time.

### Parts

Shapes merge into a part when they share the same Inkscape label (own label, or the enclosing Inkscape layer's) **and** color. The same label in different colors is split into "label (color name)". Unlabeled shapes merge by color and are named "teal #008080". A stroke can become its own geometry (a ring for closed paths, capped for open ones) colored by the stroke. Strokes under 0.2 mm default to *ignore* because auto-traced art often carries stale-colored hairlines. Default part order is the paint position of each part's first shape. The part key (`label|#color`) is what saved arrangements refer to.

### Levels and arrangements

An `Arrangement` is an ordered list of levels (index 0 = bottom). Each level holds part keys and an optional thickness override. Per-part settings hold the rename and enabled flag. Global settings are the base (level 1) and default thicknesses. `printedLevels()` is the single source of truth for what prints: levels with no enabled parts are skipped, the base thickness applies to the first *printed* level, and it returns Z ranges.

`reconcile()` keeps an arrangement valid whenever the part list changes (stroke-mode toggle, tolerance change, sidecar applied to a different SVG). Missing keys are dropped. New parts get their own level just above the level holding the part painted before them.

**Sidecar format** (`*.stacker.json`): `{ app: "svg-stacker", format: 1, appVersion, svgName, svgHash, tolerance, strokeModes, arrangement }`. `svgHash` is FNV-1a of the SVG text and is only used to warn when a sidecar is applied to a different file. `parseSidecar()` validates and clamps everything, because the file is untrusted input.

**Autosave:** the localStorage key is `svg-stacker:project`. Persist's `merge` re-derives parse/parts on hydration. Storage errors such as quota or private mode are swallowed.

### Layers, swaps and opacity

`printedLevels()` owns all Z math. With `snapToLayers` on, the first printed level is `firstLayerHeight + n·layerHeight` and the others are `n·layerHeight`, rounded to the nearest whole layer with at least one. That puts every level boundary exactly on a layer boundary. Each level also carries `layerStart` (the 1-based slicer layer number of its first layer), `layerCount`, `requested` (before snapping) and `aligned`. Values are rounded to 1e-6 so floating-point drift never misaligns a boundary.

`planLevels()` adds each level's filament color (first enabled part, or the plate color) and its swap kind: `start` (the first level), `swap` (pause before `layerStart`) or `same` (same filament as the level below, no pause). It also adds the opacity requirement:

```
minOpaque = minDark + (minLight − minDark) · L*top/100 · min(1, (max(0, L*top − L*below) + ½·Δchroma) / 100)
```

A darker color underneath counts fully, a hue difference counts half, and a lighter color underneath barely counts. With snapping on, the result is rounded **up** to whole layers. `normalizeArrangement()` only ever raises levels, writing per-level overrides.

### Stacking (`computeStack`)

Inputs are the arrangement, the parts and their footprints (SVG page mm). Output regions are in **final print mm** (integer µm), scaled to `targetWidth` (which includes plate margins), with the bounding box at (0, 0). Y is still down.

1. Union the enabled footprints per printed level and place them (scale and translate).
2. Walk top-down keeping a running union. With **support fill**, `solid_k = ∪ footprints ≥ k`; otherwise `solid_k = footprint_k`. The **plate** is `offset(∪ everything, margin)` and is always the bottom printed level, using the base thickness.
3. **Clearance** offsets every level above the first inward.
4. `visible_k = solid_k − ∪ solids above` (used for the top-view color), `unsupported_k = solid_k − solid_{k−1}` (floating area), `thin_k = solid_k − opening(solid_k, 2 × nozzle)`. Opening means shrinking by half the width and growing back. Slivers smaller than ½·w², which are mostly shaved sharp corners, are ignored.

On detailed art this takes about 200–350 ms, so `useStackRunner` (mounted once in `App`) debounces changes by 120 ms and posts them to `workers/stack.worker.ts`. Stale responses are dropped by request id. If workers are unavailable it falls back to the main thread.

### Meshes and the 3D preview

The worker answers each request twice: first `{kind: "stack"}` (2D is ready right away), then `{kind: "meshes"}` (about 100 ms on the samples). Mesh buffers are posted as transferables. `buildMeshes` turns each level's Clipper region into a manifold `CrossSection` (`NonZero`, because flipping y reverses winding), extrudes it by the level's thickness, translates it to `zStart`, checks `status() === "NoError"`, and returns xyz positions, triangle indices and volume. `tests/mesh.test.ts` asserts every directed edge has exactly one reverse twin, so the meshes are closed and consistently oriented. These are the meshes the exporters will write.

The WASM is loaded with `manifold-3d/manifold.wasm?url` and passed as `locateFile`. Node tests let it find the file itself, and that test file uses `// @vitest-environment node`. `Preview3D` (three + drei, about 0.9 MB) is `React.lazy`-loaded with the 3D tab. It rotates the Z-up print into three's Y-up, uses `flatShading` (manifold shares vertices across faces), and shows a per-level legend with PLA grams at 1.24 g/cm³.

### 3MF export (OrcaSlicer format)

The layout mirrors a project written by OrcaSlicer 2.4.2. I checked it against real projects in the author's library and against Orca's source.

| File | Contents |
| --- | --- |
| `3D/3dmodel.model` | One assembly object (id = parts + 1) made of `<component p:path="/3D/Objects/object_1.model" objectid=i>` entries. The build item centers it on the bed: `1 0 0 0 1 0 0 0 1 bedX/2 bedY/2 0`. |
| `3D/Objects/object_1.model` | One mesh `<object id=i>` per level. XY is centered on the origin, Z runs from the bed up. |
| `Metadata/model_settings.config` | `<object>` name, plus `<part id=i subtype="normal_part">` with `name` ("3. hair med") and extruder 1 for every part. These names are what Orca's object list shows. |
| `Metadata/custom_gcode_per_layer.xml` | `<layer top_z type extruder color extra gcode/>` entries and `<mode value="SingleExtruder"/>`. |
| `[Content_Types].xml`, `_rels/.rels`, `3D/_rels/3dmodel.model.rels` | Standard OPC plumbing. |

No `project_settings.config` is written, so Orca keeps the user's current printer, filament and process presets.

**Swap semantics, from Orca's source:**
- `CustomGCode::Type` is `ColorChange=0, PausePrint=1, ToolChange=2, Template=3, Custom=4`.
- `print_z` is the first layer printed with the new filament. `ToolOrdering::assign_custom_gcodes` matches it to the layer whose band contains it (a midpoint test), and the G-code is emitted right after the layer change, before any extrusion on that layer. So `top_z` is the **top Z of the new level's first layer** (`StackLevel.firstLayerTopZ`).
- **Type 0 is not used:** in Orca 2.4 the ColorChange emission block in `GCode.cpp` is `#if 0` ("BBS: inserting color gcode is removed"), so a single-extruder color change would emit nothing.
- The exporter instead uses `Custom` (4), whose `extra` is emitted verbatim (`M117 Load L3 white\nM600` or `…\nM25`; newlines are written as `&#10;`), or `PausePrint` (1), which emits the printer profile's `machine_pause_gcode` (`M25 ;pause print` on the Creality Ender-3 V2 profile).

**Verification:** `scripts/orca/slice-check.sh export.3mf any-orca-project.3mf` borrows a full `project_settings.config` from a project saved with your printer, slices it with the Orca CLI, and lists the layer and Z of every `M600`/`M25`/`M117`. On both samples, every swap landed on exactly the layer the app reports. `EXPORT_DIR=dir npx vitest run tests/export.test.ts` writes the sample 3MFs (set `EXPORT_SWAP` to choose the mode).

**STL fallback:** binary STL per level, in print coordinates. Each level already sits at its Z, so importing all of them as parts of one object reassembles the stack.

**Drag and drop:** one `DndContext` with prefixed ids (`L:` level, `P:` part, `D:` level drop zone). Pointer collision and the keyboard coordinate getter are both filtered so levels only target levels and parts only target parts or drop zones. Every drag action also has a button or select equivalent.

### Roadmap

1. ✅ Scaffold, plus import and 2D preview
2. ✅ Grouping into parts (label/color merge, stroke handling)
3. ✅ Level editor (drag-and-drop, thickness, rename, toggle, JSON sidecar, autosave)
4. ✅ Support fill, background plate, clearance, thin-feature warnings
4½. ✅ Layer normalization: whole layers, swap points, opacity check
5. ✅ 3D preview with a level scrubber
6. ✅ 3MF and STL export (swaps embedded, verified with the OrcaSlicer CLI)
7. Color-change embedding and printable summary

## Conventions

- The version in `package.json` is shown in the UI (imported as `version` from `package.json`; Vite tree-shakes the rest of the manifest). Bump it with every change.
- Theme colors come from the CSS-variable `ink` ramp in `src/index.css`. Day theme mirrors the ramp, so use `bg-ink-950`/`text-ink-100` and so on instead of `dark:` variants. Use `day:` for the rare exceptions.
