"use client";

/**
 * Per-session reactive read-model — "the state in the thing we're building".
 *
 * The read-model now lives in the ONE Yjs session doc (see `@/collab/doc-model`), so
 * data changes share the doc's history, rewind, and cross-thread/collab sync. This
 * module keeps the OLD imperative API (`useWidgetStore.getState().{data,set,get,apply,
 * reset}`, `streamToElement`, `registerDerived`) as a thin shim that delegates to the
 * active session doc, so callers not yet migrated to `dispatch()` keep working. It is
 * deprecated — new code should use `dispatch()` / `useElementData` directly.
 *
 * Updates use the Turbo-Stream vocabulary (set / merge / append / remove), implemented
 * once in `applyDataAction`.
 */
import { getActiveDoc } from "@/engine/doc-registry";
import {
  ORIGIN,
  getData,
  readData,
  readAllData,
  applyDataAction,
} from "@/collab/doc-model";
import { registerDerivation } from "@/engine/derive";

export type StreamActionType = "set" | "merge" | "append" | "remove";

export interface StreamAction {
  action: StreamActionType;
  target: string;
  value?: unknown;
}

/** Imperative read-model accessor backed by the active Yjs doc (no active doc → no-op). */
const widgetStoreState = {
  get data(): Record<string, unknown> {
    const doc = getActiveDoc();
    return doc ? readAllData(doc) : {};
  },
  apply(action: StreamAction): void {
    const doc = getActiveDoc();
    if (doc) applyDataAction(doc, action, ORIGIN.local);
  },
  set(key: string, value: unknown): void {
    const doc = getActiveDoc();
    if (doc) applyDataAction(doc, { action: "set", target: key, value }, ORIGIN.local);
  },
  get(key: string): unknown {
    const doc = getActiveDoc();
    return doc ? readData(doc, key) : undefined;
  },
  reset(): void {
    const doc = getActiveDoc();
    if (!doc) return;
    const data = getData(doc);
    doc.transact(() => {
      for (const k of [...data.keys()]) data.delete(k);
    }, ORIGIN.local);
  },
};

/** @deprecated Use `dispatch()` / `useElementData`. Thin shim over the Yjs read-model. */
export const useWidgetStore = {
  getState: () => widgetStoreState,
};

/** Apply a stream action to the active session read-model (callable outside React). */
export function streamToElement(action: StreamAction): void {
  const doc = getActiveDoc();
  if (doc) applyDataAction(doc, action, ORIGIN.agent);
}

/**
 * Register a DERIVED key: recompute `compute(depValues, get)` whenever any dependency
 * changes, writing the result to `key`. Backed by the Yjs read-model now. Returns an
 * unsubscribe; recomputes once. No-op (returns a noop unsub) when no doc is active.
 */
export function registerDerived(
  key: string,
  deps: string[],
  compute: (depValues: unknown[], get: (k: string) => unknown) => unknown,
): () => void {
  const doc = getActiveDoc();
  if (!doc) return () => {};
  return registerDerivation(doc, key, deps, compute);
}
