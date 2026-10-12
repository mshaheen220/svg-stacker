import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, defaultArrangement } from "../src/lib/arrangement";
import type { Part } from "../src/lib/parts";
import { buildSummary, summaryText } from "../src/lib/summary";

const part = (key: string, color: string, i: number): Part => ({ key, label: null, color, defaultName: `${key} ${color}`, sources: [], paintOrder: i });

describe("buildSummary", () => {
  const parts = [part("skin", "#d38d5f", 0), part("ring", "#784421", 1), part("ink", "#000000", 2), part("ink2", "#000000", 3)];

  it("lists levels in print order with layers, swap Z, and actions", () => {
    const arr = defaultArrangement(parts, { ...DEFAULT_SETTINGS, firstLayerHeight: 0.28 });
    arr.parts.ring = { name: "Border ring" };
    const sum = buildSummary(arr, parts);
    expect(sum.rows.map((r) => [r.number, r.action, r.layerStart, r.layerEnd, r.swapZ, r.parts[0]])).toEqual([
      [1, "start", 1, 10, 0.28, "skin #d38d5f"], // 0.28 + 9 × 0.2 = 2.08
      [2, "swap", 11, 15, 2.28, "Border ring"],
      [3, "swap", 16, 20, 3.28, "ink #000000"],
      [4, "same", 21, 25, 4.28, "ink2 #000000"],
    ]);
    expect(sum.swaps).toBe(2);
    expect(sum.totalLayers).toBe(25);
    expect(sum.filaments.map((f) => f.colorName)).toEqual(["skin", "brown", "black"]);
  });

  it("includes the plate as level 1 and formats a text table", () => {
    const arr = defaultArrangement(parts, { ...DEFAULT_SETTINGS, plate: { enabled: true, margin: 3, color: "#ffffff" } });
    const sum = buildSummary(arr, parts);
    expect(sum.rows[0]).toMatchObject({ number: 1, isPlate: true, parts: ["Background plate"], action: "start" });
    const text = summaryText(sum, "Test");
    expect(text).toContain("Test: color changes");
    expect(text).toContain("M600 embedded");
    expect(text).toMatch(/2 +Swap before layer 11 +11–15 +2\.20 +skin #d38d5f +skin #d38d5f/);
  });
});
