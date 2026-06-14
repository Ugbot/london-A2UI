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
import { useFoundryStore } from "@/state/foundryStore";

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
      {/* The preview is a mini-artboard: reset to light tokens so bricks stay
          readable even though the chat sidebar is dark. */}
      <div className="canvas-light max-h-72 overflow-auto rounded-b-[var(--radius)] p-3">
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

export interface FoundrySpec {
  name?: string;
  description?: string;
  tags?: string[];
  npmPackage?: string;
  schemaSource?: string;
  componentSource?: string;
}

/**
 * Approval + creation card for a foundry-proposed new brick. Shows the spec;
 * with Auto on it builds immediately, otherwise waits for Approve. Performs the
 * actual creation (POST /api/foundry) on the client, then responds to the agent.
 */
export function FoundryCard({
  spec,
  respond,
  result,
}: {
  spec: FoundrySpec;
  respond?: (value: unknown) => void | Promise<void>;
  result?: string;
}) {
  const auto = useFoundryStore((s) => s.auto);
  const [state, setState] = React.useState<"idle" | "building" | "done" | "error" | "cancelled">(
    result ? "done" : "idle",
  );
  const [message, setMessage] = React.useState<string>(result ?? "");

  const build = React.useCallback(async () => {
    if (!respond) return;
    setState("building");
    try {
      // Kick off the (possibly slow, npm-installing) job; it returns a handle now.
      const res = await fetch("/api/foundry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
      });
      const start = await res.json();
      if (!res.ok || start.error || !start.jobId) {
        setState("error");
        setMessage(start.error ?? `HTTP ${res.status}`);
        await respond(`Brick creation failed: ${start.error ?? res.status}.`);
        return;
      }
      // Poll the background job until it finishes (up to ~4 min).
      const deadline = Date.now() + 240_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        const job = await (await fetch(`/api/foundry?jobId=${start.jobId}`)).json();
        if (job.status === "done") {
          setState("done");
          setMessage(job.message ?? `Created "${spec.name}".`);
          await respond(
            `Created brick "${job.name}"${job.installed ? ` backed by ${job.installed}` : ""}. It is now available — use it in the widget.`,
          );
          return;
        }
        if (job.status === "error") {
          setState("error");
          setMessage(`${job.message ?? "failed"}${job.detail ? `: ${job.detail}` : ""}`);
          await respond(`Brick creation failed: ${job.message ?? "error"}. ${job.detail ?? ""}`);
          return;
        }
      }
      setState("error");
      setMessage("Timed out building the brick.");
      await respond("Brick creation timed out.");
    } catch (err) {
      setState("error");
      setMessage(String(err));
      await respond(`Brick creation error: ${String(err)}`);
    }
  }, [respond, spec]);

  // Auto mode: build as soon as the card mounts (no approval gate).
  React.useEffect(() => {
    if (auto && respond && state === "idle") void build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, respond]);

  return (
    <div className="my-1 flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--card-foreground)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">New brick: {spec.name}</span>
        {spec.npmPackage && (
          <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 font-mono text-[10px]">
            npm: {spec.npmPackage}
          </span>
        )}
      </div>
      {spec.description && (
        <p className="text-xs text-[var(--muted-foreground)]">{spec.description}</p>
      )}
      {state === "idle" && respond && !auto && (
        <div className="flex gap-2">
          <button
            onClick={build}
            className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1 text-xs font-medium text-[var(--primary-foreground)]"
          >
            Approve & build
          </button>
          <button
            onClick={() => {
              setState("cancelled");
              respond("User declined to create the brick.");
            }}
            className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1 text-xs"
          >
            Cancel
          </button>
        </div>
      )}
      {state === "building" && (
        <span className="text-xs text-amber-600">⏳ Building{spec.npmPackage ? " (installing lib)" : ""}…</span>
      )}
      {state === "done" && <span className="text-xs text-emerald-700">✓ {message}</span>}
      {state === "error" && <span className="text-xs text-red-600">✗ {message}</span>}
      {state === "cancelled" && <span className="text-xs text-[var(--muted-foreground)]">Cancelled.</span>}
    </div>
  );
}
