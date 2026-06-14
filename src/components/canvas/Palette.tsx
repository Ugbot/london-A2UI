"use client";

/**
 * The piece palette — drag a brick onto the canvas to add it. A compact dark column
 * (schematic-only). Each tile is HTML5-draggable, carrying the brick name on a dedicated
 * MIME so it doesn't collide with the move-to-reorder drag. WidgetCanvas handles the drop.
 */
import * as React from "react";
import { Plus } from "lucide-react";
import { PALETTE_MIME, paletteGroups } from "@/bricks/palette";

export function Palette() {
  const groups = React.useMemo(() => paletteGroups(), []);
  return (
    <div className="chrome flex w-44 shrink-0 flex-col overflow-auto border-r border-[var(--border)] bg-[var(--background)] py-2 text-[var(--foreground)]">
      <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Add a piece
      </div>
      {groups.map((g) => (
        <div key={g.group} className="flex flex-col">
          <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {g.group}
          </div>
          {g.items.map((item) => (
            <button
              key={item.brick}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PALETTE_MIME, item.brick);
                e.dataTransfer.effectAllowed = "copy";
              }}
              title={`Drag to add ${item.label}`}
              className="mx-2 flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] active:cursor-grabbing"
            >
              <Plus size={12} className="text-[var(--muted-foreground)]" />
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
