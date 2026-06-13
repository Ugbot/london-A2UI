/**
 * Pure composition-tree utilities for in-place editing and @-targeting.
 * Every node may carry a stable `id`; these helpers index, find, patch, remove,
 * duplicate, and insert by id, returning NEW trees (immutable) for React state.
 */
import type { CompositionNode } from "./composition";

/** A flat, addressable reference to an element in the tree. */
export interface ElementRef {
  id: string;
  brick: string;
  label: string;
}

const clone = (n: CompositionNode): CompositionNode =>
  JSON.parse(JSON.stringify(n)) as CompositionNode;

/** Human-friendly label for an element (best-effort from common props). */
export function labelOf(node: CompositionNode): string {
  const p = node.props ?? {};
  const candidate = p.title ?? p.label ?? p.text ?? p.heading ?? p.name;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.length > 32 ? candidate.slice(0, 31) + "…" : candidate;
  }
  return node.brick;
}

/** Flat list of every node that has an id (for @-mentions + agent context). */
export function indexElements(tree: CompositionNode | null): ElementRef[] {
  const out: ElementRef[] = [];
  const walk = (n: CompositionNode) => {
    if (n.id) out.push({ id: n.id, brick: n.brick, label: labelOf(n) });
    n.children?.forEach(walk);
  };
  if (tree) walk(tree);
  return out;
}

/** Slugify a brick name into an id stem. */
function stem(brick: string): string {
  return brick.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Assign stable ids to any node missing one (and de-duplicate collisions), so
 * every element is addressable. Returns a new tree; existing ids are preserved.
 */
export function ensureIds(tree: CompositionNode): CompositionNode {
  const used = new Set<string>();
  const counters: Record<string, number> = {};
  const next = (brick: string): string => {
    const s = stem(brick);
    let n = counters[s] ?? 0;
    let id = `${s}-${n + 1}`;
    while (used.has(id)) {
      n += 1;
      id = `${s}-${n + 1}`;
    }
    counters[s] = n + 1;
    return id;
  };
  const walk = (node: CompositionNode): CompositionNode => {
    let id = node.id;
    if (!id || used.has(id)) id = next(node.brick);
    used.add(id);
    return {
      ...node,
      id,
      children: node.children?.map(walk),
    };
  };
  return walk(clone(tree));
}

/** Find a node by id (returns the live reference within `tree`). */
export function findById(tree: CompositionNode | null, id: string): CompositionNode | null {
  if (!tree) return null;
  if (tree.id === id) return tree;
  for (const child of tree.children ?? []) {
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return null;
}

export interface NodePatch {
  /** Shallow-merge into props. */
  setProps?: Record<string, unknown>;
  /** Swap the brick type (props carried over unless replaced by setProps). */
  brick?: string;
  /** Replace children entirely. */
  children?: CompositionNode[];
}

/** Return a new tree with the node at `id` patched. No-op if id not found. */
export function patchById(
  tree: CompositionNode,
  id: string,
  patch: NodePatch,
): CompositionNode {
  const walk = (node: CompositionNode): CompositionNode => {
    if (node.id === id) {
      return {
        ...node,
        brick: patch.brick ?? node.brick,
        props: { ...node.props, ...(patch.setProps ?? {}) },
        children: patch.children ?? node.children,
      };
    }
    return { ...node, children: node.children?.map(walk) };
  };
  return walk(clone(tree));
}

/** Return a new tree with the node at `id` removed (root removal → null). */
export function removeById(tree: CompositionNode, id: string): CompositionNode | null {
  if (tree.id === id) return null;
  const walk = (node: CompositionNode): CompositionNode => ({
    ...node,
    children: node.children?.filter((c) => c.id !== id).map(walk),
  });
  return walk(clone(tree));
}

/** Return a new tree with the node at `id` duplicated as its next sibling. */
export function duplicateById(tree: CompositionNode, id: string): CompositionNode {
  const t = clone(tree);
  const used = new Set<string>(indexElements(t).map((e) => e.id));
  const freshId = (base: string) => {
    let i = 2;
    let cand = `${base}-copy`;
    while (used.has(cand)) cand = `${base}-copy-${i++}`;
    used.add(cand);
    return cand;
  };
  const reId = (node: CompositionNode): CompositionNode => ({
    ...node,
    id: node.id ? freshId(node.id) : undefined,
    children: node.children?.map(reId),
  });
  const walk = (node: CompositionNode): CompositionNode => {
    if (!node.children) return node;
    const children: CompositionNode[] = [];
    for (const c of node.children) {
      children.push(walk(c));
      if (c.id === id) children.push(reId(clone(c)));
    }
    return { ...node, children };
  };
  return walk(t);
}

/** Return a new tree with `child` inserted under `parentId` (at end, or index). */
export function insertChild(
  tree: CompositionNode,
  parentId: string,
  child: CompositionNode,
  index?: number,
): CompositionNode {
  const walk = (node: CompositionNode): CompositionNode => {
    if (node.id === parentId) {
      const kids = [...(node.children ?? [])];
      kids.splice(index ?? kids.length, 0, child);
      return { ...node, children: kids };
    }
    return { ...node, children: node.children?.map(walk) };
  };
  return walk(clone(tree));
}
