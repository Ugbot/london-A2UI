"use client";

/**
 * Collaborative + live bricks. Unlike the presentational bricks, these bind to
 * the shared Yjs document (CollabText, CollabChat) or a server SSE stream
 * (LiveFeed), so multiple users see each other's edits and server-pushed data
 * in real time. They consume the CollabProvider context.
 */
import * as React from "react";
import * as Y from "yjs";
import { useCollab } from "@/collab/provider";
import { cn } from "@/lib/utils";
import type {
  CollabChatProps,
  CollabTextProps,
  LiveFeedProps,
} from "./schemas";

const HTTP_URL =
  process.env.NEXT_PUBLIC_COLLAB_HTTP_URL ?? "http://localhost:1234";

/** Minimal prefix/suffix diff so concurrent edits to a Y.Text stay granular. */
function applyTextDiff(ytext: Y.Text, next: string) {
  const prev = ytext.toString();
  if (prev === next) return;
  let start = 0;
  const minLen = Math.min(prev.length, next.length);
  while (start < minLen && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  ytext.doc?.transact(() => {
    if (endPrev > start) ytext.delete(start, endPrev - start);
    if (endNext > start) ytext.insert(start, next.slice(start, endNext));
  });
}

export function CollabText({ id, label, placeholder, rows }: CollabTextProps) {
  const { doc } = useCollab();
  const ytext = React.useMemo(() => doc.getText(`text:${id}`), [doc, id]);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState(() => ytext.toString());

  React.useEffect(() => {
    const update = () => {
      const next = ytext.toString();
      setValue(next);
      const el = ref.current;
      if (el && el.value !== next) {
        const caret = Math.min(el.selectionStart, next.length);
        el.value = next;
        el.setSelectionRange(caret, caret);
      }
    };
    update();
    ytext.observe(update);
    return () => ytext.unobserve(update);
  }, [ytext]);

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium">{label}</span>}
      <textarea
        ref={ref}
        rows={rows}
        defaultValue={value}
        placeholder={placeholder}
        onChange={(e) => applyTextDiff(ytext, e.target.value)}
        className="rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <span className="text-xs text-[var(--muted-foreground)]">Shared — edits sync live to everyone.</span>
    </label>
  );
}

interface ChatMessage {
  user: string;
  color: string;
  text: string;
  ts: number;
}

export function CollabChat({ id, title }: CollabChatProps) {
  const { doc, user } = useCollab();
  const yarr = React.useMemo(() => doc.getArray<ChatMessage>(`chat:${id}`), [doc, id]);
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => yarr.toArray());
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    const update = () => setMessages(yarr.toArray());
    update();
    yarr.observe(update);
    return () => yarr.unobserve(update);
  }, [yarr]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    yarr.push([
      { user: user?.name ?? "Anon", color: user?.color ?? "#6366f1", text, ts: Date.now() },
    ]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
      <span className="text-sm font-medium">{title}</span>
      <div className="flex max-h-48 flex-col gap-1.5 overflow-auto">
        {messages.length === 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">No messages yet — say hi.</span>
        )}
        {messages.map((m, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium" style={{ color: m.color }}>{m.user}</span>{" "}
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message everyone…"
          className="h-8 flex-1 rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          onClick={send}
          className="h-8 rounded-[var(--radius)] bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)]"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export function LiveFeed({ channel, label }: LiveFeedProps) {
  const [history, setHistory] = React.useState<number[]>([]);

  React.useEffect(() => {
    const es = new EventSource(`${HTTP_URL}/feed?channel=${encodeURIComponent(channel)}`);
    es.onmessage = (e) => {
      try {
        const { value } = JSON.parse(e.data) as { value: number };
        setHistory((h) => [...h.slice(-29), value]);
      } catch {
        // ignore malformed frames
      }
    };
    return () => es.close();
  }, [channel]);

  const latest = history[history.length - 1];
  const max = Math.max(100, ...history);
  const points = history
    .map((v, i) => `${(i / Math.max(1, history.length - 1)) * 100},${40 - (v / max) * 40}`)
    .join(" ");

  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">
          {latest ?? "—"}
        </span>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full">
        {history.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", history.length ? "bg-emerald-500" : "bg-gray-300")} />
        live via SSE
      </span>
    </div>
  );
}
