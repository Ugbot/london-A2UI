/**
 * Zod prop schema for the Heatmap brick — the single source of truth for its
 * props. No "use client" here so the agent can import the schema server-side
 * for validation and embedding (mirrors the convention in `src/bricks/schemas.ts`).
 */
import { z } from "zod";

export const heatmapSchema = z.object({
  /** Column labels, rendered across the top. Length = number of value columns. */
  xLabels: z.array(z.string()).min(1),
  /** Row labels, rendered down the left. Length = number of value rows. */
  yLabels: z.array(z.string()).min(1),
  /** Matrix of values; outer array = rows (yLabels), inner array = cols (xLabels). */
  values: z.array(z.array(z.number())).min(1),
  /** Base cell color; intensity is scaled by each value's normalised magnitude. */
  color: z.string().default("#6366f1"),
  /** Live-bind the matrix to a keyed element id, updated via stream actions. */
  bindKey: z
    .string()
    .optional()
    .describe("Live-bind this brick's values to a keyed element id, updated via stream actions"),
});

export type HeatmapProps = z.infer<typeof heatmapSchema>;
