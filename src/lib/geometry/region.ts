import {
  areaPaths,
  EndType,
  FillRule,
  inflatePaths,
  JoinType,
  union,
  type Path64,
  type Paths64,
} from "clipper2-ts";
import type { ParsedShape, Subpath } from "../svg/types";

/**
 * 2D regions are Clipper Paths64 in integer micrometres (1 unit = 1 µm),
 * normalized so outers are positive and holes negative - i.e. they're
 * always valid under the NonZero rule. Integer coordinates keep Clipper's
 * boolean ops exact and robust.
 */
export type Region = Paths64;

export const UNITS_PER_MM = 1000;

export function toPaths64(subpaths: Subpath[]): Paths64 {
  return subpaths
    .filter((s) => s.points.length >= 2)
    .map((s) => s.points.map(([x, y]) => ({ x: Math.round(x * UNITS_PER_MM), y: Math.round(y * UNITS_PER_MM) })));
}

/** Region → mm polygons (outers and holes; render with nonzero). */
export function regionToRings(region: Region): [number, number][][] {
  return region.map((p) => p.map((pt) => [pt.x / UNITS_PER_MM, pt.y / UNITS_PER_MM] as [number, number]));
}

export function regionAreaMm2(region: Region): number {
  return Math.abs(areaPaths(region)) / (UNITS_PER_MM * UNITS_PER_MM);
}

export function unionRegions(regions: Region[]): Region {
  const all = regions.flat();
  return all.length ? union(all, FillRule.NonZero) : [];
}

/** The area a shape's fill paints, honoring its fill rule (all subpaths implicitly closed). */
export function fillRegion(shape: ParsedShape): Region {
  const paths = toPaths64(shape.subpaths).filter((p) => p.length >= 3);
  if (!paths.length) return [];
  return union(paths, shape.fillRule === "evenodd" ? FillRule.EvenOdd : FillRule.NonZero);
}

const JOIN: Record<ParsedShape["strokeLinejoin"], JoinType> = {
  miter: JoinType.Miter,
  round: JoinType.Round,
  bevel: JoinType.Bevel,
};
const CAP: Record<ParsedShape["strokeLinecap"], EndType> = {
  butt: EndType.Butt,
  round: EndType.Round,
  square: EndType.Square,
};

/**
 * The area a shape's stroke paints: closed subpaths become rings (both
 * sides offset by width/2), open subpaths get the shape's line caps.
 */
export function strokeRegion(shape: ParsedShape): Region {
  if (!shape.stroke || shape.strokeWidth <= 0) return [];
  const delta = (shape.strokeWidth / 2) * UNITS_PER_MM;
  const join = JOIN[shape.strokeLinejoin];
  const closed: Path64[] = [];
  const open: Path64[] = [];
  const paths = toPaths64(shape.subpaths);
  shape.subpaths.forEach((s, i) => (s.closed ? closed : open).push(paths[i]));
  // Arc tolerance ~ 10 µm keeps round joins/caps smooth without bloating vertex counts.
  const out: Paths64 = [];
  if (closed.length) out.push(...inflatePaths(closed, delta, join, EndType.Joined, 4, 10));
  if (open.length) out.push(...inflatePaths(open, delta, join, CAP[shape.strokeLinecap], 4, 10));
  return out.length ? union(out, FillRule.NonZero) : [];
}
