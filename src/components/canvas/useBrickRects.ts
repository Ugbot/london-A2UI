"use client";

/**
 * Measure the viewport rects of specific `[data-brick-id]` elements so the
 * DesignerOverlay can draw selection/hover boxes WITHOUT wrapping nodes (which would
 * break the `display:contents` layout). Boxes are drawn `position:fixed` at these
 * viewport rects; we re-measure on scroll/resize and on any DOM mutation inside the
 * artboard (Yjs re-renders, recharts async sizing), all coalesced into one rAF.
 */
import * as React from "react";

/** Rect of an element; for a `display:contents` wrapper, the union of its children. */
export function rectOf(el: HTMLElement): DOMRect {
  if (getComputedStyle(el).display === "contents") {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const child of Array.from(el.children)) {
      const r = (child as HTMLElement).getBoundingClientRect();
      x1 = Math.min(x1, r.left);
      y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right);
      y2 = Math.max(y2, r.bottom);
    }
    if (x1 !== Infinity) return new DOMRect(x1, y1, x2 - x1, y2 - y1);
  }
  return el.getBoundingClientRect();
}

export function useBrickRects(
  ids: string[],
  surfaceRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): Map<string, DOMRect> {
  const [rects, setRects] = React.useState<Map<string, DOMRect>>(new Map());
  const idsKey = ids.join("|");

  React.useEffect(() => {
    if (!enabled || !idsKey) {
      setRects(new Map());
      return;
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const m = new Map<string, DOMRect>();
      for (const id of idsKey.split("|")) {
        const el = document.querySelector<HTMLElement>(`[data-brick-id="${CSS.escape(id)}"]`);
        if (el) m.set(id, rectOf(el));
      }
      setRects(m);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, true); // capture → inner scroll containers
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    const mo = new MutationObserver(schedule);
    const surface = surfaceRef.current;
    if (surface) {
      ro.observe(surface);
      mo.observe(surface, { subtree: true, childList: true, characterData: true, attributes: true });
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      mo.disconnect();
    };
  }, [idsKey, enabled, surfaceRef]);

  return rects;
}
