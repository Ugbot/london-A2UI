"use client";

import {
  useFrontendTool,
  useHumanInTheLoop,
  useAgentContext,
  CopilotChatConfigurationProvider,
  CopilotSidebar,
} from "@copilotkit/react-core/v2";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { ThreadsDrawer } from "@/components/threads-drawer";
import { ThreadsPanelGate } from "@/components/threads-drawer/locked-state";
import styles from "@/components/threads-drawer/threads-drawer.module.css";

import { WidgetCanvas } from "@/components/WidgetCanvas";
import { MentionOverlay } from "@/components/MentionOverlay";
import { ExportMenu } from "@/components/ExportMenu";
import { WidgetPreviewCard, AskUserCard, FoundryCard } from "@/components/chat-cards";
import { useMentionStore } from "@/state/mentionStore";
import { useFoundryStore } from "@/state/foundryStore";
import { registry } from "@/bricks/registry";
import {
  validateComposition,
  renderWidgetInputSchema,
  type CompositionNode,
} from "@/bricks/composition";
import {
  ensureIds,
  indexElements,
  findById,
  patchById,
  removeById,
  duplicateById,
  insertChild,
} from "@/bricks/tree";
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
  const { enabled: collabEnabled, enable: enableCollab, disable: disableCollab } = useCollab();
  // Canvas widget: per-thread when solo, SHARED across the session when
  // collaborating (so edits actually propagate between people).
  const [widget, setWidget] = useSharedWidget(threadId, collabEnabled);
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const { toggleLayer, clearLayers } = useStyleLayers();
  const { auto: autoBricks, setAuto: setAutoBricks } = useFoundryStore();

  // Keep stable refs so frontend-tool handlers always see the latest widget +
  // setter (handlers are registered once and would otherwise capture stale state).
  const setWidgetRef = useRef(setWidget);
  setWidgetRef.current = setWidget;
  const widgetRef = useRef(widget);
  widgetRef.current = widget;
  const threadRef = useRef(threadId);
  threadRef.current = threadId;

  // Flat index of addressable elements — for @-mentions + agent context.
  const elements = useMemo(() => indexElements(widget), [widget]);
  // The element the user clicked-to-target on the canvas (if any).
  const selectedId = useMentionStore((s) => s.targetId);

  // Feed the current widget + element list + current selection to the agent
  // every turn, so a follow-up prompt edits what's on the canvas, resolves
  // @element-id mentions, and knows which element is currently targeted.
  useAgentContext({
    description:
      "The current widget on the canvas (composition tree), its addressable elements (each with a stable id), and `selected` — the element the user has clicked-to-target (if any). Use this to EDIT the existing widget on follow-up requests, to resolve @element-id mentions, and when the user says 'this/it' without an id, prefer the `selected` element.",
    value: JSON.stringify({ widget: widget ?? null, elements, selected: selectedId }),
  });

  /** Validate, assign ids, render to canvas, and persist. Shared by all edits. */
  const applyTree = (tree: unknown): string => {
    const result = validateComposition(tree, registry);
    if (!result.ok) {
      setStatus({ ok: false, stage: "validate", errors: result.errors });
      return (
        "The composition did not validate. Fix these and try again:\n" +
        result.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")
      );
    }
    const withIds = ensureIds(result.value);
    setWidgetRef.current(withIds);
    setStatus({ ok: true });
    void fetch("/api/canvas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: threadRef.current ?? "default", widget: withIds }),
    }).catch(() => {});
    return "Rendered successfully.";
  };

  // Restore a thread's canvas from the DB when switching threads / on load.
  // Skip while collaborating — the shared session doc is the source of truth and
  // we must not clobber peers' edits with a DB snapshot.
  useEffect(() => {
    if (collabEnabled) return;
    const key = threadId ?? "default";
    let cancelled = false;
    fetch(`/api/canvas?threadId=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.widget) setWidgetRef.current(d.widget);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [threadId, collabEnabled]);

  // Auto-enable collaboration when the report contains an editable/collaborative
  // element — so "give me an editable thing" makes it instantly co-editable.
  useEffect(() => {
    if (collabEnabled || !widget) return;
    const COLLAB_BRICKS = new Set(["CollabText", "CollabChat"]);
    const hasEditable = (n: typeof widget): boolean =>
      !!n && (COLLAB_BRICKS.has(n.brick) || (n.children ?? []).some(hasEditable));
    if (hasEditable(widget)) enableCollab();
  }, [widget, collabEnabled, enableCollab]);

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
    handler: async ({ tree }) => applyTree(tree),
    // Show the assembled widget as a live preview in chat — not raw JSON.
    render: ({ args }) => <WidgetPreviewCard tree={args?.tree} />,
  });

  // --- In-place editing: refine the CURRENT widget by element id (@-targeting). ---
  // The agent's window into the live canvas. (useAgentContext only reaches
  // requestContext, not the LLM prompt, so the agent must fetch state via a tool.)
  useFrontendTool({
    name: "get_current_widget",
    description:
      "Return the CURRENT widget on the canvas as a composition tree plus a flat list of its addressable elements (id, brick, label) and the user's current @-selection. ALWAYS call this FIRST when the user asks to change/refine/edit anything, so you can target existing elements by id with edit_element instead of rebuilding from scratch.",
    parameters: z.object({}),
    handler: async () =>
      JSON.stringify({
        widget: widgetRef.current ?? null,
        elements: indexElements(widgetRef.current),
        selected: useMentionStore.getState().targetId,
      }),
  });

  useFrontendTool({
    name: "edit_element",
    description:
      "Edit one element of the current widget by id (resolve @mentions to ids). setProps shallow-merges props (recolor, relabel, change data). brick swaps the brick type (e.g. BarChart→CandlestickChart, LineChart→Table), carrying over compatible props. Use for targeted refinements instead of rebuilding.",
    parameters: z.object({
      id: z.string().describe("Target element id (without the @)"),
      setProps: z.record(z.unknown()).optional(),
      brick: z.string().optional().describe("New brick type to swap to"),
    }),
    handler: async ({ id, setProps, brick }) => {
      const tree = widgetRef.current;
      if (!tree) return "There is no widget on the canvas yet.";
      if (!findById(tree, id)) {
        return `No element "${id}". Available: ${indexElements(tree).map((e) => e.id).join(", ") || "(none)"}`;
      }
      if (brick && !registry.has(brick)) {
        return `Unknown brick "${brick}". Use list_bricks/search_bricks.`;
      }
      return applyTree(patchById(tree, id, { setProps, brick }));
    },
  });

  useFrontendTool({
    name: "add_element",
    description:
      "Add a new element (a composition node) as a child of an existing container element (by id). Use to insert a brick next to others.",
    parameters: z.object({
      parentId: z.string().describe("Id of a container element (Stack/Grid/Section/Card)"),
      node: renderWidgetInputSchema.shape.tree,
      index: z.number().int().optional(),
    }),
    handler: async ({ parentId, node, index }) => {
      const tree = widgetRef.current;
      if (!tree) return "There is no widget on the canvas yet.";
      if (!findById(tree, parentId)) return `No container "${parentId}".`;
      return applyTree(insertChild(tree, parentId, node as CompositionNode, index));
    },
  });

  useFrontendTool({
    name: "remove_element",
    description: "Remove an element from the current widget by id.",
    parameters: z.object({ id: z.string() }),
    handler: async ({ id }) => {
      const tree = widgetRef.current;
      if (!tree) return "There is no widget on the canvas yet.";
      const next = removeById(tree, id);
      if (!next) return "Can't remove the root element; rebuild instead.";
      return applyTree(next);
    },
  });

  useFrontendTool({
    name: "duplicate_element",
    description: "Duplicate an element (by id) as its next sibling.",
    parameters: z.object({ id: z.string() }),
    handler: async ({ id }) => {
      const tree = widgetRef.current;
      if (!tree) return "There is no widget on the canvas yet.";
      if (!findById(tree, id)) return `No element "${id}".`;
      return applyTree(duplicateById(tree, id));
    },
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

  // The foundry: build a brand-new brick (optionally backed by a new npm lib)
  // when NOTHING existing fits. Approval-gated unless Auto is on.
  useFrontendTool({
    name: "set_auto_bricks",
    description:
      "Turn Auto brick-creation on/off. When on, proposed new bricks are built immediately without an approval prompt.",
    parameters: z.object({ enabled: z.boolean() }),
    handler: async ({ enabled }) => {
      setAutoBricks(enabled);
      return enabled ? "Auto bricks ON." : "Auto bricks OFF (approval required).";
    },
  });

  useHumanInTheLoop({
    name: "create_brick",
    description:
      "Build a BRAND-NEW brick when no existing brick fits (check list_bricks/search_bricks first). Prefer a real library over misusing a brick (e.g. a graph lib for node graphs, not a Table). Provide: name (PascalCase), description, tags, optional npmPackage to install, schemaSource (a module exporting `schema` = a zod object and `type Props = z.infer<typeof schema>`), and componentSource (a module that STARTS with the \"use client\" directive, imports the lib + `import type { Props } from \"./schema\"`, and exports `function Component(props: Props)`). Use CSS vars (var(--border), var(--card), var(--foreground)) for theme. The user approves unless Auto is on. After it's created, use the new brick by name.",
    parameters: z.object({
      name: z.string().describe("PascalCase brick name, e.g. NodeGraph"),
      description: z.string(),
      tags: z.array(z.string()).optional(),
      npmPackage: z.string().optional().describe("npm package to install, e.g. reactflow"),
      schemaSource: z.string().describe("Full schema.ts module source"),
      componentSource: z.string().describe("Full component.tsx module source ('use client')"),
    }),
    render: ({ args, status, respond, result }) => (
      <FoundryCard
        spec={args}
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
                  <button
                    onClick={() => setAutoBricks(!autoBricks)}
                    title="Auto: build new bricks without an approval prompt"
                    className={
                      "rounded-[var(--radius)] border px-2.5 py-1 text-xs font-medium " +
                      (autoBricks
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]")
                    }
                  >
                    Auto bricks {autoBricks ? "on" : "off"}
                  </button>
                  <ExportMenu widget={widget} onImport={(t) => applyTree(t)} />
                  <StyleMenu />
                  <CollabControls />
                </div>
              }
            />
            <MentionOverlay elements={elements} />
            <CopilotSidebar
              defaultOpen={true}
              labels={{
                modalHeaderTitle: "Widget Composer",
                welcomeMessageText:
                  "👋 Describe a widget — I'll assemble it from bricks, then refine it. Try: \"a crypto dashboard\", then \"make @btc-chart candlesticks\". Use the Target button to click a piece, or type its @id.",
              }}
            />
          </main>
        </CopilotChatConfigurationProvider>
      </div>
    </div>
  );
}
