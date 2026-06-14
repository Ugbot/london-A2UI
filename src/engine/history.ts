/**
 * Snapshot history — "rewind and more".
 *
 * Beyond stepwise undo/redo (the Y.UndoManager in useCanvasHistory), this records
 * named CHECKPOINTS of the whole session doc (tree + read-model) as encoded Yjs
 * updates, so you can scrub back to ANY past point. A checkpoint is captured after a
 * tracked (local/agent) change settles; restoring reads the checkpoint's tree + data
 * and writes them back as ONE forward transaction (CRDTs only move forward — a restore
 * is a new edit that makes the present equal that past, and is itself undoable).
 */
import * as Y from "yjs";
import { readTree, readAllData } from "@/collab/doc-model";
import type { CompositionNode } from "@/bricks/composition";

export interface Checkpoint {
  /** Full-doc state as a Yjs update (structured-clone-safe). */
  update: Uint8Array;
  /** Epoch ms — caller stamps it (Date.now is unavailable in some contexts). */
  time: number;
  /** Short human label (e.g. "edit heading", "render"). */
  label: string;
}

/** Read what a checkpoint's tree + data WOULD restore to (without mutating live doc). */
export function readCheckpoint(ckpt: Checkpoint): {
  tree: CompositionNode | null;
  data: Record<string, unknown>;
} {
  const tmp = new Y.Doc();
  Y.applyUpdate(tmp, ckpt.update);
  return { tree: readTree(tmp), data: readAllData(tmp) };
}

/**
 * A bounded ring of checkpoints for one doc. Capture appends a full-state checkpoint
 * (dropping the oldest past `limit`); restore returns the tree + data to write back.
 */
export class HistoryLog {
  private readonly doc: Y.Doc;
  private readonly limit: number;
  private items: Checkpoint[] = [];

  constructor(doc: Y.Doc, limit = 50) {
    this.doc = doc;
    this.limit = limit;
  }

  capture(label: string, time: number): void {
    this.items.push({ update: Y.encodeStateAsUpdate(this.doc), time, label });
    if (this.items.length > this.limit) this.items.shift();
  }

  list(): readonly Checkpoint[] {
    return this.items;
  }

  size(): number {
    return this.items.length;
  }

  /** Resolve the tree + data captured at `index` (clamped). */
  at(index: number): { tree: CompositionNode | null; data: Record<string, unknown> } | null {
    if (this.items.length === 0) return null;
    const i = Math.max(0, Math.min(index, this.items.length - 1));
    return readCheckpoint(this.items[i]);
  }
}
