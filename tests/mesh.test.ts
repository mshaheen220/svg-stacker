// @vitest-environment node
// manifold-3d loads its WASM the Node way here; jsdom only supplies DOMParser.
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { defaultArrangement, DEFAULT_SETTINGS } from "../src/lib/arrangement";
import { buildMeshes, type LevelMesh } from "../src/lib/geometry/mesh";
import { computeStack } from "../src/lib/geometry/stack";
import { groupParts, partFootprint } from "../src/lib/parts";
import { parseSvgText } from "../src/lib/svg/parse";
import { readSample } from "./samples";

beforeAll(() => {
  globalThis.DOMParser ??= new JSDOM().window.DOMParser as unknown as typeof DOMParser;
});

function stackFor(svgText: string, settings = {}) {
  const doc = parseSvgText(svgText, { tolerance: 0.05 });
  const parts = groupParts(doc, {});
  const byId = new Map(doc.shapes.map((s) => [s.id, s]));
  const footprints = new Map(parts.map((p) => [p.key, partFootprint(p, byId)]));
  return computeStack(defaultArrangement(parts, { ...DEFAULT_SETTINGS, ...settings }), parts, footprints);
}

/** Every directed edge must be matched by exactly one reverse edge: closed, consistently oriented. */
function expectWatertight(m: LevelMesh) {
  const edges = new Map<string, number>();
  const idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const k = `${idx[t + e]},${idx[t + ((e + 1) % 3)]}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of edges) {
    expect(n).toBe(1);
    const [a, b] = k.split(",");
    expect(edges.get(`${b},${a}`)).toBe(1);
  }
}

describe("buildMeshes", () => {
  it("extrudes levels with holes into watertight meshes at the right Z, y flipped up", async () => {
    const stack = stackFor(
      `<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10">
        <path fill-rule="evenodd" d="M0,0H20V10H0Z M2,2H8V8H2Z" fill="white"/><rect x="12" y="1" width="4" height="2" fill="black"/></svg>`,
    );
    const meshes = await buildMeshes(stack);
    expect(meshes).toHaveLength(2);
    meshes.forEach(expectWatertight);
    // Base: (200 - 36 hole) mm² × 2 mm; support fill doesn't add (black is inside white).
    expect(meshes[0].volumeMm3).toBeCloseTo(164 * 2, 1);
    expect(meshes[1].volumeMm3).toBeCloseTo(8 * 1, 1);
    const z = [...meshes[1].positions].filter((_, i) => i % 3 === 2);
    expect(Math.min(...z)).toBeCloseTo(2);
    expect(Math.max(...z)).toBeCloseTo(3);
    // The black rect sits near the SVG's top (y 1–3), i.e. near the top of the print (y-up 7–9).
    const y = [...meshes[1].positions].filter((_, i) => i % 3 === 1);
    expect(Math.min(...y)).toBeCloseTo(7);
    expect(Math.max(...y)).toBeCloseTo(9);
  });

  for (const name of ["avatar michael.svg", "avatar amanda.svg"]) {
    const text = readSample(name);
    it.skipIf(!text)(`${name}: every level is watertight`, async () => {
      const stack = stackFor(text!, { targetWidth: 100, plate: { enabled: true, margin: 3, color: "#ffffff" } });
      const t0 = performance.now();
      const meshes = await buildMeshes(stack);
      const tris = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
      console.log(`${name}: ${meshes.length} meshes, ${tris} triangles in ${(performance.now() - t0).toFixed(0)} ms`);
      meshes.forEach(expectWatertight);
      meshes.forEach((m) => expect(m.volumeMm3).toBeGreaterThan(0));
    });
  }
});
