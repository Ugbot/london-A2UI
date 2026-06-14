"use client";

/**
 * The left Project browser — hop between the things you're building (each project = a
 * saved canvas/session: name + last-edited). Replaces the old CopilotKit threads drawer
 * AND the toolbar Reports menu. Switch / new / rename / delete; the session drives the
 * canvas + chat, so switching here swaps everything.
 */
import * as React from "react";
import { FilePlus2, Pencil, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollab } from "@/collab/provider";

interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

export function ProjectBrowser() {
  const { session, setSession } = useCollab();
  const [items, setItems] = React.useState<ProjectSummary[]>([]);
  const [editing, setEditing] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch("/api/canvas");
      const j = (await r.json()) as { canvases?: ProjectSummary[] };
      setItems(j.canvases ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, session]);

  const rename = async (id: string, name: string) => {
    setEditing(null);
    await fetch("/api/canvas", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: id, name }),
    }).catch(() => {});
    void refresh();
  };

  const del = async (id: string) => {
    if (id === session) {
      const other = items.find((i) => i.id !== id);
      setSession(other ? other.id : newId());
    }
    await fetch(`/api/canvas?threadId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    void refresh();
  };

  return (
    <aside className="chrome flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <span className="text-sm font-semibold">Projects</span>
        <div className="flex items-center gap-1">
          <button onClick={() => void refresh()} title="Refresh" className="grid h-7 w-7 place-items-center rounded-[var(--radius)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setSession(newId())} title="New project" className="grid h-7 w-7 place-items-center rounded-[var(--radius)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
            <FilePlus2 size={14} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {items.length === 0 && (
          <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">No projects yet — build something and it saves automatically.</p>
        )}
        {items.map((p) => (
          <div
            key={p.id}
            className={cn(
              "group flex items-center gap-1 rounded-[var(--radius)] px-2 py-1.5",
              p.id === session ? "bg-[var(--secondary)]" : "hover:bg-[var(--secondary)]",
            )}
          >
            {editing === p.id ? (
              <input
                autoFocus
                defaultValue={p.title}
                onBlur={(e) => void rename(p.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditing(null);
                }}
                className="h-6 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--input)] bg-[var(--background)] px-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            ) : (
              <button onClick={() => setSession(p.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm">{p.title}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">{relTime(p.updatedAt)}</div>
              </button>
            )}
            <button onClick={() => setEditing(p.id)} title="Rename" className="grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--muted-foreground)] opacity-0 hover:text-[var(--foreground)] group-hover:opacity-100">
              <Pencil size={12} />
            </button>
            <button onClick={() => void del(p.id)} title="Delete" className="grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--muted-foreground)] opacity-0 hover:text-red-500 group-hover:opacity-100">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
