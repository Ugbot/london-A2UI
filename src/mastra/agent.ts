/**
 * The widget-composer Mastra agent, run in-process by the CopilotKit runtime
 * (wrapped as an AG-UI AbstractAgent in the API route).
 *
 * Model provider is env-configurable so the same agent runs against OpenAI
 * (`gpt-4.1-mini`, the default) or a local OpenAI-compatible endpoint such as
 * Ollama (set OPENAI_BASE_URL + AGENT_MODEL) — useful for local testing without
 * an OpenAI key.
 */
import { Agent } from "@mastra/core/agent";
import { cacheTools } from "./tools";
import { SYSTEM_PROMPT } from "./prompt";
import { provider, MODEL } from "./provider";

export const widgetAgent = new Agent({
  id: "widget-composer",
  name: "widget-composer",
  instructions: SYSTEM_PROMPT,
  model: provider(MODEL),
  tools: cacheTools,
});
