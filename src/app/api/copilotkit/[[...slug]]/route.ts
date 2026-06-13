import {
  CopilotRuntime,
  CopilotKitIntelligence,
  InMemoryAgentRunner,
  createCopilotEndpoint,
} from "@copilotkit/runtime/v2";
import { MastraAgent } from "@ag-ui/mastra";
import { handle } from "hono/vercel";
import { widgetAgent } from "@/mastra/agent";

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

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
