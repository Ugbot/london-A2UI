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
import { cn } from "@/lib/utils";
import type { CompositionNode } from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";

export interface WidgetCanvasProps {
  tree: CompositionNode | null;
  status?: RenderStatus | null;
  onStatus?: (status: RenderStatus) => void;
  /** Extra content rendered on the right of the header (e.g. presence). */
  headerExtra?: ReactNode;
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

export function WidgetCanvas({ tree, status, onStatus, headerExtra }: WidgetCanvasProps) {
  const { mergedVars } = useStyleLayers();
  const prevKey = useRef<string>("");
  const [flash, setFlash] = useState(false);

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
          {headerExtra}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div
          className={cn(
            "widget-surface min-h-full rounded-[var(--radius)] p-3 transition-shadow duration-300",
            flash && "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]",
          )}
          style={mergedVars as CSSProperties}
        >
          <CursorLayer>
            <div className={flash ? "animate-[brick-fade_400ms_ease]" : undefined}>
              <Renderer tree={tree} onStatus={onStatus} />
            </div>
          </CursorLayer>
        </div>
      </div>
    </div>
  );
}
