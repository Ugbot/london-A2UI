"use client";

/**
 * Canvas view mode — the "game engine" Scene/Game split:
 *   schematic → the editable canvas (select/drag/drop, inspector, @-overlays)
 *   rendered  → the live target app in an isolated iframe (read-only web view)
 *   split     → both side by side
 */
import { create } from "zustand";

export type ViewMode = "schematic" | "rendered" | "split";

interface ViewStore {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  mode: "schematic",
  setMode: (mode) => set({ mode }),
}));
