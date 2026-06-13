/**
 * Outbound proxy core (server-only). Loads a connection, injects its auth secret,
 * SSRF-guards the target, fetches with a timeout + size cap, refuses redirects,
 * and returns a sanitized result. Shared by the /api/proxy route and the agent's
 * call_api tool so there is ONE hardened request path. Secrets never leave here.
 */
import {
  getConnectionFull,
  type AuthConfigFull,
  type HttpMethod,
} from "./connections";
import { assertSafeUrl, SsrfError } from "@/lib/ssrf";

const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 10_000);
const MAX_BYTES = Number(process.env.PROXY_MAX_BYTES ?? 2 * 1024 * 1024);
const ALLOW_LOCAL = process.env.PROXY_ALLOW_LOCAL === "1";

export interface ProxyRequest {
  connectionId?: string;
  endpointId?: string;
  url?: string;
  method?: HttpMethod;
  pathParams?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ProxyResult {
  ok: boolean;
  /** Upstream HTTP status, or a proxy-level error code (400/404/502). */
  status: number;
  data: unknown;
  /** Set only on a proxy-level failure (used as the route's HTTP status). */
  error?: string;
}

function applyAuth(headers: Record<string, string>, auth: AuthConfigFull): void {
  if (auth.type === "bearer" && auth.token) {
    headers["authorization"] = `Bearer ${auth.token}`;
  } else if (auth.type === "apiKey" && auth.headerName && auth.key) {
    headers[auth.headerName] = auth.key;
  } else if (auth.type === "basic" && (auth.username || auth.password)) {
    const creds = `${auth.username ?? ""}:${auth.password ?? ""}`;
    headers["authorization"] = "Basic " + Buffer.from(creds).toString("base64");
  }
}

function buildUrl(
  base: string,
  path: string,
  pathParams?: Record<string, string>,
  query?: Record<string, string | number | boolean>,
): string {
  let p = path;
  for (const [k, v] of Object.entries(pathParams ?? {})) {
    p = p.split(`{${k}}`).join(encodeURIComponent(v));
  }
  const joined = base.replace(/\/$/, "") + (p ? (p.startsWith("/") ? p : "/" + p) : "");
  const u = new URL(joined);
  for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, String(v));
  return u.toString();
}

async function readCapped(res: Response): Promise<string> {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("response too large");
  const text = await res.text();
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
}

function fail(status: number, error: string): ProxyResult {
  return { ok: false, status, data: null, error };
}

export async function proxyFetch(req: ProxyRequest): Promise<ProxyResult> {
  let method: HttpMethod = req.method ?? "GET";
  let targetUrl: string;
  let allowedHost: string | undefined;
  const headers: Record<string, string> = {};

  if (req.connectionId) {
    const conn = await getConnectionFull(req.connectionId);
    if (!conn) return fail(404, "connection not found");
    let path = req.url ?? "/";
    if (req.endpointId) {
      const ep = conn.endpoints.find((e) => e.id === req.endpointId);
      if (!ep) return fail(404, "endpoint not found");
      path = ep.path;
      method = req.method ?? ep.method;
    }
    try {
      targetUrl = buildUrl(conn.baseUrl, path, req.pathParams, req.query);
      allowedHost = new URL(conn.baseUrl).hostname;
    } catch {
      return fail(400, "invalid connection base URL or path");
    }
    Object.assign(headers, conn.defaultHeaders ?? {});
    applyAuth(headers, conn.auth);
  } else if (req.url) {
    try {
      targetUrl = buildUrl(req.url, "", undefined, req.query);
    } catch {
      return fail(400, "invalid url");
    }
  } else {
    return fail(400, "connectionId or url is required");
  }

  // Caller headers are added only if they don't collide with default/auth headers
  // (auth must win — a caller can't override the injected secret header).
  const present = new Set(Object.keys(headers).map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    if (!present.has(k.toLowerCase())) headers[k] = v;
  }

  let safe: URL;
  try {
    safe = await assertSafeUrl(targetUrl, { allowedHost, allowLocal: ALLOW_LOCAL });
  } catch (e) {
    return fail(400, e instanceof SsrfError ? e.message : "blocked target");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const init: RequestInit = { method, headers, redirect: "manual", signal: ctrl.signal };
    if (method !== "GET" && req.body !== undefined) {
      if (!present.has("content-type") && !("content-type" in headers)) {
        headers["content-type"] = "application/json";
      }
      init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }
    const res = await fetch(safe, init);
    // Refuse redirects: a 3xx Location could escape the allowlist.
    if (res.status >= 300 && res.status < 400) {
      return fail(res.status, "redirects are not allowed");
    }
    const text = await readCapped(res);
    const ct = res.headers.get("content-type") ?? "";
    let data: unknown = text;
    if (ct.includes("application/json") || ct.includes("+json")) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return fail(502, ctrl.signal.aborted ? "upstream timeout" : "upstream request failed");
  } finally {
    clearTimeout(timer);
  }
}
