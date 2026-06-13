"use client";

import {
  useFrontendTool,
  useHumanInTheLoop,
  CopilotChatConfigurationProvider,
  CopilotSidebar,
} from "@copilotkit/react-core/v2";
import type { CSSProperties } from "react";
import { useState } from "react";
import { z } from "zod";

import { ThreadsDrawer } from "@/components/threads-drawer";
import { ThreadsPanelGate } from "@/components/threads-drawer/locked-state";
import styles from "@/components/threads-drawer/threads-drawer.module.css";

import { WidgetCanvas } from "@/components/WidgetCanvas";
import { WidgetPreviewCard, AskUserCard } from "@/components/chat-cards";
import { registry } from "@/bricks/registry";
import { validateComposition, renderWidgetInputSchema } from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";
import { streamToElement } from "@/state/store";
import { useSharedWidget } from "@/collab/hooks";
import { CollabControls } from "@/collab/CollabControls";
import { useCollab } from "@/collab/provider";
import { StyleMenu } from "@/style/StyleMenu";
import { STYLE_PRESETS, useStyleLayers } from "@/style/StyleLayers";

export default function WidgetComposerPage() {
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  // The widget tree is collaborative AND per-thread: shared via Yjs so renders
  // and edits propagate live, keyed by thread so switching threads reloads that
  // thread's canvas.
  const [widget, setWidget] = useSharedWidget(threadId);
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const { toggleLayer, clearLayers } = useStyleLayers();
  const { enable: enableCollab, disable: disableCollab } = useCollab();

  // Let the agent recolor the assistant accent.
  useFrontendTool({
    name: "setThemeColor",
    parameters: z.object({
      themeColor: z.string().describe("A nice hex color for the assistant accent."),
    }),
    handler: async ({ themeColor }) => {
      setThemeColor(themeColor);
      return `Set theme color to ${themeColor}`;
    },
  });

  // The agent's UI-affecting action: render a composition tree onto the canvas.
  // The handler validates against the brick registry and returns errors so the
  // agent can repair its tree (the validation half of the reliability loop).
  useFrontendTool({
    name: "render_widget",
    description:
      "Render a widget onto the canvas. Pass the composition tree as the `tree` object argument (a JSON object, not a string). Returns 'Rendered successfully.' or validation errors to fix.",
    parameters: renderWidgetInputSchema,
    handler: async ({ tree }) => {
      const result = validateComposition(tree, registry);
      if (!result.ok) {
        setStatus({ ok: false, stage: "validate", errors: result.errors });
        return (
          "The composition did not validate. Fix these and call render_widget again:\n" +
          result.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")
        );
      }
      setWidget(result.value);
      setStatus({ ok: true });
      return "Rendered successfully.";
    },
    // Show the assembled widget as a live preview in chat — not raw JSON.
    render: ({ args }) => <WidgetPreviewCard tree={args?.tree} />,
  });

  // Hotwire/Turbo-Stream-style messaging: push a live update to any keyed
  // element (bricks with a matching bindKey re-render instantly).
  useFrontendTool({
    name: "stream_to_element",
    description:
      "Send a live update to a keyed element on the canvas (a brick with a matching bindKey). action: set (replace), merge (object), append (array push), remove. Use to update data live without rebuilding the widget.",
    parameters: z.object({
      action: z.enum(["set", "merge", "append", "remove"]).default("set"),
      target: z.string().describe("The keyed element id (matches a brick's bindKey)"),
      value: z.unknown().optional().describe("The value to apply"),
    }),
    handler: async ({ action, target, value }) => {
      streamToElement({ action, target, value });
      return `Streamed ${action} to "${target}".`;
    },
  });

  // Collaboration is opt-in: the agent turns it on only when the user asks
  // (e.g. "let others join", "make this collaborative").
  useFrontendTool({
    name: "set_collaboration",
    description:
      "Turn live collaboration (sync, presence, cursors, sharing) on or off. Only enable when the user asks to collaborate/share with others. Off by default.",
    parameters: z.object({ enabled: z.boolean() }),
    handler: async ({ enabled }) => {
      if (enabled) enableCollab();
      else disableCollab();
      return enabled
        ? "Collaboration enabled — the canvas now syncs and others can join via Share."
        : "Collaboration disabled — back to solo.";
    },
  });

  // Let the agent shift styles (apply/remove preset style layers) when asked.
  useFrontendTool({
    name: "set_style",
    description:
      "Apply a named style preset to the canvas (toggles it). Presets: " +
      STYLE_PRESETS.map((p) => p.id).join(", ") +
      ". Pass clear=true to remove all style layers instead.",
    parameters: z.object({
      preset: z.string().optional().describe("A preset id to toggle"),
      clear: z.boolean().optional().describe("Remove all applied styles"),
    }),
    handler: async ({ preset, clear }) => {
      if (clear) {
        clearLayers();
        return "Cleared all style layers.";
      }
      const found = STYLE_PRESETS.find((p) => p.id === preset);
      if (!found) {
        return `Unknown preset "${preset}". Available: ${STYLE_PRESETS.map((p) => p.id).join(", ")}`;
      }
      toggleLayer(found);
      return `Toggled style "${found.label}".`;
    },
  });

  // Chaining interview: the agent asks a short series of questions with fixed
  // options rendered as buttons; the user clicks to answer.
  useHumanInTheLoop({
    name: "ask_user",
    description:
      "Ask the user a clarifying question with 2-4 fixed options before/while building. Use to resolve ambiguity (e.g. layout style, which metrics, theme). You may call this several times in a row to interview the user. The chosen option is returned as the result.",
    parameters: z.object({
      question: z.string().describe("The question to ask the user."),
      options: z.array(z.string()).min(2).max(4).describe("The fixed options to choose from."),
    }),
    render: ({ args, status, respond, result }) => (
      <AskUserCard
        args={args}
        respond={status === "executing" ? respond : undefined}
        result={typeof result === "string" ? result : undefined}
      />
    ),
  });

  return (
    <div className={`${styles.layout} threadsLayout`}>
      <ThreadsPanelGate>
        <ThreadsDrawer
          agentId="default"
          threadId={threadId}
          onThreadChange={setThreadId}
        />
      </ThreadsPanelGate>
      <div className={styles.mainPanel}>
        <CopilotChatConfigurationProvider agentId="default" threadId={threadId}>
          <main
            style={
              { "--copilot-kit-primary-color": themeColor } as CSSProperties
            }
            className="h-screen"
          >
            <WidgetCanvas
              tree={widget}
              status={status}
              onStatus={setStatus}
              headerExtra={
                <div className="flex items-center gap-3">
                  <StyleMenu />
                  <CollabControls />
                </div>
              }
            />
            <CopilotSidebar
              defaultOpen={true}
              labels={{
                modalHeaderTitle: "Widget Composer",
                welcomeMessageText:
                  "👋 Describe a widget — I'll assemble it from bricks. Try: \"a crypto dashboard with live BTC and ETH charts\", \"a sales dashboard\", or \"a store map of our London offices\".",
              }}
            />
          </main>
        </CopilotChatConfigurationProvider>
      </div>
    </div>
  );
}
