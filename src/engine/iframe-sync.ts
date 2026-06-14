/**
 * Parent ⇄ iframe Yjs sync over postMessage — the live-push channel for the rendered
 * view. The rendered iframe is the TARGET app embedding the same runtime; it's just
 * another Yjs peer (exactly like the fetch worker), so design edits in the builder
 * stream into the running web view live. Reuses the same `connectDocChannel` provider.
 *
 * Handshake: the iframe connects on mount and posts "a2ui-ready"; the parent, on ready,
 * connects and sends its full state (parent is the source of truth). Echo is prevented
 * by connectDocChannel's origin tag.
 */
import type * as Y from "yjs";
import { connectDocChannel, type SyncChannel } from "./worker-provider";

const TAG = "a2ui-y";
const READY = "a2ui-ready";
const THEME = "a2ui-theme";

/** Type guard for our binary sync messages (ignores unrelated postMessages). */
export function isYjsMessage(data: unknown): data is { t: string; u: Uint8Array } {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { t?: unknown }).t === TAG &&
    (data as { u?: unknown }).u instanceof Uint8Array
  );
}

/** Type guard for a theme message: { t:"a2ui-theme", vars: Record<string,string> }. */
export function isThemeMessage(data: unknown): data is { t: string; vars: Record<string, string> } {
  if (!data || typeof data !== "object" || (data as { t?: unknown }).t !== THEME) return false;
  const vars = (data as { vars?: unknown }).vars;
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) return false;
  return Object.values(vars as Record<string, unknown>).every((v) => typeof v === "string");
}

/** Parent → iframe: push the StyleLayers CSS vars so the rendered view matches the theme. */
export function sendThemeToIframe(iframe: HTMLIFrameElement, vars: Record<string, string>): void {
  iframe.contentWindow?.postMessage({ t: THEME, vars }, "*");
}

/** Child (iframe): subscribe to theme vars pushed by the parent. Returns an unsubscribe. */
export function onIframeTheme(cb: (vars: Record<string, string>) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: MessageEvent) => {
    if (e.source === window.parent && isThemeMessage(e.data)) cb(e.data.vars);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/** In the iframe: sync our doc to the parent window and announce readiness. No-op at top level. */
export function connectIframeChild(doc: Y.Doc): () => void {
  if (typeof window === "undefined" || window.parent === window) return () => {};
  const parent = window.parent;
  const channel: SyncChannel = {
    post: (u) => parent.postMessage({ t: TAG, u }, "*"),
    onMessage: (cb) => {
      const h = (e: MessageEvent) => {
        if (e.source === parent && isYjsMessage(e.data)) cb(e.data.u);
      };
      window.addEventListener("message", h);
      return () => window.removeEventListener("message", h);
    },
  };
  const off = connectDocChannel(doc, channel);
  parent.postMessage({ t: READY }, "*");
  return off;
}

/** In the parent: once the iframe signals ready, sync our doc into it. */
export function connectIframeParent(doc: Y.Doc, iframe: HTMLIFrameElement): () => void {
  let off: (() => void) | null = null;
  const onMsg = (e: MessageEvent) => {
    if (e.source !== iframe.contentWindow) return;
    if ((e.data as { t?: unknown })?.t === READY && !off) {
      const channel: SyncChannel = {
        post: (u) => iframe.contentWindow?.postMessage({ t: TAG, u }, "*"),
        onMessage: (cb) => {
          const h = (ev: MessageEvent) => {
            if (ev.source === iframe.contentWindow && isYjsMessage(ev.data)) cb(ev.data.u);
          };
          window.addEventListener("message", h);
          return () => window.removeEventListener("message", h);
        },
      };
      off = connectDocChannel(doc, channel);
    }
  };
  window.addEventListener("message", onMsg);
  return () => {
    window.removeEventListener("message", onMsg);
    off?.();
  };
}
