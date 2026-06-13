/**
 * Sanitize a persisted chat transcript before it is saved or restored, so a
 * malformed run can't poison the chat (and crash every subsequent load).
 *
 * Guards two failure modes seen in the wild:
 *   1. Malformed tool-call arguments (e.g. `{}{}` or trailing junk) → the chat
 *      runtime JSON.parses them and the run crashes. We repair to valid JSON.
 *   2. Duplicate message / tool-call ids → React renders them with the same key
 *      ("Encountered two children with the same key") and the chat view errors.
 *      We drop later duplicates.
 *
 * Pure + dependency-light so it runs on both the client and the server.
 */
import { repairToolArgs } from "./json-repair";

interface ToolCall {
  id?: string;
  function?: { name?: string; arguments?: unknown };
  [k: string]: unknown;
}
interface Message {
  id?: string;
  role?: string;
  toolCalls?: ToolCall[];
  [k: string]: unknown;
}

export function sanitizeMessages(input: unknown): Message[] {
  if (!Array.isArray(input)) return [];
  const seenMessageIds = new Set<string>();
  const seenToolCallIds = new Set<string>();
  const out: Message[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const msg = { ...(raw as Message) };

    // Drop duplicate message ids (would collide as React keys).
    if (typeof msg.id === "string") {
      if (seenMessageIds.has(msg.id)) continue;
      seenMessageIds.add(msg.id);
    }

    if (Array.isArray(msg.toolCalls)) {
      const calls: ToolCall[] = [];
      for (const call of msg.toolCalls) {
        if (!call || typeof call !== "object") continue;
        const id = typeof call.id === "string" ? call.id : undefined;
        // Drop duplicate tool-call ids (the React key crash).
        if (id && seenToolCallIds.has(id)) continue;

        let next = call;
        const fn = call.function;
        if (fn && typeof fn.arguments === "string") {
          const repaired = repairToolArgs(fn.arguments);
          if (repaired === null) continue; // unrepairable → drop the tool call
          next = { ...call, function: { ...fn, arguments: repaired } };
        }
        if (id) seenToolCallIds.add(id);
        calls.push(next);
      }
      msg.toolCalls = calls;
    }

    out.push(msg);
  }

  return out;
}
