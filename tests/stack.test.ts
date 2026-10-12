import { describe, expect, it } from "vitest";
import { defaultArrangement, DEFAULT_SETTINGS, type Arrangement } from "../src/lib/arrangement";
import { computeStack, thinRegions } from "../src/lib/geometry/stack";
import { regionAreaMm2, toPaths64 } from "../src/lib/geometry/region";
import { groupParts, partFootprint } from "../src/lib/parts";
import { parseSvgText } from "../src/lib/svg/parse";
import { readSample } from "./samples";

function setup(body: string, settings: Partial<Arrangement["settings"]> = {}) {
  const doc = parseSvgText(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">${body}</svg>`,
    { tolerance: 0.01 },
  );
  const parts = groupParts(doc, {});
  const byId = new Map(doc.shapes.map((s) => [s.id, s]));
  const footprints = new Map(parts.map((p) => [p.key, partFootprint(p, byId)]));
  const arr = defaultArrangement(parts, { ...DEFAULT_SETTINGS, ...settings });
  return { parts, footprints, arr, run: (a: Arrangement = arr) => computeStack(a, parts, footprints) };
}

// Big white square, a teal square partly hanging off it, a small black square on top.
const BODY = `<rect width="40" height="40" fill="white"/><rect x="30" y="10" width="20" height="10" fill="teal"/><rect x="35" y="12" width="5" height="5" fill="black"/>`;

describe("computeStack", () => {
  it("support fill makes each level the union of itself and everything above", () => {
    const r = setup(BODY).run();
    expect(r.levels.map((l) => Math.round(l.areaMm2))).toEqual([1600 + 100, 200, 25]);
    expect(r.levels.every((l) => l.unsupportedAreaMm2 < 0.01)).toBe(true);
    // Visible = solid minus what's above.
    expect(Math.round(regionAreaMm2(r.levels[0].visible))).toBe(1500);
    expect(r.levels.map((l) => [l.zStart, l.zEnd])).toEqual([[0, 2], [2, 3], [3, 4]]);
  });

  it("without support fill, reports what floats", () => {
    const r = setup(BODY, { supportFill: false }).run();
    expect(Math.round(r.levels[1].unsupportedAreaMm2)).toBe(100);
    expect(r.levels[2].unsupportedAreaMm2).toBeLessThan(0.01);
  });

  it("adds a plate under everything, and scales to the target width including its margin", () => {
    const { arr, run } = setup(BODY, { plate: { enabled: true, margin: 5, color: "#123456" }, targetWidth: 110 });
    const r = run(arr);
    expect(r.levels).toHaveLength(4);
    expect(r.levels[0]).toMatchObject({ isPlate: true, color: "#123456", zStart: 0, zEnd: 2 });
    expect(r.scale).toBeCloseTo(2); // (110 - 2×5) / 50
    expect(r.widthMm).toBeCloseTo(110, 1);
    expect(r.levels[1].zStart).toBe(2);
  });

  it("applies clearance to levels above the base", () => {
    const r = setup(BODY, { clearance: 0.5 }).run();
    expect(Math.round(r.levels[0].areaMm2)).toBe(1700);
    expect(r.levels[2].areaMm2).toBeCloseTo(4 * 4, 0);
  });

  it("skips disabled parts", () => {
    const { arr, parts, run } = setup(BODY);
    arr.parts[parts[2].key] = { enabled: false };
    expect(run(arr).levels).toHaveLength(2);
  });
});

describe("thinRegions", () => {
  const rect = (w: number) => toPaths64([{ points: [[0, 0], [w, 0], [w, 20], [0, 20]], closed: true }]);
  it("flags strips narrower than the minimum width, not wide ones (or their corners)", () => {
    expect(regionAreaMm2(thinRegions(rect(0.5), 0.8))).toBeCloseTo(10, 0);
    expect(regionAreaMm2(thinRegions(rect(2), 0.8))).toBe(0);
  });
});

describe("samples", () => {
  for (const name of ["avatar michael.svg", "avatar amanda.svg"]) {
    const text = readSample(name);
    it.skipIf(!text)(`${name}: fully supported stack at 100 mm`, () => {
      const doc = parseSvgText(text!, { tolerance: 0.05 });
      const parts = groupParts(doc, {});
      const byId = new Map(doc.shapes.map((s) => [s.id, s]));
      const footprints = new Map(parts.map((p) => [p.key, partFootprint(p, byId)]));
      const arr = defaultArrangement(parts, { ...DEFAULT_SETTINGS, targetWidth: 100 });
      const t0 = performance.now();
      const r = computeStack(arr, parts, footprints);
      const ms = performance.now() - t0;
      console.log(`${name}: ${r.levels.length} levels in ${ms.toFixed(0)} ms; thin: ${r.levels.map((l) => l.thinAreaMm2.toFixed(1)).join(", ")}`);
      expect(r.widthMm).toBeCloseTo(100, 0);
      expect(r.levels.every((l) => l.unsupportedAreaMm2 < 0.01)).toBe(true);
      // Base is the whole silhouette; areas never grow going up.
      for (let i = 1; i < r.levels.length; i++) expect(r.levels[i].areaMm2).toBeLessThanOrEqual(r.levels[i - 1].areaMm2 + 0.01);
    });
  }
});
