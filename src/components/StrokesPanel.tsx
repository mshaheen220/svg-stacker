import { defaultStrokeMode, type StrokeMode } from "../lib/parts";
import { colorName } from "../lib/svg/colors";
import { useProject } from "../store/useProject";

/** Per-shape choice: does a stroke become its own outline geometry, or get ignored? */
export function StrokesPanel() {
  const { parsed, strokeModes, setStrokeMode } = useProject();
  const stroked = parsed?.shapes.filter((s) => s.stroke) ?? [];
  if (stroked.length === 0) return null;

  return (
    <section aria-labelledby="strokes-heading" className="space-y-1">
      <h2 id="strokes-heading" className="text-sm font-semibold">
        Strokes <span className="font-normal text-ink-400">({stroked.length})</span>
      </h2>
      <p className="text-xs text-ink-400">
        Outline turns a stroke into its own part (e.g. a border ring). Hairlines under 0.2 mm default to ignored.
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
    </section>
  );
}
