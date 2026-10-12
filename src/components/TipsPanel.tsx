import { useEffect, useState } from "react";
import { shuffleIndices, TIPS, type TipCategory } from "../tips";

const CATEGORY: Record<TipCategory, { label: string; icon: string; badge: string }> = {
  preparing: { label: "Preparing the SVG", icon: "✏️", badge: "border-sky-500/50 bg-sky-500/15" },
  arranging: { label: "Arranging levels", icon: "🧱", badge: "border-violet-500/50 bg-violet-500/15" },
  slicing: { label: "Slicing", icon: "🔪", badge: "border-emerald-500/50 bg-emerald-500/15" },
  printing: { label: "Printing", icon: "🖨️", badge: "border-amber-500/50 bg-amber-500/15" },
};

const AUTOPLAY_INTERVAL_MS = 8000;
const OPEN_KEY = "svg-stacker:tips-open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * Rotating tips bar (same behavior as the other workshop apps): tours every
 * tip once in a shuffled order before reshuffling, with prev/next, autoplay
 * and collapse. The same tips are served to the Mashghal dashboard at
 * /api/tips/.
 */
export function TipsPanel() {
  const [isOpen, setIsOpen] = useState(readOpen);
  const [order, setOrder] = useState(() => shuffleIndices(TIPS.length));
  const [position, setPosition] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem(OPEN_KEY, String(open));
    } catch {
      // Preference just won't persist.
    }
  };

  const goNext = () =>
    setPosition((p) => {
      if (p + 1 >= order.length) {
        // Full tour complete: reshuffle so the next lap isn't the same order.
        setOrder(shuffleIndices(TIPS.length));
        return 0;
      }
      return p + 1;
    });
  const goPrev = () => setPosition((p) => (p - 1 + order.length) % order.length);

  useEffect(() => {
    // Don't advance a tip nobody can see; resume where it left off when reopened.
    if (!autoplay || !isOpen) return;
    const timer = setInterval(goNext, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, isOpen, order]);

  const tip = TIPS[order[position]];
  if (!tip) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-ink-500 hover:text-ink-100"
      >
        <span aria-hidden>💡</span> Tips
      </button>
    );
  }

  const cat = CATEGORY[tip.category];
  const btn = "rounded px-1.5 py-1 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100";
  return (
    <div className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-ink-700 bg-ink-900/60 py-1.5 pl-3 pr-2" role="region" aria-label="Tips">
      <span
        title={cat.label}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${cat.badge}`}
      >
        <span aria-hidden>{cat.icon}</span>
        <span className="sr-only">{cat.label}</span>
      </span>
      {/* Reserve two lines so short tips don't make the header jump. */}
      <div className="flex min-h-[2.5rem] min-w-0 flex-1 items-center">
        <p key={order[position]} className="line-clamp-2 animate-fade-in text-xs leading-relaxed text-ink-200" aria-live={autoplay ? "off" : "polite"}>
          {tip.text}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={goPrev} aria-label="Previous tip" className={btn}>
          ‹
        </button>
        <button type="button" onClick={goNext} aria-label="Next tip" className={btn}>
          ›
        </button>
        <button
          type="button"
          onClick={() => setAutoplay((a) => !a)}
          aria-pressed={autoplay}
          aria-label={autoplay ? "Stop autoplay" : "Autoplay through tips"}
          title={autoplay ? "Stop autoplay" : "Autoplay through tips"}
          className={`rounded px-2 py-1 text-[11px] ${autoplay ? "bg-ink-700 text-ink-50" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}
        >
          {autoplay ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Collapse tips" className={btn}>
          ✕
        </button>
      </div>
    </div>
  );
}
