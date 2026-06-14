"use client";

/**
 * The rendered view: the live TARGET app in an isolated iframe (its own document), fed
 * the session Y.Doc from the parent over postMessage so it updates live as you edit in
 * the schematic view. Read-only — a real web view, not an edit surface.
 */
import * as React from "react";
import { useCollab } from "@/collab/provider";
import { connectIframeParent } from "@/engine/iframe-sync";

export function RenderedView() {
  const { doc, session } = useCollab();
  const ref = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    return connectIframeParent(doc, iframe);
  }, [doc]);

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
