"use client";

/**
 * The rendered view: the live TARGET app in an isolated iframe (its own document), fed
 * the session Y.Doc from the parent over postMessage so it updates live as you edit in
 * the schematic view. Read-only — a real web view, not an edit surface.
 */
import * as React from "react";
import { useCollab } from "@/collab/provider";
import { useStyleLayers } from "@/style/StyleLayers";
import { connectIframeParent, sendThemeToIframe } from "@/engine/iframe-sync";

export function RenderedView() {
  const { doc, session } = useCollab();
  const { mergedVars } = useStyleLayers();
  const ref = React.useRef<HTMLIFrameElement>(null);
  const readyRef = React.useRef(false);
  const themeKey = JSON.stringify(mergedVars);

  React.useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const disconnect = connectIframeParent(doc, iframe);
    // When the iframe announces readiness, push the current theme so it matches.
    const onReady = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow && (e.data as { t?: unknown })?.t === "a2ui-ready") {
        readyRef.current = true;
        sendThemeToIframe(iframe, mergedVars as Record<string, string>);
      }
    };
    window.addEventListener("message", onReady);
    return () => {
      window.removeEventListener("message", onReady);
      readyRef.current = false;
      disconnect();
    };
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-push the theme whenever it changes (after the iframe is ready).
  React.useEffect(() => {
    if (readyRef.current && ref.current) {
      sendThemeToIframe(ref.current, mergedVars as Record<string, string>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey]);

  const src = session ? `/runtime?session=${encodeURIComponent(session)}` : "/runtime";

  return (
    <iframe
      ref={ref}
      src={src}
      title="Rendered output (live target app)"
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}
