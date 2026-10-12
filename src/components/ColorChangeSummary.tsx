import { useMemo, useState } from "react";
import { version } from "../../package.json";
import { actionText, buildSummary, summaryText, SWAP_COMMAND_LABEL, type Summary } from "../lib/summary";
import { useProject } from "../store/useProject";
import { useStack } from "../store/useStack";
import { baseName } from "../utils/download";

function useSummary(): { sum: Summary; title: string } {
  const { arrangement, parts, fileName } = useProject();
  const sum = useMemo(() => buildSummary(arrangement, parts), [arrangement, parts]);
  return { sum, title: baseName(fileName) };
}

/** Screen view: the "Color changes" tab, with Print and Copy. */
export function ColorChangeSummary() {
  const { sum, title } = useSummary();
  const [copied, setCopied] = useState(false);
  if (sum.rows.length === 0) return <p className="p-4 text-sm text-ink-400">Nothing to print yet.</p>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(sum, title));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const btn = "rounded border border-ink-700 px-2 py-1 text-xs text-ink-200 hover:border-ink-500 hover:text-ink-50";

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <SummaryHeader sum={sum} />
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => window.print()}>
            🖨 Print
          </button>
          <button type="button" className={btn} onClick={copy} aria-live="polite">
            {copied ? "Copied ✓" : "Copy as text"}
          </button>
        </div>
      </div>
      <SummaryTable sum={sum} variant="screen" />
      <p className="px-1 text-xs text-ink-400">
        Listed in print order. “Orca Z” is the layer height shown on OrcaSlicer’s layer slider for the first layer of each level; that’s
        where the swap is placed. Make sure Orca’s layer heights match ({sum.layerHeight} mm, first layer {sum.firstLayerHeight} mm).
      </p>
    </div>
  );
}

/** Print-only copy rendered at the app root; shown by window.print() regardless of the active tab. */
export function PrintableSummary() {
  const { sum, title } = useSummary();
  const result = useStack((s) => s.result);
  if (sum.rows.length === 0) return null;
  return (
    <div className="bg-white p-2 text-[11pt] text-black">
      <h1 className="text-lg font-bold">{title}: color changes</h1>
      <p className="mb-3 text-xs text-neutral-600">
        SVG Stacker v{version} · {new Date().toLocaleDateString()}
        {result && ` · ${result.widthMm.toFixed(1)} × ${result.heightMm.toFixed(1)} × ${result.heightZ.toFixed(2)} mm`}
      </p>
      <div className="mb-3">
        <SummaryHeader sum={sum} print />
      </div>
      <SummaryTable sum={sum} variant="print" />
      <p className="mt-3 text-xs text-neutral-600">
        Layers are numbered from 1. “Orca Z” = top of the level’s first layer (as on OrcaSlicer’s layer slider). Slice with layer height{" "}
        {sum.layerHeight} mm and first layer {sum.firstLayerHeight} mm.
      </p>
    </div>
  );
}

function SummaryHeader({ sum, print }: { sum: Summary; print?: boolean }) {
  const muted = print ? "text-neutral-600" : "text-ink-400";
  return (
    <div className="space-y-1 text-sm">
      <p>
        <strong>{sum.rows.length}</strong> levels · <strong>{sum.swaps}</strong> swap{sum.swaps === 1 ? "" : "s"} · {sum.totalLayers} layers at{" "}
        {sum.layerHeight} mm · {sum.heightZ.toFixed(2)} mm tall
      </p>
      <p className={`text-xs ${muted}`}>{SWAP_COMMAND_LABEL[sum.swapCommand]}.</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={muted}>Filaments in order of use:</span>
        {sum.filaments.map((f) => (
          <span key={f.color} className="flex items-center gap-1">
            <Swatch color={f.color} print={print} /> {f.colorName}
          </span>
        ))}
      </p>
    </div>
  );
}

function SummaryTable({ sum, variant }: { sum: Summary; variant: "screen" | "print" }) {
  const print = variant === "print";
  const th = print ? "border border-neutral-400 px-2 py-1 text-left" : "border-b border-ink-700 px-2 py-1.5 text-left font-medium text-ink-300";
  const td = print ? "border border-neutral-400 px-2 py-1 align-top" : "border-b border-ink-800 px-2 py-1.5 align-top";
  return (
    <table className={`w-full border-collapse text-sm ${print ? "" : "min-w-[40rem]"}`}>
      <caption className="sr-only">Color changes in print order</caption>
      <thead>
        <tr>
          {print && <th className={th} aria-label="Done" />}
          <th className={th}>Level</th>
          <th className={th}>Action</th>
          <th className={th}>Layers</th>
          <th className={th}>Orca Z</th>
          <th className={th}>Z range</th>
          <th className={th}>Filament</th>
          <th className={th}>Parts</th>
        </tr>
      </thead>
      <tbody>
        {sum.rows.map((r) => (
          <tr key={r.number} className={!print && r.action === "swap" ? "bg-accent-500/5" : ""}>
            {print && <td className={`${td} w-6 text-center text-base leading-none`}>☐</td>}
            <td className={td}>{r.number}</td>
            <td className={`${td} ${r.action === "swap" ? "font-semibold" : ""}`}>{actionText(r)}</td>
            <td className={`${td} whitespace-nowrap`}>
              {r.layerStart}–{r.layerEnd} <span className={print ? "text-neutral-500" : "text-ink-400"}>({r.layerCount})</span>
            </td>
            <td className={`${td} whitespace-nowrap tabular-nums`}>{r.swapZ.toFixed(2)}</td>
            <td className={`${td} whitespace-nowrap tabular-nums`}>
              {r.zStart.toFixed(2)}–{r.zEnd.toFixed(2)}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              <span className="flex items-center gap-1.5">
                <Swatch color={r.color} print={print} />
                {r.colorName} <span className={print ? "text-neutral-500" : "text-ink-400"}>{r.color}</span>
              </span>
              {r.mixedColors && <span className="block text-xs text-amber-600">mixed colors: first is used</span>}
            </td>
            <td className={td}>{r.parts.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Swatch({ color, print }: { color: string; print?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-sm border ${print ? "border-neutral-500" : "border-ink-600"}`}
      // print-color-adjust keeps swatches when browsers drop background colors for printing.
      style={{ background: color, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    />
  );
}
