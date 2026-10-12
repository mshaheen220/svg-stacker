import { lazy, Suspense } from "react";
import { useView } from "../../store/useView";
import { Preview2D } from "./Preview2D";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";

// three.js is large; only load it when the 3D tab is first opened.
const Preview3D = lazy(() => import("./Preview3D").then((m) => ({ default: m.Preview3D })));

const TABS = [
  { id: "2d", label: "2D" },
  { id: "3d", label: "3D" },
] as const;

export function PreviewPanel({ highlighted }: { highlighted: string[] | null }) {
  const { tab, setTab } = useView();
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Preview" className="mb-2 flex gap-1 border-b border-ink-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              tab === t.id ? "border-accent-400 text-ink-50" : "border-transparent text-ink-400 hover:text-ink-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1">
        <PreviewErrorBoundary resetKey={tab}>
        {tab === "2d" ? (
          <Preview2D highlighted={highlighted} />
        ) : (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ink-400">Loading 3D viewer…</div>}>
            <Preview3D highlighted={highlighted} />
          </Suspense>
        )}
        </PreviewErrorBoundary>
      </div>
    </div>
  );
}
