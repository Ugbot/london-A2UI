"use client";

/**
 * Runtime model picker. Lets the user switch which LLM the composer agent uses
 * without restarting — the choice is forwarded to the agent each turn (via
 * useAgentContext) and used to pick the model server-side.
 */
import * as React from "react";
import { AVAILABLE_MODELS } from "@/mastra/models";

export function ModelMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = AVAILABLE_MODELS.find((m) => m.id === value) ?? AVAILABLE_MODELS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Choose which AI model the composer uses (switches at runtime)"
        className="flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
        {current.label}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 flex w-52 flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] shadow-md">
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={[
                "flex items-center justify-between gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm hover:bg-[var(--secondary)]",
                m.id === value ? "bg-[var(--secondary)]" : "",
              ].join(" ")}
            >
              <span>{m.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                {m.provider}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
