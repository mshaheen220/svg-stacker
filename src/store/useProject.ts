import { create } from "zustand";
import { parseSvgText } from "../lib/svg/parse";
import type { ParsedSvg } from "../lib/svg/types";

export const DEFAULT_TOLERANCE_MM = 0.05;

interface ProjectState {
  fileName: string | null;
  svgText: string | null;
  /** Curve flattening tolerance in mm. */
  tolerance: number;
  parsed: ParsedSvg | null;
  error: string | null;
  loadSvg: (fileName: string, text: string) => void;
  setTolerance: (mm: number) => void;
}

function tryParse(text: string, tolerance: number): Pick<ProjectState, "parsed" | "error"> {
  try {
    const parsed = parseSvgText(text, { tolerance });
    return parsed.shapes.length === 0
      ? { parsed: null, error: "No filled or stroked shapes were found in this SVG." }
      : { parsed, error: null };
  } catch (e) {
    return { parsed: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export const useProject = create<ProjectState>((set, get) => ({
  fileName: null,
  svgText: null,
  tolerance: DEFAULT_TOLERANCE_MM,
  parsed: null,
  error: null,
  loadSvg: (fileName, text) => set({ fileName, svgText: text, ...tryParse(text, get().tolerance) }),
  setTolerance: (mm) => {
    const { svgText } = get();
    set({ tolerance: mm, ...(svgText ? tryParse(svgText, mm) : {}) });
  },
}));
