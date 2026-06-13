"use client";

/**
 * @-mention autocomplete for the chat. CopilotKit's input slot only accepts its
 * own component, so rather than rewrite the chat view we attach a lightweight
 * overlay to the existing chat textarea: it watches for an "@token", shows a
 * dropdown of the current widget's elements, and inserts the chosen @id.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import type { ElementRef } from "@/bricks/tree";

const CHAT_PLACEHOLDER = "Type a message";

export function MentionOverlay({ elements }: { elements: ElementRef[] }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  const isChatArea = (el: EventTarget | null): el is HTMLTextAreaElement =>
    el instanceof HTMLTextAreaElement &&
    (el.getAttribute("placeholder") ?? "").includes(CHAT_PLACEHOLDER);

  React.useEffect(() => {
    const onInput = (e: Event) => {
      if (!isChatArea(e.target)) return;
      const ta = e.target;
      const caret = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, caret);
      const m = /(^|\s)@([\w-]*)$/.exec(before);
      if (m) {
        taRef.current = ta;
        setQuery(m[2].toLowerCase());
        setRect(ta.getBoundingClientRect());
        setOpen(true);
      } else {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  const filtered = open
    ? elements
        .filter((el) => el.id.toLowerCase().includes(query) || el.label.toLowerCase().includes(query))
        .slice(0, 8)
    : [];

  const pick = (id: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, caret).replace(/@([\w-]*)$/, `@${id} `);
    const next = before + ta.value.slice(caret);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(ta, next);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    setOpen(false);
  };

  if (!open || filtered.length === 0 || !rect || typeof document === "undefined") return null;

  return createPortal(
    <ul
      className="fixed z-[1000] max-h-60 overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
      style={{ left: rect.left, top: rect.top - Math.min(filtered.length * 34 + 8, 252), width: rect.width }}
    >
      {filtered.map((el) => (
        <li key={el.id}>
          <button
            type="button"
            // mousedown (not click) so we act before the textarea blurs
            onMouseDown={(ev) => {
              ev.preventDefault();
              pick(el.id);
            }}
            className="flex w-full items-center justify-between gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm hover:bg-[var(--secondary)]"
          >
            <span className="font-mono text-xs text-[var(--primary)]">@{el.id}</span>
            <span className="truncate text-xs text-[var(--muted-foreground)]">
              {el.brick} · {el.label}
            </span>
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  );
}
