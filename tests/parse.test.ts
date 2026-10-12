import { describe, expect, it } from "vitest";
import { colorName, parseColor } from "../src/lib/svg/colors";
import { parseTransform } from "../src/lib/svg/matrix";
import { parseSvgText } from "../src/lib/svg/parse";
import { readSample } from "./samples";

const svg = (body: string, attrs = 'width="100mm" height="100mm" viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ${attrs}>${body}</svg>`;
const parse = (text: string) => parseSvgText(text, { tolerance: 0.05 });

describe("colors", () => {
  it("normalizes CSS colors", () => {
    expect(parseColor("#ABC")).toBe("#aabbcc");
    expect(parseColor("#008080ff")).toBe("#008080");
    expect(parseColor("rgb(255, 0, 128)")).toBe("#ff0080");
    expect(parseColor("teal")).toBe("#008080");
    expect(parseColor("none")).toBeNull();
  });
  it("names colors", () => {
    expect(colorName("#008080")).toBe("teal");
    expect(colorName("#000000")).toBe("black");
    expect(colorName("#fdfdfd")).toBe("white");
  });
});

describe("transforms", () => {
  it("chains transforms left to right", () => {
    const m = parseTransform("translate(10,20) scale(2)");
    expect(m).toEqual([2, 0, 0, 2, 10, 20]);
  });
});

describe("parseSvgText", () => {
  it("maps viewBox units to mm", () => {
    const r = parse(svg('<rect x="0" y="0" width="50" height="10"/>', 'width="200mm" height="100mm" viewBox="0 0 100 50"'));
    expect(r.widthMm).toBe(200);
    expect(r.shapes[0].bounds).toMatchObject({ minX: 0, maxX: 100, maxY: 20 });
  });

  it("treats unitless size as 96 dpi px", () => {
    const r = parse(svg('<rect width="96" height="96"/>', 'width="96" height="96" viewBox="0 0 96 96"'));
    expect(r.widthMm).toBeCloseTo(25.4);
    expect(r.shapes[0].bounds.maxX).toBeCloseTo(25.4);
  });

  it("applies nested group transforms", () => {
    const r = parse(svg('<g transform="translate(10,0)"><g transform="scale(2)"><rect x="1" y="1" width="1" height="1"/></g></g>'));
    expect(r.shapes[0].bounds).toMatchObject({ minX: 12, minY: 2, maxX: 14, maxY: 4 });
  });

  it("resolves fills from style over attributes, with inheritance and default black", () => {
    const r = parse(
      svg(`<g fill="red"><rect width="1" height="1"/><rect width="1" height="1" fill="blue" style="fill:#00ff00"/></g><rect width="1" height="1"/>`),
    );
    expect(r.shapes.map((s) => s.fill)).toEqual(["#ff0000", "#00ff00", "#000000"]);
  });

  it("supports <style> class rules", () => {
    const r = parse(svg('<style>.a { fill: #123456 }</style><rect class="a" width="1" height="1"/>'));
    expect(r.shapes[0].fill).toBe("#123456");
  });

  it("skips empty paths and invisible elements", () => {
    const r = parse(svg('<path d=""/><path d="  "/><rect width="1" height="1" style="display:none"/><circle r="0"/><rect width="1" height="1" fill="none"/>'));
    expect(r.shapes).toHaveLength(0);
    expect(r.emptyCount).toBe(3);
  });

  it("keeps compound paths and fill-rule", () => {
    const r = parse(svg('<path fill-rule="evenodd" d="M0,0H10V10H0Z M2,2H8V8H2Z"/>'));
    expect(r.shapes[0].fillRule).toBe("evenodd");
    expect(r.shapes[0].subpaths).toHaveLength(2);
    expect(r.shapes[0].subpaths.every((s) => s.closed)).toBe(true);
  });

  it("flattens circles within tolerance", () => {
    const r = parse(svg('<circle cx="50" cy="50" r="40"/>'));
    for (const [x, y] of r.shapes[0].subpaths[0].points) {
      expect(Math.abs(Math.hypot(x - 50, y - 50) - 40)).toBeLessThan(0.06);
    }
  });

  it("scales stroke width with transforms", () => {
    const r = parse(svg('<g transform="scale(3)"><circle cx="10" cy="10" r="5" fill="none" stroke="black" stroke-width="2"/></g>'));
    expect(r.shapes[0].stroke).toBe("#000000");
    expect(r.shapes[0].strokeWidth).toBeCloseTo(6);
  });

  it("uses inkscape labels, falling back to the layer label", () => {
    const r = parse(
      svg('<g inkscape:groupmode="layer" inkscape:label="Layer A"><rect width="1" height="1"/><rect width="1" height="1" inkscape:label="own"/></g>'),
    );
    expect(r.shapes.map((s) => s.label)).toEqual(["Layer A", "own"]);
  });

  it("supports polygons and ellipses", () => {
    const r = parse(svg('<polygon points="0,0 10,0 5,8"/><ellipse cx="5" cy="5" rx="4" ry="2"/>'));
    expect(r.shapes).toHaveLength(2);
    expect(r.shapes[1].bounds.maxY).toBeCloseTo(7, 1);
  });
});

describe("sample: avatar michael.svg", () => {
  const text = readSample("avatar michael.svg");
  it.skipIf(!text)("parses with mm units, scale transforms, strokes and empty paths", () => {
    const r = parse(text!);
    expect(r.widthMm).toBeCloseTo(220);
    expect(r.emptyCount).toBe(4);
    expect(r.shapes.length).toBeGreaterThan(30);
    const fills = new Set(r.shapes.map((s) => s.fill));
    for (const c of ["#008080", "#d38d5f", "#000000", "#ffccaa"]) expect(fills).toContain(c);
    // The skin circle has a separate brown border stroke.
    const skin = r.shapes.find((s) => s.id === "path20")!;
    expect(skin.stroke).toBe("#784421");
    expect(skin.strokeWidth).toBeCloseTo(3.265);
    expect(r.shapes.find((s) => s.fill === "#000000")?.label).toBe("black outline");
    // Everything lands on the 220 mm page (allowing for stroke overhang).
    expect(r.bounds.minX).toBeGreaterThan(-5);
    expect(r.bounds.maxX).toBeLessThan(225);
  });
});

describe("sample: avatar amanda.svg", () => {
  const text = readSample("avatar amanda.svg");
  it.skipIf(!text)("parses labeled shapes, matrix group transform and attribute fills", () => {
    const r = parse(text!);
    const labels = new Set(r.shapes.map((s) => s.label));
    for (const l of ["background", "face", "dark outlines", "hair med", "hair highlights", "face shadows", "teeth and glares", "white bg"]) {
      expect(labels).toContain(l);
    }
    expect(r.shapes.every((s) => s.fill)).toBe(true);
    expect(r.shapes.filter((s) => s.fillRule === "evenodd").length).toBe(8);
    // 974.085 px page ≈ 257.7 mm.
    expect(r.widthMm).toBeCloseTo(257.73, 1);
    expect(r.bounds.maxX).toBeLessThan(r.widthMm + 5);
  });
});
