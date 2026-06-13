/**
 * Externally-callable widget-build API.
 *
 *   POST /api/widget   { "prompt": "a sales dashboard with KPI cards", "maxSteps"?: 16 }
 *     → 200 { ok: true, widget: <composition tree>, elements: [...], attempts, message }
 *     → 422 { ok: false, error, errors }   (agent couldn't produce a valid tree)
 *     → 400 { ok: false, error }           (bad request body)
 *
 *   GET /api/widget    → usage docs + whether auth is required.
 *
 * The returned `widget` is the canonical composition tree: re-importable into
 * the canvas (Export ▸ Import JSON) and renderable by the brick library. Auth is
 * optional: set WIDGET_API_KEY to require `Authorization: Bearer <key>`.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildWidget } from "@/mastra/build";
import { AVAILABLE_MODELS } from "@/mastra/provider";

// The Mastra agent + pgvector + pg need the Node.js runtime (not edge).
export const runtime = "nodejs";
// Builds make live LLM/research calls; never cache.
export const dynamic = "force-dynamic";
// Hard wall-clock ceiling for the route (seconds) — Next aborts beyond this.
export const maxDuration = 120;

// Build timeout (ms): abort a wedged LLM/research loop so a caller never hangs.
const BUILD_TIMEOUT_MS = Number(process.env.WIDGET_BUILD_TIMEOUT_MS ?? 110_000);

const bodySchema = z.object({
  prompt: z.string().trim().min(1, "prompt is required").max(4000),
  maxSteps: z.number().int().min(1).max(24).optional(),
  // Runtime model selection, "provider:model" (e.g. "anthropic:claude-opus-4-8")
  // or a bare model id. Omitted → server env default (AGENT_PROVIDER/AGENT_MODEL).
  model: z.string().max(120).optional(),
});

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

/** Optional bearer-token gate. Open when WIDGET_API_KEY is unset (dev). */
function unauthorized(req: NextRequest): boolean {
  const required = process.env.WIDGET_API_KEY;
  if (!required) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token !== required;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  return json({
    ok: true,
    service: "london-A2UI widget builder",
    usage: {
      method: "POST",
      path: "/api/widget",
      body: {
        prompt: "string (1-4000 chars)",
        maxSteps: "number 1-24 (optional)",
        model: "'provider:model' or model id (optional; default from AGENT_PROVIDER/AGENT_MODEL)",
      },
      models: AVAILABLE_MODELS.map((m) => m.id),
      auth: process.env.WIDGET_API_KEY
        ? "required: Authorization: Bearer <WIDGET_API_KEY>"
        : "none (set WIDGET_API_KEY to require a bearer token)",
      returns:
        "{ ok, widget: <composition tree>, elements: [{id,brick,label}], attempts, message }",
    },
  });
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : "Invalid JSON body";
    return json({ ok: false, error: msg }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);
  try {
    const result = await buildWidget(parsed.prompt, {
      maxSteps: parsed.maxSteps,
      signal: controller.signal,
      model: parsed.model,
    });
    if (!result.ok) {
      return json(
        {
          ok: false,
          error: "The agent could not produce a valid widget for that prompt.",
          errors: result.errors ?? [],
          message: result.message,
          attempts: result.attempts,
        },
        422,
      );
    }
    return json({
      ok: true,
      widget: result.widget,
      elements: result.elements,
      attempts: result.attempts,
      message: result.message,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      return json(
        { ok: false, error: `Build timed out after ${BUILD_TIMEOUT_MS}ms` },
        504,
      );
    }
    // Sanitised: a short message, never a stack trace.
    const msg = err instanceof Error ? err.message : "Widget build failed";
    return json({ ok: false, error: msg.slice(0, 300) }, 500);
  } finally {
    clearTimeout(timer);
  }
}
