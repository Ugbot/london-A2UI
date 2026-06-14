import { z } from "zod";

export const timeSeriesSchema = z.object({
  time: z.array(z.number()).default([]).describe("X axis — UNIX timestamps in SECONDS"),
  series: z
    .array(z.object({ name: z.string(), data: z.array(z.number()) }))
    .default([])
    .describe("One line per series; data aligns with `time`"),
  bindKey: z.string().optional().describe("Keyed data providing { time, series }"),
  height: z.number().int().min(120).max(1200).default(300),
});
export type TimeSeriesProps = z.infer<typeof timeSeriesSchema>;
