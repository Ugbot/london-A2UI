"use client";

/**
 * TimeSeries — Grafana-style fast time-series (uPlot): a tiny, ultra-fast canvas line
 * chart that handles tens of thousands of points smoothly. Imperative: build a uPlot
 * instance on a ref, setData on change, resize via ResizeObserver. uPlot ships its own CSS.
 */
import * as React from "react";
import uPlot from "uplot";
// uPlot's stylesheet is imported globally in globals.css (keeping it out of the brick
// import graph so server/test imports of the registry don't pull CSS).
import { useElementData } from "@/state/hooks";
import type { TimeSeriesProps } from "./schema";

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899"];

type Live = { time?: number[]; series?: TimeSeriesProps["series"] };

export function TimeSeries({ time, series, bindKey, height }: TimeSeriesProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const plot = React.useRef<uPlot | null>(null);
  const live = useElementData<Live | undefined>(bindKey, undefined);
  const xs = live?.time ?? time;
  const ser = live?.series ?? series;

  // Stable signature of the SHAPE (series names) — re-create the plot only when it changes.
  const shapeKey = ser.map((s) => s.name).join("|");

  React.useEffect(() => {
    if (!ref.current) return;
    const opts: uPlot.Options = {
      width: ref.current.clientWidth || 600,
      height,
      legend: { show: true },
      scales: { x: { time: true } },
      series: [
        {},
        ...ser.map((s, i) => ({ label: s.name, stroke: PALETTE[i % PALETTE.length], width: 2 })),
      ],
      axes: [
        { stroke: "#64748b", grid: { stroke: "rgba(100,116,139,0.12)" } },
        { stroke: "#64748b", grid: { stroke: "rgba(100,116,139,0.12)" } },
      ],
    };
    const data: uPlot.AlignedData = [xs, ...ser.map((s) => s.data)] as uPlot.AlignedData;
    const u = new uPlot(opts, data, ref.current);
    plot.current = u;
    const ro = new ResizeObserver(() => {
      if (ref.current) u.setSize({ width: ref.current.clientWidth, height });
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      u.destroy();
      plot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, height]);

  // Cheap data updates (no re-create) when only the values change.
  React.useEffect(() => {
    plot.current?.setData([xs, ...ser.map((s) => s.data)] as uPlot.AlignedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xs, ser]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
