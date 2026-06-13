"use client";

/**
 * Hand-rolled SVG node/edge flow diagram. No external graph library — just
 * plain SVG, so there are no new deps and nothing that touches `window` at
 * import time (SSR-safe). Props are validated against `flowchartSchema` before
 * render.
 *
 * Coordinate model: node `x`/`y` are logical values in [0, 100] on both axes.
 * We size the SVG to `height` px tall and 100% wide, and use a fixed-width
 * viewBox so geometry is computed in stable user units while text stays a
 * sensible size (no non-uniform scaling — preserveAspectRatio is left at its
 * default so the aspect ratio is honored within the container).
 *
 * Render order matters: edges (lines + arrowheads) are drawn first so node
 * boxes sit on top of them; edge labels last so they read clearly.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import type { FlowChartProps } from "./schema";

// SVG user-unit canvas. Logical [0,100] coords map into an inset region so
// node boxes near the edges aren't clipped.
const VB_W = 1000;
const PAD = 70; // user-unit padding around the logical area
const NODE_W = 150;
const NODE_H = 56;
const ARROW_ID = "flowchart-arrow";

/** Map a logical coordinate in [0,100] to a user-unit coordinate on `span`. */
function project(value: number, span: number): number {
  const t = Math.max(0, Math.min(100, value)) / 100;
  return PAD + t * (span - 2 * PAD);
}

/**
 * Shorten a segment so the arrowhead lands on the node's box edge rather than
 * its center. Returns the point on the line at the box boundary of the target.
 */
function clipToBox(
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  halfW: number,
  halfH: number,
): [number, number] {
  const dx = tx - fx;
  const dy = ty - fy;
  if (dx === 0 && dy === 0) return [tx, ty];
  // Scale factor to reach the nearest box edge along the segment direction.
  const sx = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const sy = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const s = Math.min(sx, sy);
  return [tx - dx * s, ty - dy * s];
}

export function FlowChart({ nodes, edges, height }: FlowChartProps) {
  // viewBox height tracks the rendered aspect ratio so boxes aren't distorted.
  const vbH = React.useMemo(() => {
    // Keep a stable, non-degenerate ratio; clamp to a reasonable band.
    return Math.max(200, Math.min(1400, Math.round((VB_W * height) / 640)));
  }, [height]);

  // Resolve every node to its center in user units, keyed by id for edge lookup.
  const placed = React.useMemo(() => {
    const map = new Map<string, { cx: number; cy: number; label: string }>();
    for (const n of nodes) {
      map.set(n.id, {
        cx: project(n.x, VB_W),
        cy: project(n.y, vbH),
        label: n.label,
      });
    }
    return map;
  }, [nodes, vbH]);

  const halfW = NODE_W / 2;
  const halfH = NODE_H / 2;

  return (
    <div
      className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${vbH}`}
        width="100%"
        height="100%"
        role="img"
        aria-label="Flow diagram"
      >
        <defs>
          <marker
            id={ARROW_ID}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" />
          </marker>
        </defs>

        {/* Edges first, so node boxes overlay their endpoints. */}
        <g>
          {edges.map((e, i) => {
            const a = placed.get(e.from);
            const b = placed.get(e.to);
            if (!a || !b) return null; // skip dangling references
            const [ex, ey] = clipToBox(a.cx, a.cy, b.cx, b.cy, halfW, halfH);
            return (
              <line
                key={`edge-${i}`}
                x1={a.cx}
                y1={a.cy}
                x2={ex}
                y2={ey}
                stroke="var(--border)"
                strokeWidth={2}
                markerEnd={`url(#${ARROW_ID})`}
              />
            );
          })}
        </g>

        {/* Node boxes. */}
        <g>
          {nodes.map((n) => {
            const p = placed.get(n.id);
            if (!p) return null;
            return (
              <g key={`node-${n.id}`}>
                <rect
                  x={p.cx - halfW}
                  y={p.cy - halfH}
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  ry={12}
                  fill="var(--card)"
                  stroke="var(--primary)"
                  strokeWidth={2}
                />
                <text
                  x={p.cx}
                  y={p.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--foreground)"
                  fontSize={18}
                  fontWeight={500}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Edge labels last so they're legible above lines and boxes. */}
        <g>
          {edges.map((e, i) => {
            if (!e.label) return null;
            const a = placed.get(e.from);
            const b = placed.get(e.to);
            if (!a || !b) return null;
            const mx = (a.cx + b.cx) / 2;
            const my = (a.cy + b.cy) / 2;
            return (
              <text
                key={`edge-label-${i}`}
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--muted-foreground)"
                fontSize={15}
                className={cn("select-none")}
              >
                {e.label}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
