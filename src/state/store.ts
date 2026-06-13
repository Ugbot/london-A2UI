"use client";

/**
 * Per-canvas reactive data store, keyed by element id — the "state in the thing
 * we're building". Bricks read a key with `useElementData` and re-render live
 * when anyone updates it.
 *
 * Updates are modelled as Hotwire/Turbo-Stream-style actions targeting a key:
 *   set     — replace the value at target
 *   merge   — shallow-merge into an object value
 *   append  — push onto an array value
 *   remove  — delete the key
 * This lets the agent, a DataSource brick, or a peer surgically change parts of
 * a live widget by addressing keyed elements.
 */
import { create } from "zustand";

export type StreamActionType = "set" | "merge" | "append" | "remove";

export interface StreamAction {
  action: StreamActionType;
  target: string;
  value?: unknown;
}

interface WidgetStateStore {
  data: Record<string, unknown>;
  apply: (action: StreamAction) => void;
  set: (key: string, value: unknown) => void;
  get: (key: string) => unknown;
  reset: () => void;
}

export const useWidgetStore = create<WidgetStateStore>((set, get) => ({
  data: {},
  apply: (action) =>
    set((state) => {
      const data = { ...state.data };
      const cur = data[action.target];
      switch (action.action) {
        case "set":
          data[action.target] = action.value;
          break;
        case "merge":
          data[action.target] = {
            ...(typeof cur === "object" && cur ? (cur as object) : {}),
            ...(typeof action.value === "object" && action.value ? (action.value as object) : {}),
          };
          break;
        case "append": {
          const arr = Array.isArray(cur) ? [...cur] : [];
          arr.push(action.value);
          data[action.target] = arr;
          break;
        }
        case "remove":
          delete data[action.target];
          break;
      }
      return { data };
    }),
  set: (key, value) => get().apply({ action: "set", target: key, value }),
  get: (key) => get().data[key],
  reset: () => set({ data: {} }),
}));

/** Apply a stream action to the canvas store (callable outside React). */
export function streamToElement(action: StreamAction): void {
  useWidgetStore.getState().apply(action);
}
