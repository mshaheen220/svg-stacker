import { useState } from "react";
import { THICKNESS_MIN } from "../lib/arrangement";
import { useProject } from "../store/useProject";
import { NumberSlider } from "./controls/NumberSlider";
import { Toggle } from "./controls/Toggle";

/** Slicer layer heights, level thickness defaults, and the opacity check. */
export function LayersPanel() {
  const { arrangement, setSettings, normalize } = useProject();
  const s = arrangement.settings;
  const [message, setMessage] = useState<string | null>(null);

  const runNormalize = () => {
    const changes = normalize();
    setMessage(
      changes.length === 0
        ? "Every level is already thick enough."
        : `Raised ${changes.map((c) => `level ${c.number} (${c.from.toFixed(2)} → ${c.to.toFixed(2)} mm)`).join(", ")}.`,
    );
  };

  return (
    <section aria-labelledby="layers-heading" className="space-y-3">
      <h2 id="layers-heading" className="text-sm font-semibold">
        Layers &amp; thickness
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <NumberSlider label="Layer height" value={s.layerHeight} min={0.04} max={0.4} step={0.02} unit="mm" onChange={(v) => setSettings({ layerHeight: v })} />
        <NumberSlider label="First layer" value={s.firstLayerHeight} min={0.04} max={0.4} step={0.02} unit="mm" onChange={(v) => setSettings({ firstLayerHeight: v })} />
      </div>
      <p className="-mt-2 text-xs text-ink-400">Match these to your OrcaSlicer process settings.</p>
      <Toggle
        label="Whole layers only"
        checked={s.snapToLayers}
        onChange={(v) => setSettings({ snapToLayers: v })}
        help="Rounds every level to a whole number of layers, so each filament swap falls exactly between two layers."
      />
      <NumberSlider
        label="Base (level 1)"
        value={s.baseThickness}
        min={THICKNESS_MIN}
        max={5}
        step={0.1}
        unit="mm"
        onChange={(v) => setSettings({ baseThickness: v })}
      />
      <NumberSlider
        label="Other levels (default)"
        value={s.defaultThickness}
        min={THICKNESS_MIN}
        max={3}
        step={0.1}
        unit="mm"
        help="Override any level in its header; leave blank to use these."
        onChange={(v) => setSettings({ defaultThickness: v })}
      />

      <div className="space-y-2">
        <Toggle
          label="Opacity check"
          checked={s.opacity.enabled}
          onChange={(v) => setSettings({ opacity: { ...s.opacity, enabled: v } })}
          help="Warns when a color is too thin to hide the color under it. Light colors over dark ones need the most."
        />
        {s.opacity.enabled && (
          <div className="ml-6 space-y-2">
            <NumberSlider
              label="Dark colors need"
              value={s.opacity.minDark}
              min={0.2}
              max={2}
              step={0.1}
              unit="mm"
              onChange={(v) => setSettings({ opacity: { ...s.opacity, minDark: v } })}
            />
            <NumberSlider
              label="White over black needs"
              value={s.opacity.minLight}
              min={0.4}
              max={3}
              step={0.1}
              unit="mm"
              help="Other pairs fall in between, by lightness and contrast. Raise this for thin or translucent filaments."
              onChange={(v) => setSettings({ opacity: { ...s.opacity, minLight: v } })}
            />
            <button
              type="button"
              onClick={runNormalize}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
            >
              Normalize all levels
            </button>
            {message && (
              <p role="status" className="text-xs text-accent-300">
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
