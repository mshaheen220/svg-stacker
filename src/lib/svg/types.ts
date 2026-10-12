export type Point = [number, number];
/** Affine matrix [a, b, c, d, e, f], as in SVG's matrix(a b c d e f). */
export type Matrix = [number, number, number, number, number, number];
export type FillRule = "nonzero" | "evenodd";

export interface Subpath {
  points: Point[];
  /** Explicitly closed with Z. Fills always close; strokes honor this. */
  closed: boolean;
}

/** One paintable SVG element, flattened to polylines in mm (y down, page origin). */
export interface ParsedShape {
  /** Element id, or a generated one ("shape-12") when the element has none. */
  id: string;
  /** Paint order among parsed shapes (0 = painted first / bottom-most). */
  index: number;
  tag: string;
  /** Element's own inkscape:label, else the enclosing Inkscape layer's label. */
  label: string | null;
  fill: string | null;
  fillRule: FillRule;
  stroke: string | null;
  /** Stroke width in mm (after transforms). 0 when there's no stroke. */
  strokeWidth: number;
  strokeLinejoin: "miter" | "round" | "bevel";
  strokeLinecap: "butt" | "round" | "square";
  subpaths: Subpath[];
  bounds: Bounds;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ParseWarning {
  kind: "unsupported" | "empty" | "gradient" | "units" | "css";
  message: string;
}

export interface ParsedSvg {
  /** Page size in mm, from width/height (or the viewBox at 96 dpi). */
  widthMm: number;
  heightMm: number;
  shapes: ParsedShape[];
  /** Union of every shape's bounds (mm). */
  bounds: Bounds;
  warnings: ParseWarning[];
  /** How many elements were skipped as empty (e.g. d=""). */
  emptyCount: number;
}
