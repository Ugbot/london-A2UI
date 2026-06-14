/**
 * The canonical Yjs document model — the single source of truth ("the spine").
 *
 * ONE Y.Doc per session holds three top-level maps:
 *   - "canvas": the composition tree, stored FINE-GRAINED — a flat `nodes` map of
 *               id → { brick, props(Y.Map), children(Y.Array<id>) } plus a `root`
 *               pointer. Per-node + per-prop CRDT granularity means an edit emits a
 *               minimal observer delta (a single node re-renders), and collab merges
 *               at the node/prop level rather than clobbering the whole tree.
 *   - "data":   the live keyed read-model (what `useElementData` reads). Replaces the
 *               old standalone Zustand store as the source of truth, so data changes
 *               share the doc's history, rewind, and sync.
 *   - "derive": registered mortar derivations (key → source), run by the worker pool.
 *
 * Every mutation runs inside `doc.transact(fn, origin)` so a single user intent (which
 * may touch BOTH tree and data) groups into one atomic UndoManager step. The `origin`
 * tag scopes undo (only local/agent edits are tracked) and prevents echo loops between
 * the worker, remote peers, and the local user.
 */
import * as Y from "yjs";
import type { CompositionNode } from "@/bricks/composition";
import { ensureIds } from "@/bricks/tree";
import type { StreamAction } from "@/state/store";

/** Transaction origin tags. UndoManager tracks only `local`/`agent` (see hooks.ts). */
export const ORIGIN = {
  local: "local",
  agent: "agent",
  worker: "worker",
  remote: "remote",
} as const;
export type Origin = (typeof ORIGIN)[keyof typeof ORIGIN];

// ----- top-level accessors -------------------------------------------------

/** The canvas map: holds `root` (id) + `nodes` (flat Y.Map of node id → node Y.Map). */
export function getCanvas(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("canvas");
}
/** The keyed read-model map. */
export function getData(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("data");
}
/** Registered mortar derivations: key → { deps, source }. */
export function getDerive(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("derive");
}

/** The flat node store under the canvas map (lazily created). */
function getNodes(canvas: Y.Map<unknown>): Y.Map<Y.Map<unknown>> {
  let nodes = canvas.get("nodes") as Y.Map<Y.Map<unknown>> | undefined;
  if (!nodes) {
    nodes = new Y.Map();
    canvas.set("nodes", nodes);
  }
  return nodes;
}

// ----- tree: read ----------------------------------------------------------

/** Structural equality good enough for change detection (props are plain JSON). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function readNode(
  nodes: Y.Map<Y.Map<unknown>>,
  id: string,
  seen: Set<string>,
): CompositionNode | null {
  if (seen.has(id)) return null; // cycle guard
  seen.add(id);
  const nodeMap = nodes.get(id);
  if (!nodeMap) return null;
  const brick = nodeMap.get("brick") as string;
  const propsMap = nodeMap.get("props") as Y.Map<unknown> | undefined;
  const props = propsMap
    ? (Object.fromEntries(propsMap.entries()) as Record<string, unknown>)
    : {};
  const childArr = nodeMap.get("children") as Y.Array<string> | undefined;
  const childIds = childArr ? childArr.toArray() : [];
  const children = childIds
    .map((cid) => readNode(nodes, cid, seen))
    .filter((c): c is CompositionNode => c !== null);
  const node: CompositionNode = { brick, id, props };
  if (children.length > 0) node.children = children;
  return node;
}

/**
 * Read the current composition tree. Read-compatible with the OLD coarse format
 * (a single `widget` object) so previously-saved canvases still load; the first
 * write upgrades the doc to fine-grained (see {@link writeTree}).
 */
export function readTree(doc: Y.Doc): CompositionNode | null {
  const canvas = getCanvas(doc);
  const root = canvas.get("root") as string | undefined;
  if (root !== undefined) {
    if (root === "") return null;
    const nodes = canvas.get("nodes") as Y.Map<Y.Map<unknown>> | undefined;
    if (!nodes) return null;
    return readNode(nodes, root, new Set());
  }
  // Legacy fallback: coarse `widget` blob (read-only; not written back here).
  const legacy = canvas.get("widget") as CompositionNode | undefined;
  return legacy ?? null;
}

// ----- tree: write (reconcile into minimal granular deltas) ----------------

/** Write/update one node + recurse, touching only changed brick/props/children. */
function writeNode(nodes: Y.Map<Y.Map<unknown>>, node: CompositionNode): void {
  const id = node.id as string; // guaranteed by ensureIds upstream
  let nodeMap = nodes.get(id);
  if (!nodeMap) {
    nodeMap = new Y.Map();
    nodes.set(id, nodeMap);
  }
  if (nodeMap.get("brick") !== node.brick) nodeMap.set("brick", node.brick);

  // props — per-key reconcile (minimal deltas, per-prop CRDT granularity)
  let propsMap = nodeMap.get("props") as Y.Map<unknown> | undefined;
  if (!propsMap) {
    propsMap = new Y.Map();
    nodeMap.set("props", propsMap);
  }
  const nextProps = node.props ?? {};
  for (const k of [...propsMap.keys()]) {
    if (!(k in nextProps)) propsMap.delete(k);
  }
  for (const [k, v] of Object.entries(nextProps)) {
    if (!sameValue(propsMap.get(k), v)) propsMap.set(k, v);
  }

  // children — ordered id list; replace only when the order actually changed
  let childArr = nodeMap.get("children") as Y.Array<string> | undefined;
  if (!childArr) {
    childArr = new Y.Array();
    nodeMap.set("children", childArr);
  }
  const nextChildIds = (node.children ?? []).map((c) => c.id as string);
  const curChildIds = childArr.toArray();
  if (curChildIds.length !== nextChildIds.length ||
      curChildIds.some((c, i) => c !== nextChildIds[i])) {
    childArr.delete(0, childArr.length);
    if (nextChildIds.length) childArr.push(nextChildIds);
  }

  for (const child of node.children ?? []) writeNode(nodes, child);
}

/** Collect every id reachable from `root` so we can prune orphaned nodes. */
function reachableIds(node: CompositionNode | null, into: Set<string>): void {
  if (!node?.id) return;
  into.add(node.id);
  node.children?.forEach((c) => reachableIds(c, into));
}

/**
 * Reconcile the fine-grained Yjs tree to match `next`, emitting MINIMAL deltas
 * (only changed nodes/props/child-orders move; orphaned nodes are pruned). All
 * call sites already compute new immutable trees via `tree.ts` helpers and hand
 * the whole tree here, so they get granular CRDT deltas for free. Upgrades the
 * doc off the legacy coarse `widget` key on first write.
 */
export function writeTree(
  doc: Y.Doc,
  next: CompositionNode | null,
  origin: Origin = ORIGIN.local,
): void {
  doc.transact(() => {
    const canvas = getCanvas(doc);
    if (canvas.has("widget")) canvas.delete("widget"); // retire legacy format
    if (next === null) {
      canvas.set("root", "");
      const nodes = canvas.get("nodes") as Y.Map<Y.Map<unknown>> | undefined;
      if (nodes) [...nodes.keys()].forEach((k) => nodes.delete(k));
      return;
    }
    const withIds = ensureIds(next);
    const nodes = getNodes(canvas);
    writeNode(nodes, withIds);
    const keep = new Set<string>();
    reachableIds(withIds, keep);
    for (const id of [...nodes.keys()]) if (!keep.has(id)) nodes.delete(id);
    // Only touch `root` when it actually changes — Y.Map.set emits a delta even
    // for an identical value, which would pollute the minimal-delta guarantee.
    if (canvas.get("root") !== withIds.id) canvas.set("root", withIds.id as string);
  }, origin);
}

/**
 * Subscribe to ANY change in the composition tree (deep). Returns an unobserve fn.
 * Fires for granular node/prop edits as well as structural changes.
 */
export function observeTree(doc: Y.Doc, cb: () => void): () => void {
  const canvas = getCanvas(doc);
  const handler = () => cb();
  canvas.observeDeep(handler);
  return () => canvas.unobserveDeep(handler);
}

// ----- data: keyed read-model ----------------------------------------------

function asObject(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/**
 * Apply a {@link StreamAction} to the keyed data map (set/merge/append/remove) —
 * the same Turbo-Stream vocabulary the old Zustand store used, now folded into the
 * Yjs doc so data changes get history + rewind + sync.
 */
export function applyDataAction(
  doc: Y.Doc,
  action: StreamAction,
  origin: Origin = ORIGIN.local,
): void {
  doc.transact(() => {
    const data = getData(doc);
    const cur = data.get(action.target);
    switch (action.action) {
      case "set":
        data.set(action.target, action.value);
        break;
      case "merge":
        data.set(action.target, { ...asObject(cur), ...asObject(action.value) });
        break;
      case "append": {
        const arr = Array.isArray(cur) ? [...cur] : [];
        arr.push(action.value);
        data.set(action.target, arr);
        break;
      }
      case "remove":
        data.delete(action.target);
        break;
    }
  }, origin);
}

/** Read one keyed value from the read-model. */
export function readData(doc: Y.Doc, key: string): unknown {
  return getData(doc).get(key);
}

/** Snapshot the whole read-model as a plain object (e.g. for PWA export). */
export function readAllData(doc: Y.Doc): Record<string, unknown> {
  return Object.fromEntries(getData(doc).entries()) as Record<string, unknown>;
}

/**
 * Subscribe to changes for ONE key in the read-model (keyed pub/sub). The handler
 * fires only when that key changes, so a bound brick re-renders surgically.
 */
export function observeDataKey(doc: Y.Doc, key: string, cb: () => void): () => void {
  const data = getData(doc);
  const handler = (event: Y.YMapEvent<unknown>) => {
    if (event.keysChanged.has(key)) cb();
  };
  data.observe(handler);
  return () => data.unobserve(handler);
}
