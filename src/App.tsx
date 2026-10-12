import { useState } from "react";
import { version } from "../package.json";
import { ArrangementPanel } from "./components/ArrangementPanel";
import { ImportSummary } from "./components/ImportSummary";
import { StrokesPanel } from "./components/StrokesPanel";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { FileDropzone } from "./components/controls/FileDropzone";
import { NumberSlider } from "./components/controls/NumberSlider";
import { LevelEditor } from "./components/levels/LevelEditor";
import { Preview2D } from "./components/preview/Preview2D";
import { printedLevels } from "./lib/arrangement";
import { useProject } from "./store/useProject";

export default function App() {
  const { fileName, parsed, error, tolerance, arrangement, loadSvg, setTolerance } = useProject();
  const [highlighted, setHighlighted] = useState<string[] | null>(null);
  const printed = printedLevels(arrangement);
  const totalHeight = printed.at(-1)?.zEnd ?? 0;

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
          {parsed && <ArrangementPanel />}
        </aside>

        <main className="min-h-[60vh] flex-1 p-4 lg:min-h-0" aria-label="Preview">
          {parsed ? (
            <Preview2D highlighted={highlighted} />
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
            <LevelEditor onHighlight={setHighlighted} />
          </section>
        )}
      </div>
    </div>
  );
}
