/// <reference lib="webworker" />
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { buildMeshes } from "../lib/geometry/mesh";
import { computeStack } from "../lib/geometry/stack";
import type { StackRequest, StackResponse } from "./stackProtocol";

const post = (msg: StackResponse, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<StackRequest>) => {
  const { id, arrangement, parts, footprints } = e.data;
  try {
    const result = computeStack(arrangement, parts, new Map(footprints));
    post({ id, kind: "stack", result });
    const meshes = await buildMeshes(result, wasmUrl);
    post({ id, kind: "meshes", meshes }, meshes.flatMap((m) => [m.positions.buffer, m.indices.buffer]));
  } catch (err) {
    post({ id, kind: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
