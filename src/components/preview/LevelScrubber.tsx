import { useEffect } from "react";
import { useStack } from "../../store/useStack";
import { useView } from "../../store/useView";

/** "Show levels 1–N" slider shared by the 2D and 3D previews. */
export function LevelScrubber() {
  // Select the stable result object; `?? []` inside a selector would create
  // a new array every call and loop forever.
  const result = useStack((s) => s.result);
  const levels = result?.levels ?? [];
  const { shownLevels, setShownLevels } = useView();
  const count = levels.length;
  useEffect(() => {
    if (shownLevels != null && shownLevels > count) setShownLevels(null);
  }, [count, shownLevels, setShownLevels]);
  if (count < 2) return null;
  const visible = shownLevels ?? count;
  const top = levels[visible - 1];

  return (
    <label className="flex items-center gap-2 px-1 pb-2 text-xs text-ink-300">
      <span className="shrink-0">Levels 1–{visible}</span>
      <input
        type="range"
        min={1}
        max={count}
        step={1}
        value={visible}
        onChange={(e) => {
          const v = Number(e.target.value);
          setShownLevels(v === count ? null : v);
        }}
        aria-label="Show levels up to"
        aria-valuetext={`Showing levels 1 to ${visible} of ${count}${top ? `, top: ${top.name}` : ""}`}
        className="flex-1"
      />
      <span className="flex w-44 shrink-0 items-center gap-1.5 truncate text-ink-400" title={top?.name}>
        {top && <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm border border-ink-600" style={{ background: top.color }} />}
        <span className="truncate">
          Z {top?.zEnd.toFixed(2)} · {top?.name}
        </span>
      </span>
    </label>
  );
}
