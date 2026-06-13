"use client";

/**
 * Live multiplayer cursors. Each client broadcasts its pointer position over
 * the canvas (normalized 0-1) via Yjs awareness; peers' cursors are rendered as
 * coloured arrows with names. Normalizing to the surface keeps cursors aligned
 * across different viewport sizes.
 */
import * as React from "react";
import { useCollab } from "./provider";

interface RemoteCursor {
  id: number;
  x: number;
  y: number;
  name: string;
  color: string;
}

export function CursorLayer({ children }: { children: React.ReactNode }) {
  const { provider } = useCollab();
  const ref = React.useRef<HTMLDivElement>(null);
  const [peers, setPeers] = React.useState<RemoteCursor[]>([]);

  // Broadcast local cursor position relative to this surface.
  React.useEffect(() => {
    const el = ref.current;
    if (!provider || !el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      provider.awareness.setLocalStateField("cursor", {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      });
    };
    const onLeave = () => provider.awareness.setLocalStateField("cursor", null);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [provider]);

  // Track peers' cursors.
  React.useEffect(() => {
    if (!provider) return;
    const aw = provider.awareness;
    const update = () => {
      const out: RemoteCursor[] = [];
      aw.getStates().forEach((state, id) => {
        if (id === aw.clientID) return;
        const c = (state as { cursor?: { x: number; y: number } }).cursor;
        const u = (state as { user?: { name: string; color: string } }).user;
        if (c && u) out.push({ id, x: c.x, y: c.y, name: u.name, color: u.color });
      });
      setPeers(out);
    };
    update();
    aw.on("change", update);
    return () => aw.off("change", update);
  }, [provider]);

  return (
    <div ref={ref} className="relative h-full w-full">
      {children}
      {peers.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none absolute z-50 flex items-center"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            transition: "left 80ms linear, top 80ms linear",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={p.color} aria-hidden>
            <path d="M3 2l6.5 18 2.4-7.1L19 10.5z" />
          </svg>
          <span
            className="ml-1 rounded px-1 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.name}
          </span>
        </div>
      ))}
    </div>
  );
}
