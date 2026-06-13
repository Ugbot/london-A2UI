/**
 * Heatmap brick registration. No "use client" — this module is imported by the
 * server-side registry to build the BrickDef; the component itself carries the
 * client boundary.
 */
import { defineBrick } from "@/bricks/types";
import { heatmapSchema } from "./schema";
import { Heatmap } from "./component";

export const heatmapBrick = defineBrick({
  name: "Heatmap",
  description:
    "A grid heatmap of values across two label axes (intensity by color). Bind live values via bindKey.",
  tags: ["heatmap", "grid", "matrix", "intensity", "viz", "correlation"],
  schema: heatmapSchema,
  acceptsChildren: false,
  Component: Heatmap,
});
