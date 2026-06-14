"use client";

/**
 * Collaboration is opt-in. By default this shows a single "Collaborate" button;
 * the canvas runs solo until the user (or the agent) turns it on. Once enabled,
 * it shows live presence + the Share button + a way to go back to solo.
 */
import { Users } from "lucide-react";
import { useCollab } from "./provider";
import { PresenceBar } from "./PresenceBar";
import { ShareButton } from "./ShareButton";
import { Tooltip } from "../components/ui/Tooltip";
import { MenuButton } from "../components/ui/MenuButton";

export function CollabControls() {
  const { enabled, enable, disable } = useCollab();

  if (!enabled) {
    return (
      <Tooltip text="Turn on live collaboration: share a link, see others' cursors and presence.">
        <MenuButton icon={Users} label="Collaborate" onClick={enable} />
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PresenceBar />
      <ShareButton />
      <Tooltip text="Stop collaborating and go back to working on your own.">
        <MenuButton icon={Users} label="Solo" active onClick={disable} />
      </Tooltip>
    </div>
  );
}
