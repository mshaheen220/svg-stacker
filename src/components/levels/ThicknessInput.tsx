import { useEffect, useState } from "react";
import { THICKNESS_MAX, THICKNESS_MIN } from "../../lib/arrangement";

interface Props {
  label: string;
  /** Override value, or null to use `fallback`. */
  value: number | null;
  fallback: number;
  onChange: (mm: number | null) => void;
}

/** Thickness override; leaving it blank falls back to the default (shown as the placeholder). */
export function ThicknessInput({ label, value, fallback, onChange }: Props) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);

  const commit = () => {
    const v = parseFloat(text);
    if (text.trim() === "" || !Number.isFinite(v)) {
      onChange(null);
      setText("");
    } else {
      const clamped = Math.min(THICKNESS_MAX, Math.max(THICKNESS_MIN, v));
      onChange(clamped);
      setText(String(clamped));
    }
  };

  return (
    <span className="flex items-center gap-1 text-xs text-ink-400">
      <input
        type="number"
        inputMode="decimal"
        step={0.1}
        min={THICKNESS_MIN}
        max={THICKNESS_MAX}
        aria-label={label}
        title={`${label} (blank = default ${fallback} mm)`}
        placeholder={String(fallback)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-14 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-right text-ink-100 placeholder:text-ink-500"
      />
      mm
    </span>
  );
}
