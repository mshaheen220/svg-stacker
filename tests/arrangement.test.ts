import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultArrangement,
  DEFAULT_SETTINGS,
  hashText,
  parseSidecar,
  printedLevels,
  reconcile,
  type Arrangement,
} from "../src/lib/arrangement";
import type { Part } from "../src/lib/parts";
import { useProject } from "../src/store/useProject";
import { readSample } from "./samples";

const part = (key: string, paintOrder: number): Part => ({
  key,
  label: null,
  color: "#000000",
  defaultName: key,
  sources: [],
  paintOrder,
});
const keys = (a: Arrangement) => a.levels.map((l) => l.partKeys.join("+"));

describe("arrangement", () => {
  const parts = [part("a", 0), part("b", 1), part("c", 2)];

  it("defaults to one level per part in paint order", () => {
    expect(keys(defaultArrangement(parts))).toEqual(["a", "b", "c"]);
  });

  it("reconcile drops vanished parts and slots new ones after their paint predecessor", () => {
    const arr = defaultArrangement(parts);
    arr.levels.push({ id: "empty", partKeys: [], thickness: null }); // user-made empty level is kept
    const next = reconcile(arr, [part("a", 0), part("a2", 0.5), part("c", 2)]);
    expect(keys(next)).toEqual(["a", "a2", "c", ""]);
  });

  it("computes Z ranges, applying base thickness to the first printed level and skipping disabled ones", () => {
    const arr = defaultArrangement(parts, { ...DEFAULT_SETTINGS, baseThickness: 2, defaultThickness: 0.6 });
    arr.parts.a = { enabled: false };
    arr.levels[2].thickness = 1;
    const p = printedLevels(arr);
    expect(p.map((l) => [l.number, l.enabledKeys[0], l.zStart, l.zEnd])).toEqual([
      [1, "b", 0, 2],
      [2, "c", 2, 3],
    ]);
  });

  it("validates sidecar files", () => {
    expect(() => parseSidecar({ app: "other" })).toThrow(/isn't an SVG Stacker/);
    const s = parseSidecar({
      app: "svg-stacker",
      format: 1,
      tolerance: 99,
      strokeModes: { x: "outline", y: "bogus" },
      arrangement: { levels: [{ id: "l1", partKeys: ["a", 3], thickness: 50 }], parts: { a: { name: "A", enabled: "no" } }, settings: {} },
    });
    expect(s.tolerance).toBe(1);
    expect(s.strokeModes).toEqual({ x: "outline" });
    expect(s.arrangement.levels[0]).toEqual({ id: "l1", partKeys: ["a"], thickness: 10 });
    expect(s.arrangement.parts.a).toEqual({ name: "A" });
  });
});

describe("store", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10">
    <rect width="10" height="10" fill="white"/><rect width="5" height="5" fill="teal"/><rect width="2" height="2" fill="black"/></svg>`;

  beforeEach(() => {
    localStorage.clear();
    useProject.setState({ svgHash: null });
    useProject.getState().loadSvg("t.svg", svg);
  });

  it("moves parts between levels and removes the emptied level", () => {
    const s = useProject.getState();
    const [l0, l1] = s.arrangement.levels;
    s.movePart(l1.partKeys[0], l0.id);
    const levels = useProject.getState().arrangement.levels;
    expect(levels).toHaveLength(2);
    expect(levels[0].partKeys).toHaveLength(2);
  });

  it("keeps the arrangement when the same SVG is re-opened, resets for a different one", () => {
    const s = useProject.getState();
    s.moveLevel(0, 2);
    const order = keys(useProject.getState().arrangement);
    s.loadSvg("t.svg", svg);
    expect(keys(useProject.getState().arrangement)).toEqual(order);
    s.loadSvg("other.svg", svg.replace("black", "red"));
    expect(keys(useProject.getState().arrangement)[0]).toBe("|#ffffff");
  });

  it("round-trips a sidecar and warns on a different SVG", () => {
    const s = useProject.getState();
    s.renamePart("|#008080", "Hat");
    s.moveLevel(2, 0);
    const sidecar = JSON.parse(JSON.stringify(s.exportSidecar()));
    expect(sidecar.svgHash).toBe(hashText(svg));
    s.resetArrangement();
    expect(useProject.getState().applySidecar(parseSidecar(sidecar))).toBeNull();
    const arr = useProject.getState().arrangement;
    expect(arr.parts["|#008080"].name).toBe("Hat");
    expect(arr.levels[0].partKeys).toEqual(["|#000000"]);

    useProject.getState().loadSvg("x.svg", svg.replace('width="2"', 'width="3"'));
    expect(useProject.getState().applySidecar(parseSidecar(sidecar))).toMatch(/saved for t.svg/);
  });

  it("autosaves to localStorage", () => {
    const saved = JSON.parse(localStorage.getItem("svg-stacker:project")!);
    expect(saved.state.fileName).toBe("t.svg");
    expect(saved.state.parsed).toBeUndefined();
    expect(saved.state.arrangement.levels).toHaveLength(3);
  });
});

describe("samples", () => {
  const amanda = readSample("avatar amanda.svg");
  it.skipIf(!amanda)("amanda loads into one level per part", () => {
    useProject.getState().loadSvg("avatar amanda.svg", amanda!);
    const { arrangement, parts } = useProject.getState();
    expect(arrangement.levels).toHaveLength(parts.length);
    expect(printedLevels(arrangement).at(-1)!.zEnd).toBeCloseTo(2 + (parts.length - 1) * 1);
  });
});
