"use client";

/**
 * Floating mode indicator — shown over the artboard whenever a non-default
 * interaction mode is active, so it's always clear you're dragging/selecting.
 */
import { useMentionStore } from "@/state/mentionStore";

export function ModeHud() {
  const mode = useMentionStore((s) => s.mode);
  const setMode = useMentionStore((s) => s.setMode);
  if (mode === "none") return null;
  const label =
    mode === "move" ? "Move — drag elements to rearrange" : "Select — click an element to @mention it";
  return (
    <div className="chrome pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--elevated)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-lg">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary)]" />
      {label}
      <button
        onClick={() => setMode("none")}
        className="ml-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        Esc
      </button>
    </div>
  );
}
