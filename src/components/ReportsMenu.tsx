"use client";

/**
 * Open-report picker. Lists every saved canvas from the DB (durable, independent
 * of the chat runtime's thread store) so you can always get back to a report you
 * built. Selecting one navigates to its session, which restores its canvas.
 */
import * as React from "react";

interface CanvasSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function ReportsMenu({ currentSession }: { currentSession: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<CanvasSummary[] | null>(null);

  const load = React.useCallback(() => {
    setItems(null);
    fetch("/api/canvas")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.canvases) ? d.canvases : []))
      .catch(() => setItems([]));
  }, []);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openReport = (id: string) => {
    if (id === currentSession) {
      setOpen(false);
      return;
    }
    // Navigate to the report's session — the page restores its canvas on load.
    window.location.href = `${window.location.pathname}?session=${encodeURIComponent(id)}`;
  };

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Open one of your saved reports"
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
      >
        Reports
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 flex max-h-96 w-72 flex-col overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] shadow-md">
          {items === null && (
            <div className="px-2 py-2 text-xs text-[var(--muted-foreground)]">Loading…</div>
          )}
          {items?.length === 0 && (
            <div className="px-2 py-2 text-xs text-[var(--muted-foreground)]">No saved reports yet.</div>
          )}
          {items?.map((c) => (
            <button
              key={c.id}
              onClick={() => openReport(c.id)}
              className={[
                "flex flex-col items-start gap-0.5 rounded-[var(--radius)] px-2 py-1.5 text-left hover:bg-[var(--secondary)]",
                c.id === currentSession ? "bg-[var(--secondary)]" : "",
              ].join(" ")}
            >
              <span className="line-clamp-1 text-sm font-medium">{c.title}</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">{fmt(c.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
