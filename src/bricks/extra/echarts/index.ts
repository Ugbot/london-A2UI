/**
 * ECharts brick definitions (Apache ECharts — the Superset/Metabase powerhouse). One raw
 * EChart escape hatch + typed convenience charts, all server-safe (component refs only).
 */
import { defineBrick } from "@/bricks/types";
import { echartSchema, radarSchema, sankeySchema, treemapSchema, funnelSchema } from "./schema";
import { EChart, RadarChart, SankeyChart, TreemapChart, FunnelChart } from "./component";

export const echartBrick = defineBrick({
  name: "EChart",
  description:
    "Apache ECharts — render ANY chart from a raw ECharts `option` object (bar/line/scatter/heatmap/candlestick/gauge/graph/sunburst/boxplot/parallel/…). The most powerful chart brick; bind a live option via bindKey. Use when a typed chart brick doesn't fit.",
  tags: ["chart", "echarts", "viz", "advanced", "superset", "metabase", "graph", "powerful"],
  schema: echartSchema,
  acceptsChildren: false,
  Component: EChart,
});

export const radarBrick = defineBrick({
  name: "RadarChart",
  description: "A radar/spider chart (ECharts) — compare several series across shared axes. Bind {indicators, series} via bindKey.",
  tags: ["chart", "radar", "spider", "echarts", "viz", "compare"],
  schema: radarSchema,
  acceptsChildren: false,
  Component: RadarChart,
});

export const sankeyBrick = defineBrick({
  name: "SankeyChart",
  description: "A Sankey flow diagram (ECharts) — visualize flows between nodes (funnels, budgets, traffic). Bind {nodes, links} via bindKey.",
  tags: ["chart", "sankey", "flow", "echarts", "viz", "diagram"],
  schema: sankeySchema,
  acceptsChildren: false,
  Component: SankeyChart,
});

export const treemapBrick = defineBrick({
  name: "TreemapChart",
  description: "A treemap (ECharts) — nested rectangles sized by value, for hierarchical/part-of-whole data. Bind hierarchical data via bindKey.",
  tags: ["chart", "treemap", "hierarchy", "echarts", "viz"],
  schema: treemapSchema,
  acceptsChildren: false,
  Component: TreemapChart,
});

export const funnelBrick = defineBrick({
  name: "FunnelChart",
  description: "A funnel chart (ECharts) — conversion/stage drop-off. Bind [{name, value}] via bindKey.",
  tags: ["chart", "funnel", "conversion", "echarts", "viz"],
  schema: funnelSchema,
  acceptsChildren: false,
  Component: FunnelChart,
});
