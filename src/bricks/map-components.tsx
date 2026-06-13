"use client";

/**
 * The Map brick. Leaflet touches `window`, so the real implementation
 * (./LeafletMap) is loaded client-only via next/dynamic — never during SSR.
 */
import dynamic from "next/dynamic";
import type { MapProps } from "./schemas";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
      Loading map…
    </div>
  ),
});

export function Map(props: MapProps) {
  return <LeafletMap {...props} />;
}
