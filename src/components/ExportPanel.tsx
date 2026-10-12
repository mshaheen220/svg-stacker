import { useId, useState } from "react";
import { version } from "../../package.json";
import type { SwapCommand } from "../lib/arrangement";
import { meshToStl, stlFileName, stlZip } from "../lib/export/stl";
import { build3mf, swapEntries } from "../lib/export/threemf";
import { useProject } from "../store/useProject";
import { useStack } from "../store/useStack";
import { baseName, downloadBlob } from "../utils/download";

const SWAP_OPTIONS: { value: SwapCommand; label: string; help: string }[] = [
  { value: "m600", label: "M600 filament change", help: "Embeds M600 with an LCD message. Needs firmware with filament-change support (e.g. Marlin ADVANCED_PAUSE_FEATURE)." },
  { value: "m25", label: "M25 pause", help: "Embeds M25 with an LCD message: the printer pauses, you swap filament and resume. Works on stock Ender-3 V2 firmware when printing from SD." },
  { value: "printer-pause", label: "Printer profile’s pause", help: "Uses the pause G-code from your OrcaSlicer printer profile (M25 on the Ender-3 V2 profile). Shows as pause markers on Orca’s layer slider." },
  { value: "none", label: "None", help: "No swaps embedded. Add them in OrcaSlicer by hand using the color-change table." },
];

export function ExportPanel() {
  const { arrangement, fileName, setSettings } = useProject();
  const { result, meshes, meshesPending, pending } = useStack();
  const ex = arrangement.settings.export;
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const swapId = useId();
  const objectName = (name ?? baseName(fileName)).trim() || "svg-stacker";
  const ready = !!result && !!meshes && !meshesPending && !pending && meshes.length === result.levels.length;
  const swaps = result ? swapEntries(result, ex.swap).length : 0;
  const tooBig = result && (result.widthMm > ex.bedX || result.heightMm > ex.bedY);
  const option = SWAP_OPTIONS.find((o) => o.value === ex.swap)!;

  const run = (fn: () => void) => {
    setError(null);
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const download3mf = () =>
    run(() => {
      const data = build3mf(result!, meshes!, { objectName, swap: ex.swap, bed: { x: ex.bedX, y: ex.bedY }, appVersion: version });
      downloadBlob(new Blob([data as BlobPart], { type: "model/3mf" }), `${objectName}.3mf`);
    });

  const btn = "rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section aria-labelledby="export-heading" className="space-y-3">
      <h2 id="export-heading" className="text-sm font-semibold">
        Export
      </h2>
      <label className="block text-sm text-ink-200">
        Object name
        <input
          type="text"
          value={name ?? baseName(fileName)}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-sm text-ink-100"
        />
      </label>
      <div>
        <label htmlFor={swapId} className="text-sm text-ink-200">
          Filament swaps
        </label>
        <select
          id={swapId}
          value={ex.swap}
          onChange={(e) => setSettings({ export: { ...ex, swap: e.target.value as SwapCommand } })}
          aria-describedby={`${swapId}-help`}
          className="mt-1 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-sm"
        >
          {SWAP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p id={`${swapId}-help`} className="mt-1 text-xs text-ink-400">
          {option.help}
        </p>
      </div>
      <div className="flex items-end gap-2 text-sm text-ink-200">
        <label className="flex-1">
          Bed X
          <input
            type="number"
            value={ex.bedX}
            min={50}
            max={1000}
            onChange={(e) => Number(e.target.value) > 0 && setSettings({ export: { ...ex, bedX: Number(e.target.value) } })}
            className="mt-1 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-right"
          />
        </label>
        <label className="flex-1">
          Bed Y
          <input
            type="number"
            value={ex.bedY}
            min={50}
            max={1000}
            onChange={(e) => Number(e.target.value) > 0 && setSettings({ export: { ...ex, bedY: Number(e.target.value) } })}
            className="mt-1 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-right"
          />
        </label>
        <span className="pb-1.5 text-ink-400">mm</span>
      </div>
      {tooBig && (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 day:text-amber-700">
          ⚠ The print ({result!.widthMm.toFixed(0)} × {result!.heightMm.toFixed(0)} mm) is larger than the bed. Set a smaller target width in
          Support &amp; size.
        </p>
      )}

      <div className="space-y-2">
        <button type="button" disabled={!ready} onClick={download3mf} className={`${btn} w-full bg-accent-500 text-white hover:bg-accent-600`}>
          {ready ? "Download 3MF for OrcaSlicer" : "Preparing meshes…"}
        </button>
        {ready && (
          <p className="text-xs text-ink-400">
            One object, {result!.levels.length} named parts, {ex.swap === "none" ? "no swaps embedded" : `${swaps} swap${swaps === 1 ? "" : "s"} embedded`}.
            Opens with your current OrcaSlicer printer and filament presets.
          </p>
        )}
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            run(() => downloadBlob(new Blob([stlZip(result!.levels, meshes!) as BlobPart], { type: "application/zip" }), `${objectName} STLs.zip`))
          }
          className={`${btn} w-full border border-ink-700 text-ink-200 hover:border-ink-500 hover:text-ink-50`}
        >
          Download all levels as STL (.zip)
        </button>
        {ready && (
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-300">Single-level STLs</summary>
            <ul className="mt-1 space-y-0.5">
              {result!.levels.map((l, i) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-ink-300 hover:bg-ink-800 hover:text-ink-50"
                    onClick={() =>
                      run(() => downloadBlob(new Blob([meshToStl(meshes![i]) as BlobPart], { type: "model/stl" }), stlFileName(l)))
                    }
                  >
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm border border-ink-600" style={{ background: l.color }} />
                    <span className="truncate">{stlFileName(l)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-ink-400">STLs keep their Z position: import them together as parts of one object.</p>
          </details>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-400 day:text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
