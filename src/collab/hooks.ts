"use client";

/**
 * Hooks over the shared Yjs document: the collaboratively-edited widget tree
 * and live presence of connected peers.
 */
import * as React from "react";
import * as Y from "yjs";
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

/**
 * Transactional undo/redo for the canvas — "Figma with JS". The canvas tree lives
 * in the Yjs doc, so a Y.UndoManager gives transactional, collab-aware history for
 * free: each edit is a step, undo only reverts LOCAL changes. `current()` reads the
 * post-undo/redo value synchronously (Yjs applies in-band) so the caller can persist
 * it; `clear()` resets history (e.g. after switching to another report).
 */
export function useCanvasHistory() {
  const { doc } = useCollab();
  const canvas = React.useMemo(() => doc.getMap("canvas"), [doc]);
  const undoManager = React.useMemo(
    () => new Y.UndoManager(canvas, { captureTimeout: 250 }),
    [canvas],
  );
  const [{ canUndo, canRedo }, setState] = React.useState({ canUndo: false, canRedo: false });

  React.useEffect(() => {
    const update = () =>
      setState({ canUndo: undoManager.canUndo(), canRedo: undoManager.canRedo() });
    undoManager.on("stack-item-added", update);
    undoManager.on("stack-item-popped", update);
    undoManager.on("stack-cleared", update);
    update();
    return () => {
      undoManager.off("stack-item-added", update);
      undoManager.off("stack-item-popped", update);
      undoManager.off("stack-cleared", update);
      undoManager.destroy();
    };
  }, [undoManager]);

  const current = React.useCallback(
    () => ((canvas.get("widget") as CompositionNode | undefined) ?? null),
    [canvas],
  );

  return {
    canUndo,
    canRedo,
    undo: React.useCallback(() => undoManager.undo(), [undoManager]),
    redo: React.useCallback(() => undoManager.redo(), [undoManager]),
    clear: React.useCallback(() => undoManager.clear(), [undoManager]),
    current,
  };
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
