/**
 * Zod prop schema for the ScatterChart brick. No "use client" so the schema can
 * be imported server-side for validation and embedding, mirroring schemas.ts.
 */
import { z } from "zod";

export const scatterSchema = z.object({
  data: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        label: z.string().optional(),
      }),
    )
    .min(1),
  color: z.string().default("#6366f1"),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  bindKey: z
    .string()
    .optional()
    .describe("Live-bind this brick's data to a keyed element id, updated via stream actions"),
});

export type ScatterChartProps = z.infer<typeof scatterSchema>;
