"use client";

/**
 * Style layers: a stack of named CSS-variable overrides applied to the canvas.
 * Layers can be added/removed/toggled at will (by the user via the StyleMenu,
 * or by the agent via the set_style tool). Changes animate cleanly thanks to
 * the `.widget-surface` colour transitions in globals.css.
 */
import * as React from "react";

export type StyleVars = Record<string, string>;

export interface StyleLayer {
  id: string;
  label: string;
  vars: StyleVars;
}

/** Built-in presets the user can toggle. Accent layers are mutually exclusive. */
export const STYLE_PRESETS: StyleLayer[] = [
  { id: "accent-emerald", label: "Emerald", vars: { "--primary": "#059669", "--ring": "#34d399" } },
  { id: "accent-rose", label: "Rose", vars: { "--primary": "#e11d48", "--ring": "#fb7185" } },
  { id: "accent-amber", label: "Amber", vars: { "--primary": "#d97706", "--ring": "#fbbf24" } },
  { id: "accent-violet", label: "Violet", vars: { "--primary": "#7c3aed", "--ring": "#a78bfa" } },
  { id: "radius-sharp", label: "Sharp", vars: { "--radius": "0px" } },
  { id: "radius-round", label: "Round", vars: { "--radius": "1rem" } },
  { id: "muted-bg", label: "Soft bg", vars: { "--background": "#f8fafc", "--card": "#ffffff" } },
];

interface StyleContextValue {
  layers: StyleLayer[];
  mergedVars: StyleVars;
  addLayer: (layer: StyleLayer) => void;
  removeLayer: (id: string) => void;
  toggleLayer: (layer: StyleLayer) => void;
  clearLayers: () => void;
  has: (id: string) => boolean;
}

const StyleContext = React.createContext<StyleContextValue | null>(null);

export function StyleLayersProvider({ children }: { children: React.ReactNode }) {
  const [layers, setLayers] = React.useState<StyleLayer[]>([]);

  const addLayer = React.useCallback((layer: StyleLayer) => {
    setLayers((prev) => {
      // accent layers are mutually exclusive
      const filtered = layer.id.startsWith("accent-")
        ? prev.filter((l) => !l.id.startsWith("accent-"))
        : prev.filter((l) => l.id !== layer.id);
      return [...filtered, layer];
    });
  }, []);

  const removeLayer = React.useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const toggleLayer = React.useCallback((layer: StyleLayer) => {
    setLayers((prev) =>
      prev.some((l) => l.id === layer.id)
        ? prev.filter((l) => l.id !== layer.id)
        : [
            ...(layer.id.startsWith("accent-")
              ? prev.filter((l) => !l.id.startsWith("accent-"))
              : prev),
            layer,
          ],
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
