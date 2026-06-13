/**
 * M2 verification: drive the widget-composer agent through the full compose
 * loop (list_bricks -> compose -> render_widget) with a server-side stand-in
 * for the render_widget frontend tool that runs the exact same registry
 * validation. Confirms the LLM produces a VALID composition tree.
 *
 * Run: node --env-file=.env --import tsx scripts/agent-smoke.ts
 */
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { brickCatalog, registry } from "../src/bricks/registry";
import {
  validateComposition,
  renderWidgetInputSchema,
  type CompositionNode,
} from "../src/bricks/composition";
import { SYSTEM_PROMPT } from "../src/mastra/prompt";

const state: { tree: CompositionNode | null; rendered: boolean; attempts: number } = {
  tree: null,
  rendered: false,
  attempts: 0,
};

const listBricks = createTool({
  id: "list_bricks",
  description: "List every available brick with props schema.",
  inputSchema: z.object({}),
  execute: async () => ({ bricks: brickCatalog() }),
});

const renderWidget = createTool({
  id: "render_widget",
  description:
    "Render a composition tree. Pass the tree as the `tree` object argument. Returns success or validation errors.",
  inputSchema: renderWidgetInputSchema,
  execute: async (inputData) => {
    state.attempts++;
    console.log(`\n--- render_widget attempt ${state.attempts} ---`);
    console.log("received tree:", JSON.stringify(inputData.tree).slice(0, 600));
    const result = validateComposition(inputData.tree, registry);
    if (!result.ok) {
      console.log("errors:", result.errors.slice(0, 8));
      return (
        "Validation failed. Fix and retry:\n" +
        result.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")
      );
    }
    state.tree = result.value;
    state.rendered = true;
    return "Rendered successfully.";
  },
});

const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const agent = new Agent({
  id: "widget-composer-test",
  name: "widget-composer-test",
  instructions: SYSTEM_PROMPT,
  model: provider(process.env.AGENT_MODEL ?? "gpt-4.1-mini"),
  tools: { list_bricks: listBricks, render_widget: renderWidget },
});

async function main() {
  const prompt =
    "Build a sales dashboard with KPI cards for revenue, active users and churn, and a bar chart of monthly sales.";

  console.log(`Prompt: ${prompt}\n`);
  const res = await agent.generate(prompt, { maxSteps: 8 });

  console.log(`render_widget attempts: ${state.attempts}`);
  console.log(`rendered: ${state.rendered}`);
  if (state.tree) {
    const bricksUsed = new Set<string>();
    const walk = (n: CompositionNode) => {
      bricksUsed.add(n.brick);
      n.children?.forEach(walk);
    };
    walk(state.tree);
    console.log(`root brick: ${state.tree.brick}`);
    console.log(`bricks used: ${[...bricksUsed].join(", ")}`);
  }
  console.log(`\nagent final text: ${(res.text ?? "").slice(0, 200)}`);

  if (!state.rendered) {
    console.error("\n❌ agent did not produce a valid rendered widget");
    process.exitCode = 1;
  } else {
    console.log("\n✅ agent composed a registry-valid widget");
  }
}

main().catch((err) => {
  console.error("❌ agent smoke failed:", err);
  process.exitCode = 1;
});
