/**
 * FlowChart brick definition — a node/edge flow diagram (boxes connected by
 * arrows). No "use client": this module is imported server-side to register
 * the brick and embed its description/tags for referential search.
 */
import { defineBrick } from "@/bricks/types";
import { flowchartSchema } from "./schema";
import { FlowChart } from "./component";

export const flowchartBrick = defineBrick({
  name: "FlowChart",
  description:
    "A node/edge flow diagram (boxes connected by arrows). Use for flows, pipelines, org charts, architecture diagrams.",
  tags: ["flow", "graph", "diagram", "nodes", "edges", "pipeline", "flowchart"],
  schema: flowchartSchema,
  acceptsChildren: false,
  Component: FlowChart,
});
