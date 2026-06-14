"use client";

/**
 * Hooks over the shared Yjs document: the collaboratively-edited widget tree
 * and live presence of connected peers.
 */
import * as React from "react";
import * as Y from "yjs";
import type { CompositionNode } from "@/bricks/composition";
import {
  ORIGIN,
  getCanvas,
  getData,
  readTree,
  writeTree,
  observeTree,
} from "./doc-model";
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
 *
 * The tree is stored FINE-GRAINED (see doc-model.ts): `setWidget(next)` reconciles
 * into minimal per-node/per-prop deltas, so a one-prop edit emits a single delta and
 * collab merges at the node level. `[widget, setWidget]` keeps its old contract, so
 * existing callers (page.tsx edit/restore, persistence) are unchanged.
 */
export function useSharedWidget(): [
  CompositionNode | null,
  (next: CompositionNode | null) => void,
] {
  const { doc } = useCollab();

  const [widget, setLocal] = React.useState<CompositionNode | null>(
    () => readTree(doc),
  );

  React.useEffect(() => {
    const update = () => setLocal(readTree(doc));
    update();
    return observeTree(doc, update);
  }, [doc]);

  const setWidget = React.useCallback(
    (next: CompositionNode | null) => writeTree(doc, next, ORIGIN.local),
    [doc],
  );

  return [widget, setWidget];
}

/**
 * Transactional undo/redo — "Figma with JS & data". Both the canvas tree AND the
 * keyed read-model live in the one Yjs doc, so a single Y.UndoManager spanning BOTH
 * maps gives atomic rewind across structure + data: one user intent (edit a node and
 * seed its data) groups into one step and undoes together. `trackedOrigins` is scoped
 * to local/agent edits, so background worker fetches and remote-peer changes don't
 * pollute YOUR undo stack. `current()` reads post-undo/redo synchronously; `clear()`
 * resets history (e.g. after switching to another report).
 */
export function useCanvasHistory() {
  const { doc } = useCollab();
  const undoManager = React.useMemo(
    () =>
      new Y.UndoManager([getCanvas(doc), getData(doc)], {
        captureTimeout: 250,
        trackedOrigins: new Set<unknown>([ORIGIN.local, ORIGIN.agent]),
      }),
    [doc],
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

  const current = React.useCallback(() => readTree(doc), [doc]);

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
