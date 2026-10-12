import { useRef, useState, type DragEvent } from "react";

interface Props {
  accept: string;
  label: string;
  hint?: string;
  onFile: (file: File) => void;
}

export function FileDropzone({ accept, label, hint, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        dragging ? "border-accent-400 bg-accent-500/10" : "border-ink-700 bg-ink-900/40"
      }`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
      >
        {label}
      </button>
      <p className="mt-2 text-xs text-ink-400">{hint ?? "or drop a file here"}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
