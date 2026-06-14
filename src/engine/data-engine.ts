/**
 * The data engine — ALL fetching/polling/submitting, centralized.
 *
 * Runs against a given Y.Doc and is import-safe for a Web Worker (no React/DOM): it
 * fetches via /api/proxy (secrets stay server-side — it never imports proxyFetch),
 * applies a json path + optional mortar transform, and writes results into the doc's
 * keyed read-model. In the worker it operates on the synced replica; the result flows
 * back to the main doc via the Yjs provider. The SAME code runs in-process as a
 * fallback when no worker is available.
 *
 * Owns polling timers, in-flight dedupe, and a per-key fetch-config cache (so a form's
 * refetchKeys can re-pull a dataset). Status is published to `${key}__status`
 * ("loading" | "live" | "error") + `${key}__error`, which the data bricks render.
 */
import * as Y from "yjs";
import {
  ORIGIN,
  applyDataAction,
  readData,
  readAllData,
} from "@/collab/doc-model";
import { assembleFormBody } from "@/bricks/form-util";
import { runMortar } from "@/mortar/run";
import type { Command, DataSourceSpec } from "./commands";

export const statusKey = (key: string) => `${key}__status`;
export const errorKey = (key: string) => `${key}__error`;
export type FetchStatus = "loading" | "live" | "error";

/** Read a dotted path out of a fetched payload (e.g. "data.items"). */
function getJsonPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

interface FetchConfig {
  source: DataSourceSpec;
  jsonPath?: string;
  transform?: string;
}
interface EngineState {
  inFlight: Set<string>;
  polls: Map<string, ReturnType<typeof setInterval>>;
  configs: Map<string, FetchConfig>;
}
const states = new WeakMap<Y.Doc, EngineState>();
function state(doc: Y.Doc): EngineState {
  let s = states.get(doc);
  if (!s) {
    s = { inFlight: new Set(), polls: new Map(), configs: new Map() };
    states.set(doc, s);
  }
  return s;
}

function setStatus(doc: Y.Doc, key: string, status: FetchStatus, error?: string): void {
  applyDataAction(doc, { action: "set", target: statusKey(key), value: status }, ORIGIN.worker);
  if (error) {
    applyDataAction(doc, { action: "set", target: errorKey(key), value: error }, ORIGIN.worker);
  } else {
    applyDataAction(doc, { action: "remove", target: errorKey(key) }, ORIGIN.worker);
  }
}

/** Resolve a data source to a raw payload (proxy POST or direct fetch). */
async function fetchSource(source: DataSourceSpec): Promise<unknown> {
  if (source.mode === "direct" && source.url) {
    const res = await fetch(source.url, {
      method: source.method ?? "GET",
      headers: source.headers,
      body: source.body != null ? JSON.stringify(source.body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      connectionId: source.connectionId,
      endpointId: source.endpointId,
      url: source.url,
      method: source.method,
      query: source.query,
      headers: source.headers,
      body: source.body,
    }),
  });
  const json = (await res.json()) as { ok?: boolean; status?: number; data?: unknown; error?: string };
  if (!json.ok) throw new Error(json.error ?? `proxy error (${json.status})`);
  return json.data;
}

/** Fetch one dataset into `key`, with dedupe + status + mortar transform. */
export async function doFetch(doc: Y.Doc, cfg: FetchConfig & { key: string }): Promise<void> {
  const s = state(doc);
  s.configs.set(cfg.key, { source: cfg.source, jsonPath: cfg.jsonPath, transform: cfg.transform });
  const sig = `${cfg.key}|${JSON.stringify(cfg.source)}|${cfg.jsonPath ?? ""}|${cfg.transform ?? ""}`;
  if (s.inFlight.has(sig)) return; // collapse duplicate concurrent fetches
  s.inFlight.add(sig);
  setStatus(doc, cfg.key, "loading");
  try {
    const raw = await fetchSource(cfg.source);
    const picked = getJsonPath(raw, cfg.jsonPath);
    const shaped = cfg.transform
      ? runMortar(cfg.transform, picked, { get: (k: string) => readData(doc, k) })
      : picked;
    applyDataAction(doc, { action: "set", target: cfg.key, value: shaped }, ORIGIN.worker);
    setStatus(doc, cfg.key, "live");
  } catch (e) {
    setStatus(doc, cfg.key, "error", e instanceof Error ? e.message : String(e));
  } finally {
    s.inFlight.delete(sig);
  }
}

function startPoll(doc: Y.Doc, cfg: FetchConfig & { key: string; intervalMs: number }): void {
  stopPoll(doc, cfg.key);
  void doFetch(doc, cfg); // fetch immediately
  const timer = setInterval(() => void doFetch(doc, cfg), cfg.intervalMs);
  state(doc).polls.set(cfg.key, timer);
}

export function stopPoll(doc: Y.Doc, key: string): void {
  const s = state(doc);
  const timer = s.polls.get(key);
  if (timer) {
    clearInterval(timer);
    s.polls.delete(key);
  }
}

async function doSubmit(
  doc: Y.Doc,
  opts: { source: DataSourceSpec; fieldsPrefix: string; responseKey?: string; refetchKeys?: string[] },
): Promise<void> {
  const statusTarget = `form:${opts.fieldsPrefix}`;
  setStatus(doc, statusTarget, "loading");
  try {
    const body = assembleFormBody(readAllData(doc), opts.fieldsPrefix);
    const data = await fetchSource({ ...opts.source, method: opts.source.method ?? "POST", body });
    if (opts.responseKey) {
      applyDataAction(doc, { action: "set", target: opts.responseKey, value: data }, ORIGIN.worker);
    }
    setStatus(doc, statusTarget, "live");
    // refresh named datasets using their cached fetch config
    for (const k of opts.refetchKeys ?? []) {
      const cfg = state(doc).configs.get(k);
      if (cfg) void doFetch(doc, { key: k, ...cfg });
    }
  } catch (e) {
    setStatus(doc, statusTarget, "error", e instanceof Error ? e.message : String(e));
  }
}

/** Execute a worker-bound command against `doc`. Returns a promise for tests. */
export function runDataCommand(doc: Y.Doc, command: Command): Promise<void> {
  switch (command.type) {
    case "data/fetch":
      return doFetch(doc, {
        key: command.key,
        source: command.source,
        jsonPath: command.jsonPath,
        transform: command.transform,
      });
    case "data/poll-start":
      startPoll(doc, {
        key: command.key,
        source: command.source,
        jsonPath: command.jsonPath,
        transform: command.transform,
        intervalMs: command.intervalMs,
      });
      return Promise.resolve();
    case "data/poll-stop":
      stopPoll(doc, command.key);
      return Promise.resolve();
    case "form/submit":
      return doSubmit(doc, {
        source: command.source,
        fieldsPrefix: command.fieldsPrefix,
        responseKey: command.responseKey,
        refetchKeys: command.refetchKeys,
      });
    default:
      return Promise.resolve(); // non-data command — not handled here
  }
}
