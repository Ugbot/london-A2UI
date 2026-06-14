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
import { resolveSx } from "@/bricks/style-tokens";
import { BrickIdContext } from "@/bricks/contract-hooks";
import { cn } from "@/lib/utils";
import type { RenderStatus } from "@/lib/types";

/** Canvas edit controls passed down to every node (drag-to-rearrange). */
interface RenderControls {
  rearrange: boolean;
  onMove?: (dragId: string, targetId: string, position: "before" | "after") => void;
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

  // The universal style system: `sx` (tokens) + `style` (inline) apply to the
  // wrapper, not the brick component — strip them before spreading props.
  const { sx, style, ...props } = resolveProps(node, registry) as Record<string, unknown> & {
    sx?: unknown;
    style?: React.CSSProperties;
  };
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

  // Provide the node id to the brick so contracted bricks self-identify (commands/
  // events are addressed by this id) without leaking it into their typed props.
  const inner = node.id ? (
    <BrickIdContext.Provider value={node.id}>{rendered}</BrickIdContext.Provider>
  ) : (
    rendered
  );

  const sxClass = resolveSx(sx);
  // Wrap when the node is addressable (@-target) or carries styles.
  if (node.id || sxClass || style) {
    return (
      <NodeWrapper id={node.id} sxClass={sxClass} style={style}>
        {inner}
      </NodeWrapper>
    );
  }
  return inner;
}

/**
 * Per-node wrapper. Normally `display:contents` (out of layout, so Grid/Stack are
 * intact). In rearrange mode it becomes a real draggable box with drop handling,
 * so dragging one brick onto another reorders/reparents it (transactional/undoable
 * via onMove). stopPropagation keeps drag/drop on the innermost element.
 */
function NodeWrapper({
  id,
  sxClass = "",
  style,
  children,
}: {
  id?: string;
  sxClass?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { rearrange, onMove } = React.useContext(RenderControlsContext);
  const [edge, setEdge] = React.useState<"top" | "bottom" | null>(null);
  const [dragging, setDragging] = React.useState(false);

  // Rearrange mode + addressable → a draggable box with insertion-line drop.
  if (rearrange && id) {
    const line =
      "pointer-events-none absolute left-0 right-0 h-0.5 rounded-full bg-[var(--accent-brand)] shadow-[0_0_0_2px_rgba(99,102,241,0.25)]";
    return (
      <div
        data-brick-id={id}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData(DRAG_MIME, id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setEdge(e.clientY < r.top + r.height / 2 ? "top" : "bottom");
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setEdge(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const dragId = e.dataTransfer.getData(DRAG_MIME);
          const pos = edge === "bottom" ? "after" : "before";
          setEdge(null);
          if (dragId && dragId !== id) onMove?.(dragId, id, pos);
        }}
        style={style}
        className={cn(
          "group relative rounded-[var(--radius)] outline-dashed outline-1 outline-[var(--border)] transition-[outline] hover:outline-[var(--accent-brand)]",
          dragging && "opacity-50",
          sxClass,
        )}
      >
        <span className="pointer-events-none absolute -left-2 top-1 z-10 hidden rounded bg-[var(--accent-brand)] px-1 text-[10px] leading-4 text-white shadow group-hover:block">
          ⠿
        </span>
        {edge === "top" && <span className={line} style={{ top: -1 }} />}
        {edge === "bottom" && <span className={line} style={{ bottom: -1 }} />}
        {children}
      </div>
    );
  }

  // Styled box (sx tokens / inline style) — a real box so styles apply.
  if (sxClass || style) {
    return (
      <div data-brick-id={id} className={sxClass} style={style}>
        {children}
      </div>
    );
  }

  // Addressable only → display:contents wrapper (out of layout).
  return (
    <div className="contents" data-brick-id={id}>
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
  /** Apply a reorder (drag id → target id, before/after). */
  onMove?: (dragId: string, targetId: string, position: "before" | "after") => void;
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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--accent-brand)]/10 text-2xl">
          ✨
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--foreground)]">Describe what to build</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your live preview renders here. Tell the assistant what you want.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[
            "a crypto dashboard with live prices",
            "a signup form",
            "a list of posts from an API",
          ].map((s) => (
            <span
              key={s}
              className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs text-[var(--muted-foreground)]"
            >
              {s}
            </span>
          ))}
        </div>
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
