import { zipSync } from "fflate";
import type { LevelMesh } from "../geometry/mesh";
import type { StackLevel } from "../geometry/stack";

/**
 * Binary STL for one level mesh. Coordinates are kept in print space (the
 * level already sits at its Z), so importing every level's STL into one
 * object in a slicer reassembles the stack without moving anything.
 */
export function meshToStl(mesh: LevelMesh, header = "SVG Stacker"): Uint8Array {
  const triCount = mesh.indices.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buf);
  const head = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buf, 0, head.length).set(head);
  view.setUint32(80, triCount, true);
  const p = mesh.positions;
  const ix = mesh.indices;
  let o = 84;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    // Facet normal from the (counter-clockwise) winding.
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz, p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]]) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

/** File-name-safe level file name: "03 hair med.stl". */
export function stlFileName(level: StackLevel): string {
  const safe = level.name.replace(/[\\/:*?"<>|#]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "level";
  return `${String(level.number).padStart(2, "0")} ${safe}.stl`;
}

/** All levels as STLs in one zip. */
export function stlZip(levels: StackLevel[], meshes: LevelMesh[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  levels.forEach((l, i) => {
    if (meshes[i]?.indices.length) files[stlFileName(l)] = meshToStl(meshes[i], `SVG Stacker level ${l.number}`);
  });
  return zipSync(files, { level: 6 });
}
