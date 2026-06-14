import type { MetadataRoute } from "next";

/**
 * PWA manifest (Next 16 app-router metadata route → /manifest.webmanifest). Makes the
 * builder installable/standalone. The SVG icon scales to any size + maskable.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "A2UI — AI front-end builder",
    short_name: "A2UI",
    description: "Design data-driven SPAs, dashboards & reports from typed bricks",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b12",
    theme_color: "#6366f1",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
