"use client";

/**
 * Hooks over the shared Yjs document: the collaboratively-edited widget tree
 * and live presence of connected peers.
 */
import * as React from "react";
import type { CompositionNode } from "@/bricks/composition";
import { useCollab, type CollabUser } from "./provider";

/**
 * Read/write the shared widget tree for a given thread. Each thread has its own
 * key under the shared `canvas` Y.Map, so switching threads reloads that
 * thread's canvas live. Writing propagates to every client in the session.
 * Returns `[widget, setWidget]`.
 */
export function useSharedWidget(
  threadId?: string,
): [CompositionNode | null, (next: CompositionNode | null) => void] {
  const { doc } = useCollab();
  const canvas = React.useMemo(() => doc.getMap("canvas"), [doc]);
  const key = threadId ?? "default";
  const [widget, setLocal] = React.useState<CompositionNode | null>(
    () => (canvas.get(key) as CompositionNode | undefined) ?? null,
  );

  React.useEffect(() => {
    const update = () =>
      setLocal((canvas.get(key) as CompositionNode | undefined) ?? null);
    update(); // re-read immediately when the thread (key) changes
    canvas.observe(update);
    return () => canvas.unobserve(update);
  }, [canvas, key]);

  const setWidget = React.useCallback(
    (next: CompositionNode | null) => {
      if (next === null) canvas.delete(key);
      else canvas.set(key, next);
    },
    [canvas, key],
  );

  return [widget, setWidget];
}

/** Live list of connected peers (excluding self) from Yjs awareness. */
export function usePresence(): CollabUser[] {
  const { provider } = useCollab();
  const [peers, setPeers] = React.useState<CollabUser[]>([]);

  React.useEffect(() => {
    if (!provider) return;
    const awareness = provider.awareness;
    const update = () => {
      const others: CollabUser[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const user = (state as { user?: CollabUser }).user;
        if (user) others.push(user);
      });
      setPeers(others);
    };
    update();
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [provider]);

  return peers;
}
