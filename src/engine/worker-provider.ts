/**
 * A minimal Yjs sync provider over a message channel (postMessage), used SYMMETRICALLY
 * on the main thread and inside the worker. It mirrors one Y.Doc replica to the other
 * side: local updates are posted as binary deltas; incoming deltas are applied. This is
 * the cross-thread STATE wire — the worker writes fetched data into its replica and it
 * appears on the main doc (and vice-versa for commands' inputs like form fields).
 *
 * Echo prevention: updates we apply are tagged with this provider's unique origin and
 * NOT re-posted, so the two replicas converge without a feedback loop. Sync is whole-
 * update based (encodeStateAsUpdate on connect + incremental updates after) — simple
 * and correct for a single builder session; Yjs merges deltas idempotently.
 */
import * as Y from "yjs";

export interface SyncChannel {
  /** Send a binary Yjs update to the peer. */
  post(update: Uint8Array): void;
  /** Subscribe to binary updates from the peer; returns an unsubscribe. */
  onMessage(handler: (update: Uint8Array) => void): () => void;
}

/**
 * Connect `doc` to a peer over `channel`. Posts our full state immediately (so the peer
 * catches up), then streams incremental updates. Returns a disconnect fn.
 */
export function connectDocChannel(doc: Y.Doc, channel: SyncChannel): () => void {
  // Unique marker identifying updates THIS provider applied (so we don't echo them).
  const origin = { provider: "worker-sync" };

  const onUpdate = (update: Uint8Array, updateOrigin: unknown) => {
    if (updateOrigin === origin) return; // came from the peer — don't bounce back
    channel.post(update);
  };
  doc.on("update", onUpdate);

  const off = channel.onMessage((update) => {
    Y.applyUpdate(doc, update, origin);
  });

  // Initial catch-up: hand the peer everything we already have.
  channel.post(Y.encodeStateAsUpdate(doc));

  return () => {
    doc.off("update", onUpdate);
    off();
  };
}
