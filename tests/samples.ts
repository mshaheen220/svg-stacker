import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads a file from /samples, or returns null so sample tests can be skipped when it isn't present. */
export function readSample(name: string): string | null {
  const path = resolve(process.cwd(), "samples", name);
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}
