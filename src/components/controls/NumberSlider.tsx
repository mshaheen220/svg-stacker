import { useId } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  help?: string;
  onChange: (v: number) => void;
}

/** Range slider with a synced numeric input. */
export function NumberSlider({ label, value, min, max, step, unit, help, onChange }: Props) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm text-ink-200">
          {label}
        </label>
        <span className="flex items-center gap-1 text-sm">
          <input
            type="number"
            aria-label={`${label} value`}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onChange(clamp(v));
            }}
            className="w-20 rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-right text-ink-100"
          />
          {unit && <span className="text-ink-400">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={helpId}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full"
      />
      {help && (
        <p id={helpId} className="text-xs text-ink-400">
          {help}
        </p>
      )}
    </div>
  );
}
