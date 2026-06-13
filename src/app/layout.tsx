import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { CollabProvider } from "@/collab/provider";
import { StyleLayersProvider } from "@/style/StyleLayers";
import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

export const metadata: Metadata = {
  title: "Widget Composer",
  description: "Collaborative agent-driven UI assembled from bricks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={"antialiased"}>
        {/* Force REST transport so runtime-info + threads both hit the multi-route endpoint (auto-detect races the lazily-compiled API route in next dev). */}
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          useSingleEndpoint={false}
        >
          <CollabProvider>
            <StyleLayersProvider>{children}</StyleLayersProvider>
          </CollabProvider>
        </CopilotKit>
      </body>
    </html>
  );
}
