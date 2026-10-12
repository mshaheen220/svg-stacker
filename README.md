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
  lib/parts.ts  shapes → parts (merge key "label|#color"), footprints
  store/        zustand app state
  components/   UI (preview/, controls/)
  hooks/        useTheme (day / night / system)
tests/          vitest
```

The parser walks the DOM itself instead of using `getComputedStyle`/`getScreenCTM`, so it behaves the same in the browser and in Node tests.

Coordinates are millimetres, y-down, page origin. The flip to y-up happens at mesh time.

### Parts

Shapes merge into a part when they share the same Inkscape label (own label, or the enclosing Inkscape layer's) **and** color. The same label in different colors is split into "label (color name)". Unlabeled shapes merge by color and are named "teal #008080". A stroke can become its own geometry (a ring for closed paths, capped for open ones) colored by the stroke. Strokes under 0.2 mm default to *ignore* because auto-traced art often carries stale-colored hairlines. Default part order is the paint position of each part's first shape. The part key (`label|#color`) is what saved arrangements will refer to.

### Planned layers (later milestones)

- `lib/geometry/`: support-fill stacking, clearance offsets and thin-feature checks (clipper2-ts); manifold-3d (WASM) for watertight extrusion, run in a Web Worker.
- `lib/export/`: 3MF writer (`3D/3dmodel.model`, `Metadata/model_settings.config`, `Metadata/custom_gcode_per_layer.xml`, zipped with fflate) and per-level STL.

### Roadmap

1. ✅ Scaffold, plus import and 2D preview
2. ✅ Grouping into parts (label/color merge, stroke handling)
3. Level editor (drag-and-drop, thickness, rename, toggle, JSON sidecar, autosave)
4. Support fill, background plate, clearance, thin-feature warnings
5. 3D preview with a level scrubber
6. 3MF and STL export
7. Color-change embedding and printable summary

## Conventions

- The version in `package.json` is shown in the UI (injected as `__APP_VERSION__` by `vite.config.ts`). Bump it with every change.
- Theme colors come from the CSS-variable `ink` ramp in `src/index.css`. Day theme mirrors the ramp, so use `bg-ink-950`/`text-ink-100` and so on instead of `dark:` variants. Use `day:` for the rare exceptions.
