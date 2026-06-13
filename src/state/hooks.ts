"use client";

/** Reactive read of a keyed element's live value from the canvas store. */
import { useWidgetStore } from "./store";

/**
 * Subscribe to a keyed element's value. Returns `fallback` when no `key` is
 * given or nothing has been written to it yet. Safe to call unconditionally
 * (pass `undefined` key for unbound bricks).
 */
export function useElementData<T = unknown>(
  key: string | undefined,
  fallback: T,
): T {
  return useWidgetStore((s) =>
    key && key in s.data ? (s.data[key] as T) : fallback,
  );
}
