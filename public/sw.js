/*
 * A2UI builder service worker (hand-rolled — Turbopack-friendly).
 * Strategy mirrors src/pwa/sw-logic.ts:
 *   /api/*            -> network-only (NEVER cached: live data, auth, proxy)
 *   /_next/static/*   -> cache-first  (immutable hashed assets)
 *   navigations/rest  -> network-first with offline shell fallback
 */
const CACHE = "a2ui-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function strategyFor(pathname) {
  if (pathname.startsWith("/api/")) return "network-only";
  if (pathname.startsWith("/_next/static/") || /\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(pathname)) {
    return "cache-first";
  }
  return "network-first";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const strategy = strategyFor(url.pathname);
  if (strategy === "network-only") return; // let the request hit the network untouched

  if (strategy === "cache-first") {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // network-first with cached fallback (offline → cached page or shell "/")
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});
