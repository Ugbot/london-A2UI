"use client";

/**
 * Collaboration is opt-in. By default this shows a single "Collaborate" button;
 * the canvas runs solo until the user (or the agent) turns it on. Once enabled,
 * it shows live presence + the Share button + a way to go back to solo.
 */
import { useCollab } from "./provider";
import { PresenceBar } from "./PresenceBar";
import { ShareButton } from "./ShareButton";

export function CollabControls() {
  const { enabled, enable, disable } = useCollab();

  if (!enabled) {
    return (
      <button
        onClick={enable}
        title="Sync this canvas live and invite others"
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
      >
        Collaborate
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <PresenceBar />
      <ShareButton />
      <button
        onClick={disable}
        title="Stop syncing — go back to solo"
        className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
      >
        Solo
      </button>
    </div>
  );
}
