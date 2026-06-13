"use client";

/**
 * Master-detail mini-SPA: a selectable list (master) on the left and the
 * matching detail on the right. Each detail is a CHILD composition (rendered by
 * the app's Renderer and passed in as children, one per item) — so a detail can
 * be any bricks (charts, tables, forms…). No Renderer import → no import cycle.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import type { MasterDetailProps } from "./schema";

export function MasterDetail({
  title,
  items,
  children,
}: MasterDetailProps & { children?: React.ReactNode }) {
  const details = React.Children.toArray(children);
  const [active, setActive] = React.useState(0);

  return (
    <div className="flex flex-col gap-3">
      {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
      <div className="grid grid-cols-[220px_1fr] gap-4">
        <nav className="flex flex-col gap-1 border-r border-[var(--border)] pr-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "flex flex-col rounded-[var(--radius)] px-3 py-2 text-left transition-colors",
                i === active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--foreground)] hover:bg-[var(--secondary)]",
              )}
            >
              <span className="text-sm font-medium">{item.label}</span>
              {item.subtitle && (
                <span
                  className={cn(
                    "text-xs",
                    i === active ? "opacity-80" : "text-[var(--muted-foreground)]",
                  )}
                >
                  {item.subtitle}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {details[active] ?? details[0] ?? (
            <p className="text-sm text-[var(--muted-foreground)]">No detail for this item.</p>
          )}
        </div>
      </div>
    </div>
  );
}
