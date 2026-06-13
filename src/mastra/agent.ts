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
import type { RequestContext } from "@mastra/core/request-context";
import { cacheTools } from "./tools";
import { SYSTEM_PROMPT } from "./prompt";
import { resolveModel, parseModelId } from "./provider";

/** A single piece of frontend-supplied context (from useAgentContext). */
interface AgUiContextItem {
  description: string;
  value: string;
}

/**
 * Sentinel description used by the frontend to pass the runtime-selected model
 * (as "provider:model") through useAgentContext. Stripped from the prompt and
 * used to pick the model per-request, so the model is switchable at runtime.
 */
const MODEL_CONTEXT_KEY = "__model__";

function aguiItems(requestContext?: RequestContext): AgUiContextItem[] {
  const agui = requestContext?.get?.("ag-ui") as { context?: AgUiContextItem[] } | undefined;
  return agui?.context ?? [];
}

/**
 * Dynamic instructions: the @ag-ui/mastra adapter stashes the frontend's
 * `useAgentContext` payload in requestContext under "ag-ui" but does NOT inject
 * it into the prompt — so the model never saw the current widget and kept
 * rebuilding. We read it here and append it to the system prompt, so every turn
 * the agent SEES the current composition tree + element ids and can edit in place.
 */
function buildInstructions({ requestContext }: { requestContext?: RequestContext }): string {
  // Drop the model-selection sentinel — it's plumbing, not context for the LLM.
  const items = aguiItems(requestContext).filter((c) => c.description !== MODEL_CONTEXT_KEY);
  if (items.length === 0) return SYSTEM_PROMPT;
  const block = items
    .map((c) => `### ${c.description}\n${typeof c.value === "string" ? c.value : JSON.stringify(c.value)}`)
    .join("\n\n");
  return `${SYSTEM_PROMPT}\n\n## Live canvas context (read this before editing)\n${block}`;
}

/** Dynamic model: honor a runtime "provider:model" selection, else env default. */
function buildModel({ requestContext }: { requestContext?: RequestContext }) {
  const selected = aguiItems(requestContext).find((c) => c.description === MODEL_CONTEXT_KEY)?.value;
  return resolveModel(parseModelId(typeof selected === "string" ? selected : undefined));
}

export const widgetAgent = new Agent({
  id: "widget-composer",
  name: "widget-composer",
  instructions: buildInstructions,
  model: buildModel,
  tools: cacheTools,
});
