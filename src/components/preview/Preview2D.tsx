import { useEffect, useMemo, useState } from "react";
import { regionToD } from "../../lib/geometry/regionPath";
import { subpathsToD } from "../../lib/svg/pathData";
import { useProject } from "../../store/useProject";
import { useStack } from "../../store/useStack";

type Mode = "print" | "original";

interface Props {
  /** Part keys to emphasize (others are dimmed), or null. */
  highlighted: string[] | null;
}

/**
 * "Print" renders the computed stack - each level's solid, bottom to top,
 * in its filament color (a top view of the finished print), in final print
 * millimetres. "Original" renders the parsed, flattened SVG shapes.
 */
export function Preview2D({ highlighted }: Props) {
  const { parsed, arrangement } = useProject();
  const { result, pending, error } = useStack();
  const [mode, setMode] = useState<Mode>("print");
  const [wireframe, setWireframe] = useState(false);
  const [showThin, setShowThin] = useState(true);
  const levelCount = result?.levels.length ?? 0;
  // How many levels to show, from the bottom. null = all (tracks level count changes).
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (shown != null && shown > levelCount) setShown(null);
  }, [levelCount, shown]);
  const visibleCount = shown ?? levelCount;

  const levelPaths = useMemo(
    () => result?.levels.map((l) => ({ level: l, solidD: regionToD(l.solid), thinD: l.thin.length ? regionToD(l.thin) : "" })) ?? [],
    [result],
  );
  const shapePaths = useMemo(
    () => parsed?.shapes.map((s) => ({ shape: s, fillD: subpathsToD(s.subpaths), strokeD: subpathsToD(s.subpaths, false) })) ?? [],
    [parsed],
  );

  if (!parsed) return null;

  // Levels containing a highlighted part.
  const hiLevels = new Set(
    highlighted?.length ? arrangement.levels.filter((l) => l.partKeys.some((k) => highlighted.includes(k))).map((l) => l.id) : [],
  );

  const box =
    mode === "print" && result
      ? { minX: 0, minY: 0, maxX: result.widthMm, maxY: result.heightMm }
      : parsed.bounds;
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const pad = Math.max(w, h) * 0.03;
  const viewBox = `${box.minX - pad} ${box.minY - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const hairline = w / 800;
  const btn = (active: boolean) => `rounded px-2 py-0.5 capitalize ${active ? "bg-ink-700 text-ink-50" : "hover:text-ink-100"}`;

  return (
    <figure className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pb-2 text-xs text-ink-400">
        <div role="radiogroup" aria-label="Preview mode" className="flex rounded-md border border-ink-700 p-0.5">
          {(["print", "original"] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={btn(mode === m)}>
              {m}
            </button>
          ))}
        </div>
        <figcaption aria-live="polite">
          {mode === "print" && result
            ? `${result.widthMm.toFixed(1)} × ${result.heightMm.toFixed(1)} mm print`
            : `${w.toFixed(1)} × ${h.toFixed(1)} mm artwork`}
          {pending && mode === "print" && <span className="ml-2 text-accent-300">updating…</span>}
        </figcaption>
        <span className="flex items-center gap-3">
          {mode === "print" && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showThin} onChange={(e) => setShowThin(e.target.checked)} />
              Thin features
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
            Outlines only
          </label>
        </span>
      </div>

      {mode === "print" && levelCount > 1 && (
        <label className="flex items-center gap-2 px-1 pb-2 text-xs text-ink-300">
          <span className="shrink-0">Levels 1–{visibleCount}</span>
          <input
            type="range"
            min={1}
            max={levelCount}
            step={1}
            value={visibleCount}
            onChange={(e) => {
              const v = Number(e.target.value);
              setShown(v === levelCount ? null : v);
            }}
            aria-label="Show levels up to"
            aria-valuetext={`Showing levels 1 to ${visibleCount} of ${levelCount}`}
            className="flex-1"
          />
          <span className="w-40 shrink-0 truncate text-ink-400" title={result?.levels[visibleCount - 1]?.name}>
            {result?.levels[visibleCount - 1]?.name}
          </span>
        </label>
      )}

      {error && mode === "print" && (
        <p role="alert" className="mb-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-400 day:text-red-700">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 rounded-lg border border-ink-800 bg-[repeating-conic-gradient(var(--color-ink-900)_0_25%,var(--color-ink-950)_0_50%)] bg-[length:20px_20px]">
        <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label={`2D preview: ${mode}`}>
          <defs>
            <pattern id="thin-hatch" patternUnits="userSpaceOnUse" width={hairline * 8} height={hairline * 8} patternTransform="rotate(45)">
              <rect width={hairline * 8} height={hairline * 8} fill="#ff2d2d" fillOpacity={0.35} />
              <line x1={0} y1={0} x2={0} y2={hairline * 8} stroke="#ff2d2d" strokeWidth={hairline * 3} />
            </pattern>
          </defs>
          {mode === "print"
            ? levelPaths.slice(0, visibleCount).map(({ level, solidD, thinD }) => {
                const dim = hiLevels.size > 0 && !hiLevels.has(level.id) ? 0.15 : 1;
                const hi = hiLevels.has(level.id);
                return (
                  <g key={level.id} opacity={dim}>
                    <path
                      d={solidD}
                      fillRule="nonzero"
                      fill={wireframe ? "none" : level.color}
                      stroke={wireframe || hi ? "var(--color-accent-400)" : "none"}
                      strokeWidth={hi ? hairline * 3 : hairline}
                    >
                      <title>{`Level ${level.number}: ${level.name}`}</title>
                    </path>
                    {showThin && thinD && <path d={thinD} fill="url(#thin-hatch)" stroke="#ff2d2d" strokeWidth={hairline} />}
                  </g>
                );
              })
            : shapePaths.map(({ shape, fillD, strokeD }) => (
                <g key={shape.id}>
                  {shape.fill && (
                    <path
                      d={fillD}
                      fill={wireframe ? "none" : shape.fill}
                      fillRule={shape.fillRule}
                      stroke={wireframe ? "var(--color-accent-400)" : "none"}
                      strokeWidth={hairline}
                    />
                  )}
                  {shape.stroke && (
                    <path
                      d={strokeD}
                      fill="none"
                      stroke={wireframe ? "var(--color-ink-300)" : shape.stroke}
                      strokeWidth={wireframe ? hairline : shape.strokeWidth}
                      strokeLinejoin={shape.strokeLinejoin}
                      strokeLinecap={shape.strokeLinecap}
                    />
                  )}
                </g>
              ))}
        </svg>
      </div>
    </figure>
  );
}
