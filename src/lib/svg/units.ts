/** mm per unit for SVG length units. Unitless and px are CSS px at 96 dpi. */
const MM_PER: Record<string, number> = {
  "": 25.4 / 96,
  px: 25.4 / 96,
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
  q: 0.25,
};

/** Parses "220mm", "974.08", "8.5in" → mm. Returns null for percentages or junk. */
export function lengthToMm(raw: string | null): number | null {
  if (!raw) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(raw);
  if (!m) return null;
  const factor = MM_PER[m[2].toLowerCase()];
  return factor === undefined ? null : parseFloat(m[1]) * factor;
}

/** Parses a plain SVG number/length in user units, ignoring a px suffix. */
export function num(raw: string | null, fallback = 0): number {
  if (raw == null) return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}
