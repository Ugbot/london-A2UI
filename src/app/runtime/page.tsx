"use client";

/**
 * The standalone TARGET runtime — the "rendered view" loaded in an iframe by the
 * builder (and the shape a baked PWA/SPA boots into). It embeds the SAME shared runtime
 * (providers come from the root layout: CollabProvider doc + EngineProvider worker +
 * StyleLayers) and renders ONLY the artboard — no toolbar, chat, or edit overlays. It
 * syncs the session Y.Doc from the parent over postMessage, so builder edits appear live.
 * This is a real web view, not an edit surface.
 */
import * as React from "react";
import type { CSSProperties } from "react";
import { Renderer } from "@/components/Renderer";
import { useSharedWidget } from "@/collab/hooks";
import { useCollab } from "@/collab/provider";
import { connectIframeChild, onIframeTheme } from "@/engine/iframe-sync";

export default function RuntimePage() {
  const { doc } = useCollab();
  const [widget] = useSharedWidget();
  // Theme vars pushed from the parent builder (StyleLayers) so the rendered app matches.
  const [themeVars, setThemeVars] = React.useState<Record<string, string>>({});

  // Become a Yjs peer of the parent builder (live design pushes flow in).
  React.useEffect(() => connectIframeChild(doc), [doc]);
  React.useEffect(() => onIframeTheme(setThemeVars), []);

  return (
    <div
      className="canvas-light min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      style={themeVars as CSSProperties}
    >
      <div className="mx-auto max-w-5xl p-6">
        <Renderer tree={widget} />
      </div>
    </div>
  );
}
