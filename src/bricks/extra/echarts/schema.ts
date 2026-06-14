import { z } from "zod";

const height = z.number().int().min(80).max(1200).default(320);
const bindKey = z.string().optional().describe("Keyed data element providing this chart's data");

/** Raw ECharts brick — pass any ECharts `option` (the agent knows ECharts). The powerhouse. */
export const echartSchema = z.object({
  option: z.record(z.unknown()).optional().describe("A full ECharts option object"),
  bindKey,
  height,
});
export type EChartProps = z.infer<typeof echartSchema>;

export const radarSchema = z.object({
  indicators: z
    .array(z.object({ name: z.string(), max: z.number().optional() }))
    .default([])
    .describe("The radar axes"),
  series: z
    .array(z.object({ name: z.string(), values: z.array(z.number()) }))
    .default([])
    .describe("One entry per series; values align with indicators"),
  bindKey,
  height,
});
export type RadarProps = z.infer<typeof radarSchema>;

export const sankeySchema = z.object({
  nodes: z.array(z.object({ name: z.string() })).default([]),
  links: z.array(z.object({ source: z.string(), target: z.string(), value: z.number() })).default([]),
  bindKey,
  height,
});
export type SankeyProps = z.infer<typeof sankeySchema>;

const treemapNode: z.ZodType<{ name: string; value?: number; children?: unknown[] }> = z.lazy(() =>
  z.object({ name: z.string(), value: z.number().optional(), children: z.array(treemapNode).optional() }),
);
export const treemapSchema = z.object({
  data: z.array(treemapNode).default([]),
  bindKey,
  height,
});
export type TreemapProps = z.infer<typeof treemapSchema>;

export const funnelSchema = z.object({
  data: z.array(z.object({ name: z.string(), value: z.number() })).default([]),
  bindKey,
  height,
});
export type FunnelProps = z.infer<typeof funnelSchema>;
