/**
 * The Host interface — the swappable seam between the spine and the render target.
 *
 * The worker/doc is the source of truth; a Host APPLIES the resulting tree to some
 * target. The default Host is the React renderer (`src/components/Renderer.tsx`), which
 * reconciles real React bricks keyed by node id off Yjs observers (so DOM-measuring
 * libraries like recharts keep working on the main thread). Implementing these five
 * operations against a different target lets us drop in an alternative host later — e.g.
 * `@ampproject/worker-dom` for literal DOM-in-worker, a canvas/native renderer, or a
 * replacement chat surface — WITHOUT touching the engine or the bricks.
 *
 * A node is addressed by its stable composition id; props are resolved + structured-
 * clone-safe (no functions); child order lives in `childIds`.
 */
export interface HostNode {
  id: string;
  brick: string;
  props: Record<string, unknown>;
  childIds: string[];
  parentId: string | null;
}

export interface Host {
  /** Insert a node under `parentId` at `index`. */
  mount(node: HostNode, index: number): void;
  /** Shallow-update a mounted node's props (changed keys only). */
  patch(id: string, props: Record<string, unknown>): void;
  /** Reparent/reposition a node. */
  move(id: string, parentId: string | null, index: number): void;
  /** Reorder a parent's children. */
  order(parentId: string, childIds: string[]): void;
  /** Remove a node (and its subtree). */
  unmount(id: string): void;
}
