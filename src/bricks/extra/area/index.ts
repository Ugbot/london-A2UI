/**
 * AreaChart brick definition. No "use client" — this binds the schema VALUE to
 * the client Component into a BrickDef for the registry.
 */
import { defineBrick } from "@/bricks/types";
import { areaSchema } from "./schema";
import { AreaChart } from "./component";

export const areaChartBrick = defineBrick({
  name: "AreaChart",
  description: "A filled area chart for trends over an ordered sequence. Bind live data via bindKey.",
  tags: ["chart", "area", "trend", "viz", "graph", "time"],
  schema: areaSchema,
  acceptsChildren: false,
  Component: AreaChart,
});
