import { parseColor } from "./colors";
import { flattenPath } from "./flatten";
import { meanScale, multiply, parseTransform } from "./matrix";
import type { Bounds, FillRule, Matrix, ParsedShape, ParsedSvg, ParseWarning, Subpath } from "./types";
import { lengthToMm, num } from "./units";

/**
 * Parses an SVG document into flattened, mm-space shapes in paint order.
 *
 * This walks the DOM itself (rather than leaning on getComputedStyle /
 * getScreenCTM) so it behaves identically in the browser and in Node tests.
 * It resolves what real Inkscape output needs: inherited fills, `style`
 * vs. presentation attributes, simple <style> class rules, nested group
 * transforms, viewBox + physical units, and Inkscape labels/layers.
 */

export interface ParseOptions {
  /** Max distance (mm) a flattened curve may deviate from the true curve. */
  tolerance: number;
}

const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";
const SVG_NS = "http://www.w3.org/2000/svg";

// Elements whose subtree is never painted directly.
const NON_RENDERED = new Set([
  "defs", "clipPath", "mask", "pattern", "marker", "symbol", "metadata", "title", "desc",
  "style", "script", "linearGradient", "radialGradient", "filter", "namedview", "foreignObject",
]);
const UNSUPPORTED = new Set(["text", "image", "use", "switch"]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);

// Properties that children inherit from their parents.
const INHERITED = [
  "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
  "stroke-linejoin", "stroke-linecap", "visibility", "color",
] as const;
const ALL_PROPS = new Set<string>([...INHERITED, "display", "opacity"]);

type Style = Record<string, string>;

interface CssRule {
  tag: string | null;
  id: string | null;
  classes: string[];
  decls: Style;
}

interface Ctx {
  matrix: Matrix;
  style: Style;
  layerLabel: string | null;
}

export function parseSvgText(text: string, options: ParseOptions): ParsedSvg {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) throw new Error("This file isn't valid SVG/XML: " + (err.textContent ?? "").trim().split("\n")[0]);
  const root = doc.documentElement;
  if (!root || root.localName !== "svg") throw new Error("No <svg> root element found.");
  return parseSvgElement(root, options);
}

export function parseSvgElement(root: Element, { tolerance }: ParseOptions): ParsedSvg {
  const warnings: ParseWarning[] = [];
  const unsupported = new Map<string, number>();
  const { matrix: rootMatrix, widthMm, heightMm } = rootTransform(root, warnings);
  const css = collectCss(root, warnings);
  const ids = new Set<string>();
  const shapes: ParsedShape[] = [];
  let emptyCount = 0;
  let gradientWarned = false;

  const byId = (id: string) => root.ownerDocument.getElementById(id) ?? root.querySelector(`[id="${CSS_escape(id)}"]`);

  const resolvePaint = (raw: string | undefined, currentColor: string | undefined): string | null => {
    if (!raw) return null;
    const v = raw.trim();
    if (v === "currentColor") return parseColor(currentColor ?? "black");
    const url = /^url\(\s*['"]?#([^'")]+)['"]?\s*\)\s*(.*)$/.exec(v);
    if (url) {
      const color = gradientColor(url[1], byId) ?? parseColor(url[2]);
      if (!gradientWarned) {
        gradientWarned = true;
        warnings.push({ kind: "gradient", message: "Gradient/pattern fills were replaced with a single solid color." });
      }
      return color;
    }
    return parseColor(v);
  };

  const walk = (el: Element, ctx: Ctx) => {
    const tag = el.localName;
    if (NON_RENDERED.has(tag)) return;

    const own = ownStyle(el, css);
    if (own.display === "none" || num(own.opacity ?? null, 1) === 0) return;

    const style: Style = { ...ctx.style };
    for (const k of INHERITED) if (own[k] !== undefined && own[k] !== "inherit") style[k] = own[k];
    const matrix = multiply(ctx.matrix, parseTransform(el.getAttribute("transform")));
    const label = inkscapeLabel(el);
    const isLayer = tag === "g" && (el.getAttributeNS(INKSCAPE_NS, "groupmode") ?? el.getAttribute("inkscape:groupmode")) === "layer";

    if (tag === "svg" || tag === "g" || tag === "a") {
      // Nested <svg> viewports aren't handled specially (rare in Inkscape output).
      const next: Ctx = { matrix, style, layerLabel: isLayer && label ? label : ctx.layerLabel };
      for (const child of Array.from(el.children)) walk(child, next);
      return;
    }
    if (UNSUPPORTED.has(tag)) {
      unsupported.set(tag, (unsupported.get(tag) ?? 0) + 1);
      return;
    }
    if (!SHAPES.has(tag)) return;
    if (style.visibility === "hidden" || style.visibility === "collapse") return;

    const d = shapeToPathData(el);
    const subpaths = d ? flattenPath(d, matrix, tolerance) : [];
    if (subpaths.length === 0 || subpaths.every((s) => s.points.length < 2)) {
      emptyCount++;
      return;
    }

    let fill = resolvePaint(style.fill ?? "black", style.color);
    if (num(style["fill-opacity"] ?? null, 1) === 0) fill = null;
    // Lines and polylines have no meaningful fill area in practice.
    if (tag === "line") fill = null;
    let stroke = resolvePaint(style.stroke, style.color);
    const strokeWidth = num(style["stroke-width"] ?? null, 1) * meanScale(matrix);
    if (num(style["stroke-opacity"] ?? null, 1) === 0 || strokeWidth <= 0) stroke = null;
    if (!fill && !stroke) return;

    let id = el.getAttribute("id") || `shape-${shapes.length + 1}`;
    while (ids.has(id)) id += "_";
    ids.add(id);

    shapes.push({
      id,
      index: shapes.length,
      tag,
      label: label ?? ctx.layerLabel,
      fill,
      fillRule: (style["fill-rule"] === "evenodd" ? "evenodd" : "nonzero") as FillRule,
      stroke,
      strokeWidth: stroke ? strokeWidth : 0,
      strokeLinejoin: pick(style["stroke-linejoin"], ["miter", "round", "bevel"], "miter"),
      strokeLinecap: pick(style["stroke-linecap"], ["butt", "round", "square"], "butt"),
      subpaths,
      bounds: boundsOf(subpaths, stroke ? strokeWidth / 2 : 0),
    });
  };

  // The root's own style/transform participate like any group's.
  walk(root, { matrix: rootMatrix, style: {}, layerLabel: null });

  for (const [tag, count] of unsupported) {
    warnings.push({
      kind: "unsupported",
      message: `${count} <${tag}> element${count === 1 ? " was" : "s were"} skipped. ${
        tag === "text" ? "Convert text to paths in Inkscape (Path → Object to Path)." : tag === "use" ? "Unlink clones in Inkscape (Edit → Clone → Unlink Clone)." : ""
      }`.trim(),
    });
  }
  if (emptyCount > 0) {
    warnings.push({ kind: "empty", message: `${emptyCount} empty shape${emptyCount === 1 ? " was" : "s were"} skipped.` });
  }

  return {
    widthMm,
    heightMm,
    shapes,
    bounds: mergeBounds(shapes.map((s) => s.bounds)) ?? { minX: 0, minY: 0, maxX: widthMm, maxY: heightMm },
    warnings,
    emptyCount,
  };
}

function CSS_escape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

function pick<T extends string>(v: string | undefined, allowed: T[], fallback: T): T {
  return (allowed as string[]).includes(v ?? "") ? (v as T) : fallback;
}

function inkscapeLabel(el: Element): string | null {
  const v = el.getAttributeNS(INKSCAPE_NS, "label") ?? el.getAttribute("inkscape:label");
  return v && v.trim() ? v.trim() : null;
}

/** Root viewport → mm: viewBox mapping (preserveAspectRatio xMidYMid meet) and units. */
function rootTransform(root: Element, warnings: ParseWarning[]): { matrix: Matrix; widthMm: number; heightMm: number } {
  const vb = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  const hasViewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  let widthMm = lengthToMm(root.getAttribute("width"));
  let heightMm = lengthToMm(root.getAttribute("height"));
  const pxMm = 25.4 / 96;

  if (root.getAttribute("width")?.includes("%") || root.getAttribute("height")?.includes("%")) {
    warnings.push({ kind: "units", message: "Percentage width/height ignored; sizing from the viewBox at 96 dpi." });
  }

  if (!hasViewBox) {
    widthMm ??= 100;
    heightMm ??= 100;
    if (!root.getAttribute("width")) {
      warnings.push({ kind: "units", message: "No viewBox or size given; assuming px (96 dpi). Use the target width setting to scale." });
    }
    return { matrix: [pxMm, 0, 0, pxMm, 0, 0], widthMm, heightMm };
  }

  const [vx, vy, vw, vh] = vb;
  if (widthMm == null && heightMm == null) {
    widthMm = vw * pxMm;
    heightMm = vh * pxMm;
  } else if (widthMm == null) {
    widthMm = (heightMm! * vw) / vh;
  } else if (heightMm == null) {
    heightMm = (widthMm * vh) / vw;
  }
  const s = Math.min(widthMm / vw, heightMm! / vh);
  const tx = (widthMm - vw * s) / 2 - vx * s;
  const ty = (heightMm! - vh * s) / 2 - vy * s;
  return { matrix: [s, 0, 0, s, tx, ty], widthMm, heightMm: heightMm! };
}

function parseDecls(text: string): Style {
  const out: Style = {};
  for (const decl of text.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim().toLowerCase();
    const v = decl.slice(i + 1).replace(/!important/i, "").trim();
    if (ALL_PROPS.has(k) && v) out[k] = v;
  }
  return out;
}

/** Simple <style> support: tag, .class, #id and tag.class selectors. */
function collectCss(root: Element, warnings: ParseWarning[]): CssRule[] {
  const rules: CssRule[] = [];
  let skipped = 0;
  for (const styleEl of Array.from(root.getElementsByTagNameNS(SVG_NS, "style"))) {
    const text = (styleEl.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const decls = parseDecls(m[2]);
      for (const sel of m[1].split(",").map((s) => s.trim())) {
        const parsed = /^([a-zA-Z][\w-]*)?(#[\w-]+)?((?:\.[\w-]+)*)$/.exec(sel);
        if (!parsed || !sel) {
          skipped++;
          continue;
        }
        rules.push({
          tag: parsed[1] ?? null,
          id: parsed[2]?.slice(1) ?? null,
          classes: parsed[3] ? parsed[3].split(".").filter(Boolean) : [],
          decls,
        });
      }
    }
  }
  if (skipped) warnings.push({ kind: "css", message: `${skipped} CSS selector(s) in <style> were too complex and ignored.` });
  return rules;
}

/** Presentation attributes < CSS rules < style attribute. */
function ownStyle(el: Element, css: CssRule[]): Style {
  const out: Style = {};
  for (const k of ALL_PROPS) {
    const v = el.getAttribute(k);
    if (v != null && v.trim()) out[k] = v.trim();
  }
  if (css.length) {
    const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    const id = el.getAttribute("id");
    for (const r of css) {
      if (r.tag && r.tag !== el.localName) continue;
      if (r.id && r.id !== id) continue;
      if (!r.classes.every((c) => classes.includes(c))) continue;
      Object.assign(out, r.decls);
    }
  }
  const attr = el.getAttribute("style");
  if (attr) Object.assign(out, parseDecls(attr));
  return out;
}

function gradientColor(id: string, byId: (id: string) => Element | null): string | null {
  const seen = new Set<string>();
  let el = byId(id);
  while (el && !seen.has(id)) {
    seen.add(id);
    const stop = Array.from(el.children).find((c) => c.localName === "stop");
    if (stop) {
      const fromStyle = /stop-color\s*:\s*([^;]+)/i.exec(stop.getAttribute("style") ?? "")?.[1];
      return parseColor(fromStyle ?? stop.getAttribute("stop-color") ?? "black");
    }
    if (el.localName === "pattern") return null;
    const href = el.getAttribute("href") ?? el.getAttribute("xlink:href");
    if (!href?.startsWith("#")) return null;
    id = href.slice(1);
    el = byId(id);
  }
  return null;
}

/** Converts a basic shape element to equivalent path data (user units). */
function shapeToPathData(el: Element): string | null {
  const a = (n: string) => num(el.getAttribute(n));
  switch (el.localName) {
    case "path":
      return el.getAttribute("d")?.trim() || null;
    case "rect": {
      const [x, y, w, h] = [a("x"), a("y"), a("width"), a("height")];
      if (w <= 0 || h <= 0) return null;
      let rx = el.hasAttribute("rx") ? a("rx") : NaN;
      let ry = el.hasAttribute("ry") ? a("ry") : NaN;
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(Math.max(rx, 0), w / 2);
      ry = Math.min(Math.max(ry, 0), h / 2);
      if (rx === 0 || ry === 0) return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
      return (
        `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}` +
        `V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}` +
        `H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
        `V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
      );
    }
    case "circle":
    case "ellipse": {
      const [cx, cy] = [a("cx"), a("cy")];
      const rx = el.localName === "circle" ? a("r") : a("rx");
      const ry = el.localName === "circle" ? a("r") : a("ry");
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx},${cy}A${rx},${ry} 0 1 0 ${cx + rx},${cy}A${rx},${ry} 0 1 0 ${cx - rx},${cy}Z`;
    }
    case "line":
      return `M${a("x1")},${a("y1")}L${a("x2")},${a("y2")}`;
    case "polygon":
    case "polyline": {
      const n = (el.getAttribute("points") ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
      if (n.length < 4) return null;
      let d = `M${n[0]},${n[1]}`;
      for (let i = 2; i + 1 < n.length; i += 2) d += `L${n[i]},${n[i + 1]}`;
      return el.localName === "polygon" ? d + "Z" : d;
    }
  }
  return null;
}

function boundsOf(subpaths: Subpath[], pad: number): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of subpaths) {
    for (const [x, y] of s.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function mergeBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  return list.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
}

