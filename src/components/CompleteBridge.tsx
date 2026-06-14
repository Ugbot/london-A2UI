"use client";

/**
 * Bridges a wireframe's "Complete with AI" click to the chat agent. Mounted
 * inside the chat provider (where useAgent works); when a completion is queued
 * (useCompleteStore), it sends a message asking the agent to interview the user
 * and then replace the wireframe with real bricks. Renders nothing.
 */
import * as React from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { useCompleteStore } from "@/state/completeStore";

export function CompleteBridge() {
  const { agent } = useAgent();
  const pending = useCompleteStore((s) => s.pending);
  const consume = useCompleteStore((s) => s.consume);

  React.useEffect(() => {
    if (!pending || !agent) return;
    const req = consume();
    if (!req) return;
    const message =
      `Complete the @${req.id} wireframe (a ${req.kind}: "${req.label}"). ` +
      `First ask me 1–3 short questions with ask_user about the specifics ` +
      `(content, data source, style), then build the real bricks and REPLACE the ` +
      `wireframe by calling replace_element on @${req.id}.`;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
    agent.addMessage({ id, role: "user", content: message } as never);
    void agent.runAgent();
  }, [pending, agent, consume]);

  return null;
}
