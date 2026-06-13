"use client";

/**
 * Bridges canvas element selection and the chat input for @-targeting.
 * - Clicking an element on the canvas sets `targetId` (highlight) and queues a
 *   `pendingInsert` ("@id ") that the MentionInput appends to its text.
 * - `selectMode` toggles the click-to-target interaction on the canvas.
 */
import { create } from "zustand";

interface MentionStore {
  selectMode: boolean;
  targetId: string | null;
  pendingInsert: string | null;
  setSelectMode: (on: boolean) => void;
  selectElement: (id: string) => void;
  consumeInsert: () => string | null;
  clearTarget: () => void;
}

export const useMentionStore = create<MentionStore>((set, get) => ({
  selectMode: false,
  targetId: null,
  pendingInsert: null,
  setSelectMode: (on) => set({ selectMode: on }),
  selectElement: (id) => set({ targetId: id, pendingInsert: `@${id} `, selectMode: false }),
  consumeInsert: () => {
    const v = get().pendingInsert;
    if (v) set({ pendingInsert: null });
    return v;
  },
  clearTarget: () => set({ targetId: null }),
}));
