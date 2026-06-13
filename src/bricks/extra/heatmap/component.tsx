"use client";

/**
 * Hand-rolled grid heatmap. Renders a matrix of values as colored cells whose
 * opacity is scaled by each value's normalised magnitude across the whole
 * matrix. Column labels run across the top, row labels down the left.
 *
 * Props are validated against `heatmapSchema` before render, so this component
 * trusts its inputs. The matrix can be live-bound via `bindKey`, mirroring the
 * pattern used by the chart/table bricks in `src/bricks/components.tsx`.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { useElementData } from "@/state/hooks";
import type { HeatmapProps } from "./schema";

/** Parse a "#rgb"/"#rrggbb" hex string into r,g,b ints; falls back to indigo. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = Number.parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) {
    return { r: 99, g: 102, b: 241 }; // #6366f1
  }
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function Heatmap({ xLabels, yLabels, values, color, bindKey }: HeatmapProps) {
  const live = useElementData<HeatmapProps["values"] | undefined>(bindKey, undefined);
  const values_ = live ?? values;

  const { r, g, b } = React.useMemo(() => hexToRgb(color), [color]);

  // Min/max across every cell, so intensity is comparable matrix-wide.
  const { min, max } = React.useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const row of values_) {
      for (const v of row) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 0;
    }
    return { min: lo, max: hi };
  }, [values_]);

  const span = max - min;
  const intensity = (v: number) => (span === 0 ? 1 : (v - min) / span);

  // CSS grid: one leading column for y labels, then one per x label.
  const cols = xLabels.length;
  const gridTemplate = `minmax(3rem, max-content) repeat(${cols}, minmax(2.5rem, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] p-3">
      <div className="grid gap-1" style={{ gridTemplateColumns: gridTemplate }}>
        {/* Header row: empty corner + x labels */}
        <div aria-hidden className="px-1 py-1" />
        {xLabels.map((label, ci) => (
          <div
            key={`x-${ci}`}
            className="px-1 py-1 text-center text-[11px] font-medium text-[var(--muted-foreground)] truncate"
            title={label}
          >
            {label}
          </div>
        ))}

        {/* Body rows: y label + value cells */}
        {yLabels.map((yLabel, ri) => (
          <React.Fragment key={`row-${ri}`}>
            <div
              className="flex items-center justify-end pr-2 text-[11px] font-medium text-[var(--muted-foreground)] truncate"
              title={yLabel}
            >
              {yLabel}
            </div>
            {xLabels.map((_, ci) => {
              const v = values_[ri]?.[ci];
              const has = typeof v === "number" && Number.isFinite(v);
              const t = has ? intensity(v) : 0;
              // Keep a small floor so even the minimum cell is faintly tinted.
              const alpha = has ? 0.12 + 0.88 * t : 0;
              // Darken text once the fill is strong enough for contrast.
              const dark = t > 0.55;
              return (
                <div
                  key={`c-${ri}-${ci}`}
                  title={`${yLabel} · ${xLabels[ci]}: ${has ? v : "—"}`}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-[calc(var(--radius)/2)] text-[11px] tabular-nums",
                    dark ? "text-white" : "text-[var(--foreground)]",
                  )}
                  style={{
                    backgroundColor: has
                      ? `rgba(${r}, ${g}, ${b}, ${alpha})`
                      : "var(--muted)",
                  }}
                >
                  {has ? v : ""}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
