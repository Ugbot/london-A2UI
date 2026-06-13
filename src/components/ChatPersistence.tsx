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
import { sanitizeMessages } from "@/lib/sanitize-messages";

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
          // Sanitize before restoring: repair malformed tool-call args + drop
          // duplicate ids so an old broken transcript can't crash the chat view.
          const msgs = sanitizeMessages(d?.messages);
          if (msgs.length > 0 && agent.messages.length === 0) {
            agent.setMessages(msgs as never);
          }
        })
        .catch(() => {});
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, agent]);

  // Save the transcript when a run completes successfully. We do NOT save on
  // failure: a crashed run can leave malformed tool calls in the buffer, and
  // persisting them would poison the next restore. Sanitize on the way out too,
  // so the DB never holds a transcript that can crash a future load.
  React.useEffect(() => {
    if (!session || !agent) return;
    const persist = () => {
      const messages = sanitizeMessages(agent.messages as unknown);
      if (messages.length === 0) return;
      void fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, messages }),
      }).catch(() => {});
    };
    const sub = agent.subscribe({ onRunFinalized: persist });
    return () => sub.unsubscribe();
  }, [session, agent]);

  return null;
}
