import { create } from "zustand";

/** Preview UI state shared by the 2D and 3D views (not persisted). */
interface ViewState {
  tab: "2d" | "3d";
  /** Levels shown from the bottom; null = all (follows level count changes). */
  shownLevels: number | null;
  /** Extra vertical gap between levels in the 3D view (mm). */
  explode: number;
  setTab: (t: ViewState["tab"]) => void;
  setShownLevels: (n: number | null) => void;
  setExplode: (mm: number) => void;
}

export const useView = create<ViewState>((set) => ({
  tab: "2d",
  shownLevels: null,
  explode: 0,
  setTab: (tab) => set({ tab }),
  setShownLevels: (shownLevels) => set({ shownLevels }),
  setExplode: (explode) => set({ explode }),
}));
