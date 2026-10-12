/// <reference lib="webworker" />
import { computeStack } from "../lib/geometry/stack";
import type { StackRequest, StackResponse } from "./stackProtocol";

self.onmessage = (e: MessageEvent<StackRequest>) => {
  const { id, arrangement, parts, footprints } = e.data;
  try {
    const result = computeStack(arrangement, parts, new Map(footprints));
    self.postMessage({ id, result } satisfies StackResponse);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies StackResponse);
  }
};
