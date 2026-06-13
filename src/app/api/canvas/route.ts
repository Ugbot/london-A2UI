/**
 * Canvas persistence: store/restore a thread's widget composition tree in the
 * DB so opening a previous chat restores its canvas (chat itself is persisted
 * by CopilotKit Intelligence).
 */
import { loadCanvas, saveCanvas } from "@/server/cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const threadId = new URL(req.url).searchParams.get("threadId");
  if (!threadId) {
    return Response.json({ error: "threadId required" }, { status: 400 });
  }
  try {
    const widget = await loadCanvas(threadId);
    return Response.json({ widget });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { threadId?: string; widget?: unknown };
    if (!body.threadId || body.widget === undefined) {
      return Response.json({ error: "threadId and widget required" }, { status: 400 });
    }
    await saveCanvas(body.threadId, body.widget);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
