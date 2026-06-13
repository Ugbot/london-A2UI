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
import { research } from "@/server/linkup";
import { listConnections, addEndpoint } from "@/server/connections";
import { importOpenApiConnection } from "@/server/openapi-import";
import { proxyFetch } from "@/server/proxy";

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

export const researchTool = createTool({
  id: "research",
  description:
    "Search the web (Linkup) for up-to-date, sourced information. Returns { answer, sources:[{name,url,snippet}] }. Use it to build a research dashboard: a Heading, a Text summary of the answer, StatCards for any key numbers, and a Sources Table or List with the urls. depth 'deep' is slower but more thorough.",
  inputSchema: z.object({
    query: z.string().describe("What to research"),
    depth: z.enum(["standard", "deep"]).default("standard"),
  }),
  execute: async (input) => {
    try {
      return await research(input.query, input.depth);
    } catch (err) {
      // Graceful: surface the error (e.g. out of Linkup credits) to the agent.
      return { error: err instanceof Error ? err.message : String(err), answer: "", sources: [] };
    }
  },
});

export const listConnectionsTool = createTool({
  id: "list_connections",
  description:
    "List the saved data Connections (external APIs/CMSs the SPA can read/write). Returns REDACTED connections — names, base URLs, endpoints (id/method/path/summary), and whether a secret is set (hasSecret). NEVER returns secrets. Call this first when the user wants live data or a form that submits somewhere.",
  inputSchema: z.object({}),
  execute: async () => ({ connections: await listConnections() }),
});

export const importOpenApiTool = createTool({
  id: "import_openapi",
  description:
    "Create a data Connection from an OpenAPI/Swagger spec (paste a spec URL or the JSON). Returns the new connection's id + parsed endpoints so you can wire ApiData/Form bricks to it. The connection is created WITHOUT a secret — if the API needs auth, tell the user to open the Data panel and add the secret (NEVER ask them to paste tokens/keys into chat).",
  inputSchema: z.object({
    specUrl: z.string().optional().describe("URL of an OpenAPI/Swagger JSON spec"),
    specJson: z.unknown().optional().describe("The OpenAPI spec as a JSON object"),
    name: z.string().optional(),
    authType: z.enum(["none", "bearer", "apiKey", "basic"]).optional(),
    headerName: z.string().optional().describe("Header name for apiKey auth"),
  }),
  execute: async (input) => {
    try {
      const connection = await importOpenApiConnection({
        specUrl: input.specUrl,
        specJson: input.specJson,
        name: input.name,
        auth: input.authType ? { type: input.authType, headerName: input.headerName } : undefined,
      });
      return { connection };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const addEndpointTool = createTool({
  id: "add_endpoint",
  description:
    "Define a single endpoint on an existing Connection conversationally (when there's no OpenAPI spec). Provide the connection id, method, and path (relative to the connection's base URL, may contain {params}).",
  inputSchema: z.object({
    connectionId: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().describe("Relative path, e.g. /orders/{id}"),
    summary: z.string().optional(),
    id: z.string().optional().describe("Endpoint slug; derived from method+path if omitted"),
  }),
  execute: async (input) => {
    const id = input.id ?? `${input.method.toLowerCase()}-${input.path}`.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
    const connection = await addEndpoint(input.connectionId, {
      id,
      method: input.method,
      path: input.path,
      summary: input.summary,
    });
    return connection ? { connection } : { error: "connection not found" };
  },
});

export const callApiTool = createTool({
  id: "call_api",
  description:
    "Make a ONE-OFF proxied call to test a Connection/endpoint before wiring a brick (auth injected server-side, SSRF-guarded). Returns a truncated, sanitized result. Use to confirm a connection works or to inspect a response shape.",
  inputSchema: z.object({
    connectionId: z.string().optional(),
    endpointId: z.string().optional(),
    url: z.string().optional(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
    query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.unknown().optional(),
  }),
  execute: async (input) => {
    const r = await proxyFetch(input);
    const preview = JSON.stringify(r.data ?? null).slice(0, 1500);
    return { ok: r.ok, status: r.status, error: r.error, data: preview };
  },
});

export const cacheTools = {
  list_bricks: listBricksTool,
  search_bricks: searchBricksTool,
  search_partials: searchPartialsTool,
  bake_partial: bakePartialTool,
  research: researchTool,
  list_connections: listConnectionsTool,
  import_openapi: importOpenApiTool,
  add_endpoint: addEndpointTool,
  call_api: callApiTool,
};
