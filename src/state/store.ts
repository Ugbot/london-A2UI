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

/**
 * Register a DERIVED key: recompute `compute(depValues, get)` whenever any
 * dependency key changes, and write the result to `key`. The reactive backbone
 * for mortar — a computed value propagates to every brick bound to `key` in real
 * time (Zustand subscription graph). Returns an unsubscribe; recomputes once now.
 */
export function registerDerived(
  key: string,
  deps: string[],
  compute: (depValues: unknown[], get: (k: string) => unknown) => unknown,
): () => void {
  const get = (k: string) => useWidgetStore.getState().data[k];
  const recompute = () => {
    let next: unknown;
    try {
      next = compute(deps.map(get), get);
    } catch {
      return; // a throwing derivation must not break the store
    }
    if (next !== useWidgetStore.getState().data[key]) {
      useWidgetStore.getState().set(key, next);
    }
  };

  let prev = deps.map(get);
  const unsub = useWidgetStore.subscribe((state) => {
    const cur = deps.map((d) => state.data[d]);
    if (cur.some((v, i) => v !== prev[i])) {
      prev = cur;
      recompute();
    }
  });
  recompute();
  return unsub;
}
