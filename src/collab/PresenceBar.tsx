"use client";

/** Live avatars of connected peers + connection status, from Yjs awareness. */
import { useCollab } from "./provider";
import { usePresence } from "./hooks";

export function PresenceBar() {
  const { connected, user } = useCollab();
  const peers = usePresence();
  const everyone = [...(user ? [user] : []), ...peers];

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {everyone.slice(0, 6).map((u, i) => (
          <span
            key={i}
            title={u.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--background)] text-[10px] font-semibold text-white"
            style={{ backgroundColor: u.color }}
          >
            {u.name.slice(0, 1)}
          </span>
        ))}
      </div>
      <span className="text-xs text-[var(--muted-foreground)]">
        {everyone.length} here · {connected ? "synced" : "offline"}
      </span>
    </div>
  );
}
