import { area, difference, EndType, FillRule, getBoundsPaths, inflatePaths, intersect, JoinType } from "clipper2-ts";
import { partName, PLATE_ID, printedLevels, type Arrangement } from "../arrangement";
import type { Part } from "../parts";
import { regionAreaMm2, UNITS_PER_MM, unionRegions, type Region } from "./region";

/**
 * Turns an arrangement into the actual printed solids.
 *
 * All output regions are in *final print* coordinates: millimetres (as
 * integer µm), scaled to the target width, with the object's bounding box
 * starting at (0, 0). Y still points down (SVG convention).
 */

export interface StackLevel {
  id: string;
  number: number;
  isPlate: boolean;
  /** Part names on this level, for display and the 3MF. */
  name: string;
  /** Filament color: the first enabled part's color (or the plate color). */
  color: string;
  /** Distinct part colors on this level (more than one = warning). */
  partColors: string[];
  zStart: number;
  zEnd: number;
  /** The level's printed cross-section. */
  solid: Region;
  /** What shows from above (solid minus everything above it). */
  visible: Region;
  /** Areas narrower than the minimum printable width. */
  thin: Region;
  thinAreaMm2: number;
  /** Area with nothing directly underneath (only possible with support fill off). */
  unsupportedAreaMm2: number;
  areaMm2: number;
}

export interface StackResult {
  levels: StackLevel[];
  /** Scale applied to the SVG geometry (final mm per SVG mm). */
  scale: number;
  widthMm: number;
  heightMm: number;
  heightZ: number;
  /** Minimum printable feature width used for the thin check (2 × nozzle). */
  minFeatureMm: number;
}

const EMPTY: StackResult = { levels: [], scale: 1, widthMm: 0, heightMm: 0, heightZ: 0, minFeatureMm: 0.8 };

const offset = (r: Region, mm: number): Region =>
  r.length === 0 || mm === 0 ? r : inflatePaths(r, mm * UNITS_PER_MM, JoinType.Round, EndType.Polygon, 2, 10);

const diff = (a: Region, b: Region): Region => (a.length === 0 ? [] : b.length === 0 ? a : difference(a, b, FillRule.NonZero));

/**
 * Parts of `solid` narrower than `width`: what a morphological opening
 * (shrink by width/2, grow back) removes. Tiny slivers - mostly the tips
 * of sharp corners, which openings always shave - are filtered out.
 */
export function thinRegions(solid: Region, width: number): Region {
  if (solid.length === 0) return [];
  const opened = offset(offset(solid, -width / 2), width / 2);
  const lost = diff(solid, opened);
  const minArea = 0.5 * width * width * UNITS_PER_MM * UNITS_PER_MM;
  // Outers have positive area in Clipper's output; keep the big ones and
  // clip the full result (holes included) to them.
  const bigOuters = lost.filter((p) => area(p) >= minArea);
  return bigOuters.length ? intersect(lost, bigOuters, FillRule.NonZero) : [];
}

function transform(region: Region, s: number, dx: number, dy: number): Region {
  return region.map((p) => p.map((pt) => ({ x: Math.round(pt.x * s + dx), y: Math.round(pt.y * s + dy) })));
}

export function computeStack(arr: Arrangement, parts: Part[], footprints: Map<string, Region>): StackResult {
  const settings = arr.settings;
  const printed = printedLevels(arr);
  const partLevels = printed.filter((l) => l.level);
  if (partLevels.length === 0) return EMPTY;
  const byKey = new Map(parts.map((p) => [p.key, p]));

  // Scale so the overall width (artwork + plate margins) hits the target.
  const allFootprints = unionRegions(partLevels.flatMap((l) => l.enabledKeys.map((k) => footprints.get(k) ?? [])));
  if (allFootprints.length === 0) return EMPTY;
  const b = getBoundsPaths(allFootprints);
  const nativeW = (b.right - b.left) / UNITS_PER_MM;
  const margin = settings.plate.enabled ? settings.plate.margin : 0;
  const scale = settings.targetWidth ? Math.max(0.01, (settings.targetWidth - 2 * margin) / nativeW) : 1;
  const m = margin * UNITS_PER_MM;
  const place = (r: Region) => transform(r, scale, -b.left * scale + m, -b.top * scale + m);

  // Footprint per printed level, in final coordinates.
  const levelFootprints = printed.map((l) =>
    l.level ? place(unionRegions(l.enabledKeys.map((k) => footprints.get(k) ?? []))) : [],
  );

  // Solids, computed top-down so support fill is a running union.
  const solids: Region[] = new Array(printed.length);
  let above: Region = [];
  for (let i = printed.length - 1; i >= 0; i--) {
    if (printed[i].id === PLATE_ID) {
      solids[i] = offset(above, margin);
      continue;
    }
    above = unionRegions([above, levelFootprints[i]]);
    solids[i] = settings.supportFill ? above : levelFootprints[i];
  }
  // Clearance: shrink every level above the base.
  if (settings.clearance > 0) {
    for (let i = 1; i < solids.length; i++) solids[i] = offset(solids[i], -settings.clearance);
  }

  const minFeatureMm = 2 * settings.nozzle;
  const levels: StackLevel[] = [];
  let overhead: Region = [];
  const visibles: Region[] = new Array(printed.length);
  for (let i = printed.length - 1; i >= 0; i--) {
    visibles[i] = diff(solids[i], overhead);
    overhead = unionRegions([overhead, solids[i]]);
  }

  printed.forEach((l, i) => {
    const enabledParts = l.enabledKeys.map((k) => byKey.get(k)).filter((p): p is Part => !!p);
    const partColors = [...new Set(enabledParts.map((p) => p.color))];
    const thin = thinRegions(solids[i], minFeatureMm);
    const unsupported = i === 0 ? [] : diff(solids[i], solids[i - 1]);
    levels.push({
      id: l.id,
      number: l.number,
      isPlate: l.id === PLATE_ID,
      name: l.level ? enabledParts.map((p) => partName(arr, p)).join(" + ") : "Plate",
      color: l.level ? (partColors[0] ?? "#888888") : settings.plate.color,
      partColors,
      zStart: l.zStart,
      zEnd: l.zEnd,
      solid: solids[i],
      visible: visibles[i],
      thin,
      thinAreaMm2: regionAreaMm2(thin),
      unsupportedAreaMm2: regionAreaMm2(unsupported),
      areaMm2: regionAreaMm2(solids[i]),
    });
  });

  const fb = getBoundsPaths(solids[0].length ? unionRegions(solids) : allFootprints);
  return {
    levels,
    scale,
    widthMm: (fb.right - fb.left) / UNITS_PER_MM,
    heightMm: (fb.bottom - fb.top) / UNITS_PER_MM,
    heightZ: printed.at(-1)!.zEnd,
    minFeatureMm,
  };
}
