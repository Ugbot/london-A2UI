import { z } from "zod";

const bar = z.object({
  time: z.union([z.string(), z.number()]).describe("A 'YYYY-MM-DD' date or a UNIX timestamp (seconds)"),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

export const priceChartSchema = z.object({
  data: z.array(bar).default([]).describe("OHLC bars"),
  volume: z
    .array(z.object({ time: z.union([z.string(), z.number()]), value: z.number() }))
    .optional()
    .describe("Optional volume bars (same time axis)"),
  bindKey: z.string().optional().describe("Keyed data providing { data, volume } or an OHLC array"),
  height: z.number().int().min(120).max(1200).default(360),
});
export type PriceChartProps = z.infer<typeof priceChartSchema>;
