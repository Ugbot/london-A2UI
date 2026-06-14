import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { CollabProvider } from "@/collab/provider";
import { StyleLayersProvider } from "@/style/StyleLayers";
import { QueryProvider } from "@/state/QueryProvider";
import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "A2UI — AI front-end builder",
  description: "Design data-driven SPAs, dashboards & reports from typed bricks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/*
          @ag-ui/client calls `this.fetch(url, init)` where this.fetch is the
          native fetch — invoking it as a method throws "Illegal invocation".
          Bind the global fetch to window BEFORE any bundle JS captures it, so
          unbound calls work. Must run first → inline head script.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var f=window.fetch;if(f&&!window.__fetchBound){window.fetch=function(){return f.apply(window,arguments)};window.__fetchBound=true;}})();",
          }}
        />
      </head>
      <body className={"antialiased"}>
        {/* Force REST transport so runtime-info + threads both hit the multi-route endpoint (auto-detect races the lazily-compiled API route in next dev). */}
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          useSingleEndpoint={false}
        >
          <CollabProvider>
            <StyleLayersProvider>
              <QueryProvider>{children}</QueryProvider>
            </StyleLayersProvider>
          </CollabProvider>
        </CopilotKit>
      </body>
    </html>
  );
}
