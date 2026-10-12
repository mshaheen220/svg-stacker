import Module from "manifold-3d";
import type { ManifoldToplevel } from "manifold-3d";
import { UNITS_PER_MM } from "./region";
import type { StackResult } from "./stack";

/**
 * Extrudes each stack level into a watertight triangle mesh with
 * manifold-3d (WASM). These are the meshes the 3D preview shows and the
 * exporters write.
 *
 * Output coordinates are print coordinates in mm: X right, Y *up* (the SVG's
 * y-down is flipped so the artwork reads correctly from above), Z up from
 * the bed, with the object's footprint starting at (0, 0).
 */

export interface LevelMesh {
  id: string;
  /** xyz per vertex. */
  positions: Float32Array;
  /** 3 vertex indices per triangle, counter-clockwise from outside. */
  indices: Uint32Array;
  volumeMm3: number;
}

let wasm: Promise<ManifoldToplevel> | null = null;

/**
 * Loads manifold's WASM once. In the browser pass the bundler-resolved
 * .wasm URL; in Node the module finds the file next to itself.
 */
export function loadManifold(wasmUrl?: string): Promise<ManifoldToplevel> {
  wasm ??= Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then((m) => {
    m.setup();
    return m;
  });
  return wasm;
}

export async function buildMeshes(stack: StackResult, wasmUrl?: string): Promise<LevelMesh[]> {
  const { CrossSection } = await loadManifold(wasmUrl);
  const H = stack.heightMm;
  const meshes: LevelMesh[] = [];

  for (const level of stack.levels) {
    const thickness = level.zEnd - level.zStart;
    if (level.solid.length === 0 || thickness <= 0) {
      meshes.push({ id: level.id, positions: new Float32Array(), indices: new Uint32Array(), volumeMm3: 0 });
      continue;
    }
    // Flipping y reverses winding, so use NonZero (orientation-agnostic for
    // Clipper's non-overlapping outers + holes) rather than Positive.
    const polygons = level.solid.map((path) => path.map((p) => [p.x / UNITS_PER_MM, H - p.y / UNITS_PER_MM] as [number, number]));
    const section = new CrossSection(polygons, "NonZero");
    const extruded = section.extrude(thickness);
    const solid = extruded.translate([0, 0, level.zStart]);
    try {
      const status = solid.status();
      if (status !== "NoError") throw new Error(`Level ${level.number} mesh is not manifold (${status}).`);
      const mesh = solid.getMesh();
      // getMesh may carry extra per-vertex properties; keep xyz only.
      const n = mesh.vertProperties.length / mesh.numProp;
      const positions = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        positions[i * 3] = mesh.vertProperties[i * mesh.numProp];
        positions[i * 3 + 1] = mesh.vertProperties[i * mesh.numProp + 1];
        positions[i * 3 + 2] = mesh.vertProperties[i * mesh.numProp + 2];
      }
      meshes.push({ id: level.id, positions, indices: new Uint32Array(mesh.triVerts), volumeMm3: solid.volume() });
    } finally {
      section.delete();
      extruded.delete();
      solid.delete();
    }
  }
  return meshes;
}
