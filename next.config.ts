import type { NextConfig } from "next";
import path from "node:path";

// Force a SINGLE Yjs module instance. yjs ships dual ESM (.mjs) + CJS (.cjs); when
// some importers get one and some the other, two instances load — the source of the
// "Yjs was already imported" warning and broken cross-module instanceof checks. Pin
// every `yjs` resolution (ours + y-websocket + y-protocols) to the one ESM build.
const YJS_ESM = path.resolve(process.cwd(), "node_modules/yjs/dist/yjs.mjs");

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Pin the workspace root to THIS project (a stray ~/package-lock.json otherwise
    // makes Next infer the home dir as root, breaking relative resolution + the alias).
    root: process.cwd(),
    // Relative to `root` above (Turbopack treats a leading-slash path as relative).
    resolveAlias: {
      yjs: "./node_modules/yjs/dist/yjs.mjs",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...(config.resolve.alias ?? {}), yjs: YJS_ESM };
    return config;
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
