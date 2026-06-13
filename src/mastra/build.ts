/**
 * Headless widget build — the engine behind the externally-callable API
 * (`POST /api/widget`). Runs the same composer agent + brick/partial cache used
 * by the interactive canvas, but with a SERVER-SIDE `render_widget` tool that
 * captures and validates the composition tree instead of painting a browser
 * canvas. Returns the validated tree as JSON (re-importable into the canvas, or
 * usable directly by an external caller).
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { registry } from "@/bricks/registry";
import {
  validateComposition,
  renderWidgetInputSchema,
  type CompositionNode,
} from "@/bricks/composition";
import { ensureIds, indexElements, type ElementRef } from "@/bricks/tree";
import { SYSTEM_PROMPT } from "./prompt";
import { cacheTools } from "./tools";
import { resolveModel, parseModelId } from "./provider";

export interface BuildResult {
  ok: boolean;
  widget: CompositionNode | null;
  elements: ElementRef[];
  attempts: number;
  message: string;
  errors?: { path: string; message: string }[];
}

const RENDER_DESCRIPTION =
  "Render the finished widget. Pass the composition tree as the `tree` object " +
  "argument (a JSON object, not a string). Returns 'Rendered successfully.' or " +
  "validation errors to fix and retry. Call this once you have composed the widget.";

/**
 * Build a widget from a natural-language prompt, fully server-side.
 *
 * The agent has the cache/search/research tools plus a capturing render tool.
 * The last successfully-validated tree it renders is returned. `maxSteps` bounds
 * the tool-call loop (research + searches + render + retries).
 */
export async function buildWidget(
  prompt: string,
  opts: { maxSteps?: number; signal?: AbortSignal; model?: string } = {},
): Promise<BuildResult> {
  const capture: {
    tree: CompositionNode | null;
    attempts: number;
    lastErrors?: { path: string; message: string }[];
  } = { tree: null, attempts: 0 };

  const renderWidget = createTool({
    id: "render_widget",
    description: RENDER_DESCRIPTION,
    inputSchema: renderWidgetInputSchema,
    execute: async (input) => {
      capture.attempts++;
      const result = validateComposition(input.tree, registry);
      if (!result.ok) {
        capture.lastErrors = result.errors;
        return (
          "The composition did not validate. Fix these and try again:\n" +
          result.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")
        );
      }
      capture.tree = ensureIds(result.value);
      capture.lastErrors = undefined;
      return "Rendered successfully.";
    },
  });

  const agent = new Agent({
    id: "widget-composer-api",
    name: "widget-composer-api",
    instructions: SYSTEM_PROMPT,
    model: resolveModel(parseModelId(opts.model)),
    tools: { ...cacheTools, render_widget: renderWidget },
  });

  const res = await agent.generate(prompt, {
    maxSteps: opts.maxSteps ?? 16,
    abortSignal: opts.signal,
  });

  return {
    ok: capture.tree !== null,
    widget: capture.tree,
    elements: indexElements(capture.tree),
    attempts: capture.attempts,
    message: res.text ?? "",
    errors: capture.tree ? undefined : capture.lastErrors,
  };
}
