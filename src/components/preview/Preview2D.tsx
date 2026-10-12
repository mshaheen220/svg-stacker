import { useMemo, useState } from "react";
import { regionToD } from "../../lib/geometry/regionPath";
import { subpathsToD } from "../../lib/svg/pathData";
import { useProject } from "../../store/useProject";

type Mode = "parts" | "original";

interface Props {
  highlighted: string | null;
}

/**
 * "Original" renders the parsed, flattened shapes; "Parts" renders the
 * merged part footprints (Clipper output) in part order - i.e. exactly the
 * geometry later stages work from.
 */
export function Preview2D({ highlighted }: Props) {
  const { parsed, parts, footprints } = useProject();
  const [mode, setMode] = useState<Mode>("parts");
  const [wireframe, setWireframe] = useState(false);

  const shapePaths = useMemo(
    () => parsed?.shapes.map((s) => ({ shape: s, fillD: subpathsToD(s.subpaths), strokeD: subpathsToD(s.subpaths, false) })) ?? [],
    [parsed],
  );
  const partPaths = useMemo(() => parts.map((p) => ({ part: p, d: regionToD(footprints.get(p.key) ?? []) })), [parts, footprints]);

  if (!parsed) return null;
  const { minX, minY, maxX, maxY } = parsed.bounds;
  const pad = Math.max(maxX - minX, maxY - minY) * 0.03;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  const hairline = (maxX - minX) / 800;
  const dim = (key: string) => (highlighted && highlighted !== key ? 0.15 : 1);

  return (
    <figure className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-xs text-ink-400">
        <div role="radiogroup" aria-label="Preview mode" className="flex rounded-md border border-ink-700 p-0.5">
          {(["parts", "original"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 capitalize ${mode === m ? "bg-ink-700 text-ink-50" : "hover:text-ink-100"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <figcaption>
          {(maxX - minX).toFixed(1)} × {(maxY - minY).toFixed(1)} mm artwork
        </figcaption>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
          Outlines only
        </label>
      </div>
      <div className="min-h-0 flex-1 rounded-lg border border-ink-800 bg-[repeating-conic-gradient(var(--color-ink-900)_0_25%,var(--color-ink-950)_0_50%)] bg-[length:20px_20px]">
        <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label={`2D preview: ${mode}`}>
          {mode === "parts"
            ? partPaths.map(({ part, d }) => (
                <path
                  key={part.key}
                  d={d}
                  fillRule="nonzero"
                  fill={wireframe ? "none" : part.color}
                  stroke={wireframe || highlighted === part.key ? "var(--color-accent-400)" : "none"}
                  strokeWidth={highlighted === part.key ? hairline * 3 : hairline}
                  opacity={dim(part.key)}
                >
                  <title>{part.defaultName}</title>
                </path>
              ))
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
