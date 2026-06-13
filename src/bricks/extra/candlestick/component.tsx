"use client";

/**
 * A hand-rolled SVG OHLC candlestick chart. Green candles when close >= open,
 * red otherwise. Supports live data binding via `bindKey`, reading the keyed
 * value from the canvas store and falling back to the static `data` prop.
 */
import * as React from "react";
import type { CandlestickProps } from "./schema";
import { useElementData } from "@/state/hooks";
import { cn } from "@/lib/utils";

const UP = "#16a34a";
const DOWN = "#dc2626";

// Internal coordinate space; rendered responsively via viewBox.
const VIEW_W = 800;
const VIEW_H = 256;
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 28; // room for x labels

export function CandlestickChart({ data, bindKey }: CandlestickProps) {
  const live = useElementData<CandlestickProps["data"] | undefined>(bindKey, undefined);
  const candles = live ?? data;

  if (!candles || candles.length === 0) {
    return (
      <div
        className={cn(
          "flex h-64 w-full items-center justify-center text-sm",
          "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]",
        )}
        style={{ color: "var(--muted-foreground)" }}
      >
        No data
      </div>
    );
  }

  const minLow = Math.min(...candles.map((c) => c.low));
  const maxHigh = Math.max(...candles.map((c) => c.high));
  const range = maxHigh - minLow || 1;

  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const plotW = VIEW_W - PAD_X * 2;
  const slot = plotW / candles.length;
  // Body occupies 60% of each slot, centered in the slot.
  const bodyW = Math.max(1, slot * 0.6);

  const yOf = (price: number) => PAD_TOP + (maxHigh - price) * (plotH / range);

  return (
    <div
      className={cn(
        "h-64 w-full overflow-hidden",
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1",
      )}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        role="img"
        aria-label="OHLC candlestick chart"
      >
        {candles.map((c, i) => {
          const cx = PAD_X + slot * i + slot / 2;
          const up = c.close >= c.open;
          const color = up ? UP : DOWN;

          const yHigh = yOf(c.high);
          const yLow = yOf(c.low);
          const yOpen = yOf(c.open);
          const yClose = yOf(c.close);

          const bodyTop = Math.min(yOpen, yClose);
          const bodyBottom = Math.max(yOpen, yClose);
          const bodyH = Math.max(1, bodyBottom - bodyTop);

          // Show a label for a manageable subset to avoid crowding.
          const step = Math.ceil(candles.length / 8);
          const showLabel = i % step === 0 || i === candles.length - 1;

          return (
            <g key={`${c.label}-${i}`}>
              {/* Wick: high -> low */}
              <line
                x1={cx}
                x2={cx}
                y1={yHigh}
                y2={yLow}
                stroke={color}
                strokeWidth={1}
              />
              {/* Body: open -> close */}
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
                stroke={color}
                strokeWidth={1}
                rx={1}
              />
              {showLabel ? (
                <text
                  x={cx}
                  y={VIEW_H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--muted-foreground)"
                >
                  {c.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
