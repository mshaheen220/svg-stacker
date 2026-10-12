import { useMemo, useState } from "react";
import { subpathsToD } from "../../lib/svg/pathData";
import type { ParsedSvg } from "../../lib/svg/types";

interface Props {
  parsed: ParsedSvg;
}

/**
 * Renders the *parsed and flattened* geometry (not the original file), so
 * what you see here is exactly what the later stages will work from.
 */
export function Preview2D({ parsed }: Props) {
  const [wireframe, setWireframe] = useState(false);
  const { minX, minY, maxX, maxY } = parsed.bounds;
  const pad = Math.max(maxX - minX, maxY - minY) * 0.03;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  const hairline = (maxX - minX) / 800;

  const paths = useMemo(
    () => parsed.shapes.map((s) => ({ shape: s, fillD: subpathsToD(s.subpaths), strokeD: subpathsToD(s.subpaths, false) })),
    [parsed],
  );
  const vertexCount = useMemo(
    () => parsed.shapes.reduce((n, s) => n + s.subpaths.reduce((m, p) => m + p.points.length, 0), 0),
    [parsed],
  );

  return (
    <figure className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-1 pb-2 text-xs text-ink-400">
        <figcaption>
          {(maxX - minX).toFixed(1)} × {(maxY - minY).toFixed(1)} mm artwork · {vertexCount.toLocaleString()} vertices
        </figcaption>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
          Show flattened outlines
        </label>
      </div>
      <div className="min-h-0 flex-1 rounded-lg border border-ink-800 bg-[repeating-conic-gradient(var(--color-ink-900)_0_25%,var(--color-ink-950)_0_50%)] bg-[length:20px_20px]">
        <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label="2D preview of the imported artwork">
          {paths.map(({ shape, fillD, strokeD }) => (
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
