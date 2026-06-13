"use client";

/**
 * Visual Data panel: manage data Connections (external APIs/CMSs). List them, add
 * one manually or by importing an OpenAPI spec, enter/update a secret (write-only
 * — the server never returns it), inspect endpoints, and delete. The agent wires
 * bricks to these connections; this panel is the human surface for secrets +
 * inspection. Mirrors the ReportsMenu dropdown pattern.
 */
import * as React from "react";

type AuthType = "none" | "bearer" | "apiKey" | "basic";
interface Endpoint {
  id: string;
  method: string;
  path: string;
  summary?: string;
}
interface Connection {
  id: string;
  name: string;
  baseUrl: string;
  auth: { type: AuthType; headerName?: string; hasSecret: boolean };
  endpoints: Endpoint[];
}

const btn =
  "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40";
const field =
  "h-8 w-full rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-2 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]";

export function DataPanel() {
  const [open, setOpen] = React.useState(false);
  const [conns, setConns] = React.useState<Connection[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [secretFor, setSecretFor] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setConns(null);
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => setConns(Array.isArray(d.connections) ? d.connections : []))
      .catch(() => setConns([]));
  }, []);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  // --- Add connection form state ---
  const [importMode, setImportMode] = React.useState<"manual" | "openapi">("manual");
  const [name, setName] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [authType, setAuthType] = React.useState<AuthType>("none");
  const [specUrl, setSpecUrl] = React.useState("");

  const resetAdd = () => {
    setName(""); setBaseUrl(""); setAuthType("none"); setSpecUrl(""); setImportMode("manual");
  };

  const submitAdd = async () => {
    setBusy(true); setErr(null);
    try {
      const body =
        importMode === "openapi"
          ? { source: "openapi", specUrl, name: name || undefined, authType }
          : { source: "manual", name, baseUrl, authType };
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "failed");
      setAdding(false); resetAdd(); load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to add connection");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    await fetch(`/api/connections?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Manage data connections (APIs/CMS) + secrets" className={btn}>
        Data
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 flex max-h-[32rem] w-96 flex-col gap-2 overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--card-foreground)] shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Data connections</span>
            <button className={btn} onClick={() => { setAdding((a) => !a); setErr(null); }}>
              {adding ? "Cancel" : "+ Add"}
            </button>
          </div>

          {adding && (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-2">
              <div className="flex gap-1 text-xs">
                {(["manual", "openapi"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setImportMode(m)}
                    className={[btn, importMode === m ? "border-[var(--primary)] bg-[var(--secondary)]" : ""].join(" ")}
                  >
                    {m === "manual" ? "Manual" : "OpenAPI"}
                  </button>
                ))}
              </div>
              <input className={field} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              {importMode === "manual" ? (
                <input className={field} placeholder="Base URL (https://api.example.com)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              ) : (
                <input className={field} placeholder="OpenAPI spec URL (JSON)" value={specUrl} onChange={(e) => setSpecUrl(e.target.value)} />
              )}
              <select className={field} value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
                <option value="none">No auth</option>
                <option value="bearer">Bearer token</option>
                <option value="apiKey">API key header</option>
                <option value="basic">Basic auth</option>
              </select>
              {err && <span className="text-xs text-red-600">{err}</span>}
              <button className={[btn, "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"].join(" ")} disabled={busy} onClick={submitAdd}>
                {busy ? "Adding…" : "Add connection"}
              </button>
              <span className="text-[10px] text-[var(--muted-foreground)]">Add the secret after creating it (below). Secrets are stored server-side and never shown.</span>
            </div>
          )}

          {conns === null && <span className="text-xs text-[var(--muted-foreground)]">Loading…</span>}
          {conns?.length === 0 && !adding && <span className="text-xs text-[var(--muted-foreground)]">No connections yet. Add one to fetch/submit data.</span>}

          {conns?.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-[10px] text-[var(--muted-foreground)]">{c.baseUrl}</div>
                </div>
                <span className={["shrink-0 rounded-full px-2 py-0.5 text-[10px]", c.auth.type === "none" ? "bg-[var(--secondary)] text-[var(--muted-foreground)]" : c.auth.hasSecret ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"].join(" ")}>
                  {c.auth.type === "none" ? "public" : c.auth.hasSecret ? "secret set" : "needs secret"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <button className={btn} onClick={() => setExpanded((x) => (x === c.id ? null : c.id))}>
                  {c.endpoints.length} endpoints
                </button>
                {c.auth.type !== "none" && (
                  <button className={btn} onClick={() => setSecretFor((s) => (s === c.id ? null : c.id))}>
                    {c.auth.hasSecret ? "Update secret" : "Set secret"}
                  </button>
                )}
                <button className={btn} onClick={() => del(c.id)}>Delete</button>
              </div>
              {expanded === c.id && (
                <ul className="mt-1 flex flex-col gap-0.5 text-[10px] text-[var(--muted-foreground)]">
                  {c.endpoints.length === 0 && <li>No endpoints.</li>}
                  {c.endpoints.map((e) => (
                    <li key={e.id} className="truncate">
                      <span className="font-mono font-semibold text-[var(--foreground)]">{e.method}</span> {e.path}
                      {e.summary ? ` — ${e.summary}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {secretFor === c.id && <SecretForm connection={c} onDone={() => { setSecretFor(null); load(); }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline secret-entry form (write-only PUT) for a connection's auth type. */
function SecretForm({ connection, onDone }: { connection: Connection; onDone: () => void }) {
  const [token, setToken] = React.useState("");
  const [headerName, setHeaderName] = React.useState(connection.auth.headerName ?? "X-API-Key");
  const [key, setKey] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    const auth =
      connection.auth.type === "bearer"
        ? { type: "bearer", token }
        : connection.auth.type === "apiKey"
          ? { type: "apiKey", headerName, key }
          : { type: "basic", username, password };
    await fetch("/api/connections", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: connection.id, auth }),
    }).catch(() => {});
    setBusy(false);
    onDone();
  };

  return (
    <div className="mt-1 flex flex-col gap-1 rounded-[var(--radius)] bg-[var(--secondary)] p-2">
      {connection.auth.type === "bearer" && (
        <input className={field} type="password" placeholder="Bearer token" value={token} onChange={(e) => setToken(e.target.value)} />
      )}
      {connection.auth.type === "apiKey" && (
        <>
          <input className={field} placeholder="Header name" value={headerName} onChange={(e) => setHeaderName(e.target.value)} />
          <input className={field} type="password" placeholder="API key" value={key} onChange={(e) => setKey(e.target.value)} />
        </>
      )}
      {connection.auth.type === "basic" && (
        <>
          <input className={field} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      )}
      <button className={[btn, "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"].join(" ")} disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save secret"}
      </button>
    </div>
  );
}
