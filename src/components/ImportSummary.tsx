import { colorName } from "../lib/svg/colors";
import type { ParsedSvg } from "../lib/svg/types";

export function ImportSummary({ parsed }: { parsed: ParsedSvg }) {
  const colors = new Map<string, number>();
  for (const s of parsed.shapes) {
    if (s.fill) colors.set(s.fill, (colors.get(s.fill) ?? 0) + 1);
    if (s.stroke) colors.set(s.stroke, (colors.get(s.stroke) ?? 0) + 1);
  }
  const labeled = parsed.shapes.filter((s) => s.label).length;
  const stroked = parsed.shapes.filter((s) => s.stroke).length;

  return (
    <section aria-labelledby="import-summary" className="space-y-3">
      <h2 id="import-summary" className="text-sm font-semibold text-ink-100">
        Imported
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-400">Page</dt>
        <dd>
          {parsed.widthMm.toFixed(1)} × {parsed.heightMm.toFixed(1)} mm
        </dd>
        <dt className="text-ink-400">Shapes</dt>
        <dd>{parsed.shapes.length}</dd>
        <dt className="text-ink-400">Labeled</dt>
        <dd>{labeled}</dd>
        <dt className="text-ink-400">With strokes</dt>
        <dd>{stroked}</dd>
      </dl>
      <div>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-ink-400">Colors ({colors.size})</h3>
        <ul className="flex flex-wrap gap-1.5">
          {[...colors].map(([hex, n]) => (
            <li
              key={hex}
              className="flex items-center gap-1.5 rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-xs"
              title={`${n} shape${n === 1 ? "" : "s"}`}
            >
              <span aria-hidden className="h-3 w-3 rounded-sm border border-ink-600" style={{ background: hex }} />
              {colorName(hex)} <span className="text-ink-400">{hex}</span>
            </li>
          ))}
        </ul>
      </div>
      {parsed.warnings.length > 0 && (
        <ul className="space-y-1" aria-label="Import warnings">
          {parsed.warnings.map((w, i) => (
            <li key={i} className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 day:text-amber-700">
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
