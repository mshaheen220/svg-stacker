import { layerTopZ, partName, type Arrangement, type SwapCommand } from "./arrangement";
import { planLevels, type SwapKind } from "./layers";
import type { Part } from "./parts";
import { colorName } from "./svg/colors";

/**
 * The color-change summary: one row per printed level, in print order, with
 * everything needed to run the print by hand or check OrcaSlicer's layer
 * slider against the embedded swaps.
 */

export interface SummaryRow {
  number: number;
  action: SwapKind;
  /** First and last slicer layer (1-based) of this level. */
  layerStart: number;
  layerEnd: number;
  layerCount: number;
  /** Top Z of the first layer: what Orca's layer slider shows, and where a swap is placed. */
  swapZ: number;
  zStart: number;
  zEnd: number;
  thickness: number;
  color: string;
  colorName: string;
  parts: string[];
  /** More than one part color on the level (only the first prints). */
  mixedColors: boolean;
  isPlate: boolean;
}

export interface Summary {
  rows: SummaryRow[];
  totalLayers: number;
  swaps: number;
  /** Distinct filaments in first-use order. */
  filaments: { color: string; colorName: string }[];
  layerHeight: number;
  firstLayerHeight: number;
  heightZ: number;
  swapCommand: SwapCommand;
}

export function buildSummary(arr: Arrangement, parts: Part[]): Summary {
  const byKey = new Map(parts.map((p) => [p.key, p]));
  const plan = planLevels(arr, byKey);
  const s = arr.settings;
  const rows = plan.map((l): SummaryRow => {
    const layerCount = Math.round(l.layerCount);
    return {
      number: l.number,
      action: l.swap,
      layerStart: l.layerStart,
      layerEnd: l.layerStart + Math.max(1, layerCount) - 1,
      layerCount,
      swapZ: layerTopZ(l.layerStart, s),
      zStart: l.zStart,
      zEnd: l.zEnd,
      thickness: l.thickness,
      color: l.color,
      colorName: colorName(l.color),
      parts: l.level ? l.enabledKeys.map((k) => byKey.get(k)).filter((p): p is Part => !!p).map((p) => partName(arr, p)) : ["Background plate"],
      mixedColors: l.partColors.length > 1,
      isPlate: !l.level,
    };
  });
  const filaments: Summary["filaments"] = [];
  for (const r of rows) if (!filaments.some((f) => f.color === r.color)) filaments.push({ color: r.color, colorName: r.colorName });
  return {
    rows,
    totalLayers: rows.at(-1)?.layerEnd ?? 0,
    swaps: rows.filter((r) => r.action === "swap").length,
    filaments,
    layerHeight: s.layerHeight,
    firstLayerHeight: s.firstLayerHeight,
    heightZ: rows.at(-1)?.zEnd ?? 0,
    swapCommand: s.export.swap,
  };
}

export const SWAP_COMMAND_LABEL: Record<SwapCommand, string> = {
  m600: "M600 embedded in the 3MF at each swap",
  m25: "M25 pause embedded in the 3MF at each swap",
  "printer-pause": "Printer-profile pause embedded in the 3MF at each swap",
  none: "Nothing embedded: add a pause or filament change in OrcaSlicer at each swap layer",
};

export function actionText(r: SummaryRow): string {
  if (r.action === "start") return "Load to start";
  if (r.action === "same") return "Keep printing (same filament)";
  return `Swap before layer ${r.layerStart}`;
}

/** Plain-text version for copying into notes. */
export function summaryText(sum: Summary, title: string): string {
  const header = [
    `${title}: color changes`,
    `Layer height ${sum.layerHeight} mm (first layer ${sum.firstLayerHeight} mm) · ${sum.totalLayers} layers · ${sum.heightZ.toFixed(2)} mm tall · ${sum.swaps} swap${sum.swaps === 1 ? "" : "s"}`,
    SWAP_COMMAND_LABEL[sum.swapCommand] + ".",
    "",
  ];
  const cols = ["Level", "Action", "Layers", "Orca Z", "Filament", "Parts"];
  const lines = sum.rows.map((r) => [
    String(r.number),
    actionText(r),
    `${r.layerStart}–${r.layerEnd}`,
    r.swapZ.toFixed(2),
    `${r.colorName} ${r.color}`,
    r.parts.join(", "),
  ]);
  const widths = cols.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join("  ");
  return [...header, fmt(cols), ...lines.map(fmt), ""].join("\n");
}
