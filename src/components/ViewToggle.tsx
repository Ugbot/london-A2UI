"use client";

/**
 * Scene/Game style view switch: Schematic (editable) · Rendered (live iframe) · Split.
 */
import * as React from "react";
import { PencilRuler, MonitorPlay, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewStore, type ViewMode } from "@/state/viewStore";

const OPTIONS: { mode: ViewMode; label: string; Icon: typeof PencilRuler }[] = [
  { mode: "schematic", label: "Schematic", Icon: PencilRuler },
  { mode: "rendered", label: "Rendered", Icon: MonitorPlay },
  { mode: "split", label: "Split", Icon: Columns2 },
];

export function ViewToggle() {
  const mode = useViewStore((s) => s.mode);
  const setMode = useViewStore((s) => s.setMode);
  return (
    <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-0.5">
      {OPTIONS.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          title={`${label} view`}
          className={cn(
            "flex items-center gap-1 rounded-[calc(var(--radius)-2px)] px-2 py-1 text-xs font-medium transition-colors",
            mode === m
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
