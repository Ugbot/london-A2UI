/**
 * Gauge brick definition — a radial gauge for a single metric within a
 * min/max range. No "use client": this module is imported server-side to
 * register the brick and embed its description/tags for referential search.
 */
import { defineBrick } from "@/bricks/types";
import { gaugeSchema } from "./schema";
import { Gauge } from "./component";

export const gaugeBrick = defineBrick({
  name: "Gauge",
  description:
    "A radial gauge for a single metric within a min/max range. Bind live value via bindKey.",
  tags: ["gauge", "radial", "metric", "kpi", "dial", "viz"],
  schema: gaugeSchema,
  acceptsChildren: false,
  Component: Gauge,
});
