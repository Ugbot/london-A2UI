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
 * The canvas is ONE document per session, keyed by a STABLE key (not the
 * CopilotKit thread id — that changes when you send a message / switch chats,
 * which used to blank the canvas and make edits hit an empty tree). The same
 * Yjs doc is used solo and collaborative: turning collaboration on simply
 * attaches the WebSocket provider to this doc, so the canvas syncs without
 * re-keying or seeding.
 */
const CANVAS_KEY = "widget";

export function useSharedWidget(): [
  CompositionNode | null,
  (next: CompositionNode | null) => void,
] {
  const { doc } = useCollab();
  const canvas = React.useMemo(() => doc.getMap("canvas"), [doc]);

  const [widget, setLocal] = React.useState<CompositionNode | null>(
    () => (canvas.get(CANVAS_KEY) as CompositionNode | undefined) ?? null,
  );

  React.useEffect(() => {
    const update = () =>
      setLocal((canvas.get(CANVAS_KEY) as CompositionNode | undefined) ?? null);
    update();
    canvas.observe(update);
    return () => canvas.unobserve(update);
  }, [canvas]);

  const setWidget = React.useCallback(
    (next: CompositionNode | null) => {
      if (next === null) canvas.delete(CANVAS_KEY);
      else canvas.set(CANVAS_KEY, next);
    },
    [canvas],
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
