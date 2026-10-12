import { useMemo, useState } from "react";
import { version } from "../package.json";
import { ArrangementPanel } from "./components/ArrangementPanel";
import { ImportSummary } from "./components/ImportSummary";
import { LayersPanel } from "./components/LayersPanel";
import { StrokesPanel } from "./components/StrokesPanel";
import { SupportPanel } from "./components/SupportPanel";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { FileDropzone } from "./components/controls/FileDropzone";
import { NumberSlider } from "./components/controls/NumberSlider";
import { LevelEditor } from "./components/levels/LevelEditor";
import { PreviewPanel } from "./components/preview/PreviewPanel";
import { planLevels } from "./lib/layers";
import { useProject } from "./store/useProject";
import { useStack, useStackRunner } from "./store/useStack";

export default function App() {
  const { fileName, parsed, error, tolerance, arrangement, parts, loadSvg, setTolerance } = useProject();
  const [highlighted, setHighlighted] = useState<string[] | null>(null);
  useStackRunner();
  const stack = useStack((s) => s.result);
  const printed = useMemo(() => planLevels(arrangement, new Map(parts.map((p) => [p.key, p]))), [arrangement, parts]);
  const showThrough = printed.filter((l) => l.showThrough).length;
  const misaligned = printed.filter((l) => !l.aligned).length;
  const swaps = printed.filter((l) => l.swap === "swap").length;
  const totalHeight = printed.at(-1)?.zEnd ?? 0;
  const thinLevels = stack?.levels.filter((l) => l.thinAreaMm2 > 0).length ?? 0;
  const floatingLevels = stack?.levels.filter((l) => l.unsupportedAreaMm2 >= 0.01).length ?? 0;

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-accent-400">SVG</span> Stacker
          </h1>
          <span className="text-xs text-ink-400" aria-label={`Version ${version}`}>
            v{version}
          </span>
        </div>
        <ThemeSwitcher />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="space-y-6 border-ink-800 p-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r" aria-label="Settings">
          <section aria-labelledby="import-heading" className="space-y-2">
            <h2 id="import-heading" className="text-sm font-semibold">
              Import SVG
            </h2>
            <FileDropzone
              accept=".svg,image/svg+xml"
              label={fileName ? "Replace SVG…" : "Choose SVG…"}
              hint={fileName ?? "or drop an .svg file here"}
              onFile={async (f) => loadSvg(f.name, await f.text())}
            />
            {error && (
              <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-sm text-red-400 day:text-red-700">
                {error}
              </p>
            )}
            <NumberSlider
              label="Curve tolerance"
              value={tolerance}
              min={0.01}
              max={0.5}
              step={0.01}
              unit="mm"
              help="Max deviation when flattening curves. Smaller = smoother but heavier."
              onChange={setTolerance}
            />
          </section>
          {parsed && <ImportSummary parsed={parsed} />}
          {parsed && <StrokesPanel />}
          {parsed && <LayersPanel />}
          {parsed && <SupportPanel />}
          {parsed && <ArrangementPanel />}
        </aside>

        <main className="min-h-[60vh] flex-1 p-4 lg:min-h-0" aria-label="Preview">
          {parsed ? (
            <PreviewPanel highlighted={highlighted} />
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center rounded-lg border border-dashed border-ink-800 text-sm text-ink-400">
              Import an SVG to get started.
            </div>
          )}
        </main>

        {parsed && (
          <section
            aria-labelledby="levels-heading"
            className="space-y-2 border-ink-800 p-4 lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto lg:border-l"
          >
            <div className="flex items-baseline justify-between">
              <h2 id="levels-heading" className="text-sm font-semibold">
                Levels <span className="font-normal text-ink-400">({printed.length} printed)</span>
              </h2>
              <span className="text-xs text-ink-400">Total height {totalHeight.toFixed(2)} mm</span>
            </div>
            <p className="text-xs text-ink-400">
              {swaps} filament swap{swaps === 1 ? "" : "s"} · {printed.at(-1) ? printed.at(-1)!.layerStart + Math.ceil(printed.at(-1)!.layerCount) - 1 : 0} layers at{" "}
              {arrangement.settings.layerHeight} mm
            </p>
            {(showThrough > 0 || misaligned > 0) && (
              <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 day:text-amber-700">
                {showThrough > 0 && `${showThrough} level${showThrough === 1 ? " is" : "s are"} too thin to hide the color below (use Fix or Normalize all levels). `}
                {misaligned > 0 && `${misaligned} level${misaligned === 1 ? " starts" : "s start"} mid-layer.`}
              </p>
            )}
            {(thinLevels > 0 || floatingLevels > 0) && (
              <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 day:text-amber-700">
                {floatingLevels > 0 && `${floatingLevels} level${floatingLevels === 1 ? " has" : "s have"} floating areas. `}
                {thinLevels > 0 &&
                  `${thinLevels} level${thinLevels === 1 ? " has" : "s have"} features thinner than ${(2 * arrangement.settings.nozzle).toFixed(2)} mm at this size.`}
              </p>
            )}
            <LevelEditor onHighlight={setHighlighted} />
          </section>
        )}
      </div>
    </div>
  );
}
