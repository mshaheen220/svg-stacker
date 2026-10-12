import type { Part, StrokeMode } from "./parts";

/**
 * The user's arrangement of parts into printed levels. Everything refers to
 * parts by their stable key ("label|#color"), so an arrangement saved as a
 * JSON sidecar can be re-applied to the same SVG later.
 */

export interface Level {
  id: string;
  /** Part keys on this level. A level prints in a single filament. */
  partKeys: string[];
  /** Thickness override in mm; null = use the base (level 1) or default thickness. */
  thickness: number | null;
}

export interface PartSettings {
  name?: string;
  /** Disabled parts are left out of the print entirely. */
  enabled?: boolean;
}

export interface PlateSettings {
  /** Adds a background plate under everything, as the bottom level. */
  enabled: boolean;
  /** How far the plate extends past the artwork's outline (mm). */
  margin: number;
  color: string;
}

export interface Settings {
  /** Default thickness for levels 2+ (mm). */
  defaultThickness: number;
  /** Default thickness for level 1, the base (mm) - the plate, when enabled. */
  baseThickness: number;
  /** Each level is solid under every level above it, so nothing floats. */
  supportFill: boolean;
  /** Inward offset applied to every level above the base (mm). */
  clearance: number;
  plate: PlateSettings;
  /** Overall printed width (mm), including any plate; null = the SVG's own size. */
  targetWidth: number | null;
  /** Nozzle diameter (mm); features narrower than 2× this are flagged. */
  nozzle: number;
}

export interface Arrangement {
  /** Bottom (index 0) to top. */
  levels: Level[];
  parts: Record<string, PartSettings>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultThickness: 1.0,
  baseThickness: 2.0,
  supportFill: true,
  clearance: 0,
  plate: { enabled: false, margin: 3, color: "#ffffff" },
  targetWidth: null,
  nozzle: 0.4,
};

export const PLATE_ID = "plate";

/** Fills in settings missing from older autosaves/sidecars. */
export function withDefaults(s: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...s, plate: { ...DEFAULT_SETTINGS.plate, ...s?.plate } };
}

export const THICKNESS_MIN = 0.2;
export const THICKNESS_MAX = 10;

export const newLevelId = () => `lvl-${Math.random().toString(36).slice(2, 10)}`;

/** One level per part, in paint order. */
export function defaultArrangement(parts: Part[], settings: Settings = DEFAULT_SETTINGS): Arrangement {
  return {
    levels: parts.map((p) => ({ id: newLevelId(), partKeys: [p.key], thickness: null })),
    parts: {},
    settings: { ...settings, plate: { ...settings.plate } },
  };
}

/**
 * Brings an arrangement in line with the current parts: keys that no
 * longer exist are dropped (and levels left empty by that removed), and
 * new parts get their own level just above the level holding the part
 * painted right before them.
 */
export function reconcile(arr: Arrangement, parts: Part[]): Arrangement {
  const valid = new Set(parts.map((p) => p.key));
  const levels: Level[] = arr.levels
    .map((l) => ({ ...l, partKeys: l.partKeys.filter((k) => valid.has(k)) }))
    .filter((l, i) => l.partKeys.length > 0 || arr.levels[i].partKeys.length === 0);

  const placed = new Set(levels.flatMap((l) => l.partKeys));
  const byPaint = [...parts].sort((a, b) => a.paintOrder - b.paintOrder);
  for (const part of byPaint) {
    if (placed.has(part.key)) continue;
    // Find the closest earlier-painted part that's already placed.
    let insertAt = 0;
    for (const prev of byPaint) {
      if (prev.paintOrder >= part.paintOrder) break;
      const idx = levels.findIndex((l) => l.partKeys.includes(prev.key));
      if (idx >= 0) insertAt = idx + 1;
    }
    levels.splice(insertAt, 0, { id: newLevelId(), partKeys: [part.key], thickness: null });
    placed.add(part.key);
  }
  return { ...arr, levels };
}

export const isPartEnabled = (arr: Arrangement, key: string) => arr.parts[key]?.enabled !== false;

export function partName(arr: Arrangement, part: Part): string {
  return arr.parts[part.key]?.name?.trim() || part.defaultName;
}

export interface PrintedLevel {
  /** The arrangement level, or null for the background plate. */
  level: Level | null;
  /** Level id, or PLATE_ID. */
  id: string;
  /** 1-based position among printed (non-empty) levels. */
  number: number;
  enabledKeys: string[];
  thickness: number;
  zStart: number;
  zEnd: number;
}

/**
 * Levels that actually print (at least one enabled part), with their Z
 * ranges. The plate, when enabled, is the bottom level. The base thickness
 * applies to the first *printed* level (the plate, if there is one).
 */
export function printedLevels(arr: Arrangement): PrintedLevel[] {
  const out: PrintedLevel[] = [];
  let z = 0;
  const anyEnabled = arr.levels.some((l) => l.partKeys.some((k) => isPartEnabled(arr, k)));
  if (arr.settings.plate.enabled && anyEnabled) {
    const t = arr.settings.baseThickness;
    out.push({ level: null, id: PLATE_ID, number: 1, enabledKeys: [], thickness: t, zStart: 0, zEnd: t });
    z = t;
  }
  for (const level of arr.levels) {
    const enabledKeys = level.partKeys.filter((k) => isPartEnabled(arr, k));
    if (enabledKeys.length === 0) continue;
    const thickness =
      level.thickness ?? (out.length === 0 ? arr.settings.baseThickness : arr.settings.defaultThickness);
    out.push({ level, id: level.id, number: out.length + 1, enabledKeys, thickness, zStart: z, zEnd: z + thickness });
    z += thickness;
  }
  return out;
}

// ---- Sidecar (save / load) -------------------------------------------------

export interface Sidecar {
  app: "svg-stacker";
  format: 1;
  appVersion: string;
  svgName: string | null;
  /** Hash of the SVG text, to warn when the sidecar is applied to a different file. */
  svgHash: string | null;
  tolerance: number;
  strokeModes: Record<string, StrokeMode>;
  arrangement: Arrangement;
}

/** Small, fast, non-cryptographic hash (FNV-1a, 32-bit) of the SVG text. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const num = (v: unknown, fallback: number, min = THICKNESS_MIN, max = THICKNESS_MAX) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Validates and normalizes untrusted sidecar JSON. Throws with a readable message. */
export function parseSidecar(json: unknown): Sidecar {
  const o = json as Partial<Sidecar> | null;
  if (!o || typeof o !== "object" || o.app !== "svg-stacker") throw new Error("This isn't an SVG Stacker arrangement file.");
  if (o.format !== 1) throw new Error(`Unsupported arrangement format: ${String(o.format)}.`);
  const a = (o.arrangement ?? {}) as Partial<Arrangement>;
  if (!Array.isArray(a.levels)) throw new Error("Arrangement file has no levels.");

  const levels: Level[] = a.levels.map((l) => ({
    id: typeof l?.id === "string" ? l.id : newLevelId(),
    partKeys: Array.isArray(l?.partKeys) ? l.partKeys.filter((k): k is string => typeof k === "string") : [],
    thickness: l?.thickness == null ? null : num(l.thickness, DEFAULT_SETTINGS.defaultThickness),
  }));
  const parts: Record<string, PartSettings> = {};
  for (const [k, v] of Object.entries(a.parts ?? {})) {
    if (!v || typeof v !== "object") continue;
    parts[k] = {
      ...(typeof v.name === "string" ? { name: v.name } : {}),
      ...(typeof v.enabled === "boolean" ? { enabled: v.enabled } : {}),
    };
  }
  const s = (a.settings ?? {}) as Partial<Settings>;
  const plate = (s.plate ?? {}) as Partial<PlateSettings>;
  const d = DEFAULT_SETTINGS;
  const strokeModes: Record<string, StrokeMode> = {};
  for (const [k, v] of Object.entries(o.strokeModes ?? {})) if (v === "outline" || v === "ignore") strokeModes[k] = v;

  return {
    app: "svg-stacker",
    format: 1,
    appVersion: String(o.appVersion ?? ""),
    svgName: typeof o.svgName === "string" ? o.svgName : null,
    svgHash: typeof o.svgHash === "string" ? o.svgHash : null,
    tolerance: num(o.tolerance, 0.05, 0.005, 1),
    strokeModes,
    arrangement: {
      levels,
      parts,
      settings: {
        defaultThickness: num(s.defaultThickness, d.defaultThickness),
        baseThickness: num(s.baseThickness, d.baseThickness),
        supportFill: typeof s.supportFill === "boolean" ? s.supportFill : d.supportFill,
        clearance: num(s.clearance, d.clearance, 0, 1),
        plate: {
          enabled: typeof plate.enabled === "boolean" ? plate.enabled : d.plate.enabled,
          margin: num(plate.margin, d.plate.margin, 0, 50),
          color: typeof plate.color === "string" && /^#[0-9a-f]{6}$/i.test(plate.color) ? plate.color.toLowerCase() : d.plate.color,
        },
        targetWidth: s.targetWidth == null ? null : num(s.targetWidth, 100, 5, 1000),
        nozzle: num(s.nozzle, d.nozzle, 0.1, 2),
      },
    },
  };
}
