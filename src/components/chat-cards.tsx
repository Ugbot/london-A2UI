"use client";

/**
 * In-chat cards. Instead of dumping composition JSON as text, the agent's
 * tool calls render as "complete elements": render_widget shows a live preview
 * of the assembled widget, and ask_user shows the question as clickable
 * option buttons (the chaining-interview UX).
 */
import * as React from "react";
import { Renderer } from "@/components/Renderer";
import { registry } from "@/bricks/registry";
import { validateComposition, type CompositionNode } from "@/bricks/composition";

/** A framed, scrollable live preview of a composition tree, shown in chat. */
export function WidgetPreviewCard({ tree }: { tree: unknown }) {
  const result = validateComposition(tree, registry);
  if (!result.ok) {
    return (
      <div className="my-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--muted-foreground)]">
        Composing widget…
      </div>
    );
  }
  return (
    <div className="my-1 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]">
      <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-3 py-1.5 text-xs font-medium text-emerald-700">
        <span>✓</span> Rendered to canvas
      </div>
      <div className="max-h-72 overflow-auto p-3">
        <Renderer tree={result.value as CompositionNode} />
      </div>
    </div>
  );
}

interface AskUserArgs {
  question?: string;
  options?: string[];
}

/** Renders the agent's question as option buttons; clicking responds. */
export function AskUserCard({
  args,
  respond,
  result,
}: {
  args: AskUserArgs;
  respond?: (value: unknown) => void | Promise<void>;
  result?: string;
}) {
  const [picked, setPicked] = React.useState<string | null>(null);
  const options = args.options ?? [];
  const answered = picked ?? result ?? null;

  return (
    <div className="my-1 flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--card-foreground)]">
      {args.question && <p className="text-sm font-medium">{args.question}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const isChosen = answered === opt;
          const disabled = !respond || answered !== null;
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => {
                setPicked(opt);
                respond?.(opt);
              }}
              className={[
                "rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors",
                isChosen
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]",
                disabled && !isChosen ? "opacity-50" : "",
              ].join(" ")}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <span className="text-xs text-[var(--muted-foreground)]">You chose: {answered}</span>
      )}
    </div>
  );
}
