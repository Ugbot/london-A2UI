/**
 * Data-layer connections: external data sources (REST/OpenAPI CMS/APIs) the SPA
 * maps over. This module owns the SECURITY BOUNDARY: the FULL shape (with
 * secrets) never leaves the server — only the REDACTED shape crosses to the
 * client/agent. `getConnectionFull` is server-internal (used by the proxy only).
 *
 * Mirrors the cache.ts idiom: `await migrate()` first, parameterized queries.
 */
import { getPool, migrate } from "./db";

export type AuthType = "none" | "bearer" | "apiKey" | "basic";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** FULL auth — server-only; holds secrets. Never serialized to a client. */
export interface AuthConfigFull {
  type: AuthType;
  token?: string; // bearer
  headerName?: string; // apiKey header name (e.g. "X-API-Key")
  key?: string; // apiKey value
  username?: string; // basic
  password?: string; // basic
}

export interface EndpointDef {
  id: string; // slug
  method: HttpMethod;
  path: string; // relative to baseUrl, may contain {param}
  summary?: string;
  requestSchema?: Record<string, unknown>; // JSON-schema of the request body
}

/** FULL connection — server-only. */
export interface ConnectionFull {
  id: string;
  name: string;
  baseUrl: string;
  auth: AuthConfigFull;
  defaultHeaders: Record<string, string>;
  endpoints: EndpointDef[];
  createdAt: string;
  updatedAt: string;
}

/** REDACTED auth — the only auth shape that crosses to the client/agent. */
export interface AuthConfigRedacted {
  type: AuthType;
  headerName?: string;
  hasSecret: boolean;
}

/** REDACTED connection — safe to return over HTTP / to the agent. */
export interface ConnectionRedacted {
  id: string;
  name: string;
  baseUrl: string;
  auth: AuthConfigRedacted;
  defaultHeaders: Record<string, string>;
  endpoints: EndpointDef[];
  createdAt: string;
  updatedAt: string;
}

/** Header names whose VALUES are sensitive and must be masked when redacting. */
const SENSITIVE_HEADER_RE = /authorization|api[-_]?key|token|secret|cookie/i;

/** Strip secrets from a connection. PURE — unit-tested without a DB. */
export function redact(full: ConnectionFull): ConnectionRedacted {
  const a = full.auth ?? { type: "none" };
  const hasSecret =
    (a.type === "bearer" && !!a.token) ||
    (a.type === "apiKey" && !!a.key) ||
    (a.type === "basic" && !!(a.username || a.password));

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(full.defaultHeaders ?? {})) {
    headers[k] = SENSITIVE_HEADER_RE.test(k) ? "••••" : v;
  }

  return {
    id: full.id,
    name: full.name,
    baseUrl: full.baseUrl,
    auth: { type: a.type, headerName: a.headerName, hasSecret },
    defaultHeaders: headers,
    endpoints: full.endpoints ?? [],
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
  };
}

interface ConnectionRow {
  id: string;
  name: string;
  base_url: string;
  auth: AuthConfigFull | null;
  default_headers: Record<string, string> | null;
  endpoints: EndpointDef[] | null;
  created_at: Date;
  updated_at: Date;
}

function rowToFull(r: ConnectionRow): ConnectionFull {
  return {
    id: r.id,
    name: r.name,
    baseUrl: r.base_url,
    auth: r.auth ?? { type: "none" },
    defaultHeaders: r.default_headers ?? {},
    endpoints: r.endpoints ?? [],
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export interface CreateConnectionInput {
  name: string;
  baseUrl: string;
  auth?: AuthConfigFull;
  defaultHeaders?: Record<string, string>;
  endpoints?: EndpointDef[];
}

export async function createConnection(
  input: CreateConnectionInput,
): Promise<ConnectionRedacted> {
  await migrate();
  const pool = await getPool();
  const { rows } = await pool.query<ConnectionRow>(
    `INSERT INTO connections (name, base_url, auth, default_headers, endpoints)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
     RETURNING *`,
    [
      input.name,
      input.baseUrl,
      JSON.stringify(input.auth ?? { type: "none" }),
      JSON.stringify(input.defaultHeaders ?? {}),
      JSON.stringify(input.endpoints ?? []),
    ],
  );
  return redact(rowToFull(rows[0]));
}

export async function listConnections(): Promise<ConnectionRedacted[]> {
  await migrate();
  const pool = await getPool();
  const { rows } = await pool.query<ConnectionRow>(
    `SELECT * FROM connections ORDER BY updated_at DESC`,
  );
  return rows.map((r) => redact(rowToFull(r)));
}

/** Server-internal ONLY — returns secrets. Never expose via an HTTP GET. */
export async function getConnectionFull(id: string): Promise<ConnectionFull | null> {
  await migrate();
  const pool = await getPool();
  const { rows } = await pool.query<ConnectionRow>(
    `SELECT * FROM connections WHERE id = $1`,
    [id],
  );
  return rows[0] ? rowToFull(rows[0]) : null;
}

export async function getConnectionRedacted(
  id: string,
): Promise<ConnectionRedacted | null> {
  const full = await getConnectionFull(id);
  return full ? redact(full) : null;
}

/** Write-only secret update — the GET never returns it. */
export async function updateSecret(
  id: string,
  auth: AuthConfigFull,
): Promise<ConnectionRedacted | null> {
  await migrate();
  const pool = await getPool();
  const { rows } = await pool.query<ConnectionRow>(
    `UPDATE connections SET auth = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(auth)],
  );
  return rows[0] ? redact(rowToFull(rows[0])) : null;
}

/** Add or replace an endpoint (by id) on a connection. */
export async function addEndpoint(
  id: string,
  endpoint: EndpointDef,
): Promise<ConnectionRedacted | null> {
  const full = await getConnectionFull(id);
  if (!full) return null;
  const endpoints = [...full.endpoints.filter((e) => e.id !== endpoint.id), endpoint];
  const pool = await getPool();
  const { rows } = await pool.query<ConnectionRow>(
    `UPDATE connections SET endpoints = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(endpoints)],
  );
  return rows[0] ? redact(rowToFull(rows[0])) : null;
}

export async function deleteConnection(id: string): Promise<boolean> {
  await migrate();
  const pool = await getPool();
  const { rowCount } = await pool.query(`DELETE FROM connections WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
