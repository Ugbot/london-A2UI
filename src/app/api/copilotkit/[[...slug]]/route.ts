import {
  CopilotRuntime,
  CopilotKitIntelligence,
  InMemoryAgentRunner,
  createCopilotEndpoint,
} from "@copilotkit/runtime/v2";
import { MastraAgent } from "@ag-ui/mastra";
import { handle } from "hono/vercel";
import { widgetAgent } from "@/mastra/agent";
import { sanitizeMessages } from "@/lib/sanitize-messages";

// Run the agent in-process: MastraAgent is an AG-UI AbstractAgent — exactly the
// shape the runtime expects (the same interface the old HttpAgent implemented),
// so no separate agent server/port is needed. The Mastra agent + pgvector + pg
// need the Node.js runtime.
export const runtime = "nodejs";

// 1. Create the CopilotRuntime instance with our in-process Mastra agent.
//
// Thread management: we default to the LOCAL InMemoryAgentRunner so thread ids
// are created on demand for whatever id the client supplies (e.g. a stable
// `thread-<session>`). The hosted Intelligence gateway owns/validates thread ids
// itself — supplying an explicit id it didn't mint returns "Failed to initialize
// thread", and it was the source of intermittent 502s / "thread locked" errors.
// Opt back into Intelligence explicitly with USE_COPILOT_INTELLIGENCE=1.
const useIntelligence =
  process.env.USE_COPILOT_INTELLIGENCE === "1" &&
  !!process.env.COPILOTKIT_LICENSE_TOKEN;

const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new MastraAgent({ agent: widgetAgent }),
  },
  // --- copilotkit:intelligence (opt-in via USE_COPILOT_INTELLIGENCE=1) ---
  ...(useIntelligence
    ? {
        intelligence: new CopilotKitIntelligence({
          apiKey: process.env.INTELLIGENCE_API_KEY ?? "",
          apiUrl: process.env.INTELLIGENCE_API_URL ?? "http://localhost:4201",
          wsUrl:
            process.env.INTELLIGENCE_GATEWAY_WS_URL ?? "ws://localhost:4401",
        }),
        // Demo stub — replace with your own auth-derived user identity (e.g. OIDC)
        // before any multi-user deployment, or all users share one thread history.
        identifyUser: () => ({ id: "demo-user", name: "Demo User" }),
        licenseToken: process.env.COPILOTKIT_LICENSE_TOKEN,
      }
    : { runner: new InMemoryAgentRunner() }),
  // --- /copilotkit:intelligence ---
});

// 2. Build a Next.js API route that handles the CopilotKit runtime requests.
const app = createCopilotEndpoint({
  runtime: copilotRuntime,
  basePath: "/api/copilotkit",
});

const honoPost = handle(app);

/**
 * Sanitize the conversation history on agent run/connect BEFORE the runtime
 * processes it. A malformed tool call from a prior turn (e.g. args `{}{}`) would
 * otherwise be JSON.parsed during replay and crash the run with RUN_ERROR —
 * which then breaks selecting that thread entirely. We repair/drop those here at
 * the boundary so a poisoned turn can never wedge a thread.
 */
export async function POST(req: Request) {
  try {
    const { pathname } = new URL(req.url);
    if (/\/agent\/[^/]+\/(run|connect)$/.test(pathname)) {
      const body = (await req.clone().json().catch(() => null)) as
        | { messages?: unknown; context?: unknown }
        | null;
      if (body) {
        const patch: Record<string, unknown> = {};
        // (1) Sanitize message history so a malformed tool call from a prior turn
        //     (e.g. args `{}{}`) can't crash the run on replay.
        if (Array.isArray(body.messages)) {
          const clean = sanitizeMessages(body.messages);
          if (JSON.stringify(clean) !== JSON.stringify(body.messages)) patch.messages = clean;
        }
        // (2) The runtime requires `context` (array). If a transient client state
        //     omits it, the run hard-400s ("context Required") and nothing can
        //     start. Default it so a run can never be blocked by a missing context.
        if (!Array.isArray(body.context)) patch.context = [];

        if (Object.keys(patch).length > 0) {
          const headers = new Headers(req.headers);
          headers.delete("content-length"); // body length changed; let it recompute
          const patched = new Request(req.url, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...body, ...patch }),
          });
          return honoPost(patched);
        }
      }
    }
  } catch {
    /* fall through to the unmodified request */
  }
  return honoPost(req);
}

export const GET = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
