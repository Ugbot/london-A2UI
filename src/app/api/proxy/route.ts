/**
 * Outbound HTTP proxy for data-layer connections. The thin HTTP wrapper around
 * the hardened proxyFetch core (auth injection + SSRF guard + timeout + size cap
 * + no redirects live there). Optional bearer gate via WIDGET_API_KEY.
 *
 *   POST /api/proxy { connectionId?, endpointId?, url?, method?, pathParams?,
 *                     query?, headers?, body? }
 *     → 200 { ok, status, data }          (proxy reached the upstream)
 *     → 4xx/5xx { ok:false, status, error } (proxy rejected: SSRF/validation/etc.)
 */
import type { NextRequest } from "next/server";
import { proxyFetch } from "@/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: NextRequest): boolean {
  const required = process.env.WIDGET_API_KEY;
  if (!required) return false;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return token !== required;
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) {
    return Response.json({ ok: false, status: 401, error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, status: 400, error: "invalid JSON body" }, { status: 400 });
  }
  const result = await proxyFetch(body as Parameters<typeof proxyFetch>[0]);
  // Proxy-level failures (error set) surface as their HTTP code; an upstream
  // response (even 4xx) is wrapped in a 200 so the client can read status/data.
  return Response.json(result, { status: result.error ? result.status : 200 });
}
