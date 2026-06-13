"use client";

/**
 * Persists the chat transcript per session in our own DB (via /api/chat), so the
 * conversation restores alongside the canvas — independent of the chat runtime's
 * in-memory thread store (which is lost on server restart).
 *
 * - Restores the saved messages once per session, only if the live chat is empty
 *   (so it never clobbers an in-progress conversation).
 * - Saves the full transcript whenever a run finishes or fails.
 *
 * Renders nothing; mount it inside the CopilotKit chat provider tree.
 */
import * as React from "react";
import { useAgent } from "@copilotkit/react-core/v2";

export function ChatPersistence({ session }: { session: string | null }) {
  const { agent } = useAgent();
  const restoredFor = React.useRef<string | null>(null);

  // Restore the saved transcript once per session. Delayed slightly so the
  // runtime's initial connect can't overwrite the restored messages, and guarded
  // on an empty live chat so we never stomp an active conversation.
  React.useEffect(() => {
    if (!session || !agent || restoredFor.current === session) return;
    restoredFor.current = session;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/chat?session=${encodeURIComponent(session)}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const msgs = d?.messages;
          if (Array.isArray(msgs) && msgs.length > 0 && agent.messages.length === 0) {
            agent.setMessages(msgs);
          }
        })
        .catch(() => {});
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, agent]);

  // Save the transcript when a run settles.
  React.useEffect(() => {
    if (!session || !agent) return;
    const persist = () => {
      const messages = agent.messages;
      if (!messages || messages.length === 0) return;
      void fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, messages }),
      }).catch(() => {});
    };
    const sub = agent.subscribe({ onRunFinalized: persist, onRunFailed: persist });
    return () => sub.unsubscribe();
  }, [session, agent]);

  return null;
}
