"use client";

/**
 * Hooks over the shared Yjs document: the collaboratively-edited widget tree
 * and live presence of connected peers.
 */
import * as React from "react";
import type { CompositionNode } from "@/bricks/composition";
import { useCollab, type CollabUser } from "./provider";

/**
 * Read/write the canvas widget tree.
 *
 * Keying is the crux of real collaboration:
 *  - SOLO (collab off): keyed per thread (`thread:<id>`) so switching threads
 *    reloads that thread's canvas locally.
 *  - SHARED (collab on): everyone on the same session/room edits ONE key
 *    (`shared-canvas`), so edits actually propagate between users.
 *
 * On switching into shared mode, the current widget is seeded into the shared
 * key (if empty) so the canvas doesn't blank.
 */
export function useSharedWidget(
  threadId: string | undefined,
  shared: boolean,
): [CompositionNode | null, (next: CompositionNode | null) => void] {
  const { doc } = useCollab();
  const canvas = React.useMemo(() => doc.getMap("canvas"), [doc]);
  const key = shared ? "shared-canvas" : `thread:${threadId ?? "default"}`;
  const lastNonNull = React.useRef<CompositionNode | null>(null);

  const [widget, setLocal] = React.useState<CompositionNode | null>(
    () => (canvas.get(key) as CompositionNode | undefined) ?? null,
  );

  React.useEffect(() => {
    const update = () => {
      const v = (canvas.get(key) as CompositionNode | undefined) ?? null;
      if (v) lastNonNull.current = v;
      setLocal(v);
    };
    // Seed the shared canvas from the last solo widget so it isn't blank for
    // the user who turned collaboration on.
    if (shared && !canvas.get(key) && lastNonNull.current) {
      canvas.set(key, lastNonNull.current);
    }
    update();
    canvas.observe(update);
    return () => canvas.unobserve(update);
  }, [canvas, key, shared]);

  const setWidget = React.useCallback(
    (next: CompositionNode | null) => {
      if (next) lastNonNull.current = next;
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
