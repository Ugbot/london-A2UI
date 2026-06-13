"use client";

/**
 * Collaboration context: one shared Yjs document per session (room), synced
 * over the collab WebSocket server. The session id lives in the URL (?session=)
 * so a session is shareable — anyone opening the URL joins the same doc.
 * Everything collaborative (widget tree, CollabText, CollabChat) lives here.
 */
import * as React from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

// @ag-ui/client stores `this.fetch = config.fetch ?? fetch` and later calls
// `this.fetch(url, init)` — invoking native fetch as a method throws
// "Illegal invocation" (fetch must run with this===window). Wrap the global
// fetch in a window-bound shim (idempotent) so any unbound call works. Runs on
// the client at bundle load, before any agent run.
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const w = window as Window & { __fetchBound?: boolean };
  if (!w.__fetchBound) {
    const native = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => native(input, init)) as typeof fetch;
    w.__fetchBound = true;
  }
}

const COLLAB_WS_URL =
  process.env.NEXT_PUBLIC_COLLAB_WS_URL ?? "ws://localhost:1234";

/** Identity broadcast via Yjs awareness for presence. */
export interface CollabUser {
  name: string;
  color: string;
}

interface CollabContextValue {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  connected: boolean;
  user: CollabUser | null;
  /** The session id (room) — null until collaboration is enabled. */
  session: string | null;
  /** Whether collaboration (sync/presence/cursors) is turned on. Off by default. */
  enabled: boolean;
  /** Turn collaboration on (connects, resolves identity + shareable session). */
  enable: () => void;
  /** Turn collaboration off (disconnects; widget stays local). */
  disable: () => void;
}

const CollabContext = React.createContext<CollabContextValue | null>(null);

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899"];
const ANIMALS = ["Otter", "Falcon", "Lynx", "Heron", "Fox", "Wren", "Ibex", "Orca"];

/** Client-only: random identity. MUST NOT run during SSR (hydration safety). */
function randomUser(): CollabUser {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  return { name: `${pick(ANIMALS)}-${Math.floor(Math.random() * 900 + 100)}`, color: pick(COLORS) };
}

const SESSION_STORAGE_KEY = "a2ui-session";

/**
 * Resolve the session id (the canvas/DB key) with stable precedence:
 *   URL ?session=  >  localStorage (last session)  >  newly generated.
 *
 * Persisting to localStorage is what makes a plain reload (no ?session= in the
 * URL) restore your LAST canvas instead of minting a blank new session. The id
 * is also written back to the URL so the session stays shareable.
 */
function resolveSession(): string {
  const params = new URLSearchParams(window.location.search);
  let session = params.get("session");

  if (!session && typeof localStorage !== "undefined") {
    try {
      session = localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      /* storage blocked (private mode) — fall through to generate */
    }
  }

  if (!session) {
    session =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
  }

  // Reflect the resolved session in the URL (shareable) and remember it.
  params.set("session", session);
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, session);
  } catch {
    /* ignore */
  }
  return session;
}

export function CollabProvider({ children }: { children: React.ReactNode }) {
  // Empty doc is deterministic — safe to create during SSR (no randomness).
  // The doc is always present so the canvas works SOLO; it only SYNCS once
  // collaboration is enabled (opt-in).
  const [doc] = React.useState(() => new Y.Doc());
  const [provider, setProvider] = React.useState<WebsocketProvider | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [user, setUser] = React.useState<CollabUser | null>(null);
  const [session, setSession] = React.useState<string | null>(null);
  const [enabled, setEnabled] = React.useState(false);

  const enable = React.useCallback(() => setEnabled(true), []);
  const disable = React.useCallback(() => setEnabled(false), []);

  // Resolve the session id once on mount (client only), independent of whether
  // collaboration is enabled. The session is the STABLE key for the canvas doc
  // and its DB persistence, so it must not change when collab toggles or when
  // chat threads switch.
  React.useEffect(() => {
    // Resolve in the effect body (post-commit) — NOT inside the setState updater,
    // which React may run during render; resolveSession calls history.replaceState
    // (patched by Next's Router) and would update the Router mid-render.
    const resolved = resolveSession();
    setSession((s) => s ?? resolved);
  }, []);

  // Connect ONLY when collaboration is enabled. Cleanup on disable/unmount.
  React.useEffect(() => {
    if (!enabled) return;
    const u = randomUser();
    const sess = resolveSession();
    setUser(u);
    setSession(sess);

    const wsProvider = new WebsocketProvider(COLLAB_WS_URL, `room-${sess}`, doc, {
      connect: true,
    });
    wsProvider.awareness.setLocalStateField("user", u);
    const onStatus = (e: { status: string }) => setConnected(e.status === "connected");
    wsProvider.on("status", onStatus);
    setProvider(wsProvider);

    return () => {
      wsProvider.off("status", onStatus);
      wsProvider.destroy();
      setProvider(null);
      setConnected(false);
      setUser(null);
      // Keep `session` — it is the stable canvas/DB key, not collab-scoped.
    };
  }, [enabled, doc]);

  const value = React.useMemo<CollabContextValue>(
    () => ({ doc, provider, connected, user, session, enabled, enable, disable }),
    [doc, provider, connected, user, session, enabled, enable, disable],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

/** Access the shared collaboration context. Throws if used outside the provider. */
export function useCollab(): CollabContextValue {
  const ctx = React.useContext(CollabContext);
  if (!ctx) throw new Error("useCollab must be used within <CollabProvider>");
  return ctx;
}
