"use client";

/** Whether new bricks are created autonomously (Auto on) or require approval. */
import { create } from "zustand";

interface FoundryStore {
  auto: boolean;
  setAuto: (on: boolean) => void;
}

export const useFoundryStore = create<FoundryStore>((set) => ({
  auto: false,
  setAuto: (on) => set({ auto: on }),
}));
