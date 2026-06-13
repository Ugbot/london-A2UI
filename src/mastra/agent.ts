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
import { createOpenAI } from "@ai-sdk/openai";
import { cacheTools } from "./tools";
import { SYSTEM_PROMPT } from "./prompt";

const provider = createOpenAI({
  // Unset → https://api.openai.com/v1. Set to e.g. http://localhost:11434/v1 for Ollama.
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const MODEL = process.env.AGENT_MODEL ?? "gpt-4.1-mini";

export const widgetAgent = new Agent({
  id: "widget-composer",
  name: "widget-composer",
  instructions: SYSTEM_PROMPT,
  model: provider(MODEL),
  tools: cacheTools,
});
