"use client";

/**
 * Rewind scrubber — "Figma with a timeline".
 *
 * Records bounded checkpoints of the whole session doc (tree + data) after each tracked
 * (local/agent) change settles, and lets you scrub back to ANY of them. Restoring writes
 * the checkpoint's tree + data back as one atomic, itself-undoable edit (see history.ts).
 * Complements stepwise undo/redo with arbitrary seek. Hidden until ≥2 checkpoints exist.
 */
import * as React from "react";
import { History } from "lucide-react";
import * as Y from "yjs";
import { useCollab } from "@/collab/provider";
import { ORIGIN } from "@/collab/doc-model";
import { HistoryLog } from "@/engine/history";
import { dispatchBatch } from "@/engine/dispatch";
import type { Command } from "@/engine/commands";

export function HistoryScrubber() {
  const { doc } = useCollab();
  const logRef = React.useRef<HistoryLog | null>(null);
  const [version, setVersion] = React.useState(0); // bump to re-read the log
  const [pos, setPos] = React.useState(0);
  const [scrubbing, setScrubbing] = React.useState(false);

  // Fresh log per doc (session switch / reload).
  React.useEffect(() => {
    logRef.current = new HistoryLog(doc);
    setVersion((v) => v + 1);
    setPos(0);
  }, [doc]);

  // Capture a checkpoint shortly after a tracked change settles (debounced).
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onTxn = (txn: Y.Transaction) => {
      // Only user-driven edits make a checkpoint; worker fetches + remote peers are excluded.
      if (txn.origin !== ORIGIN.local && txn.origin !== ORIGIN.agent) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        logRef.current?.capture("edit", Date.now());
        if (!scrubbing) setPos((logRef.current?.size() ?? 1) - 1);
        setVersion((v) => v + 1);
      }, 450);
    };
    doc.on("afterTransaction", onTxn);
    return () => {
      doc.off("afterTransaction", onTxn);
      if (timer) clearTimeout(timer);
    };
  }, [doc, scrubbing]);

  const log = logRef.current;
  const size = log?.size() ?? 0;
  void version; // re-render dependency

  if (size < 2) return null;

  const restore = (index: number) => {
    const snap = log!.at(index);
    if (!snap) return;
    const commands: Command[] = [{ type: "tree/render", tree: snap.tree ?? { brick: "Stack", props: {} } }];
    for (const [target, value] of Object.entries(snap.data)) {
      commands.push({ type: "data/set", action: "set", target, value });
    }
    dispatchBatch(commands);
  };

  const items = log!.list();
  const at = items[Math.min(pos, size - 1)];

  return (
    <div className="flex items-center gap-2" title="Rewind through edit history">
      <History size={14} className="text-[var(--muted-foreground)]" />
      <input
        type="range"
        min={0}
        max={size - 1}
        value={Math.min(pos, size - 1)}
        onPointerDown={() => setScrubbing(true)}
        onChange={(e) => setPos(Number(e.target.value))}
        onPointerUp={(e) => {
          const idx = Number((e.target as HTMLInputElement).value);
          setScrubbing(false);
          restore(idx);
        }}
        className="h-1 w-28 cursor-pointer accent-[var(--primary)]"
      />
      <span className="tabular-nums text-[10px] text-[var(--muted-foreground)]">
        {Math.min(pos, size - 1) + 1}/{size}
        {scrubbing && at ? ` · ${new Date(at.time).toLocaleTimeString()}` : ""}
      </span>
    </div>
  );
}
