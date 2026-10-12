// Dev aid (not part of the normal suite): writes the flattened geometry of each
// sample back out as SVG so it can be compared visually with the original.
// Run with: RENDER_DIR=/some/dir npx vitest run tests/render-samples.test.ts
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { regionToD } from "../src/lib/geometry/regionPath";
import { groupParts, partFootprint } from "../src/lib/parts";
import { subpathsToD } from "../src/lib/svg/pathData";
import { parseSvgText } from "../src/lib/svg/parse";
import { readSample } from "./samples";

const dir = process.env.RENDER_DIR;
it.skipIf(!dir)("renders samples", () => {
  for (const name of ["avatar michael.svg", "avatar amanda.svg"]) {
    const text = readSample(name);
    if (!text) continue;
    const r = parseSvgText(text, { tolerance: 0.05 });
    const body = r.shapes
      .map(
        (s) =>
          (s.fill ? `<path d="${subpathsToD(s.subpaths)}" fill="${s.fill}" fill-rule="${s.fillRule}"/>` : "") +
          (s.stroke ? `<path d="${subpathsToD(s.subpaths, false)}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linejoin="${s.strokeLinejoin}"/>` : ""),
      )
      .join("\n");
    const t0 = performance.now();
    const parts = groupParts(r, {});
    const byId = new Map(r.shapes.map((s) => [s.id, s]));
    const partsBody = parts.map((p) => `<path d="${regionToD(partFootprint(p, byId))}" fill="${p.color}"/>`).join("\n");
    console.log(`${name}: ${parts.length} parts, footprints in ${(performance.now() - t0).toFixed(0)} ms`);
    writeFileSync(
      `${dir}/parts_${name.replace(/ /g, "_")}`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r.widthMm}mm" height="${r.heightMm}mm" viewBox="0 0 ${r.widthMm} ${r.heightMm}">${partsBody}</svg>`,
    );
    writeFileSync(
      `${dir}/${name.replace(/ /g, "_")}`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r.widthMm}mm" height="${r.heightMm}mm" viewBox="0 0 ${r.widthMm} ${r.heightMm}">${body}</svg>`,
    );
  }
});
