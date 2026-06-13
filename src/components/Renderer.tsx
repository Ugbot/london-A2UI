"use client";

/**
 * The recursive renderer — walks a CompositionNode tree and renders the
 * registered brick component for each node. This is the "assembly" half of
 * "bricks, not sand": no JSX is generated, only known bricks are instantiated.
 *
 * Reliability is layered here:
 *  - invalid trees never reach a component (validated against the registry);
 *  - runtime render errors are caught by an ErrorBoundary;
 *  - both outcomes are reported via `onStatus` to drive the agent repair loop.
 */
import * as React from "react";
import { registry } from "@/bricks/registry";
import {
  resolveProps,
  validateComposition,
  type CompositionNode,
} from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";

/** Canvas edit controls passed down to every node (drag-to-rearrange). */
interface RenderControls {
  rearrange: boolean;
  onMove?: (dragId: string, beforeId: string) => void;
}
const RenderControlsContext = React.createContext<RenderControls>({ rearrange: false });
const DRAG_MIME = "application/x-brick-id";

/** Render a single node and (if the brick accepts them) its children. */
function NodeRenderer({ node }: { node: CompositionNode }): React.ReactElement {
  const brick = registry.get(node.brick);
  if (!brick) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-800">
        Unknown brick <code className="font-mono">{node.brick}</code>
      </div>
    );
  }

  const props = resolveProps(node, registry);
  const Component = brick.Component;

  const rendered =
    brick.acceptsChildren && node.children?.length ? (
      <Component {...props}>
        {/* Key by the stable node id (fallback to index) so React reconciles
            surgically — moving/editing one brick won't remount its siblings, and
            undo/redo diffs cleanly. */}
        {node.children.map((child, i) => (
          <NodeRenderer key={child.id ?? i} node={child} />
        ))}
      </Component>
    ) : (
      <Component {...props} />
    );

  // Tag each addressable node for @-targeting (click-to-select + highlight).
  if (node.id) {
    const id = node.id;
    return <NodeWrapper id={id}>{rendered}</NodeWrapper>;
  }
  return rendered;
}

/**
 * Per-node wrapper. Normally `display:contents` (out of layout, so Grid/Stack are
 * intact). In rearrange mode it becomes a real draggable box with drop handling,
 * so dragging one brick onto another reorders/reparents it (transactional/undoable
 * via onMove). stopPropagation keeps drag/drop on the innermost element.
 */
function NodeWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { rearrange, onMove } = React.useContext(RenderControlsContext);
  const [over, setOver] = React.useState(false);

  if (!rearrange) {
    return (
      <div className="contents" data-brick-id={id}>
        {children}
      </div>
    );
  }
  return (
    <div
      data-brick-id={id}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData(DRAG_MIME, id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const dragId = e.dataTransfer.getData(DRAG_MIME);
        if (dragId && dragId !== id) onMove?.(dragId, id);
      }}
      className={
        "cursor-move rounded-[var(--radius)] outline-dashed outline-1 outline-[var(--border)] " +
        (over ? "outline-2 outline-[var(--primary)] bg-[var(--secondary)]" : "")
      }
    >
      {children}
    </div>
  );
}

interface BoundaryProps {
  onError?: (message: string) => void;
  children: React.ReactNode;
}

/** Catches runtime render errors so one bad brick can't blank the canvas. */
class RenderErrorBoundary extends React.Component<
  BoundaryProps,
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
  }

  render() {
    if (this.state.error !== null) {
      return (
        <div className="rounded-[var(--radius)] border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">This widget failed to render.</p>
          <p className="mt-1 font-mono text-xs opacity-80">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** A stable string identity for a tree, used to reset the error boundary. */
function treeKey(tree: CompositionNode | null): string {
  return tree ? JSON.stringify(tree) : "empty";
}

export interface RendererProps {
  tree: CompositionNode | null;
  /** Called whenever validation or rendering outcome changes. */
  onStatus?: (status: RenderStatus) => void;
  /** Drag-to-rearrange mode: elements become draggable boxes. */
  rearrange?: boolean;
  /** Apply a reorder (drag id → before id). */
  onMove?: (dragId: string, beforeId: string) => void;
}

/**
 * Top-level renderer: validates the tree against the registry, reports status,
 * and renders inside an error boundary that resets when the tree changes.
 */
export function Renderer({ tree, onStatus, rearrange = false, onMove }: RendererProps): React.ReactElement {
  const key = treeKey(tree);
  const result = React.useMemo(
    () => (tree ? validateComposition(tree, registry) : null),
    // re-validate whenever the serialized tree changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  React.useEffect(() => {
    if (!result) return;
    if (result.ok) onStatus?.({ ok: true });
    else onStatus?.({ ok: false, stage: "validate", errors: result.errors });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!tree || !result) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
        Ask the assistant to build a widget — it will appear here.
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Composition did not validate against the brick registry:</p>
        <ul className="mt-2 flex flex-col gap-1">
          {result.errors.map((e, i) => (
            <li key={i} className="font-mono text-xs">
              <span className="opacity-70">{e.path}</span>: {e.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <RenderErrorBoundary
      key={key}
      onError={(message) =>
        onStatus?.({ ok: false, stage: "render", errors: [{ path: "root", message }] })
      }
    >
      <RenderControlsContext.Provider value={{ rearrange, onMove }}>
        <NodeRenderer node={result.value} />
      </RenderControlsContext.Provider>
    </RenderErrorBoundary>
  );
}
