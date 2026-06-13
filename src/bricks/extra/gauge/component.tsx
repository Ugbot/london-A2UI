"use client";

/**
 * Hand-rolled SVG radial gauge (180° semicircle arc). The background arc is
 * drawn in var(--secondary); the value arc in var(--primary), revealed via
 * stroke-dasharray on the same arc path. Props are validated against
 * `gaugeSchema` before render. Supports live values via `bindKey`, following
 * the same pattern as the ProgressBar brick.
 */
import { cn } from "@/lib/utils";
import { useElementData } from "@/state/hooks";
import type { GaugeProps } from "./schema";

// Geometry for the semicircle arc, in SVG user units.
const W = 200;
const H = 116;
const CX = 100;
const CY = 100;
const R = 84;
const STROKE = 16;

/** Point on the arc circle at a fraction t in [0,1] across the 180° sweep. */
function arcPoint(t: number): [number, number] {
  // t=0 → left end (180°), t=1 → right end (0°), sweeping over the top.
  const angle = Math.PI * (1 - t);
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)];
}

export function Gauge({ value, min, max, label, unit, bindKey }: GaugeProps) {
  const live = useElementData<number | undefined>(bindKey, undefined);
  const v = live ?? value;

  // Guard against a degenerate range so fraction stays finite.
  const span = max - min;
  const clamped = Math.max(min, Math.min(max, v));
  const fraction = span > 0 ? (clamped - min) / span : 0;

  const [sx, sy] = arcPoint(0);
  const [ex, ey] = arcPoint(1);
  // Single semicircle path from left end to right end, sweeping over the top.
  const d = `M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}`;

  // Length of the half-circumference; the value arc reveals `fraction` of it.
  const arcLen = Math.PI * R;
  const valueLen = arcLen * fraction;

  // Display formatting: keep integers clean, otherwise one decimal place.
  const shown = Number.isInteger(v) ? String(v) : v.toFixed(1);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-full max-w-[260px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={label ? `${label}: ${shown}${unit ?? ""}` : `${shown}${unit ?? ""}`}
        >
          {/* Background track */}
          <path
            d={d}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Value arc, revealed via stroke-dasharray */}
          <path
            d={d}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${valueLen} ${arcLen}`}
            className="transition-[stroke-dasharray] duration-500 ease-out"
          />
        </svg>
        {/* Centered value readout overlaid on the arc */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-semibold leading-none tabular-nums text-[var(--foreground)]">
            {shown}
            {unit && <span className="ml-0.5 text-base font-medium text-[var(--muted-foreground)]">{unit}</span>}
          </span>
        </div>
      </div>
      <div className="flex w-full max-w-[260px] items-center justify-between px-1 text-[10px] tabular-nums text-[var(--muted-foreground)]">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {label && (
        <span className={cn("text-sm font-medium text-[var(--muted-foreground)]")}>{label}</span>
      )}
    </div>
  );
}
