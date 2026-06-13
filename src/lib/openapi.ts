/**
 * Minimal, dependency-free OpenAPI/Swagger parser — extracts just what a
 * connection needs: name, base URL, and endpoints (method, path, summary, request
 * body JSON-schema). Resolves ONLY local `#/...` $refs (with a visited + depth
 * guard); never fetches remote $refs (that would be an SSRF vector). Caps spec
 * size + endpoint count. We hand-parse rather than pull a heavy spec library.
 */
import type { EndpointDef, HttpMethod } from "@/server/connections";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const MAX_ENDPOINTS = 300;
const MAX_REF_DEPTH = 16;

export interface ParsedSpec {
  name: string;
  baseUrl: string;
  endpoints: EndpointDef[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function slug(input: string): string {
  // Preserve a readable operationId (case + underscores); only sanitize the rest.
  return (
    input
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "endpoint"
  );
}

/** Resolve a JSON pointer like "#/components/schemas/Pet" within the same doc. */
function resolvePointer(root: Obj, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined; // remote refs are never followed
  let cur: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Deep-resolve local $refs in a schema, guarding cycles + depth. */
function resolveRefs(node: unknown, root: Obj, seen: Set<string>, depth: number): unknown {
  if (depth > MAX_REF_DEPTH) return {};
  if (Array.isArray(node)) return node.map((n) => resolveRefs(n, root, seen, depth + 1));
  if (!isObj(node)) return node;

  const ref = str(node.$ref);
  if (ref) {
    if (seen.has(ref)) return {}; // cycle
    const target = resolvePointer(root, ref);
    if (target === undefined) return {}; // remote/unknown ref → drop
    const next = new Set(seen);
    next.add(ref);
    return resolveRefs(target, root, next, depth + 1);
  }

  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) out[k] = resolveRefs(v, root, seen, depth + 1);
  return out;
}

function requestSchema(op: Obj, root: Obj): Record<string, unknown> | undefined {
  const rb = op.requestBody;
  if (!isObj(rb)) return undefined;
  const content = rb.content;
  if (!isObj(content)) return undefined;
  const json = content["application/json"] ?? content["application/*+json"];
  if (!isObj(json) || !isObj(json.schema)) return undefined;
  const resolved = resolveRefs(json.schema, root, new Set(), 0);
  return isObj(resolved) ? resolved : undefined;
}

function resolveBaseUrl(doc: Obj, specUrl?: string): string {
  // OpenAPI 3: servers[0].url
  const servers = doc.servers;
  let base = Array.isArray(servers) && isObj(servers[0]) ? str(servers[0].url) ?? "" : "";
  // Swagger 2: host + basePath + schemes
  if (!base && str(doc.host)) {
    const schemes = Array.isArray(doc.schemes) ? (doc.schemes as unknown[]).map(String) : [];
    const scheme = schemes.includes("https") ? "https" : schemes[0] ?? "https";
    base = `${scheme}://${str(doc.host)}${str(doc.basePath) ?? ""}`;
  }
  // Resolve a relative server URL against the spec URL.
  if (base && specUrl && !/^https?:\/\//i.test(base)) {
    try {
      base = new URL(base, specUrl).toString();
    } catch {
      /* keep as-is */
    }
  }
  return base.replace(/\/$/, "");
}

/** Parse an OpenAPI/Swagger document into a connection-ready ParsedSpec. */
export function parseOpenApi(spec: unknown, specUrl?: string): ParsedSpec {
  if (!isObj(spec)) throw new Error("OpenAPI spec must be a JSON object");
  const info = isObj(spec.info) ? spec.info : {};
  const name = str(info.title) ?? "Imported API";
  const baseUrl = resolveBaseUrl(spec, specUrl);

  const endpoints: EndpointDef[] = [];
  const paths = isObj(spec.paths) ? spec.paths : {};
  const seenIds = new Set<string>();

  for (const [path, item] of Object.entries(paths)) {
    if (!isObj(item)) continue;
    for (const [method, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !isObj(op)) continue;
      if (endpoints.length >= MAX_ENDPOINTS) return { name, baseUrl, endpoints };
      let id = slug(str(op.operationId) ?? `${method}-${path}`);
      while (seenIds.has(id)) id = `${id}-${seenIds.size}`;
      seenIds.add(id);
      endpoints.push({
        id,
        method: method.toUpperCase() as HttpMethod,
        path,
        summary: str(op.summary) ?? str(op.description),
        requestSchema: requestSchema(op, spec),
      });
    }
  }

  if (endpoints.length === 0) throw new Error("no endpoints found in spec");
  return { name, baseUrl, endpoints };
}
