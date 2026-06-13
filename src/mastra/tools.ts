/**
 * Server-side tools for the widget-composer agent.
 *
 *  - list_bricks: the full registry catalog (names + prop schemas).
 *  - search_bricks: semantic search for relevant primitives.
 *  - search_partials: semantic search over the GROWING cache of prior widgets
 *    (templates with holes) — this is what makes the agent faster/consistent
 *    over time.
 *  - bake_partial: distill a rendered widget into a reusable partial (called
 *    after a successful render).
 */
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { brickCatalog } from "@/bricks/registry";
import { searchBricks, searchPartials, bakePartial } from "@/server/cache";

const looseTree = z.object({
  brick: z.string(),
  props: z.record(z.unknown()).optional(),
  children: z.array(z.unknown()).optional(),
});

export const listBricksTool = createTool({
  id: "list_bricks",
  description:
    "List every available UI brick: name, description, tags, whether it accepts children, and its props JSON-schema. Call this when you need the full catalog.",
  inputSchema: z.object({}),
  execute: async () => ({ bricks: brickCatalog() }),
});

export const searchBricksTool = createTool({
  id: "search_bricks",
  description:
    "Semantic search for the most relevant bricks for a need (e.g. 'chart of monthly sales', 'collaborative notes'). Returns the closest bricks with their descriptions.",
  inputSchema: z.object({
    query: z.string().describe("What you need a brick for"),
    k: z.number().int().min(1).max(12).optional(),
  }),
  execute: async (input) => {
    const hits = await searchBricks(input.query, input.k ?? 6);
    return { bricks: hits };
  },
});

export const searchPartialsTool = createTool({
  id: "search_partials",
  description:
    "Search the cache of previously-built widgets (templates with typed holes) for one matching the request. If a close match is returned (low distance), REUSE its template by filling the holes with new content instead of composing from scratch.",
  inputSchema: z.object({
    query: z.string().describe("The user's widget request"),
    k: z.number().int().min(1).max(6).optional(),
  }),
  execute: async (input) => {
    const hits = await searchPartials(input.query, input.k ?? 3);
    return { partials: hits };
  },
});

export const bakePartialTool = createTool({
  id: "bake_partial",
  description:
    "Save a successfully-rendered widget into the reusable cache. Call this AFTER render_widget succeeds. Provide a short descriptive name and a one-line description of what the widget is for, plus the exact tree you rendered.",
  inputSchema: z.object({
    name: z.string().describe("Short descriptive name, e.g. 'sales-dashboard'"),
    description: z.string().describe("One line: what this widget is for"),
    tags: z.array(z.string()).optional(),
    tree: looseTree,
  }),
  execute: async (input) => {
    const result = await bakePartial({
      name: input.name,
      description: input.description,
      tags: input.tags,
      tree: input.tree,
    });
    return result;
  },
});

export const cacheTools = {
  list_bricks: listBricksTool,
  search_bricks: searchBricksTool,
  search_partials: searchPartialsTool,
  bake_partial: bakePartialTool,
};
