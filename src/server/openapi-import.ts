/**
 * Shared OpenAPI → connection import, used by BOTH the /api/connections route and
 * the agent's import_openapi tool. A specUrl is fetched through the SSRF guard
 * (size-capped, JSON only); the spec is parsed locally (no remote $ref) and saved
 * as a connection. Secrets are NOT set here — the user adds them in the Data panel.
 */
import { assertSafeUrl } from "@/lib/ssrf";
import { parseOpenApi } from "@/lib/openapi";
import { createConnection, type AuthConfigFull, type ConnectionRedacted } from "./connections";

const ALLOW_LOCAL = process.env.PROXY_ALLOW_LOCAL === "1";
const MAX_SPEC_BYTES = 5 * 1024 * 1024;

/** Fetch an OpenAPI spec URL through the SSRF guard; size-capped, JSON. */
export async function fetchSpec(url: string): Promise<unknown> {
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

export interface ImportOpenApiInput {
  specUrl?: string;
  specJson?: unknown;
  name?: string;
  baseUrl?: string;
  auth?: AuthConfigFull;
}

export async function importOpenApiConnection(
  opts: ImportOpenApiInput,
): Promise<ConnectionRedacted> {
  const spec = opts.specJson ?? (opts.specUrl ? await fetchSpec(opts.specUrl) : null);
  if (!spec) throw new Error("specUrl or specJson is required");
  const parsed = parseOpenApi(spec, opts.specUrl);
  return createConnection({
    name: opts.name ?? parsed.name,
    baseUrl: opts.baseUrl ?? parsed.baseUrl,
    endpoints: parsed.endpoints,
    auth: opts.auth ?? { type: "none" },
  });
}
