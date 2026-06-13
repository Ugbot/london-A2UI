"use client";

/**
 * Collaboration is opt-in. By default this shows a single "Collaborate" button;
 * the canvas runs solo until the user (or the agent) turns it on. Once enabled,
 * it shows live presence + the Share button + a way to go back to solo.
 */
import { useCollab } from "./provider";
import { PresenceBar } from "./PresenceBar";
import { ShareButton } from "./ShareButton";
import { Tooltip } from "../components/ui/Tooltip";

export function CollabControls() {
  const { enabled, enable, disable } = useCollab();

  if (!enabled) {
    return (
      <Tooltip text="Turn on live collaboration: share a link, see others' cursors and presence.">
        <button
          onClick={enable}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
        >
          Collaborate
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <PresenceBar />
      <ShareButton />
      <Tooltip text="Stop collaborating and go back to working on your own.">
        <button
          onClick={disable}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
        >
          Solo
        </button>
      </Tooltip>
    </div>
  );
}
