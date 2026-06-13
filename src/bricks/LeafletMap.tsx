"use client";

/**
 * Interactive OpenStreetMap (Leaflet) — loaded client-only via next/dynamic.
 *
 * The key idea: a marker's `popup` is a composition subtree rendered with the
 * SAME <Renderer>, so any brick (StatCard, chart, chat, …) can be hooked onto a
 * location. Markers also show their `label` as a permanent tooltip.
 */
import * as React from "react";
import L from "leaflet";
import maplibregl from "maplibre-gl";
import { MapContainer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import "@maplibre/maplibre-gl-leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Renderer } from "@/components/Renderer";
import type { CompositionNode } from "@/bricks/composition";
import type { MapProps } from "./schemas";

// The leaflet plugin looks up the global maplibregl instance.
if (typeof window !== "undefined") {
  (window as unknown as { maplibregl: typeof maplibregl }).maplibregl = maplibregl;
}

/** Free, no-key vector tiles (OpenFreeMap) rendered with MapLibre GL inside Leaflet. */
const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function VectorTiles() {
  const map = useMap();
  React.useEffect(() => {
    const gl = L.maplibreGL({ style: VECTOR_STYLE }).addTo(map);
    return () => {
      map.removeLayer(gl);
    };
  }, [map]);
  return null;
}

/** A keyless SVG pin DivIcon — avoids Leaflet's bundler-broken default icon assets. */
function pinIcon(color = "#6366f1") {
  return L.divIcon({
    className: "",
    html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.2 13 21 13 21s13-11.8 13-21C26 5.8 20.2 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -32],
  });
}

export default function LeafletMap({ center, zoom, height, markers }: MapProps) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <VectorTiles />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={pinIcon()}>
            {m.label && (
              <Tooltip direction="top" offset={[0, -30]} permanent={!m.popup}>
                {m.label}
              </Tooltip>
            )}
            {m.popup && (
              <Popup minWidth={220} maxWidth={360}>
                <div className="min-w-[200px]">
                  <Renderer tree={m.popup as CompositionNode} />
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
