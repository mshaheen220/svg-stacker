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
  lib/geometry/stack.ts  arrangement → printed solids: scaling to target
                width, support fill, plate, clearance, visible regions,
                thin-feature and floating-area checks
  workers/      stack.worker.ts runs computeStack off the main thread
  lib/parts.ts  shapes → parts (merge key "label|#color"), footprints
  lib/arrangement.ts  levels (bottom → top), per-part name/enabled, thickness
                settings, reconcile-with-parts, Z ranges, sidecar validation
  store/        useProject: zustand store; persist middleware autosaves to
                localStorage (only source data + arrangement; parse/parts are
                re-derived). useStack: debounced worker results
  components/   UI (levels/ = dnd-kit level editor, preview/, controls/)
  hooks/        useTheme (day / night / system)
tests/          vitest
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

### Stacking (`computeStack`)

Inputs are the arrangement, the parts and their footprints (SVG page mm). Output regions are in **final print mm** (integer µm), scaled to `targetWidth` (which includes plate margins), with the bounding box at (0, 0). Y is still down.

1. Union the enabled footprints per printed level and place them (scale and translate).
2. Walk top-down keeping a running union. With **support fill**, `solid_k = ∪ footprints ≥ k`; otherwise `solid_k = footprint_k`. The **plate** is `offset(∪ everything, margin)` and is always the bottom printed level, using the base thickness.
3. **Clearance** offsets every level above the first inward.
4. `visible_k = solid_k − ∪ solids above` (used for the top-view color), `unsupported_k = solid_k − solid_{k−1}` (floating area), `thin_k = solid_k − opening(solid_k, 2 × nozzle)`. Opening means shrinking by half the width and growing back. Slivers smaller than ½·w², which are mostly shaved sharp corners, are ignored.

On detailed art this takes about 200–350 ms, so `useStackRunner` (mounted once in `App`) debounces changes by 120 ms and posts them to `workers/stack.worker.ts`. Stale responses are dropped by request id. If workers are unavailable it falls back to the main thread.

**Drag and drop:** one `DndContext` with prefixed ids (`L:` level, `P:` part, `D:` level drop zone). Pointer collision and the keyboard coordinate getter are both filtered so levels only target levels and parts only target parts or drop zones. Every drag action also has a button or select equivalent.

### Planned layers (later milestones)

- manifold-3d (WASM) for watertight extrusion of `StackLevel.solid` regions, also in a worker.
- `lib/export/`: 3MF writer (`3D/3dmodel.model`, `Metadata/model_settings.config`, `Metadata/custom_gcode_per_layer.xml`, zipped with fflate) and per-level STL.

### Roadmap

1. ✅ Scaffold, plus import and 2D preview
2. ✅ Grouping into parts (label/color merge, stroke handling)
3. ✅ Level editor (drag-and-drop, thickness, rename, toggle, JSON sidecar, autosave)
4. ✅ Support fill, background plate, clearance, thin-feature warnings
5. 3D preview with a level scrubber
6. 3MF and STL export
7. Color-change embedding and printable summary

## Conventions

- The version in `package.json` is shown in the UI (imported as `version` from `package.json`; Vite tree-shakes the rest of the manifest). Bump it with every change.
- Theme colors come from the CSS-variable `ink` ramp in `src/index.css`. Day theme mirrors the ramp, so use `bg-ink-950`/`text-ink-100` and so on instead of `dark:` variants. Use `day:` for the rare exceptions.
