import { defineBrick } from "@/bricks/types";
import { forceGraphSchema } from "./schema";
import { ForceGraph } from "./component";

export const forceGraphBrick = defineBrick({
  name: "ForceGraph",
  description:
    "A D3 force-directed network graph: nodes connected by links with physics and draggable nodes. Use for relationships, networks, knowledge/dependency graphs, org/social networks — anything dynamic that a static FlowChart can't express. Nodes take id/label/group; links take source/target ids.",
  tags: ["d3", "graph", "network", "force", "viz", "relationships", "nodes", "edges", "general"],
  schema: forceGraphSchema,
  acceptsChildren: false,
  Component: ForceGraph,
});
