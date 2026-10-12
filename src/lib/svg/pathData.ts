import type { Subpath } from "./types";

/** Polylines → SVG path data, for previews. */
export function subpathsToD(subpaths: Subpath[], closeAll = true): string {
  let d = "";
  for (const s of subpaths) {
    if (s.points.length === 0) continue;
    d += "M" + s.points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L");
    if (closeAll || s.closed) d += "Z";
  }
  return d;
}
