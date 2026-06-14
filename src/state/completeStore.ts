"use client";

/**
 * Bridge for "Complete with AI" on a wireframe. A Wireframe brick (or the
 * inspector) queues a completion request here; a CompleteBridge mounted inside
 * the chat provider consumes it and asks the agent to interview + generate.
 */
import { create } from "zustand";

export interface CompleteRequest {
  id: string;
  label: string;
  kind: string;
}

interface CompleteStore {
  pending: CompleteRequest | null;
  request: (req: CompleteRequest) => void;
  consume: () => CompleteRequest | null;
}

export const useCompleteStore = create<CompleteStore>((set, get) => ({
  pending: null,
  request: (req) => set({ pending: req }),
  consume: () => {
    const v = get().pending;
    if (v) set({ pending: null });
    return v;
  },
}));
