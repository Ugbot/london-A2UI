/**
 * Zod prop schema for the Gauge brick — a radial gauge for a single metric
 * within a min/max range. No "use client" so the agent can import the schema
 * server-side for validation and embedding.
 */
import { z } from "zod";

export const gaugeSchema = z.object({
  value: z.number().describe("Current metric value (clamped into [min, max])"),
  min: z.number().default(0).describe("Lower bound of the gauge range"),
  max: z.number().default(100).describe("Upper bound of the gauge range"),
  label: z.string().optional().describe("Caption shown below the value"),
  unit: z.string().optional().describe("Unit suffix shown next to the value, e.g. %, °C, ms"),
  bindKey: z
    .string()
    .optional()
    .describe("Live-bind this gauge's value to a keyed element id, updated via stream actions"),
});

export type GaugeProps = z.infer<typeof gaugeSchema>;
