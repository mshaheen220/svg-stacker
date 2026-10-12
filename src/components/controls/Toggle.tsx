import { useId, type ReactNode } from "react";

interface Props {
  label: string;
  checked: boolean;
  help?: ReactNode;
  onChange: (v: boolean) => void;
}

/** Checkbox with label and optional help text. */
export function Toggle({ label, checked, help, onChange }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-ink-200">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={help ? `${id}-help` : undefined} />
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="ml-6 text-xs text-ink-400">
          {help}
        </p>
      )}
    </div>
  );
}
