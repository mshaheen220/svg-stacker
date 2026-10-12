import { describe, expect, it } from "vitest";
import { shuffleIndices, TIPS, tipsPayload } from "../src/tips";

describe("tips", () => {
  it("matches the Mashghal tip-source shape: { tips: [{ category, text }] }", () => {
    const body = JSON.parse(JSON.stringify(tipsPayload()));
    expect(Object.keys(body)).toEqual(["tips"]);
    expect(body.tips.length).toBeGreaterThan(20);
    for (const t of body.tips) {
      expect(Object.keys(t).sort()).toEqual(["category", "text"]);
      expect(["preparing", "arranging", "slicing", "printing"]).toContain(t.category);
      expect(t.text.trim().length).toBeGreaterThan(20);
    }
  });

  it("has no duplicate tips", () => {
    expect(new Set(TIPS.map((t) => t.text)).size).toBe(TIPS.length);
  });

  it("shuffles into a permutation", () => {
    expect([...shuffleIndices(TIPS.length)].sort((a, b) => a - b)).toEqual(TIPS.map((_, i) => i));
  });
});
