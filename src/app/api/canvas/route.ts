/**
 * Canvas persistence: store/restore a session's widget composition tree in the
 * DB so reloading restores its canvas. Keyed by an opaque session/thread id.
 *
 * Hardening: the id is length/charset-bounded, the payload is size-capped (a
 * composition tree, not arbitrary blobs), and errors are sanitised (logged
 * server-side, generic message to the client).
 */
import { loadCanvas, saveCanvas } from "@/server/cache";

export const runtime = "nodejs";

// Bounds: ids are short opaque tokens; trees are modest JSON, not blobs.
const ID_RE = /^[A-Za-z0-9_:.-]{1,128}$/;
const MAX_WIDGET_BYTES = 2 * 1024 * 1024; // 2 MB

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const threadId = new URL(req.url).searchParams.get("threadId");
  if (!threadId || !ID_RE.test(threadId)) {
    return fail("valid threadId required", 400);
  }
  try {
    const widget = await loadCanvas(threadId);
    return Response.json({ widget });
  } catch (err) {
    console.error("[canvas:GET]", err);
    return fail("failed to load canvas", 500);
  }
}

export async function POST(req: Request) {
  let body: { threadId?: string; widget?: unknown };
  try {
    body = (await req.json()) as { threadId?: string; widget?: unknown };
  } catch {
    return fail("invalid JSON body", 400);
  }

  if (!body.threadId || !ID_RE.test(body.threadId)) {
    return fail("valid threadId required", 400);
  }
  if (body.widget === undefined) {
    return fail("widget required", 400);
  }
  // Reject oversized payloads before touching the DB.
  if (JSON.stringify(body.widget).length > MAX_WIDGET_BYTES) {
    return fail("widget payload too large", 413);
  }

  try {
    await saveCanvas(body.threadId, body.widget);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[canvas:POST]", err);
    return fail("failed to save canvas", 500);
  }
}
