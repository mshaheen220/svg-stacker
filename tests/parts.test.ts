import { describe, expect, it } from "vitest";
import { fillRegion, regionAreaMm2, strokeRegion } from "../src/lib/geometry/region";
import { groupParts, partFootprint } from "../src/lib/parts";
import { parseSvgText } from "../src/lib/svg/parse";
import { readSample } from "./samples";

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100mm" height="100mm" viewBox="0 0 100 100">${body}</svg>`;
const parse = (text: string) => parseSvgText(text, { tolerance: 0.01 });

describe("regions", () => {
  it("honors evenodd vs nonzero for compound paths", () => {
    // Inner square drawn in the same direction: a hole only under evenodd.
    const d = "M0,0H10V10H0Z M2,2H8V8H2Z";
    const [eo, nz] = parse(svg(`<path fill-rule="evenodd" d="${d}"/><path d="${d}"/>`)).shapes;
    expect(regionAreaMm2(fillRegion(eo))).toBeCloseTo(64);
    expect(regionAreaMm2(fillRegion(nz))).toBeCloseTo(100);
  });

  it("outlines a closed stroke as a ring", () => {
    const [c] = parse(svg('<circle cx="50" cy="50" r="20" fill="none" stroke="red" stroke-width="2"/>')).shapes;
    expect(regionAreaMm2(strokeRegion(c))).toBeCloseTo(2 * Math.PI * 20 * 2, 0);
  });

  it("outlines an open stroke with caps", () => {
    const [l] = parse(svg('<line x1="10" y1="10" x2="30" y2="10" stroke="red" stroke-width="2"/>')).shapes;
    expect(regionAreaMm2(strokeRegion(l))).toBeCloseTo(40); // butt caps: 20 × 2
  });
});

describe("groupParts", () => {
  const doc = parse(
    svg(`
      <rect width="10" height="10" fill="teal"/>
      <rect x="20" width="10" height="10" fill="teal"/>
      <circle cx="50" cy="50" r="5" fill="#fff" inkscape:label="bg"/>
      <circle cx="50" cy="50" r="4" fill="pink" stroke="maroon" inkscape:label="bg"/>
      <rect y="80" width="5" height="5" fill="teal" stroke="red" stroke-width="0.1"/>
    `),
  );

  it("merges by label+color in paint order, naming by label or color", () => {
    const parts = groupParts(doc, {});
    expect(parts.map((p) => p.defaultName)).toEqual([
      "teal #008080",
      "bg (white)",
      "bg (pink)",
      "bg (dark red)",
    ]);
    // The hairline red stroke on the last rect is ignored by default.
    expect(parts[0].sources).toHaveLength(3);
  });

  it("drops ignored strokes", () => {
    const strokeShape = doc.shapes.find((s) => s.stroke)!;
    expect(groupParts(doc, { [strokeShape.id]: "ignore" })).toHaveLength(3);
  });

  it("unions footprints of merged shapes", () => {
    const parts = groupParts(doc, {});
    const byId = new Map(doc.shapes.map((s) => [s.id, s]));
    expect(regionAreaMm2(partFootprint(parts[0], byId))).toBeCloseTo(225);
  });
});

describe("samples", () => {
  const michael = readSample("avatar michael.svg");
  it.skipIf(!michael)("michael: color parts, labeled outline, skin border ring", () => {
    const doc = parse(michael!);
    const parts = groupParts(doc, {});
    const names = parts.map((p) => p.defaultName);
    expect(names).toContain("teal #008080");
    expect(names).toContain("black outline");
    expect(parts.find((p) => p.color === "#784421")?.sources).toEqual([{ shapeId: "path20", kind: "stroke" }]);
    // Skin circle ring is painted right after the skin fill.
    expect(parts[0].color).toBe("#d38d5f");
    expect(parts[1].color).toBe("#784421");
    const byId = new Map(doc.shapes.map((s) => [s.id, s]));
    for (const p of parts) expect(regionAreaMm2(partFootprint(p, byId))).toBeGreaterThan(0);
  });

  const amanda = readSample("avatar amanda.svg");
  it.skipIf(!amanda)("amanda: one part per label (split by color where needed)", () => {
    const parts = groupParts(parse(amanda!), {});
    expect(parts.map((p) => p.defaultName)).toEqual([
      "background (white)",
      "background (rose)",
      "background (maroon)",
      "face",
      "dark outlines",
      "hair med",
      "white bg",
      "face shadows",
      "hair highlights",
      "teeth and glares",
      "gray #92807b",
    ]);
  });
});
