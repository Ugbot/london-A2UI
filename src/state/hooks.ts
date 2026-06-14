"use client";

/** Reactive read of a keyed element's live value from the session read-model. */
import * as React from "react";
import { useCollab } from "@/collab/provider";
import { readData, observeDataKey } from "@/collab/doc-model";

/**
 * Subscribe to a keyed element's value in the Yjs read-model. Returns `fallback` when
 * no `key` is given or nothing has been written to it yet. KEYED pub/sub: the component
 * re-renders ONLY when this specific key changes (via `observeDataKey`), so a live data
 * update surgically refreshes exactly the bricks bound to that key. Safe to call
 * unconditionally (pass `undefined` for unbound bricks).
 */
export function useElementData<T = unknown>(
  key: string | undefined,
  fallback: T,
): T {
  const { doc } = useCollab();

  const subscribe = React.useCallback(
    (onChange: () => void) => (key ? observeDataKey(doc, key, onChange) : () => {}),
    [doc, key],
  );
  const getSnapshot = React.useCallback(
    () => (key ? readData(doc, key) : undefined),
    [doc, key],
  );

  const value = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (value === undefined ? fallback : value) as T;
}
