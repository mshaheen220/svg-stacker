import type { Arrangement } from "../lib/arrangement";
import type { Region } from "../lib/geometry/region";
import type { StackResult } from "../lib/geometry/stack";
import type { Part } from "../lib/parts";

export interface StackRequest {
  id: number;
  arrangement: Arrangement;
  parts: Part[];
  footprints: [string, Region][];
}

export type StackResponse = { id: number; result: StackResult; error?: undefined } | { id: number; error: string; result?: undefined };
