/**
 * Zod prop schema for the FlowChart brick — a node/edge flow diagram (boxes
 * connected by arrows). No "use client" so the agent can import the schema
 * server-side for validation and embedding.
 *
 * Node `x`/`y` are LOGICAL coordinates in [0, 100] (both axes); the component
 * maps them into pixel space. Edges reference node ids via `from`/`to`.
 */
import { z } from "zod";

export const flowchartSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().describe("Unique node identifier, referenced by edges"),
        label: z.string().describe("Text shown inside the node box"),
        x: z.number().describe("Logical horizontal position in [0, 100]"),
        y: z.number().describe("Logical vertical position in [0, 100]"),
      }),
    )
    .min(1)
    .describe("Boxes in the diagram, positioned on a 0..100 logical grid"),
  edges: z
    .array(
      z.object({
        from: z.string().describe("Source node id"),
        to: z.string().describe("Target node id"),
        label: z.string().optional().describe("Optional caption shown at the edge midpoint"),
      }),
    )
    .default([])
    .describe("Directed connections drawn as arrows between node centers"),
  height: z
    .number()
    .int()
    .min(160)
    .max(720)
    .default(360)
    .describe("Rendered height of the diagram in pixels"),
});

export type FlowChartProps = z.infer<typeof flowchartSchema>;
