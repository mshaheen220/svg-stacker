import { regionAreaMm2 } from "../lib/geometry/region";
import { defaultStrokeMode, type StrokeMode } from "../lib/parts";
import { colorName } from "../lib/svg/colors";
import { useProject } from "../store/useProject";

interface Props {
  highlighted: string | null;
  onHighlight: (key: string | null) => void;
}

export function PartsPanel({ highlighted, onHighlight }: Props) {
  const { parts, footprints, parsed, strokeModes, setStrokeMode } = useProject();
  if (!parsed) return null;
  const stroked = parsed.shapes.filter((s) => s.stroke);

  return (
    <section aria-labelledby="parts-heading" className="space-y-3">
      <h2 id="parts-heading" className="text-sm font-semibold">
        2. Parts <span className="font-normal text-ink-400">({parts.length})</span>
      </h2>
      <p className="text-xs text-ink-400">Shapes with the same label and color are merged. Hover to highlight.</p>
      <ul className="space-y-1">
        {parts.map((p) => {
          const area = regionAreaMm2(footprints.get(p.key) ?? []);
          return (
            <li
              key={p.key}
              tabIndex={0}
              onMouseEnter={() => onHighlight(p.key)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(p.key)}
              onBlur={() => onHighlight(null)}
              className={`flex items-center gap-2 rounded border px-2 py-1 text-sm outline-none ${
                highlighted === p.key ? "border-accent-400 bg-ink-800" : "border-ink-800 bg-ink-900/60"
              }`}
            >
              <span aria-hidden className="h-4 w-4 shrink-0 rounded-sm border border-ink-600" style={{ background: p.color }} />
              <span className="min-w-0 flex-1 truncate" title={p.defaultName}>
                {p.defaultName}
              </span>
              <span className="shrink-0 text-xs text-ink-400">
                {p.sources.length} src · {area < 10 ? area.toFixed(1) : Math.round(area)} mm²
              </span>
            </li>
          );
        })}
      </ul>

      {stroked.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs uppercase tracking-wide text-ink-400">Strokes</h3>
          <p className="text-xs text-ink-400">
            Outline turns a stroke into its own geometry (e.g. a border ring). Hairlines under 0.2 mm default to ignored.
          </p>
          <ul className="space-y-1">
            {stroked.map((s) => {
              const mode = strokeModes[s.id] ?? defaultStrokeMode(s);
              const name = s.label ?? s.id;
              return (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border border-ink-600" style={{ background: s.stroke! }} />
                  <span className="min-w-0 flex-1 truncate" title={`${name}: ${colorName(s.stroke!)} ${s.stroke}`}>
                    {name} <span className="text-ink-400">{s.strokeWidth.toFixed(2)} mm</span>
                  </span>
                  <select
                    aria-label={`Stroke handling for ${name}`}
                    value={mode}
                    onChange={(e) => setStrokeMode(s.id, e.target.value as StrokeMode)}
                    className="rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-xs"
                  >
                    <option value="outline">Outline</option>
                    <option value="ignore">Ignore</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
