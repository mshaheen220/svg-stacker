import type { Matrix } from "./types";

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 · m2 (apply m2 first, then m1) - the order SVG nests transforms in. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/** Geometric-mean scale factor, used to convert stroke widths. */
export function meanScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/** Parses an SVG transform attribute (matrix/translate/scale/rotate/skewX/skewY, chained). */
export function parseTransform(attr: string | null): Matrix {
  let m = IDENTITY;
  if (!attr) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  for (let match; (match = re.exec(attr)); ) {
    const n = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t: Matrix = IDENTITY;
    switch (match[1]) {
      case "matrix":
        if (n.length === 6) t = n as Matrix;
        break;
      case "translate":
        t = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
        break;
      case "scale":
        t = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
        break;
      case "rotate": {
        const r = ((n[0] ?? 0) * Math.PI) / 180;
        const [cx, cy] = [n[1] ?? 0, n[2] ?? 0];
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        t = multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        break;
      }
      case "skewX":
        t = [1, 0, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        t = [1, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = multiply(m, t);
  }
  return m;
}
