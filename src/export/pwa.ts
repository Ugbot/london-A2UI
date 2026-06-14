/**
 * Export a report as a self-contained, installable, offline PWA (single .html).
 *
 * The baked artifact carries the SPINE: the composition tree AND the serialized Yjs doc
 * state (`Y.encodeStateAsUpdate`, base64) as data islands, exposed on `window.__A2UI__`.
 * That makes it (a) instantly viewable offline via the embedded frozen render, (b)
 * re-importable, and (c) hydratable by the A2UI runtime — including an optional
 * `liveSyncUrl` so a running instance can RECEIVE design pushes / CRDT-sync (the
 * two-layer goal). Everything is inlined, so the file works offline as-is; it installs
 * as a PWA when served over http(s). `buildReportBundle` is pure (string in → string
 * out) for testing; the ExportMenu supplies the live render + doc snapshot.
 */
import type { CompositionNode } from "@/bricks/composition";

export interface ReportBundleInput {
  title: string;
  /** Frozen rendered HTML of the artboard (instant offline paint). */
  bodyHtml: string;
  /** CSS custom-property declarations (the `--x: y;` lines, no selector). */
  themeCss: string;
  /** The app's REAL compiled CSS (Tailwind output + globals) so it's styled offline. */
  css?: string;
  /** The composition tree (re-importable / hydratable). */
  tree: CompositionNode | null;
  /** base64 of Y.encodeStateAsUpdate(doc) — the full doc state (tree + read-model). */
  stateUpdateB64: string;
  /** Optional Yjs sync URL: when set, a hydrating runtime attaches a provider for live-push. */
  liveSyncUrl?: string;
}

/** Encode bytes to base64 in both browser (btoa) and node (Buffer) contexts. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  if (typeof btoa !== "undefined") return btoa(bin);
  return Buffer.from(bytes).toString("base64");
}

/** A data-URI SVG icon so the report manifest needs no external/network asset. */
const ICON_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#6366f1"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="200" font-weight="700" fill="#fff">A2</text></svg>',
  );

/** The report's own service worker (cache-everything for true offline). */
export const REPORT_SW_SOURCE = `
const C = "a2ui-report-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(C).then((c) =>
      c.match(e.request).then((hit) =>
        hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }).catch(() => hit)
      )
    )
  );
});
`.trim();

function escapeJsonForScript(value: unknown): string {
  // Safe to embed inside <script>…</script> (avoid </script> breakout + HTML comments).
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

/** Build the full standalone PWA report document as an HTML string. */
export function buildReportBundle(input: ReportBundleInput): string {
  const manifest = {
    name: input.title,
    short_name: "A2UI Report",
    start_url: ".",
    display: "standalone",
    background_color: "#0b0b12",
    theme_color: "#6366f1",
    icons: [{ src: ICON_DATA_URI, sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
  };
  const manifestUri = "data:application/manifest+json," + encodeURIComponent(JSON.stringify(manifest));

  const boot = `
    window.__A2UI__ = {
      tree: ${escapeJsonForScript(input.tree)},
      state: ${escapeJsonForScript(input.stateUpdateB64)},
      liveSyncUrl: ${escapeJsonForScript(input.liveSyncUrl ?? null)}
    };
    // Register an offline cache SW (best-effort; only when served over http(s)).
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      try {
        var _b = new Blob([${escapeJsonForScript(REPORT_SW_SOURCE)}], { type: "text/javascript" });
        navigator.serviceWorker.register(URL.createObjectURL(_b)).catch(function(){});
      } catch (e) {}
    }
    // The A2UI runtime (when bundled in) reads window.__A2UI__ to hydrate the doc from
    // its state and, if liveSyncUrl is set, attach a Yjs provider for live design pushes.
  `.trim();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${input.title}</title>
<meta name="theme-color" content="#6366f1">
<link rel="manifest" href="${manifestUri}">
<style>${input.css ?? ""}</style>
<style>:root{
${input.themeCss}
}
body{background:var(--background);color:var(--foreground);font-family:Inter,system-ui,Arial,sans-serif;padding:24px}</style>
</head>
<body>
<div id="a2ui-root">${input.bodyHtml}</div>
<script id="a2ui-tree" type="application/json">${escapeJsonForScript(input.tree)}</script>
<script id="a2ui-state" type="application/json">${escapeJsonForScript({ update: input.stateUpdateB64, liveSyncUrl: input.liveSyncUrl ?? null })}</script>
<script>${boot}</script>
</body>
</html>`;
}
