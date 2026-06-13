"use client";

/**
 * Style layers: a stack of named CSS-variable overrides applied ON TOP of the
 * canvas widget (as inline vars on `.widget-surface`). Layers can be toggled by
 * the user (StyleMenu) or the agent (set_style tool).
 *
 * Layers are grouped: a group's layers are mutually exclusive (picking one
 * replaces the previous in that group), so e.g. choosing the Midnight theme
 * swaps out any other theme. The active stack is PERSISTED per session in
 * localStorage, so a restyle survives reloads (it travels with the report's
 * session).
 */
import * as React from "react";
import { useCollab } from "@/collab/provider";

export type StyleVars = Record<string, string>;

export interface StyleLayer {
  id: string;
  label: string;
  /** Layers sharing a group are mutually exclusive (theme, accent, radius, …). */
  group?: string;
  vars: StyleVars;
}

/**
 * Built-in presets. Themes rewrite the whole palette (big, obvious changes);
 * accents/radius/font are modifiers layered on top.
 */
export const STYLE_PRESETS: StyleLayer[] = [
  // --- Full themes (rewrite the palette) ---
  {
    id: "theme-midnight",
    label: "Midnight",
    group: "theme",
    vars: {
      "--background": "#0b1220",
      "--foreground": "#e5e7eb",
      "--card": "#111827",
      "--card-foreground": "#e5e7eb",
      "--border": "#1f2937",
      "--input": "#1f2937",
      "--secondary": "#1f2937",
      "--secondary-foreground": "#e5e7eb",
      "--muted": "#1f2937",
      "--muted-foreground": "#9ca3af",
      "--primary": "#818cf8",
      "--primary-foreground": "#0b1220",
      "--ring": "#a5b4fc",
    },
  },
  {
    id: "theme-paper",
    label: "Paper",
    group: "theme",
    vars: {
      "--background": "#faf7f0",
      "--foreground": "#1c1917",
      "--card": "#fffdf8",
      "--card-foreground": "#1c1917",
      "--border": "#e7e2d6",
      "--secondary": "#f1ece0",
      "--secondary-foreground": "#1c1917",
      "--muted": "#f1ece0",
      "--muted-foreground": "#78716c",
      "--primary": "#b45309",
      "--primary-foreground": "#fffdf8",
      "--ring": "#d97706",
    },
  },
  {
    id: "theme-forest",
    label: "Forest",
    group: "theme",
    vars: {
      "--background": "#0f1c17",
      "--foreground": "#d1fae5",
      "--card": "#13241d",
      "--card-foreground": "#d1fae5",
      "--border": "#1f3a30",
      "--secondary": "#1f3a30",
      "--secondary-foreground": "#d1fae5",
      "--muted": "#1f3a30",
      "--muted-foreground": "#6ee7b7",
      "--primary": "#34d399",
      "--primary-foreground": "#0f1c17",
      "--ring": "#6ee7b7",
    },
  },
  // --- Accent (tints primary + ring + secondary highlight) ---
  { id: "accent-emerald", label: "Emerald", group: "accent", vars: { "--primary": "#059669", "--ring": "#34d399" } },
  { id: "accent-rose", label: "Rose", group: "accent", vars: { "--primary": "#e11d48", "--ring": "#fb7185" } },
  { id: "accent-amber", label: "Amber", group: "accent", vars: { "--primary": "#d97706", "--ring": "#fbbf24" } },
  { id: "accent-violet", label: "Violet", group: "accent", vars: { "--primary": "#7c3aed", "--ring": "#a78bfa" } },
  // --- Corner radius ---
  { id: "radius-sharp", label: "Sharp", group: "radius", vars: { "--radius": "0px" } },
  { id: "radius-round", label: "Round", group: "radius", vars: { "--radius": "1rem" } },
  // --- Font ---
  { id: "font-serif", label: "Serif", group: "font", vars: { "--ui-font": "Georgia, 'Times New Roman', serif" } },
  { id: "font-mono", label: "Mono", group: "font", vars: { "--ui-font": "ui-monospace, 'SF Mono', Menlo, monospace" } },
];

/** Resolve a layer's exclusivity group (explicit group, else legacy id-prefix). */
function groupOf(layer: StyleLayer): string | null {
  if (layer.group) return layer.group;
  const dash = layer.id.indexOf("-");
  return dash > 0 ? layer.id.slice(0, dash) : null;
}

interface StyleContextValue {
  layers: StyleLayer[];
  mergedVars: StyleVars;
  addLayer: (layer: StyleLayer) => void;
  removeLayer: (id: string) => void;
  toggleLayer: (layer: StyleLayer) => void;
  setLayers: (layers: StyleLayer[]) => void;
  clearLayers: () => void;
  has: (id: string) => boolean;
}

const StyleContext = React.createContext<StyleContextValue | null>(null);

const storageKey = (session: string | null) => `a2ui-style:${session ?? "default"}`;

export function StyleLayersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useCollab();
  const [layers, setLayers] = React.useState<StyleLayer[]>([]);
  // Don't persist until we've restored, or we'd clobber the saved stack with [].
  const restoredFor = React.useRef<string | null>(null);

  // Restore the saved stack when the session resolves / changes.
  React.useEffect(() => {
    if (!session || restoredFor.current === session) return;
    restoredFor.current = session;
    try {
      const raw = localStorage.getItem(storageKey(session));
      setLayers(raw ? (JSON.parse(raw) as StyleLayer[]) : []);
    } catch {
      setLayers([]);
    }
  }, [session]);

  // Persist on change (once restored for this session).
  React.useEffect(() => {
    if (!session || restoredFor.current !== session) return;
    try {
      localStorage.setItem(storageKey(session), JSON.stringify(layers));
    } catch {
      /* storage blocked — keep working in-memory */
    }
  }, [layers, session]);

  const withoutGroup = (prev: StyleLayer[], layer: StyleLayer) => {
    const g = groupOf(layer);
    return g ? prev.filter((l) => groupOf(l) !== g) : prev.filter((l) => l.id !== layer.id);
  };

  const addLayer = React.useCallback((layer: StyleLayer) => {
    setLayers((prev) => [...withoutGroup(prev, layer), layer]);
  }, []);

  const removeLayer = React.useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const toggleLayer = React.useCallback((layer: StyleLayer) => {
    setLayers((prev) =>
      prev.some((l) => l.id === layer.id)
        ? prev.filter((l) => l.id !== layer.id)
        : [...withoutGroup(prev, layer), layer],
    );
  }, []);

  const clearLayers = React.useCallback(() => setLayers([]), []);

  const mergedVars = React.useMemo<StyleVars>(
    () => Object.assign({}, ...layers.map((l) => l.vars)),
    [layers],
  );

  const value = React.useMemo<StyleContextValue>(
    () => ({
      layers,
      mergedVars,
      addLayer,
      removeLayer,
      toggleLayer,
      setLayers,
      clearLayers,
      has: (id: string) => layers.some((l) => l.id === id),
    }),
    [layers, mergedVars, addLayer, removeLayer, toggleLayer, clearLayers],
  );

  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>;
}

export function useStyleLayers(): StyleContextValue {
  const ctx = React.useContext(StyleContext);
  if (!ctx) throw new Error("useStyleLayers must be used within <StyleLayersProvider>");
  return ctx;
}
