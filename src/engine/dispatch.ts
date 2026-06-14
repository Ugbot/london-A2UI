/**
 * `dispatch()` — the single CQRS entry point. Every UI/agent mutation goes through
 * here: the command is Zod-validated, then a handler mutates the active Yjs doc inside
 * a transaction (so the change is event-sourced, rewindable, and synced). Tree edits
 * reuse the pure `tree.ts` ops then reconcile via `writeTree` (minimal granular deltas).
 *
 * `dispatchBatch` runs several commands inside ONE transaction so a single user intent
 * (e.g. replace a wireframe AND seed its data) becomes ONE atomic undo step.
 */
import type * as Y from "yjs";
import { getActiveDoc } from "./doc-registry";
import { commandSchema, WORKER_COMMANDS, type Command } from "./commands";
import { getActivePool } from "./pool";
import { runDataCommand } from "./data-engine";
import {
  ORIGIN,
  type Origin,
  readTree,
  writeTree,
  applyDataAction,
} from "@/collab/doc-model";
import {
  patchById,
  moveNode,
  replaceById,
  insertChild,
  removeById,
  duplicateById,
} from "@/bricks/tree";
import { registerDerivedSource, unregisterDerivedSource } from "./derive";

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

const ok: DispatchResult = { ok: true };
const fail = (error: string): DispatchResult => ({ ok: false, error });

/** Apply ONE validated command to a specific doc. Exported for tests + batching. */
export function applyCommand(
  doc: Y.Doc,
  command: Command,
  origin: Origin = ORIGIN.local,
): DispatchResult {
  switch (command.type) {
    case "data/set":
      applyDataAction(
        doc,
        { action: command.action, target: command.target, value: command.value },
        origin,
      );
      return ok;

    case "derive/register":
      registerDerivedSource(doc, command.key, command.deps, command.source);
      return ok;

    case "derive/unregister":
      unregisterDerivedSource(doc, command.key);
      return ok;

    case "tree/render":
      writeTree(doc, command.tree, origin);
      return ok;

    case "tree/patch": {
      const tree = readTree(doc);
      if (!tree) return fail("empty canvas");
      writeTree(
        doc,
        patchById(tree, command.id, { setProps: command.setProps, brick: command.brick }),
        origin,
      );
      return ok;
    }

    case "tree/move": {
      const tree = readTree(doc);
      if (!tree) return fail("empty canvas");
      writeTree(doc, moveNode(tree, command.dragId, command.targetId, command.position), origin);
      return ok;
    }

    case "tree/replace": {
      const tree = readTree(doc);
      if (!tree) return fail("empty canvas");
      writeTree(doc, replaceById(tree, command.id, command.node), origin);
      return ok;
    }

    case "tree/insert": {
      const tree = readTree(doc);
      if (!tree) return fail("empty canvas");
      writeTree(doc, insertChild(tree, command.parentId, command.node, command.index), origin);
      return ok;
    }

    case "tree/remove": {
      const tree = readTree(doc);
      if (!tree) return fail("empty canvas");
      writeTree(doc, removeById(tree, command.id), origin);
      return ok;
    }

    case "tree/duplicate": {
      const tree = readTree(doc);
      if (!tree) return fail("empty canvas");
      writeTree(doc, duplicateById(tree, command.id), origin);
      return ok;
    }

    case "data/fetch":
    case "data/poll-start":
    case "data/poll-stop":
    case "form/submit":
      // Worker-bound commands run in-process here (used by dispatchBatch + tests);
      // the live dispatch() path prefers the worker pool (see below).
      void runDataCommand(doc, command);
      return ok;
  }
}

/** Validate + route a command to the active session doc. */
export function dispatch(command: unknown, origin: Origin = ORIGIN.local): DispatchResult {
  const parsed = commandSchema.safeParse(command);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const doc = getActiveDoc();
  if (!doc) return fail("no active document");
  // Worker-bound commands go to the pool (the heavy thread); fall back to in-process.
  if (WORKER_COMMANDS.has(parsed.data.type)) {
    const pool = getActivePool();
    if (pool) pool.enqueue(parsed.data);
    else void runDataCommand(doc, parsed.data);
    return ok;
  }
  return applyCommand(doc, parsed.data, origin);
}

/**
 * Dispatch several commands as ONE atomic transaction (one undo step). Yjs merges the
 * handlers' nested transactions into this outer one, so structure + data edits in the
 * same intent rewind together.
 */
export function dispatchBatch(commands: unknown[], origin: Origin = ORIGIN.local): DispatchResult {
  const parsed = commands.map((c) => commandSchema.safeParse(c));
  const bad = parsed.find((p) => !p.success);
  if (bad && !bad.success) return fail(bad.error.issues.map((i) => i.message).join("; "));
  const doc = getActiveDoc();
  if (!doc) return fail("no active document");
  let result: DispatchResult = ok;
  doc.transact(() => {
    for (const p of parsed) {
      if (p.success) {
        const r = applyCommand(doc, p.data, origin);
        if (!r.ok) result = r;
      }
    }
  }, origin);
  return result;
}
