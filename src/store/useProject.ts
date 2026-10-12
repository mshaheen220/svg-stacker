import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { version as appVersion } from "../../package.json";
import {
  defaultArrangement,
  DEFAULT_SETTINGS,
  hashText,
  newLevelId,
  reconcile,
  withDefaults,
  type Arrangement,
  type Settings,
  type Sidecar,
} from "../lib/arrangement";
import type { Region } from "../lib/geometry/region";
import { normalizeArrangement, type NormalizeChange } from "../lib/layers";
import { groupParts, partFootprint, type Part, type StrokeMode } from "../lib/parts";
import { parseSvgText } from "../lib/svg/parse";
import type { ParsedSvg } from "../lib/svg/types";

export const DEFAULT_TOLERANCE_MM = 0.05;

interface ProjectState {
  // ---- Persisted (autosave) ----
  fileName: string | null;
  svgText: string | null;
  svgHash: string | null;
  /** Curve flattening tolerance in mm. */
  tolerance: number;
  /** Per-shape overrides of the default stroke handling, keyed by shape id. */
  strokeModes: Record<string, StrokeMode>;
  arrangement: Arrangement;

  // ---- Derived (recomputed, never persisted) ----
  parsed: ParsedSvg | null;
  error: string | null;
  /** Parts in default (paint) order, and each part's 2D footprint. */
  parts: Part[];
  footprints: Map<string, Region>;

  loadSvg: (fileName: string, text: string) => void;
  setTolerance: (mm: number) => void;
  setStrokeMode: (shapeId: string, mode: StrokeMode) => void;

  moveLevel: (from: number, to: number) => void;
  /** Moves a part to `levelId` at `index` (end if omitted). levelId "new-top"/"new-bottom" creates a level. */
  movePart: (key: string, levelId: string, index?: number) => void;
  addLevel: () => void;
  removeLevel: (id: string) => void;
  setLevelThickness: (id: string, mm: number | null) => void;
  renamePart: (key: string, name: string) => void;
  setPartEnabled: (key: string, enabled: boolean) => void;
  setSettings: (s: Partial<Settings>) => void;
  resetArrangement: () => void;
  /** Raises levels whose color would show through; returns what changed. */
  normalize: () => NormalizeChange[];

  exportSidecar: () => Sidecar;
  /** Applies a loaded sidecar. Returns a warning when it was saved for a different SVG. */
  applySidecar: (s: Sidecar) => string | null;
}

type Derived = Pick<ProjectState, "parsed" | "error" | "parts" | "footprints">;

const EMPTY_DERIVED: Omit<Derived, "error"> = { parsed: null, parts: [], footprints: new Map() };

function deriveParts(parsed: ParsedSvg | null, strokeModes: Record<string, StrokeMode>) {
  if (!parsed) return { parts: [] as Part[], footprints: new Map<string, Region>() };
  const parts = groupParts(parsed, strokeModes);
  const byId = new Map(parsed.shapes.map((s) => [s.id, s]));
  return { parts, footprints: new Map(parts.map((p) => [p.key, partFootprint(p, byId)])) };
}

function parseAndDerive(text: string, tolerance: number, strokeModes: Record<string, StrokeMode>): Derived {
  try {
    const parsed = parseSvgText(text, { tolerance });
    if (parsed.shapes.length === 0) {
      return { ...EMPTY_DERIVED, error: "No filled or stroked shapes were found in this SVG." };
    }
    return { parsed, error: null, ...deriveParts(parsed, strokeModes) };
  } catch (e) {
    return { ...EMPTY_DERIVED, error: e instanceof Error ? e.message : String(e) };
  }
}

// localStorage can be full, disabled, or throw in private windows; autosave
// is a convenience, so failures are swallowed rather than breaking the app.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Autosave skipped (likely quota); the sidecar download still works.
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  },
};

export const useProject = create<ProjectState>()(
  persist(
    (set, get) => {
      /** Updates the arrangement immutably. */
      const updateArr = (fn: (a: Arrangement) => Arrangement) => set({ arrangement: fn(get().arrangement) });

      return {
        fileName: null,
        svgText: null,
        svgHash: null,
        tolerance: DEFAULT_TOLERANCE_MM,
        strokeModes: {},
        arrangement: { levels: [], parts: {}, settings: { ...DEFAULT_SETTINGS } },
        parsed: null,
        error: null,
        parts: [],
        footprints: new Map(),

        loadSvg: (fileName, text) => {
          const svgHash = hashText(text);
          const prev = get();
          // Re-opening the same file keeps the current arrangement.
          const same = prev.svgHash === svgHash;
          const strokeModes = same ? prev.strokeModes : {};
          const derived = parseAndDerive(text, prev.tolerance, strokeModes);
          const arrangement = same
            ? reconcile(prev.arrangement, derived.parts)
            : defaultArrangement(derived.parts, prev.arrangement.settings);
          set({ fileName, svgText: text, svgHash, strokeModes, ...derived, arrangement });
        },

        setTolerance: (mm) => {
          const { svgText, strokeModes, arrangement } = get();
          if (!svgText) return set({ tolerance: mm });
          const derived = parseAndDerive(svgText, mm, strokeModes);
          set({ tolerance: mm, ...derived, arrangement: reconcile(arrangement, derived.parts) });
        },

        setStrokeMode: (shapeId, mode) => {
          const strokeModes = { ...get().strokeModes, [shapeId]: mode };
          const derived = deriveParts(get().parsed, strokeModes);
          set({ strokeModes, ...derived, arrangement: reconcile(get().arrangement, derived.parts) });
        },

        moveLevel: (from, to) =>
          updateArr((a) => {
            const levels = [...a.levels];
            const [moved] = levels.splice(from, 1);
            levels.splice(Math.max(0, Math.min(levels.length, to)), 0, moved);
            return { ...a, levels };
          }),

        movePart: (key, levelId, index) =>
          updateArr((a) => {
            let levels = a.levels.map((l) => ({ ...l, partKeys: l.partKeys.filter((k) => k !== key) }));
            if (levelId === "new-top" || levelId === "new-bottom") {
              const lvl = { id: newLevelId(), partKeys: [key], thickness: null };
              levels = levelId === "new-top" ? [...levels, lvl] : [lvl, ...levels];
            } else {
              levels = levels.map((l) => {
                if (l.id !== levelId) return l;
                const keys = [...l.partKeys];
                keys.splice(index ?? keys.length, 0, key);
                return { ...l, partKeys: keys };
              });
            }
            // A level emptied by dragging its last part away is removed.
            const sourceEmptied = (l: (typeof levels)[number]) =>
              l.partKeys.length === 0 && a.levels.find((o) => o.id === l.id)?.partKeys.includes(key);
            return { ...a, levels: levels.filter((l) => !sourceEmptied(l)) };
          }),

        addLevel: () => updateArr((a) => ({ ...a, levels: [...a.levels, { id: newLevelId(), partKeys: [], thickness: null }] })),

        removeLevel: (id) => updateArr((a) => ({ ...a, levels: a.levels.filter((l) => l.id !== id || l.partKeys.length > 0) })),

        setLevelThickness: (id, mm) =>
          updateArr((a) => ({ ...a, levels: a.levels.map((l) => (l.id === id ? { ...l, thickness: mm } : l)) })),

        renamePart: (key, name) =>
          updateArr((a) => ({ ...a, parts: { ...a.parts, [key]: { ...a.parts[key], name: name || undefined } } })),

        setPartEnabled: (key, enabled) =>
          updateArr((a) => ({ ...a, parts: { ...a.parts, [key]: { ...a.parts[key], enabled } } })),

        setSettings: (s) => updateArr((a) => ({ ...a, settings: { ...a.settings, ...s } })),

        resetArrangement: () => {
          const derived = deriveParts(get().parsed, {});
          set({ strokeModes: {}, ...derived, arrangement: defaultArrangement(derived.parts, get().arrangement.settings) });
        },

        normalize: () => {
          const { arrangement, parts } = get();
          const result = normalizeArrangement(arrangement, new Map(parts.map((p) => [p.key, p])));
          if (result.changes.length) set({ arrangement: result.arrangement });
          return result.changes;
        },

        exportSidecar: () => {
          const { fileName, svgHash, tolerance, strokeModes, arrangement } = get();
          return { app: "svg-stacker", format: 1, appVersion, svgName: fileName, svgHash, tolerance, strokeModes, arrangement };
        },

        applySidecar: (s) => {
          const { svgText, svgHash } = get();
          if (!svgText) {
            set({ tolerance: s.tolerance, strokeModes: s.strokeModes, arrangement: s.arrangement });
            return "Arrangement loaded. Import the matching SVG to see it applied.";
          }
          const derived = parseAndDerive(svgText, s.tolerance, s.strokeModes);
          set({ tolerance: s.tolerance, strokeModes: s.strokeModes, ...derived, arrangement: reconcile(s.arrangement, derived.parts) });
          return s.svgHash && s.svgHash !== svgHash
            ? `This arrangement was saved for ${s.svgName ?? "a different SVG"}; parts were matched by name and color.`
            : null;
        },
      };
    },
    {
      name: "svg-stacker:project",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        fileName: s.fileName,
        svgText: s.svgText,
        svgHash: s.svgHash,
        tolerance: s.tolerance,
        strokeModes: s.strokeModes,
        arrangement: s.arrangement,
      }),
      // Rebuild everything derived from the restored SVG while merging the
      // saved state in (hydration runs synchronously inside create(), so
      // useProject itself can't be referenced here yet).
      merge: (persisted, current) => {
        const saved = persisted as Partial<ProjectState> | undefined;
        const next = { ...current, ...saved };
        next.arrangement = { ...next.arrangement, settings: withDefaults(next.arrangement?.settings) };
        if (!next.svgText) return next;
        const derived = parseAndDerive(next.svgText, next.tolerance, next.strokeModes);
        return { ...next, ...derived, arrangement: reconcile(next.arrangement, derived.parts) };
      },
    },
  ),
);
