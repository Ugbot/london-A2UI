"use client";

/**
 * Draws where a drag will land: a glowing insertion LINE between children, or a BOX
 * highlight around an empty/target container (drop-inside). Fixed portal, pass-through.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import type { DropTarget } from "./useDropTarget";

export function DropIndicator({ target }: { target: DropTarget | null }) {
  if (!target || typeof document === "undefined") return null;
  const { kind, rect } = target.indicator;
  const style: React.CSSProperties =
    kind === "line"
      ? {
          position: "fixed",
          left: rect.left,
          top: rect.top - 1,
          width: rect.width,
          height: 2,
          background: "var(--accent-brand)",
          boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent-brand) 25%, transparent)",
          borderRadius: 2,
        }
      : {
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          outline: "2px dashed var(--accent-brand)",
          outlineOffset: -2,
          background: "color-mix(in srgb, var(--accent-brand) 8%, transparent)",
          borderRadius: "var(--radius)",
        };
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1003]">
      <div style={style} />
    </div>,
    document.body,
  );
}
