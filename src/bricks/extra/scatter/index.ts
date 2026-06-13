/**
 * BrickDef registration for the ScatterChart brick. No "use client" so it can be
 * imported server-side; the client component is referenced via Component.
 */
import { defineBrick } from "@/bricks/types";
import { scatterSchema } from "./schema";
import { ScatterChart } from "./component";

export const scatterChartBrick = defineBrick({
  name: "ScatterChart",
  description: "A scatter plot of x/y points. Bind live data via bindKey.",
  tags: ["chart", "scatter", "plot", "correlation", "viz", "points"],
  schema: scatterSchema,
  acceptsChildren: false,
  Component: ScatterChart,
});
