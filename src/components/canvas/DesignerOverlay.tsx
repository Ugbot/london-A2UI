"use client";

/**
 * Designer chrome for the schematic editor — drawn as a single fixed overlay that
 * MEASURES element rects (never wraps nodes, so `display:contents` layout is intact).
 * Focused style: a faint outline + label on hover, a strong box + label + corner
 * handles + a quick-action toolbar on the selection. Pass-through (pointer-events:none)
 * except the handles + toolbar. Schematic-only: WidgetCanvas mounts it only in the
 * schematic pane, so the rendered iframe never gets editor chrome.
 *
 * Handles are drawn now and become functional (resize) in the rescale step.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { findById } from "@/bricks/tree";
import { useSelectionStore } from "@/state/selectionStore";
import { dispatch } from "@/engine/dispatch";
import { useBrickRects } from "./useBrickRects";
import { SelectionToolbar } from "./SelectionToolbar";
import type { CompositionNode } from "@/bricks/composition";

const HANDLE_POSITIONS = [
  { x: 0, y: 0, c: "nwse-resize" },
  { x: 0.5, y: 0, c: "ns-resize" },
  { x: 1, y: 0, c: "nesw-resize" },
  { x: 1, y: 0.5, c: "ew-resize" },
  { x: 1, y: 1, c: "nwse-resize" },
  { x: 0.5, y: 1, c: "ns-resize" },
  { x: 0, y: 1, c: "nesw-resize" },
  { x: 0, y: 0.5, c: "ew-resize" },
];

export function DesignerOverlay({
  tree,
  surfaceRef,
}: {
  tree: CompositionNode | null;
  surfaceRef: React.RefObject<HTMLElement | null>;
}) {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const editingId = useSelectionStore((s) => s.editingId);
  const hoverId = useSelectionStore((s) => s.hoverId);

  const ids = React.useMemo(() => {
    const set = new Set<string>();
    if (selectedId) set.add(selectedId);
    if (hoverId && hoverId !== selectedId) set.add(hoverId);
    return [...set];
  }, [selectedId, hoverId]);

  const rects = useBrickRects(ids, surfaceRef, ids.length > 0);

  // Live resize preview (committed to CSS width/height on release).
  const [preview, setPreview] = React.useState<{ w: number; h: number } | null>(null);

  const rawSelRect = selectedId ? rects.get(selectedId) : undefined;
  const hovRect = hoverId && hoverId !== selectedId ? rects.get(hoverId) : undefined;
  const selNode = selectedId ? findById(tree, selectedId) : null;
  // Effective selection rect uses the live preview size while resizing.
  const selRect =
    rawSelRect && preview
      ? new DOMRect(rawSelRect.x, rawSelRect.y, preview.w, preview.h)
      : rawSelRect;

  const startResize = (e: React.PointerEvent, hx: number, hy: number) => {
    if (!rawSelRect || !selectedId || !selNode) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: rawSelRect.width, h: rawSelRect.height };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      const w = Math.max(16, start.w + (hx === 1 ? dx : hx === 0 ? -dx : 0));
      const h = Math.max(16, start.h + (hy === 1 ? dy : hy === 0 ? -dy : 0));
      setPreview({ w, h });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPreview((p) => {
        if (p) {
          const prevStyle = ((selNode.props as { style?: Record<string, unknown> }).style) ?? {};
          dispatch({
            type: "tree/patch",
            id: selectedId,
            setProps: { style: { ...prevStyle, width: Math.round(p.w), height: Math.round(p.h) } },
          });
        }
        return null;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (typeof document === "undefined") return null;

  const box = (rect: DOMRect): React.CSSProperties => ({
    position: "fixed",
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  });

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1001]">
      {/* hover outline */}
      {hovRect && (
        <div
          style={{ ...box(hovRect), outline: "1px solid var(--accent-brand)", opacity: 0.5, borderRadius: "var(--radius)" }}
        />
      )}

      {/* selection box + label + handles (hidden while inline-editing text) */}
      {selRect && selNode && !editingId && (
        <>
          <div
            style={box(selRect)}
            className="rounded-[var(--radius)] outline outline-2 outline-[var(--accent-brand)]"
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded-t bg-[var(--accent-brand)] px-1.5 text-[10px] font-medium leading-[18px] text-white">
              {selNode.brick} · @{selNode.id}
            </span>
          </div>
          {HANDLE_POSITIONS.map((h, i) => (
            <div
              key={i}
              onPointerDown={(e) => startResize(e, h.x, h.y)}
              className="pointer-events-auto fixed z-[1002] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[var(--accent-brand)] bg-white"
              style={{
                top: selRect.top + h.y * selRect.height,
                left: selRect.left + h.x * selRect.width,
                cursor: h.c,
              }}
            />
          ))}
          <SelectionToolbar id={selNode.id!} brick={selNode.brick} rect={selRect} />
        </>
      )}
    </div>,
    document.body,
  );
}
