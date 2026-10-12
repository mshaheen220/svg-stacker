import { colorName } from "./svg/colors";
import type { ParsedShape, ParsedSvg } from "./svg/types";
import { fillRegion, strokeRegion, unionRegions, type Region } from "./geometry/region";

/** Per shape: does its stroke become its own outline geometry, or is it ignored? */
export type StrokeMode = "outline" | "ignore";

export interface PartSource {
  shapeId: string;
  kind: "fill" | "stroke";
}

/**
 * A printable part: everything with the same Inkscape label and color.
 * (Same label but different colors stay separate - they need different
 * filaments.) Unlabeled shapes group purely by color.
 */
export interface Part {
  /** Stable identity, used to re-apply saved arrangements: "label|#rrggbb". */
  key: string;
  label: string | null;
  color: string;
  defaultName: string;
  sources: PartSource[];
  /** Paint position of the first contributing shape (stroke = index + 0.5). */
  paintOrder: number;
}

export const partKey = (label: string | null, color: string) => `${label ?? ""}|${color}`;

export function groupParts(parsed: ParsedSvg, strokeModes: Record<string, StrokeMode>): Part[] {
  const parts = new Map<string, Part>();
  const add = (shape: ParsedShape, kind: PartSource["kind"], color: string, order: number) => {
    const key = partKey(shape.label, color);
    let part = parts.get(key);
    if (!part) {
      part = { key, label: shape.label, color, defaultName: "", sources: [], paintOrder: order };
      parts.set(key, part);
    }
    part.sources.push({ shapeId: shape.id, kind });
  };

  for (const shape of parsed.shapes) {
    if (shape.fill) add(shape, "fill", shape.fill, shape.index);
    if (shape.stroke && (strokeModes[shape.id] ?? defaultStrokeMode(shape)) === "outline") {
      add(shape, "stroke", shape.stroke, shape.index + 0.5);
    }
  }

  const list = [...parts.values()].sort((a, b) => a.paintOrder - b.paintOrder);
  const colorsPerLabel = new Map<string, number>();
  for (const p of list) if (p.label) colorsPerLabel.set(p.label, (colorsPerLabel.get(p.label) ?? 0) + 1);
  for (const p of list) {
    p.defaultName = p.label
      ? colorsPerLabel.get(p.label)! > 1
        ? `${p.label} (${colorName(p.color)})`
        : p.label
      : `${colorName(p.color)} ${p.color}`;
  }
  return list;
}

/**
 * Strokes thinner than this default to "ignore". Auto-traced artwork often
 * carries hairline strokes (e.g. 0.25 px) in a stale color that would
 * otherwise become junk parts, and they're far below printable width anyway.
 */
export const MIN_OUTLINE_STROKE_MM = 0.2;

export function defaultStrokeMode(shape: ParsedShape): StrokeMode {
  return shape.stroke && shape.strokeWidth >= MIN_OUTLINE_STROKE_MM ? "outline" : "ignore";
}

// Shape regions only depend on the (immutable) parsed shape, so cache them.
const fillCache = new WeakMap<ParsedShape, Region>();
const strokeCache = new WeakMap<ParsedShape, Region>();

function cached(cache: WeakMap<ParsedShape, Region>, shape: ParsedShape, fn: (s: ParsedShape) => Region): Region {
  let r = cache.get(shape);
  if (!r) {
    r = fn(shape);
    cache.set(shape, r);
  }
  return r;
}

/** The 2D footprint of a part: union of all its fills and outlined strokes. */
export function partFootprint(part: Part, shapesById: Map<string, ParsedShape>): Region {
  return unionRegions(
    part.sources.map((src) => {
      const shape = shapesById.get(src.shapeId)!;
      return src.kind === "fill" ? cached(fillCache, shape, fillRegion) : cached(strokeCache, shape, strokeRegion);
    }),
  );
}
