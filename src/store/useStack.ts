import { useEffect } from "react";
import { create } from "zustand";
import type { LevelMesh } from "../lib/geometry/mesh";
import { computeStack, type StackResult } from "../lib/geometry/stack";
import type { StackRequest, StackResponse } from "../workers/stackProtocol";
import { useProject } from "./useProject";

/**
 * The computed stack (support fill, plate, clearance, thin-feature checks).
 * It takes a few hundred ms on detailed artwork, so it runs in a Web Worker,
 * debounced, and the last result stays on screen while a new one computes.
 */
interface StackState {
  result: StackResult | null;
  /** Watertight meshes per level (same order as result.levels), for 3D and export. */
  meshes: LevelMesh[] | null;
  pending: boolean;
  meshesPending: boolean;
  error: string | null;
}

export const useStack = create<StackState>(() => ({ result: null, meshes: null, pending: false, meshesPending: false, error: null }));

const DEBOUNCE_MS = 120;

function createWorker(): Worker | null {
  try {
    return new Worker(new URL("../workers/stack.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

/** Mount once (in App): keeps useStack in sync with the project. */
export function useStackRunner() {
  const arrangement = useProject((s) => s.arrangement);
  const parts = useProject((s) => s.parts);
  const footprints = useProject((s) => s.footprints);

  useEffect(() => {
    if (parts.length === 0) {
      useStack.setState({ result: null, meshes: null, pending: false, meshesPending: false, error: null });
      return;
    }
    useStack.setState({ pending: true, meshesPending: true });
    const timer = setTimeout(() => run(), DEBOUNCE_MS);
    return () => clearTimeout(timer);

    function run() {
      const worker = getWorker();
      if (!worker) {
        const id = ++requestId;
        try {
          const result = computeStack(arrangement, parts, footprints);
          useStack.setState({ result, pending: false, error: null });
          // Fallback only (no worker): load manifold on demand to keep the main bundle small.
          Promise.all([import("../lib/geometry/mesh"), import("manifold-3d/manifold.wasm?url")])
            .then(([m, url]) => m.buildMeshes(result, url.default))
            .then(
            (meshes) => id === requestId && useStack.setState({ meshes, meshesPending: false }),
            (e) => id === requestId && useStack.setState({ meshesPending: false, error: String(e) }),
          );
        } catch (e) {
          useStack.setState({ pending: false, meshesPending: false, error: String(e) });
        }
        return;
      }
      const id = ++requestId;
      const req: StackRequest = { id, arrangement, parts, footprints: [...footprints] };
      worker.postMessage(req);
    }
  }, [arrangement, parts, footprints]);
}

let worker: Worker | null | undefined;
let requestId = 0;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = createWorker();
  if (worker) {
    worker.onmessage = (e: MessageEvent<StackResponse>) => {
      const msg = e.data;
      if (msg.id !== requestId) return; // a newer request is in flight
      if (msg.kind === "stack") useStack.setState({ result: msg.result, pending: false, error: null });
      else if (msg.kind === "meshes") useStack.setState({ meshes: msg.meshes, meshesPending: false });
      else useStack.setState({ pending: false, meshesPending: false, error: msg.error });
    };
    worker.onerror = () => {
      // Fall back to computing on the main thread from now on.
      worker = null;
      useStack.setState({ pending: false, meshesPending: false, error: "Background geometry worker failed; retry by changing any setting." });
    };
  }
  return worker;
}
