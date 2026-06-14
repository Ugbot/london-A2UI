/**
 * Pure service-worker routing policy (unit-tested; mirrored by public/sw.js).
 *
 * - `/api/*` → NEVER cached (live data, auth, the proxy) — always hit the network.
 * - `/_next/static/*` and other immutable assets → cache-first (hashed filenames).
 * - navigations / everything else → network-first with a cached shell fallback (offline).
 */
export type CacheStrategy = "network-only" | "cache-first" | "network-first";

export function routeRequest(pathname: string): CacheStrategy {
  if (pathname.startsWith("/api/")) return "network-only";
  if (pathname.startsWith("/_next/static/") || /\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(pathname)) {
    return "cache-first";
  }
  return "network-first";
}
