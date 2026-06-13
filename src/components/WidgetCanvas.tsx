"use client";

/**
 * The canvas region that renders the current widget composition tree. Kept
 * agent-agnostic: it takes a `tree` and reports render status, so it can be
 * driven by agent state (the main page) or a static tree (the preview page).
 *
 * When the tree changes, the canvas gives a clear visual cue (a flash ring +
 * an "Updated" badge) so it's obvious WHEN new content lands.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Renderer } from "@/components/Renderer";
import { CursorLayer } from "@/collab/Cursors";
import { useStyleLayers } from "@/style/StyleLayers";
import { useMentionStore } from "@/state/mentionStore";
import { cn } from "@/lib/utils";
import type { CompositionNode } from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";

export interface WidgetCanvasProps {
  tree: CompositionNode | null;
  status?: RenderStatus | null;
  onStatus?: (status: RenderStatus) => void;
  /** Extra content rendered on the right of the header (e.g. presence). */
  headerExtra?: ReactNode;
  /** Apply a drag-to-rearrange reorder (transactional/undoable in the parent). */
  onMove?: (dragId: string, beforeId: string) => void;
}

function StatusPill({ status, updated }: { status: RenderStatus | null | undefined; updated: boolean }) {
  if (updated) {
    return <span className="text-xs font-medium text-emerald-600">✓ Updated just now</span>;
  }
  if (!status) {
    return <span className="text-xs text-[var(--muted-foreground)]">assembled from bricks</span>;
  }
  if (status.ok) {
    return <span className="text-xs font-medium text-emerald-600">● rendered</span>;
  }
  return (
    <span className="text-xs font-medium text-red-600">
      ● {status.stage} error ({status.errors.length})
    </span>
  );
}

export function WidgetCanvas({ tree, status, onStatus, headerExtra, onMove }: WidgetCanvasProps) {
  const { mergedVars } = useStyleLayers();
  const { selectMode, setSelectMode, targetId, selectElement, clearTarget } = useMentionStore();
  const prevKey = useRef<string>("");
  const [flash, setFlash] = useState(false);
  const [rearrange, setRearrange] = useState(false);

  // Click-to-target: in select mode, clicking a tagged element selects it
  // (queues an @id into the chat input + highlights it).
  const onCanvasClick = (e: React.MouseEvent) => {
    if (!selectMode) return;
    const el = (e.target as HTMLElement).closest("[data-brick-id]");
    const id = el?.getAttribute("data-brick-id");
    if (id) {
      e.preventDefault();
      e.stopPropagation();
      selectElement(id);
    }
  };

  // Flag a clear "just updated" cue whenever the rendered tree actually changes.
  useEffect(() => {
    const key = tree ? JSON.stringify(tree) : "";
    if (key && key !== prevKey.current) {
      const first = prevKey.current === "";
      prevKey.current = key;
      if (!first) {
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 1500);
        return () => clearTimeout(t);
      }
    }
  }, [tree]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
        <h1 className="text-sm font-semibold tracking-tight">Widget Canvas</h1>
        <div className="flex items-center gap-4">
          <StatusPill status={status} updated={flash} />
          {targetId && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs">
              <span className="font-mono text-[var(--primary)]">@{targetId}</span>
              <button onClick={clearTarget} className="text-[var(--muted-foreground)]">✕</button>
            </span>
          )}
          <button
            onClick={() => setSelectMode(!selectMode)}
            className={cn(
              "rounded-[var(--radius)] border px-2.5 py-1 text-xs font-medium",
              selectMode
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]",
            )}
            title="Click an element on the canvas to @-target it"
          >
            {selectMode ? "Click an element…" : "Target"}
          </button>
          {onMove && (
            <button
              onClick={() => setRearrange((r) => !r)}
              className={cn(
                "rounded-[var(--radius)] border px-2.5 py-1 text-xs font-medium",
                rearrange
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]",
              )}
              title="Drag elements to rearrange them"
            >
              {rearrange ? "Done rearranging" : "Rearrange"}
            </button>
          )}
          {headerExtra}
        </div>
      </div>
      {/* Highlight the targeted element's rendered root (contents wrapper child). */}
      {targetId && (
        <style>{`[data-brick-id="${targetId}"] > * { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--radius); }`}</style>
      )}
      <div className="flex-1 overflow-auto p-3">
        <div
          onClickCapture={onCanvasClick}
          className={cn(
            "widget-surface min-h-full rounded-[var(--radius)] p-3 transition-shadow duration-300",
            // Paint the themed palette so style layers (esp. full themes) are
            // visible: the surface takes the layer's background/foreground.
            "bg-[var(--background)] text-[var(--foreground)]",
            flash && "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]",
            selectMode && "cursor-crosshair",
          )}
          style={mergedVars as CSSProperties}
        >
          <CursorLayer>
            <div className={flash ? "animate-[brick-fade_400ms_ease]" : undefined}>
              <Renderer tree={tree} onStatus={onStatus} rearrange={rearrange} onMove={onMove} />
            </div>
          </CursorLayer>
        </div>
      </div>
    </div>
  );
}
