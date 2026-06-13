/**
 * Connections CRUD + OpenAPI import.
 *   GET    /api/connections            → { connections: ConnectionRedacted[] }
 *   POST   /api/connections            → create: { source:"openapi", specUrl?|specJson?, ... }
 *                                                 | { source:"manual", name, baseUrl, authType?, endpoints? }
 *   PUT    /api/connections            → set secret: { id, auth: AuthConfigFull }  (write-only)
 *   PATCH  /api/connections            → add endpoint: { id, endpoint: EndpointDef }
 *   DELETE /api/connections?id=<id>    → remove
 *
 * Only the REDACTED shape is ever returned. Secret writes never echo the secret.
 * A specUrl import is fetched through the SSRF guard (no internal targets).
 */
import type { NextRequest } from "next/server";
import {
  listConnections,
  createConnection,
  updateSecret,
  addEndpoint,
  deleteConnection,
  type AuthConfigFull,
  type AuthType,
  type EndpointDef,
} from "@/server/connections";
import { parseOpenApi } from "@/lib/openapi";
import { assertSafeUrl, SsrfError } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOW_LOCAL = process.env.PROXY_ALLOW_LOCAL === "1";
const MAX_SPEC_BYTES = 5 * 1024 * 1024;

interface Body {
  source?: "openapi" | "manual";
  name?: string;
  baseUrl?: string;
  authType?: AuthType;
  headerName?: string;
  endpoints?: EndpointDef[];
  specUrl?: string;
  specJson?: unknown;
  id?: string;
  auth?: AuthConfigFull;
  endpoint?: EndpointDef;
}

function unauthorized(req: NextRequest): boolean {
  const required = process.env.WIDGET_API_KEY;
  if (!required) return false;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return token !== required;
}

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Fetch an OpenAPI spec URL through the SSRF guard, size-capped, JSON only. */
async function fetchSpec(url: string): Promise<unknown> {
  const safe = await assertSafeUrl(url, { allowLocal: ALLOW_LOCAL });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(safe, { signal: ctrl.signal, redirect: "manual" });
    if (!res.ok) throw new Error(`spec fetch failed (${res.status})`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_SPEC_BYTES) {
      throw new Error("spec too large");
    }
    const text = await res.text();
    if (text.length > MAX_SPEC_BYTES) throw new Error("spec too large");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) return fail("Unauthorized", 401);
  try {
    return Response.json({ connections: await listConnections() });
  } catch (err) {
    console.error("[connections:GET]", err);
    return fail("failed to list connections", 500);
  }
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) return fail("Unauthorized", 401);
  let b: Body;
  try {
    b = (await req.json()) as Body;
  } catch {
    return fail("invalid JSON body", 400);
  }
  const auth: AuthConfigFull = b.authType
    ? { type: b.authType, headerName: b.headerName }
    : { type: "none" };
  try {
    if (b.source === "openapi") {
      const spec = b.specJson ?? (b.specUrl ? await fetchSpec(b.specUrl) : null);
      if (!spec) return fail("specUrl or specJson is required", 400);
      const parsed = parseOpenApi(spec, b.specUrl);
      const connection = await createConnection({
        name: b.name ?? parsed.name,
        baseUrl: b.baseUrl ?? parsed.baseUrl,
        endpoints: parsed.endpoints,
        auth,
      });
      return Response.json({ connection });
    }
    if (!b.name || !b.baseUrl) return fail("name and baseUrl are required", 400);
    const connection = await createConnection({
      name: b.name,
      baseUrl: b.baseUrl,
      auth,
      endpoints: Array.isArray(b.endpoints) ? b.endpoints : [],
    });
    return Response.json({ connection });
  } catch (err) {
    console.error("[connections:POST]", err);
    const msg = err instanceof SsrfError || err instanceof Error ? err.message : "failed to create connection";
    return fail(msg.slice(0, 200), 400);
  }
}

export async function PUT(req: NextRequest) {
  if (unauthorized(req)) return fail("Unauthorized", 401);
  let b: Body;
  try {
    b = (await req.json()) as Body;
  } catch {
    return fail("invalid JSON body", 400);
  }
  if (!b.id || !b.auth || typeof b.auth !== "object") return fail("id and auth are required", 400);
  try {
    const connection = await updateSecret(b.id, b.auth);
    return connection ? Response.json({ connection }) : fail("connection not found", 404);
  } catch (err) {
    console.error("[connections:PUT]", err);
    return fail("failed to update secret", 500);
  }
}

export async function PATCH(req: NextRequest) {
  if (unauthorized(req)) return fail("Unauthorized", 401);
  let b: Body;
  try {
    b = (await req.json()) as Body;
  } catch {
    return fail("invalid JSON body", 400);
  }
  if (!b.id || !b.endpoint) return fail("id and endpoint are required", 400);
  try {
    const connection = await addEndpoint(b.id, b.endpoint);
    return connection ? Response.json({ connection }) : fail("connection not found", 404);
  } catch (err) {
    console.error("[connections:PATCH]", err);
    return fail("failed to add endpoint", 500);
  }
}

export async function DELETE(req: NextRequest) {
  if (unauthorized(req)) return fail("Unauthorized", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("id is required", 400);
  try {
    return Response.json({ ok: await deleteConnection(id) });
  } catch (err) {
    console.error("[connections:DELETE]", err);
    return fail("failed to delete connection", 500);
  }
}
