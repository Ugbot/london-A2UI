/**
 * Shared state between the agent and the canvas. The agent pushes a `widget`
 * composition tree via AG-UI state snapshots; the canvas renders it and writes
 * back a `renderStatus` so the agent can repair runtime failures.
 */
import type { CompositionError, CompositionNode } from "@/bricks/composition";

/** Outcome of validating + rendering the current widget. */
export type RenderStatus =
  | { ok: true }
  | { ok: false; stage: "validate" | "render"; errors: CompositionError[] };

export type AgentState = {
  /** The composition tree currently on the canvas (null = empty). */
  widget: CompositionNode | null;
  /** Last render outcome, written by the canvas for the repair loop. */
  renderStatus: RenderStatus | null;
};

export const initialAgentState: AgentState = {
  widget: null,
  renderStatus: null,
};
