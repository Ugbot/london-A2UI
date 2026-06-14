/**
 * The palette: a curated set of bricks the user can drag onto the canvas. Each item
 * carries minimal required props; the drop handler runs them through `resolveProps` so
 * the brick's schema defaults fill in the rest. Server-safe (no React).
 */
export const PALETTE_MIME = "application/x-a2ui-brick";
/** MIME for dragging an EXISTING element (carries its id) to reparent/reorder it. */
export const ELEMENT_MIME = "application/x-a2ui-move";

export interface PaletteItem {
  brick: string;
  label: string;
  group: string;
  defaults: Record<string, unknown>;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // Text
  { brick: "Heading", label: "Heading", group: "Text", defaults: { text: "Heading" } },
  { brick: "Text", label: "Text", group: "Text", defaults: { text: "Body text goes here." } },
  { brick: "Badge", label: "Badge", group: "Text", defaults: { text: "Badge" } },
  { brick: "Quote", label: "Quote", group: "Text", defaults: { text: "A memorable quote." } },
  // Controls
  { brick: "Button", label: "Button", group: "Controls", defaults: { label: "Button" } },
  { brick: "Input", label: "Input", group: "Controls", defaults: { label: "Field", placeholder: "Type…" } },
  // Data
  { brick: "StatCard", label: "Stat card", group: "Data", defaults: { label: "Metric", value: "123" } },
  // Layout
  { brick: "Stack", label: "Stack", group: "Layout", defaults: { gap: 4 } },
  { brick: "Grid", label: "Grid", group: "Layout", defaults: { cols: 2, gap: 4 } },
  { brick: "Card", label: "Card", group: "Layout", defaults: { title: "Card" } },
  { brick: "Section", label: "Section", group: "Layout", defaults: { title: "Section" } },
  { brick: "Divider", label: "Divider", group: "Layout", defaults: {} },
  // Media
  { brick: "Image", label: "Image", group: "Media", defaults: { src: "https://placehold.co/600x320", alt: "Image" } },
  // Wireframe — sketch with boxes, then "Complete with AI" turns each into real bricks.
  { brick: "Wireframe", label: "Box", group: "Wireframe", defaults: { label: "Box", kind: "section" } },
  { brick: "Wireframe", label: "Chart", group: "Wireframe", defaults: { label: "Chart", kind: "chart" } },
  { brick: "Wireframe", label: "Form", group: "Wireframe", defaults: { label: "Form", kind: "form" } },
  { brick: "Wireframe", label: "List", group: "Wireframe", defaults: { label: "List", kind: "list" } },
];

/** Minimal default props for a palette brick (resolveProps fills the schema rest). */
export function paletteDefaults(brick: string): Record<string, unknown> {
  return PALETTE_ITEMS.find((i) => i.brick === brick)?.defaults ?? {};
}

/** Palette items grouped, preserving declaration order. */
export function paletteGroups(): { group: string; items: PaletteItem[] }[] {
  const out: { group: string; items: PaletteItem[] }[] = [];
  for (const item of PALETTE_ITEMS) {
    let g = out.find((x) => x.group === item.group);
    if (!g) {
      g = { group: item.group, items: [] };
      out.push(g);
    }
    g.items.push(item);
  }
  return out;
}
