"use client";

/**
 * Chat @-mention plumbing + the canvas interaction MODE (for the tool dock).
 *
 * WYSIWYG selection now lives in selectionStore (clicking selects for editing). This
 * store is only: (1) the tool mode (none/select/move) the dock + ModeHud use for the
 * drag-to-move tool, and (2) `pendingInsert` — an "@id " queued for the chat composer
 * (consumed by MentionOverlay). Pushing a mention is now an EXPLICIT action
 * (`mentionElement`), not a side effect of selecting.
 */
import { create } from "zustand";

/** The active canvas interaction mode (driven by the tool dock). */
export type EditorMode = "none" | "select" | "move";

interface MentionStore {
  mode: EditorMode;
  pendingInsert: string | null;
  setMode: (mode: EditorMode) => void;
  /** Queue an "@id " for the chat composer (explicit "mention in chat" action). */
  mentionElement: (id: string) => void;
  consumeInsert: () => string | null;
}

export const useMentionStore = create<MentionStore>((set, get) => ({
  mode: "none",
  pendingInsert: null,
  setMode: (mode) => set({ mode }),
  mentionElement: (id) => set({ pendingInsert: `@${id} ` }),
  consumeInsert: () => {
    const v = get().pendingInsert;
    if (v) set({ pendingInsert: null });
    return v;
  },
}));
