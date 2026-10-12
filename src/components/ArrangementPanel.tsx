import { useRef, useState } from "react";
import { parseSidecar } from "../lib/arrangement";
import { useProject } from "../store/useProject";
import { baseName, downloadBlob } from "../utils/download";

/** Save/load of the arrangement sidecar, and reset. */
export function ArrangementPanel() {
  const { fileName, exportSidecar, applySidecar, resetArrangement } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  const save = () => {
    const json = JSON.stringify(exportSidecar(), null, 2);
    downloadBlob(new Blob([json], { type: "application/json" }), `${baseName(fileName)}.stacker.json`);
  };

  const load = async (file: File) => {
    try {
      const warning = applySidecar(parseSidecar(JSON.parse(await file.text())));
      setMessage(warning ? { kind: "warn", text: warning } : { kind: "ok", text: `Loaded ${file.name}.` });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const btn = "rounded border border-ink-700 px-2 py-1 text-xs text-ink-200 hover:border-ink-500 hover:text-ink-50";

  return (
    <section aria-labelledby="arrangement-heading" className="space-y-3">
      <h2 id="arrangement-heading" className="text-sm font-semibold">
        Arrangement
      </h2>
      <div className="space-y-2">
        <p className="text-xs text-ink-400">Autosaved in this browser. Save a sidecar file to re-use it with the same SVG later.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={save}>
            Save arrangement…
          </button>
          <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
            Load arrangement…
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              if (confirm("Reset levels, names and stroke choices to the defaults for this SVG?")) resetArrangement();
            }}
          >
            Reset
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Load arrangement file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
        {message && (
          <p
            role="status"
            className={`rounded border px-2 py-1 text-xs ${
              message.kind === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-400 day:text-red-700"
                : message.kind === "warn"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300 day:text-amber-700"
                  : "border-accent-500/40 bg-accent-500/10 text-accent-300"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
