"use client";

/**
 * Compute where a drag would drop on the schematic canvas, with NESTING: the drop
 * target is whichever container (or leaf's parent) is under the pointer, so you can drop
 * INSIDE a container (div-in-div), not just append at the bottom. Returns the parent id +
 * insert index + an indicator rect (a line between children, or a box around an empty
 * container) the DropIndicator draws. Reuses `rectOf` for measurement.
 */
import { findById, findParent } from "@/bricks/tree";
import { rectOf } from "./useBrickRects";
import type { CompositionNode } from "@/bricks/composition";
import type { BrickDef } from "@/bricks/types";

export interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface DropTarget {
  parentId: string;
  index: number;
  indicator: { kind: "line" | "box"; rect: IndicatorRect };
}

/** Pure: insertion index + the y where the line sits, from children's vertical spans. */
export function indexFromRows(rows: { top: number; bottom: number }[], y: number): { index: number; lineY: number } {
  for (let i = 0; i < rows.length; i++) {
    const mid = (rows[i].top + rows[i].bottom) / 2;
    if (y < mid) return { index: i, lineY: rows[i].top };
  }
  const last = rows[rows.length - 1];
  return { index: rows.length, lineY: last ? last.bottom : 0 };
}

function elFor(id: string): HTMLElement | null {
  return typeof document === "undefined" ? null : document.querySelector<HTMLElement>(`[data-brick-id="${CSS.escape(id)}"]`);
}

export function computeDropTarget(
  x: number,
  y: number,
  tree: CompositionNode | null,
  registry: Map<string, BrickDef>,
): DropTarget | null {
  if (!tree?.id) return null;
  const acceptsChildren = (id: string) => {
    const n = findById(tree, id);
    return !!(n && registry.get(n.brick)?.acceptsChildren);
  };

  // Deepest brick element under the pointer (overlay layers have no data-brick-id → skipped).
  let hitId: string | null = null;
  for (const el of document.elementsFromPoint(x, y)) {
    const id = (el as HTMLElement).getAttribute?.("data-brick-id");
    if (id && findById(tree, id)) {
      hitId = id;
      break;
    }
  }

  // Resolve to a container: the hovered container itself, else the hovered leaf's parent,
  // else the root. Drop is always INTO a container at an index.
  let containerId: string;
  if (hitId && acceptsChildren(hitId)) containerId = hitId;
  else if (hitId) containerId = findParent(tree, hitId)?.id ?? tree.id;
  else containerId = tree.id;
  if (!acceptsChildren(containerId)) containerId = tree.id;

  const container = findById(tree, containerId);
  const containerEl = elFor(containerId);
  if (!container || !containerEl) return null;
  const c = rectOf(containerEl);
  const kids = container.children ?? [];

  if (kids.length === 0) {
    return { parentId: containerId, index: 0, indicator: { kind: "box", rect: { left: c.left, top: c.top, width: c.width, height: c.height } } };
  }
  const rows = kids.map((child) => {
    const el = child.id ? elFor(child.id) : null;
    const r = el ? rectOf(el) : null;
    return r ? { top: r.top, bottom: r.bottom } : { top: c.top, bottom: c.top };
  });
  const { index, lineY } = indexFromRows(rows, y);
  return {
    parentId: containerId,
    index,
    indicator: { kind: "line", rect: { left: c.left, top: lineY, width: c.width, height: 0 } },
  };
}
