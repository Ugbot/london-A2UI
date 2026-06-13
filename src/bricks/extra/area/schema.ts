/**
 * Zod prop schema for the AreaChart brick. No "use client" so it can be
 * imported server-side for validation and embedding, mirroring schemas.ts.
 */
import { z } from "zod";

/** A single (label, value) pair plotted along the area chart. */
const areaDatum = z.object({
  label: z.string(),
  value: z.number(),
});

export const areaSchema = z.object({
  data: z.array(areaDatum).min(1),
  color: z.string().default("#6366f1"),
  bindKey: z
    .string()
    .optional()
    .describe("Live-bind this brick's data to a keyed element id, updated via stream actions"),
});

export type AreaChartProps = z.infer<typeof areaSchema>;
