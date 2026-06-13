import { z } from "zod";

export const forceGraphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        group: z.number().int().optional(),
      }),
    )
    .min(1),
  links: z
    .array(z.object({ source: z.string(), target: z.string(), value: z.number().optional() }))
    .default([]),
  height: z.number().int().min(200).max(800).default(420),
  /** Live-bind { nodes, links } to a keyed element. */
  bindKey: z.string().optional(),
});

export type ForceGraphProps = z.infer<typeof forceGraphSchema>;
