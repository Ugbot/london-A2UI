"use client";

/**
 * @-mention autocomplete for the chat. CopilotKit's input slot only accepts its
 * own component, so we attach a lightweight overlay to the existing chat
 * textarea: watch for an "@token", show a dropdown of the current widget's
 * elements, and insert the chosen @id — via mouse OR keyboard (↑/↓, Enter/Tab,
 * Esc), intercepting Enter so it fills instead of submitting the chat.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import type { ElementRef } from "@/bricks/tree";
import { useMentionStore } from "@/state/mentionStore";

const CHAT_PLACEHOLDER = "Type a message";

/** Is this the chat composer textarea? Robust to label changes: match the known
 *  placeholder OR any textarea inside the CopilotKit chat region. */
function isChatArea(el: EventTarget | null): el is HTMLTextAreaElement {
  if (!(el instanceof HTMLTextAreaElement)) return false;
  if ((el.getAttribute("placeholder") ?? "").includes(CHAT_PLACEHOLDER)) return true;
  return !!el.closest("[data-copilotkit], .cpk-dark");
}

/** Find the chat composer textarea in the DOM (for click-to-insert). */
function findChatTextarea(): HTMLTextAreaElement | null {
  const byPlaceholder = document.querySelector<HTMLTextAreaElement>(
    `textarea[placeholder*="${CHAT_PLACEHOLDER}"]`,
  );
  if (byPlaceholder) return byPlaceholder;
  return document.querySelector<HTMLTextAreaElement>(".cpk-dark textarea, [data-copilotkit] textarea");
}

/** Set a textarea's value through React's native setter so onChange fires. */
function setTextareaValue(ta: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(ta, value);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

export function MentionOverlay({ elements }: { elements: ElementRef[] }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Click-to-select on the canvas queues an "@id " — insert it into the chat input.
  const pendingInsert = useMentionStore((s) => s.pendingInsert);
  const consumeInsert = useMentionStore((s) => s.consumeInsert);
  React.useEffect(() => {
    if (!pendingInsert) return;
    const ta = findChatTextarea();
    const text = consumeInsert();
    if (!ta || !text) return;
    const needsSpace = ta.value.length > 0 && !/\s$/.test(ta.value);
    const next = ta.value + (needsSpace ? " " : "") + text;
    setTextareaValue(ta, next);
    ta.focus();
    ta.setSelectionRange(next.length, next.length);
  }, [pendingInsert, consumeInsert]);

  const filtered = React.useMemo(
    () =>
      open
        ? elements
            .filter((e) => e.id.toLowerCase().includes(query) || e.label.toLowerCase().includes(query))
            .slice(0, 8)
        : [],
    [open, query, elements],
  );

  // Keep refs the document-level handlers can read without re-binding.
  const stateRef = React.useRef({ open, filtered, active });
  stateRef.current = { open, filtered, active };

  const pick = React.useCallback((id: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, caret).replace(/@([\w-]*)$/, `@${id} `);
    const next = before + ta.value.slice(caret);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(ta, next);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    const pos = before.length;
    ta.setSelectionRange(pos, pos);
    setOpen(false);
  }, []);

  React.useEffect(() => {
    const onInput = (e: Event) => {
      if (!isChatArea(e.target)) return;
      const ta = e.target;
      const caret = ta.selectionStart ?? ta.value.length;
      const m = /(^|\s)@([\w-]*)$/.exec(ta.value.slice(0, caret));
      if (m) {
        taRef.current = ta;
        setQuery(m[2].toLowerCase());
        setRect(ta.getBoundingClientRect());
        setActive(0);
        setOpen(true);
      } else {
        setOpen(false);
      }
    };
    // Capture phase so we can intercept Enter/Tab BEFORE CopilotKit submits.
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s.open || !isChatArea(e.target) || s.filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, s.filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        pick(s.filtered[s.active]?.id ?? s.filtered[0].id);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [pick]);

  if (!open || filtered.length === 0 || !rect || typeof document === "undefined") return null;

  // Anchor the dropdown SNUG to the top edge of the chat input (grows upward),
  // full input width — an inline combobox, like @-mentions in OpenAI/Claude/Slack.
  return createPortal(
    <ul
      className="fixed z-[1000] max-h-72 overflow-auto rounded-t-[var(--radius)] border border-b-0 border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
      style={{ left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width }}
    >
      <li className="px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        ↑/↓ to navigate · Enter to insert
      </li>
      {filtered.map((el, i) => (
        <li key={el.id}>
          <button
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseDown={(ev) => {
              ev.preventDefault();
              pick(el.id);
            }}
            className={[
              "flex w-full items-center justify-between gap-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm",
              i === active ? "bg-[var(--secondary)]" : "",
            ].join(" ")}
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
