/**
 * Tips shown in the app's rotating tips bar and served at GET /api/tips/
 * for the Mashghal dashboard (see vite.config.ts and docker/nginx.conf).
 * This is the single copy: the in-app panel imports it directly, and the
 * build writes it out as the static API response.
 *
 * Shape matches Mashghal's other tip sources: { category, text }, where
 * category is an opaque per-app string.
 */
export interface Tip {
  category: TipCategory;
  text: string;
}

export type TipCategory = "preparing" | "arranging" | "slicing" | "printing";

export const TIPS: Tip[] = [
  // --- Preparing the SVG (Inkscape) ---
  { category: "preparing", text: "Name your shapes in Inkscape's Layers and Objects panel — those names become the part names in SVG Stacker and in OrcaSlicer's object list." },
  { category: "preparing", text: "Convert text to paths before importing (Path → Object to Path); text elements are skipped." },
  { category: "preparing", text: "Unlink clones in Inkscape (Edit → Clone → Unlink Clone) — <use> clones are skipped on import." },
  { category: "preparing", text: "Shapes with the same label and the same color merge into one part; give them different labels if you want them on different levels." },
  { category: "preparing", text: "Auto-traced artwork often carries hairline strokes in a stale color. Strokes under 0.2 mm are ignored by default — switch one to Outline only if it should print." },
  { category: "preparing", text: "A stroke set to Outline becomes its own part: a closed path's stroke turns into a ring, perfect for a colored border around a circle." },
  { category: "preparing", text: "Fine lines need to be at least 2× your nozzle width at the final print size — thicken them in Inkscape if the thin-feature hatching shows up red." },

  // --- Arranging levels ---
  { category: "arranging", text: "Use ⤒ on a level to try it as the top layer — e.g. putting the black outline on top gives crisp line art over every color." },
  { category: "arranging", text: "Support fill makes each level solid under everything above it, so nothing ever prints in mid-air. Leave it on unless you know why you need it off." },
  { category: "arranging", text: "Drag the Levels slider in the 2D or 3D preview to watch the print build up color by color." },
  { category: "arranging", text: "The Explode slider in 3D spreads the levels apart so you can see each level's shape and the wedding-cake support underneath." },
  { category: "arranging", text: "Several parts on one level print in one filament. Only do that when they share a color — otherwise the first part's color wins." },
  { category: "arranging", text: "Light colors over dark ones need more thickness to hide what's below. Click Normalize all levels to raise any level that would let the color underneath show through." },
  { category: "arranging", text: "Save arrangement downloads a small .stacker.json file, so you can rebuild the same sign from the same SVG later — even on another computer." },
  { category: "arranging", text: "A background plate adds an outline-shaped base with a margin around the whole design — great for wall plaques." },
  { category: "arranging", text: "Thin-feature warnings depend on the final size; making the print bigger with Target width is often the easiest fix." },

  // --- Slicing in OrcaSlicer ---
  { category: "slicing", text: "Set OrcaSlicer's layer height and first-layer height to match SVG Stacker's Layers settings — the embedded filament swaps are placed for those exact heights." },
  { category: "slicing", text: "Every filament swap lands exactly between two layers when “Whole layers only” is on — keep it on for clean color changes." },
  { category: "slicing", text: "The exported 3MF carries no slicer settings, so OrcaSlicer keeps your current printer, filament and process presets." },
  { category: "slicing", text: "Check the color-change table against OrcaSlicer's layer slider: each swap should sit at the “Orca Z” listed for its level." },
  { category: "slicing", text: "Ironing the top surface of each level gives flat color areas a smooth, even sheen on signs and plaques." },
  { category: "slicing", text: "Use at least 4–5 top layers on thin color levels so infill pattern doesn't show through the top surface." },

  // --- Printing & filament swaps ---
  { category: "printing", text: "With M600 swaps, the printer parks and shows “Load L3 white …” on its screen — load the color named there, purge, and confirm to continue." },
  { category: "printing", text: "Print the color-change summary and keep it by the printer; tick off each swap as you go so you never load the wrong color." },
  { category: "printing", text: "Wipe the purge blob off the nozzle before resuming after a filament change, or it can get dragged across the new color." },
  { category: "printing", text: "If a swap leaves a little old color in the new layer, purge a bit more filament during the change before resuming." },
  { category: "printing", text: "Two adjacent levels in the same filament don't need a swap — the summary marks them “Keep printing”." },
  { category: "printing", text: "On stock firmware without M600, choose “M25 pause” on export: the print pauses at each swap and you resume from the printer's screen." },
];

/** The response body for GET /api/tips/ (Mashghal's tip-source format). */
export const tipsPayload = () => ({ tips: TIPS });

/** Fisher-Yates shuffle of [0, length): tour every tip once in random order before repeating. */
export function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}
