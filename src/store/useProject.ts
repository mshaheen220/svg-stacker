import { create } from "zustand";
import type { Region } from "../lib/geometry/region";
import { groupParts, partFootprint, type Part, type StrokeMode } from "../lib/parts";
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
  /** Per-shape overrides of the default stroke handling, keyed by shape id. */
  strokeModes: Record<string, StrokeMode>;
  /** Derived: parts in default (paint) order, and each part's 2D footprint. */
  parts: Part[];
  footprints: Map<string, Region>;
  loadSvg: (fileName: string, text: string) => void;
  setTolerance: (mm: number) => void;
  setStrokeMode: (shapeId: string, mode: StrokeMode) => void;
}

type Derived = Pick<ProjectState, "parsed" | "error" | "parts" | "footprints">;

function derive(parsed: ParsedSvg | null, strokeModes: Record<string, StrokeMode>): Pick<Derived, "parts" | "footprints"> {
  if (!parsed) return { parts: [], footprints: new Map() };
  const parts = groupParts(parsed, strokeModes);
  const byId = new Map(parsed.shapes.map((s) => [s.id, s]));
  return { parts, footprints: new Map(parts.map((p) => [p.key, partFootprint(p, byId)])) };
}

function parseAndDerive(text: string, tolerance: number, strokeModes: Record<string, StrokeMode>): Derived {
  try {
    const parsed = parseSvgText(text, { tolerance });
    if (parsed.shapes.length === 0) {
      return { parsed: null, error: "No filled or stroked shapes were found in this SVG.", ...derive(null, {}) };
    }
    return { parsed, error: null, ...derive(parsed, strokeModes) };
  } catch (e) {
    return { parsed: null, error: e instanceof Error ? e.message : String(e), ...derive(null, {}) };
  }
}

export const useProject = create<ProjectState>((set, get) => ({
  fileName: null,
  svgText: null,
  tolerance: DEFAULT_TOLERANCE_MM,
  parsed: null,
  error: null,
  strokeModes: {},
  parts: [],
  footprints: new Map(),
  loadSvg: (fileName, text) => set({ fileName, svgText: text, strokeModes: {}, ...parseAndDerive(text, get().tolerance, {}) }),
  setTolerance: (mm) => {
    const { svgText, strokeModes } = get();
    set({ tolerance: mm, ...(svgText ? parseAndDerive(svgText, mm, strokeModes) : {}) });
  },
  setStrokeMode: (shapeId, mode) => {
    const strokeModes = { ...get().strokeModes, [shapeId]: mode };
    set({ strokeModes, ...derive(get().parsed, strokeModes) });
  },
}));
