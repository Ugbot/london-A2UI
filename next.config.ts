import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // DBOS is a Node server framework with lazy optional deps (otel, winston); let
  // Node require it at runtime instead of bundling it (Turbopack can't resolve
  // its optional deps). @mastra/* is also heavy server-side.
  serverExternalPackages: [
    "@copilotkit/runtime",
    "@dbos-inc/dbos-sdk",
    "@mastra/core",
    "pg",
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
};

export default nextConfig;
