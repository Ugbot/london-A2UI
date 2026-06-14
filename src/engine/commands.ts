/**
 * The CQRS command vocabulary — the ONLY way the UI mutates the spine.
 *
 * A Command is a typed intent. `dispatch()` (dispatch.ts) routes each to a handler
 * that mutates the Yjs doc inside a transaction; the "event" side is purely Yjs
 * observers (no separate event bus for state). Commands are Zod-validated so the
 * agent's `send`-style tools and cross-thread messages can't inject malformed input.
 *
 * This union grows by phase: Phase 1 covers data/derive/tree edits; Phase 2 adds the
 * worker-owned data/fetch · data/poll · form/submit; Phase 3 adds history/*.
 */
import { z } from "zod";
import { compositionNodeSchema } from "@/bricks/composition";

const streamActionType = z.enum(["set", "merge", "append", "remove"]);

/** Write a value into the keyed read-model (ActionButton, agent stream, inputs). */
const dataSet = z.object({
  type: z.literal("data/set"),
  action: streamActionType.default("set"),
  target: z.string().min(1),
  value: z.unknown().optional(),
});

/** Register a mortar derivation: recompute `key` from `deps` via the TS `source`. */
const deriveRegister = z.object({
  type: z.literal("derive/register"),
  key: z.string().min(1),
  deps: z.array(z.string()),
  source: z.string().min(1),
});
const deriveUnregister = z.object({
  type: z.literal("derive/unregister"),
  key: z.string().min(1),
});

/** Replace the whole composition tree (render_widget / full restructure). */
const treeRender = z.object({
  type: z.literal("tree/render"),
  tree: compositionNodeSchema,
});
/** Shallow-merge props and/or swap the brick type of one node. */
const treePatch = z.object({
  type: z.literal("tree/patch"),
  id: z.string().min(1),
  setProps: z.record(z.unknown()).optional(),
  brick: z.string().optional(),
});
/** Move a node to sit before/after a sibling target (drag-to-rearrange). */
const treeMove = z.object({
  type: z.literal("tree/move"),
  dragId: z.string().min(1),
  targetId: z.string().min(1),
  position: z.enum(["before", "after"]).default("before"),
});
/** Replace a node (and its subtree) with a new node (wireframe completion). */
const treeReplace = z.object({
  type: z.literal("tree/replace"),
  id: z.string().min(1),
  node: compositionNodeSchema,
});
/** Insert a child under a parent at an optional index. */
const treeInsert = z.object({
  type: z.literal("tree/insert"),
  parentId: z.string().min(1),
  node: compositionNodeSchema,
  index: z.number().int().nonnegative().optional(),
});
const treeRemove = z.object({ type: z.literal("tree/remove"), id: z.string().min(1) });
const treeDuplicate = z.object({ type: z.literal("tree/duplicate"), id: z.string().min(1) });

/**
 * A data source: a proxied connection/endpoint (default, secrets stay server-side) OR
 * a direct public URL. The worker POSTs this to /api/proxy (or fetches `url` directly).
 */
export const dataSourceSchema = z.object({
  mode: z.enum(["proxy", "direct"]).default("proxy"),
  connectionId: z.string().optional(),
  endpointId: z.string().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});
export type DataSourceSpec = z.infer<typeof dataSourceSchema>;

// --- Worker-bound commands (run in the fetch worker; results sync back via Yjs) ---

/** One-shot fetch: load `source` → jsonPath → optional mortar transform → key. */
const dataFetch = z.object({
  type: z.literal("data/fetch"),
  key: z.string().min(1),
  source: dataSourceSchema,
  jsonPath: z.string().optional(),
  transform: z.string().optional(),
});
/** Start polling `source` into `key` every intervalMs (worker owns the timer). */
const dataPollStart = z.object({
  type: z.literal("data/poll-start"),
  key: z.string().min(1),
  source: dataSourceSchema,
  jsonPath: z.string().optional(),
  transform: z.string().optional(),
  intervalMs: z.number().int().positive(),
});
const dataPollStop = z.object({ type: z.literal("data/poll-stop"), key: z.string().min(1) });
/** Assemble bound form fields → submit → write response → refetch datasets. */
const formSubmit = z.object({
  type: z.literal("form/submit"),
  source: dataSourceSchema,
  fieldsPrefix: z.string(),
  responseKey: z.string().optional(),
  refetchKeys: z.array(z.string()).optional(),
});

export const commandSchema = z.discriminatedUnion("type", [
  dataSet,
  deriveRegister,
  deriveUnregister,
  treeRender,
  treePatch,
  treeMove,
  treeReplace,
  treeInsert,
  treeRemove,
  treeDuplicate,
  dataFetch,
  dataPollStart,
  dataPollStop,
  formSubmit,
]);

/** Commands handled by the worker pool (everything else applies on the main doc). */
export const WORKER_COMMANDS: ReadonlySet<string> = new Set([
  "data/fetch",
  "data/poll-start",
  "data/poll-stop",
  "form/submit",
]);

export type Command = z.infer<typeof commandSchema>;
export type CommandType = Command["type"];
