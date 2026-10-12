import { useEffect } from "react";
import { create } from "zustand";
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
  pending: boolean;
  error: string | null;
}

export const useStack = create<StackState>(() => ({ result: null, pending: false, error: null }));

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
      useStack.setState({ result: null, pending: false, error: null });
      return;
    }
    useStack.setState({ pending: true });
    const timer = setTimeout(() => run(), DEBOUNCE_MS);
    return () => clearTimeout(timer);

    function run() {
      const worker = getWorker();
      if (!worker) {
        try {
          useStack.setState({ result: computeStack(arrangement, parts, footprints), pending: false, error: null });
        } catch (e) {
          useStack.setState({ pending: false, error: String(e) });
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
      if (e.data.id !== requestId) return; // a newer request is in flight
      if (e.data.error !== undefined) useStack.setState({ pending: false, error: e.data.error });
      else useStack.setState({ result: e.data.result, pending: false, error: null });
    };
    worker.onerror = () => {
      // Fall back to computing on the main thread from now on.
      worker = null;
      useStack.setState({ pending: false, error: "Background geometry worker failed; retry by changing any setting." });
    };
  }
  return worker;
}
