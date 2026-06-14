"use client";

/**
 * ECharts-backed bricks (Superset/Metabase-grade): a raw `EChart` (any ECharts option)
 * plus typed convenience charts (Radar, Sankey, Treemap, Funnel). Each reads live data
 * via bindKey (falling back to static props), builds an ECharts option, and renders it
 * through the shared EChartBox.
 */
import * as React from "react";
import type * as echarts from "echarts";
import { useElementData } from "@/state/hooks";
import { EChartBox } from "./EChartBox";
import type { EChartProps, RadarProps, SankeyProps, TreemapProps, FunnelProps } from "./schema";

const tooltip = { tooltip: {} as Record<string, unknown> };

export function EChart({ option, bindKey, height }: EChartProps) {
  const live = useElementData<Record<string, unknown> | undefined>(bindKey, undefined);
  const opt = (live ?? option) as echarts.EChartsCoreOption | undefined;
  if (!opt) {
    return (
      <div className="grid h-40 place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
        EChart — set an `option` or bind one via bindKey
      </div>
    );
  }
  return <EChartBox option={opt} height={height} />;
}

export function RadarChart({ indicators, series, bindKey, height }: RadarProps) {
  const live = useElementData<{ indicators?: RadarProps["indicators"]; series?: RadarProps["series"] } | undefined>(bindKey, undefined);
  const inds = live?.indicators ?? indicators;
  const ser = live?.series ?? series;
  const option = {
    ...tooltip,
    legend: { bottom: 0 },
    radar: { indicator: inds.map((i) => ({ name: i.name, max: i.max })) },
    series: [{ type: "radar", data: ser.map((s) => ({ name: s.name, value: s.values })) }],
  };
  return <EChartBox option={option} height={height} />;
}

export function SankeyChart({ nodes, links, bindKey, height }: SankeyProps) {
  const live = useElementData<{ nodes?: SankeyProps["nodes"]; links?: SankeyProps["links"] } | undefined>(bindKey, undefined);
  const option = {
    ...tooltip,
    series: [
      {
        type: "sankey",
        data: live?.nodes ?? nodes,
        links: live?.links ?? links,
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.5 },
      },
    ],
  };
  return <EChartBox option={option} height={height} />;
}

export function TreemapChart({ data, bindKey, height }: TreemapProps) {
  const live = useElementData<TreemapProps["data"] | undefined>(bindKey, undefined);
  const option = { ...tooltip, series: [{ type: "treemap", data: live ?? data, roam: false }] };
  return <EChartBox option={option} height={height} />;
}

export function FunnelChart({ data, bindKey, height }: FunnelProps) {
  const live = useElementData<FunnelProps["data"] | undefined>(bindKey, undefined);
  const option = {
    ...tooltip,
    legend: { bottom: 0 },
    series: [{ type: "funnel", data: live ?? data, label: { show: true } }],
  };
  return <EChartBox option={option} height={height} />;
}
