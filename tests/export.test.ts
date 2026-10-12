// @vitest-environment node
import { writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { defaultArrangement, DEFAULT_SETTINGS, type Settings } from "../src/lib/arrangement";
import { build3mf, swapEntries, type SwapCommand } from "../src/lib/export/threemf";
import { meshToStl, stlZip } from "../src/lib/export/stl";
import { buildMeshes } from "../src/lib/geometry/mesh";
import { computeStack } from "../src/lib/geometry/stack";
import { groupParts, partFootprint } from "../src/lib/parts";
import { parseSvgText } from "../src/lib/svg/parse";
import { buildSummary } from "../src/lib/summary";
import { readSample } from "./samples";

let dom: JSDOM;
beforeAll(() => {
  dom = new JSDOM();
  globalThis.DOMParser ??= dom.window.DOMParser as unknown as typeof DOMParser;
});

async function prepare(svgText: string, settings: Partial<Settings> = {}) {
  const doc = parseSvgText(svgText, { tolerance: 0.05 });
  const parts = groupParts(doc, {});
  const byId = new Map(doc.shapes.map((s) => [s.id, s]));
  const footprints = new Map(parts.map((p) => [p.key, partFootprint(p, byId)]));
  const stack = computeStack(defaultArrangement(parts, { ...DEFAULT_SETTINGS, ...settings }), parts, footprints);
  return { stack, meshes: await buildMeshes(stack) };
}

const xml = (s: string) => new dom.window.DOMParser().parseFromString(s, "application/xml");
const SIMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm" viewBox="0 0 40 20">
  <rect width="40" height="20" fill="white"/><rect x="5" y="5" width="10" height="10" fill="#008080"/><rect x="25" y="5" width="10" height="10" fill="black"/></svg>`;

describe("build3mf", () => {
  it("writes one object with a named part per level, centered on the bed", async () => {
    const { stack, meshes } = await prepare(SIMPLE);
    const files = unzipSync(build3mf(stack, meshes, { objectName: "Sign", swap: "m600", bed: { x: 220, y: 220 }, appVersion: "test" }));
    expect(Object.keys(files).sort()).toEqual([
      "3D/3dmodel.model",
      "3D/Objects/object_1.model",
      "3D/_rels/3dmodel.model.rels",
      "Metadata/custom_gcode_per_layer.xml",
      "Metadata/model_settings.config",
      "[Content_Types].xml",
      "_rels/.rels",
    ]);
    for (const f of Object.values(files)) expect(xml(strFromU8(f)).getElementsByTagName("parsererror")).toHaveLength(0);

    const settings = xml(strFromU8(files["Metadata/model_settings.config"]));
    const names = [...settings.querySelectorAll("part > metadata[key=name]")].map((m) => m.getAttribute("value"));
    expect(names).toEqual(["1. white #ffffff", "2. teal #008080", "3. black #000000"]);
    expect(settings.querySelector("object > metadata[key=name]")!.getAttribute("value")).toBe("Sign");

    const root = xml(strFromU8(files["3D/3dmodel.model"]));
    expect(root.getElementsByTagName("component")).toHaveLength(3);
    expect(root.querySelector("item")!.getAttribute("transform")).toBe("1 0 0 0 1 0 0 0 1 110 110 0");

    // Mesh centered in XY around the origin, Z from the bed up.
    const objects = xml(strFromU8(files["3D/Objects/object_1.model"]));
    const xs = [...objects.getElementsByTagName("vertex")].map((v) => Number(v.getAttribute("x")));
    expect(Math.min(...xs)).toBeCloseTo(-20);
    expect(Math.max(...xs)).toBeCloseTo(20);
  });

  it("embeds a swap at the top Z of each new color's first layer", async () => {
    const { stack, meshes } = await prepare(SIMPLE);
    const files = unzipSync(build3mf(stack, meshes, { objectName: "Sign", swap: "m600", bed: { x: 220, y: 220 }, appVersion: "test" }));
    const layers = [...xml(strFromU8(files["Metadata/custom_gcode_per_layer.xml"])).getElementsByTagName("layer")];
    // Base 0–2 mm (layers 1–10), teal 2–3 (first layer top 2.2), black 3–4 (top 3.2).
    expect(layers.map((l) => [l.getAttribute("top_z"), l.getAttribute("type"), l.getAttribute("extra")])).toEqual([
      ["2.2", "4", "M117 Load L2 teal #008080\nM600"],
      ["3.2", "4", "M117 Load L3 black #000000\nM600"],
    ]);
  });

  it("supports pause-style swaps and no swaps", async () => {
    const { stack } = await prepare(SIMPLE);
    expect(swapEntries(stack, "printer-pause").map((s) => s.type)).toEqual([1, 1]);
    expect(swapEntries(stack, "m25")[0].extra).toBe("M117 Load L2 teal #008080\nM25");
    expect(swapEntries(stack, "none")).toEqual([]);
  });

  it("skips swaps between same-filament levels and respects the first-layer height", async () => {
    const { stack } = await prepare(SIMPLE, { plate: { enabled: true, margin: 2, color: "#ffffff" }, firstLayerHeight: 0.28 });
    // Plate (white) → white level: no swap. Base = 0.28 + 9 × 0.2 = 2.08.
    expect(stack.levels.map((l) => l.swap)).toEqual(["start", "same", "swap", "swap"]);
    expect(swapEntries(stack, "m600").map((s) => s.topZ)).toEqual([3.28, 4.28]);
  });

  it("agrees with the color-change summary on every swap", async () => {
    const doc = parseSvgText(SIMPLE, { tolerance: 0.05 });
    const parts = groupParts(doc, {});
    const byId = new Map(doc.shapes.map((s) => [s.id, s]));
    const footprints = new Map(parts.map((p) => [p.key, partFootprint(p, byId)]));
    const arr = defaultArrangement(parts, { ...DEFAULT_SETTINGS, firstLayerHeight: 0.24, layerHeight: 0.16, plate: { enabled: true, margin: 2, color: "#ff0000" } });
    const stack = computeStack(arr, parts, footprints);
    const summary = buildSummary(arr, parts);
    const fromSummary = summary.rows.filter((r) => r.action === "swap").map((r) => [r.number, r.swapZ]);
    const from3mf = swapEntries(stack, "m600").map((s) => [s.level.number, s.topZ]);
    expect(from3mf).toEqual(fromSummary);
    expect(from3mf.length).toBe(3);
  });
});

describe("STL", () => {
  it("writes binary STL with the right triangle count", async () => {
    const { stack, meshes } = await prepare(SIMPLE);
    const stl = meshToStl(meshes[1]);
    const view = new DataView(stl.buffer);
    expect(view.getUint32(80, true)).toBe(meshes[1].indices.length / 3);
    expect(stl.length).toBe(84 + 50 * (meshes[1].indices.length / 3));
    expect(Object.keys(unzipSync(stlZip(stack.levels, meshes)))).toEqual(["01 white ffffff.stl", "02 teal 008080.stl", "03 black 000000.stl"]);
  });
});

describe("samples", () => {
  const out = process.env.EXPORT_DIR;
  for (const name of ["avatar michael.svg", "avatar amanda.svg"]) {
    const text = readSample(name);
    it.skipIf(!text)(`${name}: exports a valid 3MF`, async () => {
      const { stack, meshes } = await prepare(text!, { targetWidth: 120 });
      const t0 = performance.now();
      const swap = (process.env.EXPORT_SWAP as SwapCommand | undefined) ?? "m600";
      const data = build3mf(stack, meshes, { objectName: name.replace(".svg", ""), swap, bed: { x: 220, y: 220 }, appVersion: "test" });
      console.log(`${name}: ${(data.length / 1e6).toFixed(2)} MB 3MF in ${(performance.now() - t0).toFixed(0)} ms`);
      const files = unzipSync(data);
      const parts = xml(strFromU8(files["Metadata/model_settings.config"])).getElementsByTagName("part");
      expect(parts).toHaveLength(stack.levels.length);
      if (out) writeFileSync(`${out}/${name.replace(".svg", "")}.3mf`, data);
    });
  }
});
