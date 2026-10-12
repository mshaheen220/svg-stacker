import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ListOrder = "bottom-first" | "top-first";

/** Preview/editor UI state shared across components. Only listOrder is remembered. */
interface ViewState {
  tab: "2d" | "3d";
  /** Levels shown from the bottom; null = all (follows level count changes). */
  shownLevels: number | null;
  /** Extra vertical gap between levels in the 3D view (mm). */
  explode: number;
  /** Display order of the Levels list. Purely visual: the print order never changes. */
  listOrder: ListOrder;
  setTab: (t: ViewState["tab"]) => void;
  setShownLevels: (n: number | null) => void;
  setExplode: (mm: number) => void;
  setListOrder: (o: ListOrder) => void;
}

export const useView = create<ViewState>()(
  persist(
    (set) => ({
      tab: "2d",
      shownLevels: null,
      explode: 0,
      listOrder: "bottom-first",
      setTab: (tab) => set({ tab }),
      setShownLevels: (shownLevels) => set({ shownLevels }),
      setExplode: (explode) => set({ explode }),
      setListOrder: (listOrder) => set({ listOrder }),
    }),
    {
      name: "svg-stacker:view",
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
      }),
      partialize: (s) => ({ listOrder: s.listOrder }),
    },
  ),
);
