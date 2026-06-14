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
import { ViewToggle } from "@/components/ViewToggle";
import { RenderedView } from "@/components/RenderedView";
import { useViewStore } from "@/state/viewStore";
import { ModeHud } from "@/components/ModeHud";
import { Inspector } from "@/components/Inspector";
import { DesignerOverlay } from "@/components/canvas/DesignerOverlay";
import { findById } from "@/bricks/tree";
import { primaryTextProps } from "@/bricks/text-props";
import { useStyleLayers } from "@/style/StyleLayers";
import { useMentionStore } from "@/state/mentionStore";
import { useSelectionStore } from "@/state/selectionStore";
import { dispatch } from "@/engine/dispatch";
import { cn } from "@/lib/utils";
import type { CompositionNode } from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";

/** Resolve a click/hover target element to its nearest addressable brick id. */
function brickIdAt(target: EventTarget | null): string | null {
  const el = (target as HTMLElement | null)?.closest?.("[data-brick-id]");
  return el?.getAttribute("data-brick-id") ?? null;
}

export interface WidgetCanvasProps {
  tree: CompositionNode | null;
  status?: RenderStatus | null;
  onStatus?: (status: RenderStatus) => void;
  /** Report title shown in the toolbar. */
  title?: string;
  /** Action controls rendered on the right of the toolbar. */
  headerExtra?: ReactNode;
  /** Apply a drag-to-rearrange reorder (transactional/undoable in the parent). */
  onMove?: (dragId: string, targetId: string, position: "before" | "after") => void;
  /** Apply style tokens to an element (transactional/undoable in the parent). */
  onSetSx?: (id: string, sx: string[]) => void;
}

export function WidgetCanvas({ tree, status, onStatus, title = "Untitled report", headerExtra, onMove, onSetSx }: WidgetCanvasProps) {
  const { mergedVars } = useStyleLayers();
  const moveMode = useMentionStore((s) => s.mode === "move");
  const mentionElement = useMentionStore((s) => s.mentionElement);

  const selectedId = useSelectionStore((s) => s.selectedId);
  const editingId = useSelectionStore((s) => s.editingId);
  const select = useSelectionStore((s) => s.select);
  const enterEdit = useSelectionStore((s) => s.enterEdit);
  const exitEdit = useSelectionStore((s) => s.exitEdit);
  const clear = useSelectionStore((s) => s.clear);
  const setHover = useSelectionStore((s) => s.setHover);

  const selectedNode = selectedId ? findById(tree, selectedId) : null;
  const prevKey = useRef<string>("");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);

  // Schematic is the WYSIWYG editor: clicking selects (no tool needed). We select on
  // capture but do NOT stop propagation, so interactive bricks still receive the click.
  // Double-click enters inline text editing. Move mode (drag tool) suspends selection.
  const onCanvasClick = (e: React.MouseEvent) => {
    if (moveMode) return;
    const id = brickIdAt(e.target);
    if (id) select(id);
    else clear(); // click on empty artboard deselects
  };
  const onCanvasDoubleClick = (e: React.MouseEvent) => {
    if (moveMode) return;
    const id = brickIdAt(e.target);
    if (!id) return;
    const node = findById(tree, id);
    if (node && primaryTextProps(node.brick).length > 0) {
      e.preventDefault();
      e.stopPropagation();
      enterEdit(id);
    }
  };
  const onCanvasOver = (e: React.MouseEvent) => {
    if (moveMode) return;
    setHover(brickIdAt(e.target));
  };

  // Keyboard: Esc exits edit then clears; Delete removes the selection — but never
  // while typing (inline edit, an input/textarea, or the chat composer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const typing =
        editingId !== null ||
        (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable));
      if (e.key === "Escape") {
        if (editingId) exitEdit();
        else if (selectedId) clear();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !typing) {
        e.preventDefault();
        dispatch({ type: "tree/remove", id: selectedId });
        clear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, selectedId, exitEdit, clear]);

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

  const viewMode = useViewStore((s) => s.mode);
  const showSchematic = viewMode !== "rendered";
  const showRendered = viewMode !== "schematic";

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        title={title}
        status={status}
        updated={flash}
        right={
          <div className="flex items-center gap-1.5">
            <ViewToggle />
            {selectedId && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs">
                <span className="font-mono text-[var(--primary-foreground)]">@{selectedId}</span>
                <button
                  onClick={() => mentionElement(selectedId)}
                  title="Mention this element in chat"
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  @
                </button>
                <button onClick={clear} title="Deselect" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
              </span>
            )}
            {headerExtra}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Schematic: the editable canvas (select/drag/inspector). */}
        {showSchematic && (
          <div className="flex min-w-0 flex-1">
            <ToolDock />
            <div
              onClickCapture={onCanvasClick}
              onDoubleClick={onCanvasDoubleClick}
              onMouseOver={onCanvasOver}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "relative flex-1 overflow-auto p-8 transition-colors",
                moveMode ? "bg-[var(--accent)]/40" : "",
              )}
              style={{ backgroundColor: moveMode ? undefined : "var(--canvas-backdrop)" }}
            >
              <ModeHud />
              {selectedNode && onSetSx && (
                <Inspector
                  node={selectedNode}
                  onSetSx={(sx) => onSetSx(selectedNode.id!, sx)}
                  onClose={clear}
                />
              )}
              {/* Designer chrome: hover/selection boxes, label, handles, quick actions
                  (rect-measured, schematic-only — never in the rendered iframe). */}
              <DesignerOverlay tree={tree} surfaceRef={surfaceRef} />
              {/* The artboard: a white elevated card the widget renders into. */}
              <div
                ref={surfaceRef}
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
        )}
        {/* Rendered: the live target app in an isolated iframe (read-only web view). */}
        {showRendered && (
          <div className={cn("min-w-0 flex-1", showSchematic && "border-l border-[var(--border)]")}>
            <RenderedView />
          </div>
        )}
      </div>
    </div>
  );
}
