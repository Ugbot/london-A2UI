"use client";

/**
 * Figma-style tool dock — a vertical dark rail on the left edge of the canvas.
 * Picks the active interaction MODE (Select = click-to-@mention, Move = drag to
 * rearrange). Clicking the active tool again returns to the default mode.
 */
import { MousePointer2, Move, type LucideIcon } from "lucide-react";
import { useMentionStore, type EditorMode } from "@/state/mentionStore";

function Tool({
  mode,
  active,
  onPick,
  Icon,
  label,
  hint,
}: {
  mode: EditorMode;
  active: boolean;
  onPick: (m: EditorMode) => void;
  Icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={() => onPick(active ? "none" : mode)}
      title={`${label} (${hint})`}
      aria-pressed={active}
      className={[
        "grid h-9 w-9 place-items-center rounded-[var(--radius)] transition-colors",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

export function ToolDock() {
  const mode = useMentionStore((s) => s.mode);
  const setMode = useMentionStore((s) => s.setMode);
  return (
    <div className="chrome flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--background)] py-2">
      <Tool mode="select" active={mode === "select"} onPick={setMode} Icon={MousePointer2} label="Select" hint="V" />
      <Tool mode="move" active={mode === "move"} onPick={setMode} Icon={Move} label="Move" hint="M" />
    </div>
  );
}
