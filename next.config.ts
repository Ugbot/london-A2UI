import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Pin the workspace root to THIS project (a stray ~/package-lock.json otherwise
    // makes Next infer the home dir as root). NOTE: do NOT alias `yjs` to a single
    // file here — that hands y-websocket/y-protocols a different module identity than
    // the doc and silently breaks the awareness protocol (collab cursors/presence).
    // The server externalize below is what dedupes the build warning.
    root: process.cwd(),
  },
  // DBOS is a Node server framework with lazy optional deps (otel, winston); let
  // Node require it at runtime instead of bundling it (Turbopack can't resolve
  // its optional deps). @mastra/* is also heavy server-side.
  serverExternalPackages: [
    "@copilotkit/runtime",
    "@dbos-inc/dbos-sdk",
    "@mastra/core",
    "pg",
    // Load the Yjs stack from node_modules via Node's require cache on the server →
    // a single instance (silences "Yjs was already imported" during static gen).
    "yjs",
    "y-protocols",
    "y-websocket",
  ],
  env: {
    NEXT_PUBLIC_COPILOTKIT_THREADS_ENABLED: process.env.COPILOTKIT_LICENSE_TOKEN
      ? "true"
      : "false",
  },
  typescript: {
    // @ag-ui/client's HttpAgent currently exposes private generic types through
    // the runtime route in this example. Keep builds focused on runtime output.
    ignoreBuildErrors: true,
  },
  // The service worker must never be cached itself, or SW updates won't ship.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
