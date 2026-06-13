"use client";

/** A compact menu of style presets the user can toggle on/off at will. */
import { useState } from "react";
import { STYLE_PRESETS, useStyleLayers } from "./StyleLayers";

export function StyleMenu() {
  const { toggleLayer, clearLayers, has, layers } = useStyleLayers();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
      >
        Style{layers.length ? ` (${layers.length})` : ""}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2 shadow-md">
          <div className="flex flex-wrap gap-1.5">
            {STYLE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleLayer(p)}
                className={[
                  "rounded-full border px-2 py-0.5 text-xs",
                  has(p.id)
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)]",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
          {layers.length > 0 && (
            <button
              onClick={clearLayers}
              className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
            >
              Clear styles
            </button>
          )}
        </div>
      )}
    </div>
  );
}
