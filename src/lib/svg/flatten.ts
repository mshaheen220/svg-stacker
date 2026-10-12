import svgpath from "svgpath";
import type { Matrix, Point, Subpath } from "./types";

/**
 * Converts path data to polylines in the target coordinate space.
 *
 * svgpath does the fiddly normalization (relative → absolute, arcs → cubic
 * beziers, S/T shorthands → full curves, applying the transform matrix);
 * this module then flattens the remaining curves with a segment count
 * chosen from the curve's second-derivative bound, so the polyline never
 * strays more than `tolerance` (in output units, i.e. mm) from the curve.
 */
export function flattenPath(d: string, m: Matrix, tolerance: number): Subpath[] {
  const tol = Math.max(tolerance, 1e-4);
  // svgpath applies matrix() lazily on serialization, so round-trip through
  // a string to get transformed segments.
  const path = svgpath(svgpath(d).abs().unshort().unarc().matrix(m).toString()).abs();

  const out: Subpath[] = [];
  let cur: Point[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const flush = (closed: boolean) => {
    if (cur.length >= 2) out.push({ points: dedupe(cur, closed), closed });
    cur = [];
  };

  for (const seg of (path as unknown as { segments: (string | number)[][] }).segments) {
    const cmd = seg[0] as string;
    const a = seg.slice(1) as number[];
    // A drawing command right after Z (no new M) starts at the subpath start.
    if (cmd !== "M" && cmd !== "Z" && cmd !== "z" && cur.length === 0) cur.push([x, y]);
    switch (cmd) {
      case "M":
        flush(false);
        x = startX = a[0];
        y = startY = a[1];
        cur.push([x, y]);
        break;
      case "L":
        x = a[0];
        y = a[1];
        cur.push([x, y]);
        break;
      case "H":
        x = a[0];
        cur.push([x, y]);
        break;
      case "V":
        y = a[0];
        cur.push([x, y]);
        break;
      case "C": {
        cubic(cur, x, y, a[0], a[1], a[2], a[3], a[4], a[5], tol);
        x = a[4];
        y = a[5];
        break;
      }
      case "Q": {
        quad(cur, x, y, a[0], a[1], a[2], a[3], tol);
        x = a[2];
        y = a[3];
        break;
      }
      case "Z":
      case "z":
        flush(true);
        x = startX;
        y = startY;
        break;
    }
  }
  flush(false);
  return out;
}

function cubic(
  out: Point[], x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, tol: number,
) {
  // Max deviation of an n-segment uniform polyline from a cubic is bounded
  // by (1/8)·max|B''|/n², and max|B''| = 6·max(|P0-2P1+P2|, |P1-2P2+P3|).
  const ddx = Math.max(Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3));
  const n = Math.min(512, Math.max(1, Math.ceil(Math.sqrt((0.75 * ddx) / tol))));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.push([a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3]);
  }
}

function quad(out: Point[], x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, tol: number) {
  // Same bound with max|B''| = 2·|P0-2P1+P2|.
  const dd = Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2);
  const n = Math.min(512, Math.max(1, Math.ceil(Math.sqrt((0.25 * dd) / tol))));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    out.push([mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, mt * mt * y0 + 2 * mt * t * y1 + t * t * y2]);
  }
}

/** Drops consecutive duplicate points (and a closing point equal to the first). */
function dedupe(points: Point[], closed: boolean): Point[] {
  const eps = 1e-9;
  const res: Point[] = [];
  for (const p of points) {
    const last = res[res.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > eps || Math.abs(last[1] - p[1]) > eps) res.push(p);
  }
  if (closed && res.length > 1) {
    const [f, l] = [res[0], res[res.length - 1]];
    if (Math.abs(f[0] - l[0]) <= eps && Math.abs(f[1] - l[1]) <= eps) res.pop();
  }
  return res;
}
