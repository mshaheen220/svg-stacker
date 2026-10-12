import { ceilToLayers, printedLevels, type Arrangement, type OpacitySettings, type PrintedLevel } from "./arrangement";
import type { Part } from "./parts";
import { hexToRgb, toLab } from "./svg/colors";

/**
 * Print planning on top of printedLevels(): each level's filament color,
 * where filament swaps happen, and whether a level's color is thick enough
 * to hide the color underneath it.
 */

export type SwapKind =
  /** First printed level: load this filament before starting. */
  | "start"
  /** Pause and swap filament before this level's first layer. */
  | "swap"
  /** Same filament as the level below: keep printing, no pause. */
  | "same";

export interface LevelPlan extends PrintedLevel {
  /** Filament color: the first enabled part's color (or the plate color). */
  color: string;
  /** Distinct part colors on this level (more than one = only the first prints). */
  partColors: string[];
  swap: SwapKind;
  /** Color of the level directly underneath, if any. */
  belowColor: string | null;
  /** Minimum thickness to hide `belowColor` (whole layers when snapping), or null when not checked. */
  minOpaque: number | null;
  /** True when thickness < minOpaque - the color below may show through. */
  showThrough: boolean;
}

/**
 * How thick `top` must be to hide `below`. Light colors are translucent
 * and need more material; dark colors hide almost anything quickly. So the
 * requirement scales from minDark to minLight by the top color's lightness
 * times how much `below` would show:
 *  - a *darker* color underneath shows through badly (black under yellow
 *    looks muddy), so the lightness drop counts fully;
 *  - a different hue/saturation counts half (it tints, but less visibly);
 *  - a lighter color underneath only makes the top a touch paler.
 *   white over black → minLight, black over anything → minDark.
 */
export function opacityThickness(top: string, below: string, o: OpacitySettings): number {
  const [lt, at, bt] = toLab(hexToRgb(top));
  const [lb, ab, bb] = toLab(hexToRgb(below));
  const darkerBelow = Math.max(0, lt - lb);
  const chroma = Math.hypot(at - ab, bt - bb);
  const contrast = Math.min(1, (darkerBelow + 0.5 * chroma) / 100);
  return o.minDark + (o.minLight - o.minDark) * (lt / 100) * contrast;
}

export function planLevels(arr: Arrangement, parts: Map<string, Part>): LevelPlan[] {
  const s = arr.settings;
  const plans: LevelPlan[] = [];
  for (const lvl of printedLevels(arr)) {
    const enabledParts = lvl.enabledKeys.map((k) => parts.get(k)).filter((p): p is Part => !!p);
    const partColors = [...new Set(enabledParts.map((p) => p.color))];
    const color = lvl.level ? (partColors[0] ?? "#888888") : s.plate.color;
    const prev = plans.at(-1);
    const belowColor = prev?.color ?? null;
    const swap: SwapKind = !prev ? "start" : prev.color === color ? "same" : "swap";
    let minOpaque: number | null = null;
    // The base sits on the bed (nothing to hide); same-filament levels don't need hiding.
    if (s.opacity.enabled && belowColor && swap === "swap") {
      const raw = opacityThickness(color, belowColor, s.opacity);
      minOpaque = s.snapToLayers ? ceilToLayers(raw, false, s) : Math.round(raw * 100) / 100;
    }
    plans.push({
      ...lvl,
      color,
      partColors,
      swap,
      belowColor,
      minOpaque,
      showThrough: minOpaque != null && lvl.thickness < minOpaque - 1e-6,
    });
  }
  return plans;
}

export interface NormalizeChange {
  levelId: string;
  number: number;
  from: number;
  to: number;
}

/**
 * Raises every level whose color would show through to its minimum opaque
 * thickness (as a per-level override). Thinner levels are never made
 * thinner. Snapping to whole layers is applied by printedLevels itself.
 */
export function normalizeArrangement(arr: Arrangement, parts: Map<string, Part>): { arrangement: Arrangement; changes: NormalizeChange[] } {
  const changes: NormalizeChange[] = [];
  const raise = new Map<string, number>();
  for (const p of planLevels(arr, parts)) {
    if (p.showThrough && p.minOpaque != null && p.level) {
      raise.set(p.id, p.minOpaque);
      changes.push({ levelId: p.id, number: p.number, from: p.thickness, to: p.minOpaque });
    }
  }
  if (changes.length === 0) return { arrangement: arr, changes };
  return {
    arrangement: { ...arr, levels: arr.levels.map((l) => (raise.has(l.id) ? { ...l, thickness: raise.get(l.id)! } : l)) },
    changes,
  };
}
