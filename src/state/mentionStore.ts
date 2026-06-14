"use client";

/**
 * Bridges canvas element selection and the chat input for @-targeting.
 * - Clicking an element on the canvas sets `targetId` (highlight) and queues a
 *   `pendingInsert` ("@id ") that the MentionInput appends to its text.
 * - `selectMode` toggles the click-to-target interaction on the canvas.
 */
import { create } from "zustand";

/** The active canvas interaction mode (driven by the tool dock). */
export type EditorMode = "none" | "select" | "move";

interface MentionStore {
  mode: EditorMode;
  targetId: string | null;
  pendingInsert: string | null;
  setMode: (mode: EditorMode) => void;
  selectElement: (id: string) => void;
  consumeInsert: () => string | null;
  clearTarget: () => void;
}

export const useMentionStore = create<MentionStore>((set, get) => ({
  mode: "none",
  targetId: null,
  pendingInsert: null,
  setMode: (mode) => set({ mode }),
  // Selecting an element queues an @mention and drops back to the default mode.
  selectElement: (id) => set({ targetId: id, pendingInsert: `@${id} `, mode: "none" }),
  consumeInsert: () => {
    const v = get().pendingInsert;
    if (v) set({ pendingInsert: null });
    return v;
  },
  clearTarget: () => set({ targetId: null }),
}));
