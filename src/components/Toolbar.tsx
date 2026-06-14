"use client";

/**
 * The dark top toolbar (chrome). Wordmark + report title + render status on the
 * left; grouped action controls on the right. Wrapped in `.chrome` so it (and any
 * dropdown panels nested in its controls) render on the dark theme.
 */
import * as React from "react";
import type { RenderStatus } from "@/lib/types";

function StatusDot({ status, updated }: { status?: RenderStatus | null; updated?: boolean }) {
  let color = "bg-[var(--muted-foreground)]";
  let label = "assembled from bricks";
  if (updated) {
    color = "bg-emerald-400";
    label = "updated";
  } else if (status?.ok) {
    color = "bg-emerald-400";
    label = "rendered";
  } else if (status && !status.ok) {
    color = "bg-red-400";
    label = `${status.stage} error`;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function Toolbar({
  title,
  status,
  updated,
  right,
}: {
  title: string;
  status?: RenderStatus | null;
  updated?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <header className="chrome flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--background)] px-3 text-[var(--foreground)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)]">
            A2
          </span>
          <span className="text-sm font-semibold tracking-tight">A2UI</span>
        </div>
        <span className="h-4 w-px bg-[var(--border)]" />
        <span className="max-w-[16rem] truncate text-sm text-[var(--foreground)]" title={title}>
          {title}
        </span>
        <StatusDot status={status} updated={updated} />
      </div>
      <div className="flex items-center gap-1.5">{right}</div>
    </header>
  );
}
