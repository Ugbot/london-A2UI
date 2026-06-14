"use client";

/**
 * The canvas region: a dark toolbar + a left tool dock framing a bright artboard
 * (Figma-style). The artboard is a white elevated card floating on a soft
 * backdrop; bricks render on the LIGHT tokens (never light-on-white). Interaction
 * mode (select / move) comes from the shared store and is surfaced by the dock +
 * a floating ModeHud.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Renderer } from "@/components/Renderer";
import { CursorLayer } from "@/collab/Cursors";
import { Toolbar } from "@/components/Toolbar";
import { ToolDock } from "@/components/ToolDock";
import { ModeHud } from "@/components/ModeHud";
import { useStyleLayers } from "@/style/StyleLayers";
import { useMentionStore } from "@/state/mentionStore";
import { cn } from "@/lib/utils";
import type { CompositionNode } from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";

export interface WidgetCanvasProps {
  tree: CompositionNode | null;
  status?: RenderStatus | null;
  onStatus?: (status: RenderStatus) => void;
  /** Report title shown in the toolbar. */
  title?: string;
  /** Action controls rendered on the right of the toolbar. */
  headerExtra?: ReactNode;
  /** Apply a drag-to-rearrange reorder (transactional/undoable in the parent). */
  onMove?: (dragId: string, beforeId: string) => void;
}

export function WidgetCanvas({ tree, status, onStatus, title = "Untitled report", headerExtra, onMove }: WidgetCanvasProps) {
  const { mergedVars } = useStyleLayers();
  const mode = useMentionStore((s) => s.mode);
  const setMode = useMentionStore((s) => s.setMode);
  const targetId = useMentionStore((s) => s.targetId);
  const selectElement = useMentionStore((s) => s.selectElement);
  const clearTarget = useMentionStore((s) => s.clearTarget);
  const selectMode = mode === "select";
  const moveMode = mode === "move";
  const prevKey = useRef<string>("");
  const [flash, setFlash] = useState(false);

  // Click-to-target in Select mode → queue an @mention + highlight.
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

  // Esc exits the current mode.
  useEffect(() => {
    if (mode === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, setMode]);

  // Flag a "just updated" cue whenever the rendered tree actually changes.
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
      <Toolbar
        title={title}
        status={status}
        updated={flash}
        right={
          <div className="flex items-center gap-1.5">
            {targetId && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs">
                <span className="font-mono text-[var(--primary-foreground)]">@{targetId}</span>
                <button onClick={clearTarget} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
              </span>
            )}
            {headerExtra}
          </div>
        }
      />

      {/* Highlight the targeted element's rendered root. */}
      {targetId && (
        <style>{`[data-brick-id="${targetId}"] > * { outline: 2px solid var(--accent-brand); outline-offset: 2px; border-radius: var(--radius); }`}</style>
      )}

      <div className="flex min-h-0 flex-1">
        <ToolDock />
        <div
          onClickCapture={onCanvasClick}
          className={cn(
            "relative flex-1 overflow-auto p-8 transition-colors",
            moveMode ? "bg-[var(--accent)]/40" : "",
            selectMode && "cursor-crosshair",
          )}
          style={{ backgroundColor: moveMode ? undefined : "var(--canvas-backdrop)" }}
        >
          <ModeHud />
          {/* The artboard: a white elevated card the widget renders into. */}
          <div
            className={cn(
              "widget-surface mx-auto min-h-[60vh] max-w-5xl rounded-[var(--radius-xl)] bg-[var(--background)] p-6 text-[var(--foreground)] shadow-[0_8px_40px_rgba(0,0,0,0.10)] ring-1 ring-black/5 transition-shadow duration-300",
              flash && "ring-2 ring-[var(--accent-brand)]",
            )}
            style={mergedVars as CSSProperties}
          >
            <CursorLayer>
              <div className={flash ? "animate-[brick-fade_400ms_ease]" : undefined}>
                <Renderer tree={tree} onStatus={onStatus} rearrange={moveMode} onMove={onMove} />
              </div>
            </CursorLayer>
          </div>
        </div>
      </div>
    </div>
  );
}
