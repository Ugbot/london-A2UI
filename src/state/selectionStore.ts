"use client";

/**
 * WYSIWYG editor selection — the schematic canvas's direct-manipulation state.
 *
 * Deliberately SEPARATE from mentionStore (which drives the chat @-mention pipeline):
 * clicking an element here selects it FOR EDITING (opens the inspector, draws the
 * selection box) and never touches the chat. Pushing "@id" to chat is an explicit
 * action (mentionStore.mentionElement).
 *
 *   select(id)     → selected (and not editing)
 *   enterEdit(id)  → selected + inline text editing this element
 *   exitEdit()     → stop editing, keep it selected
 *   clear()        → nothing selected
 *   setHover(id)   → hover highlight (independent of selection)
 *   outlineAll     → optional "blueprint" toggle (off by default)
 */
import { create } from "zustand";

interface SelectionStore {
  selectedId: string | null;
  editingId: string | null;
  hoverId: string | null;
  outlineAll: boolean;
  select: (id: string | null) => void;
  enterEdit: (id: string) => void;
  exitEdit: () => void;
  clear: () => void;
  setHover: (id: string | null) => void;
  toggleOutlineAll: () => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedId: null,
  editingId: null,
  hoverId: null,
  outlineAll: false,
  select: (id) => set({ selectedId: id, editingId: null }),
  enterEdit: (id) => set({ selectedId: id, editingId: id }),
  exitEdit: () => set({ editingId: null }),
  clear: () => set({ selectedId: null, editingId: null }),
  setHover: (id) => set({ hoverId: id }),
  toggleOutlineAll: () => set((s) => ({ outlineAll: !s.outlineAll })),
}));
