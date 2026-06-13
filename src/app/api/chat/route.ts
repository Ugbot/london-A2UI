/**
 * Chat-transcript persistence: store/restore a session's conversation (the
 * AG-UI message array) in our own Postgres, so the chat restores alongside the
 * canvas — independent of the chat runtime's in-memory thread store.
 *
 * Keyed by the same opaque session id as the canvas. Id is bounded, the payload
 * is size-capped, and errors are sanitised (logged server-side).
 */
import { loadChat, saveChat } from "@/server/cache";
import { sanitizeMessages } from "@/lib/sanitize-messages";

export const runtime = "nodejs";

const ID_RE = /^[A-Za-z0-9_:.-]{1,128}$/;
const MAX_CHAT_BYTES = 4 * 1024 * 1024; // 4 MB transcript cap

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get("session");
  if (!session || !ID_RE.test(session)) return fail("valid session required", 400);
  try {
    const messages = await loadChat(session);
    return Response.json({ messages: messages ?? [] });
  } catch (err) {
    console.error("[chat:GET]", err);
    return fail("failed to load chat", 500);
  }
}

export async function POST(req: Request) {
  let body: { session?: string; messages?: unknown };
  try {
    body = (await req.json()) as { session?: string; messages?: unknown };
  } catch {
    return fail("invalid JSON body", 400);
  }
  if (!body.session || !ID_RE.test(body.session)) return fail("valid session required", 400);
  if (!Array.isArray(body.messages)) return fail("messages array required", 400);
  if (JSON.stringify(body.messages).length > MAX_CHAT_BYTES) {
    return fail("chat payload too large", 413);
  }
  // Defense-in-depth: never persist a transcript that could crash a future load
  // (malformed tool-call args, duplicate ids), even if a client skips its own pass.
  const clean = sanitizeMessages(body.messages);
  try {
    await saveChat(body.session, clean);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[chat:POST]", err);
    return fail("failed to save chat", 500);
  }
}
