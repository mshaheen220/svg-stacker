import { ImportSummary } from "./components/ImportSummary";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { FileDropzone } from "./components/controls/FileDropzone";
import { NumberSlider } from "./components/controls/NumberSlider";
import { Preview2D } from "./components/preview/Preview2D";
import { useProject } from "./store/useProject";

export default function App() {
  const { fileName, parsed, error, tolerance, loadSvg, setTolerance } = useProject();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-accent-400">SVG</span> Stacker
          </h1>
          <span className="text-xs text-ink-400" aria-label={`Version ${__APP_VERSION__}`}>
            v{__APP_VERSION__}
          </span>
        </div>
        <ThemeSwitcher />
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="space-y-5 overflow-y-auto border-ink-800 p-4 md:w-80 md:shrink-0 md:border-r" aria-label="Settings">
          <section aria-labelledby="import-heading" className="space-y-2">
            <h2 id="import-heading" className="text-sm font-semibold">
              1. Import SVG
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
        </aside>

        <main className="min-h-[60vh] flex-1 p-4 md:min-h-0">
          {parsed ? (
            <Preview2D parsed={parsed} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-ink-800 text-sm text-ink-400">
              Import an SVG to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
