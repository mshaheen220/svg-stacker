import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, defaultArrangement, printedLevels, snapThickness, type Arrangement } from "../src/lib/arrangement";
import { normalizeArrangement, opacityThickness, planLevels } from "../src/lib/layers";
import { groupParts, type Part } from "../src/lib/parts";
import { parseSvgText } from "../src/lib/svg/parse";
import { readSample } from "./samples";

const part = (key: string, color: string, paintOrder: number): Part => ({ key, label: null, color, defaultName: key, sources: [], paintOrder });
const setup = (colors: string[], settings: Partial<Arrangement["settings"]> = {}) => {
  const parts = colors.map((c, i) => part(`k${i}`, c, i));
  return { arr: defaultArrangement(parts, { ...DEFAULT_SETTINGS, ...settings }), byKey: new Map(parts.map((p) => [p.key, p])) };
};

describe("snapping to layers", () => {
  const s = { ...DEFAULT_SETTINGS, layerHeight: 0.28, firstLayerHeight: 0.3 };
  it("rounds to the nearest whole layer, including the first layer on the base", () => {
    expect(snapThickness(1, false, s)).toEqual({ thickness: 1.12, layers: 4 });
    expect(snapThickness(0.05, false, s)).toEqual({ thickness: 0.28, layers: 1 });
    expect(snapThickness(2, true, s)).toEqual({ thickness: 1.98, layers: 7 }); // 0.3 + 6 × 0.28
  });

  it("puts every level boundary on a layer boundary and numbers layers", () => {
    const { arr } = setup(["#ffffff", "#000000", "#ff0000"], { layerHeight: 0.28, firstLayerHeight: 0.3 });
    const p = printedLevels(arr);
    expect(p.map((l) => [l.zStart, l.zEnd, l.layerStart, l.layerCount, l.aligned])).toEqual([
      [0, 1.98, 1, 7, true],
      [1.98, 3.1, 8, 4, true],
      [3.1, 4.22, 12, 4, true],
    ]);
  });

  it("flags misaligned boundaries when snapping is off", () => {
    const { arr } = setup(["#ffffff", "#000000", "#ff0000"], { snapToLayers: false, defaultThickness: 0.5 });
    const p = printedLevels(arr);
    expect(p.map((l) => l.aligned)).toEqual([true, true, false]); // 2.0 aligned, 2.5 is mid-layer
  });
});

describe("planLevels", () => {
  it("marks the start, swaps, and same-filament neighbours", () => {
    const { arr, byKey } = setup(["#ffffff", "#000000", "#000000", "#ff0000"]);
    expect(planLevels(arr, byKey).map((l) => l.swap)).toEqual(["start", "swap", "same", "swap"]);
  });

  it("scales the opacity requirement with lightness and contrast", () => {
    const o = DEFAULT_SETTINGS.opacity;
    expect(opacityThickness("#ffffff", "#000000", o)).toBeCloseTo(1.2);
    expect(opacityThickness("#000000", "#ffffff", o)).toBeCloseTo(0.4);
    expect(opacityThickness("#ffffff", "#fafafa", o)).toBeLessThan(0.45);
    // A lighter color underneath matters much less than a darker one.
    expect(opacityThickness("#ffff00", "#ffffff", o)).toBeLessThan(opacityThickness("#ffff00", "#000000", o) - 0.3);
  });

  it("flags show-through and normalizes by raising (never lowering) levels to whole layers", () => {
    const { arr, byKey } = setup(["#000000", "#ffffff", "#ffff00", "#000000"]);
    const before = planLevels(arr, byKey);
    expect(before.map((l) => l.showThrough)).toEqual([false, true, false, false]);
    expect(before[1].minOpaque).toBeCloseTo(1.2); // white over black
    const { arrangement, changes } = normalizeArrangement(arr, byKey);
    expect(changes.map((c) => [c.number, c.from, c.to])).toEqual([[2, 1, 1.2]]);
    const after = planLevels(arrangement, byKey);
    expect(after.every((l) => !l.showThrough)).toBe(true);
    expect(after[1].layerCount).toBe(6);
  });
});

describe("samples", () => {
  for (const name of ["avatar michael.svg", "avatar amanda.svg"]) {
    const text = readSample(name);
    it.skipIf(!text)(`${name}: normalizes to whole, opaque layers`, () => {
      const parts = groupParts(parseSvgText(text!, { tolerance: 0.05 }), {});
      const byKey = new Map(parts.map((p) => [p.key, p]));
      const { arrangement, changes } = normalizeArrangement(defaultArrangement(parts), byKey);
      const plan = planLevels(arrangement, byKey);
      console.log(`${name}: raised ${changes.map((c) => `L${c.number} ${c.from}→${c.to}`).join(", ") || "nothing"}`);
      expect(plan.every((l) => !l.showThrough && l.aligned)).toBe(true);
      for (const l of plan) expect(Math.abs(l.layerCount - Math.round(l.layerCount))).toBeLessThan(1e-9);
    });
  }
});
