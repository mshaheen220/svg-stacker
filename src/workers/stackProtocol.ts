import type { Arrangement } from "../lib/arrangement";
import type { LevelMesh } from "../lib/geometry/mesh";
import type { Region } from "../lib/geometry/region";
import type { StackResult } from "../lib/geometry/stack";
import type { Part } from "../lib/parts";

export interface StackRequest {
  id: number;
  arrangement: Arrangement;
  parts: Part[];
  footprints: [string, Region][];
}

/** Each request gets a "stack" response (2D), then a "meshes" response (3D). */
export type StackResponse =
  | { id: number; kind: "stack"; result: StackResult }
  | { id: number; kind: "meshes"; meshes: LevelMesh[] }
  | { id: number; kind: "error"; error: string };
