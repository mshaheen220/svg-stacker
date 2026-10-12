import { useProject } from "../store/useProject";
import { useStack } from "../store/useStack";
import { NumberSlider } from "./controls/NumberSlider";
import { Toggle } from "./controls/Toggle";

/** Support fill, background plate, clearance, final size and nozzle. */
export function SupportPanel() {
  const { arrangement, setSettings, parsed } = useProject();
  const result = useStack((s) => s.result);
  const s = arrangement.settings;
  const scale = result?.scale ?? 1;
  // The artwork's own width (no plate), for the "original size" label.
  const nativeWidth = result ? (result.widthMm - (s.plate.enabled ? 2 * s.plate.margin : 0)) / scale : null;

  return (
    <section aria-labelledby="support-heading" className="space-y-3">
      <h2 id="support-heading" className="text-sm font-semibold">
        Support &amp; size
      </h2>
      <Toggle
        label="Support fill"
        checked={s.supportFill}
        onChange={(v) => setSettings({ supportFill: v })}
        help="Each level is solid under everything above it (a stepped “wedding cake”), so nothing floats."
      />
      <Toggle
        label="Background plate"
        checked={s.plate.enabled}
        onChange={(v) => setSettings({ plate: { ...s.plate, enabled: v } })}
        help="Adds a bottom level covering the whole outline, with a margin. It uses the base thickness."
      />
      {s.plate.enabled && (
        <div className="ml-6 space-y-2">
          <NumberSlider
            label="Plate margin"
            value={s.plate.margin}
            min={0}
            max={20}
            step={0.5}
            unit="mm"
            onChange={(v) => setSettings({ plate: { ...s.plate, margin: v } })}
          />
          <label className="flex items-center justify-between text-sm text-ink-200">
            Plate color
            <input
              type="color"
              value={s.plate.color}
              onChange={(e) => setSettings({ plate: { ...s.plate, color: e.target.value } })}
              className="h-7 w-12 cursor-pointer rounded border border-ink-700 bg-ink-900"
            />
          </label>
        </div>
      )}
      <NumberSlider
        label="Clearance"
        value={s.clearance}
        min={0}
        max={0.5}
        step={0.05}
        unit="mm"
        help="Shrinks every level above the base inward, so each step is slightly inset."
        onChange={(v) => setSettings({ clearance: v })}
      />

      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-ink-400">Final size</h3>
        <Toggle
          label={`Original size${nativeWidth ? ` (${nativeWidth.toFixed(1)} mm wide)` : ""}`}
          checked={s.targetWidth == null}
          onChange={(v) => setSettings({ targetWidth: v ? null : Math.round(result?.widthMm ?? parsed?.widthMm ?? 100) })}
        />
        {s.targetWidth != null && (
          <NumberSlider
            label="Target width"
            value={s.targetWidth}
            min={20}
            max={300}
            step={1}
            unit="mm"
            help="Overall width including any plate. Height scales to match."
            onChange={(v) => setSettings({ targetWidth: v })}
          />
        )}
        {result && (
          <p className="text-xs text-ink-300">
            Prints at {result.widthMm.toFixed(1)} × {result.heightMm.toFixed(1)} × {result.heightZ.toFixed(2)} mm
            {Math.abs(scale - 1) > 1e-3 && <span className="text-ink-400"> · scale {(scale * 100).toFixed(1)}%</span>}
          </p>
        )}
      </div>

      <NumberSlider
        label="Nozzle"
        value={s.nozzle}
        min={0.2}
        max={1}
        step={0.05}
        unit="mm"
        help={`Features narrower than ${(2 * s.nozzle).toFixed(2)} mm (2 × nozzle) are flagged.`}
        onChange={(v) => setSettings({ nozzle: v })}
      />
    </section>
  );
}
