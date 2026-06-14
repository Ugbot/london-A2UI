"use client";

/**
 * Inline WYSIWYG text editor used by core text bricks. Renders the value as plain text
 * normally; when this brick is the schematic editor's `editingId` (and the value isn't
 * bound), it becomes a contentEditable seeded ONCE from the value (uncontrolled while
 * focused — never re-seeded from props mid-edit, so the caret never jumps). Commits on
 * blur / Enter via dispatch(tree/patch) (one write → transactional + rewindable); Esc
 * cancels. Bound text (bindKey/bindField/bindCompute) is non-editable with a lock hint.
 */
import * as React from "react";
import { Lock } from "lucide-react";
import { useSelectionStore } from "@/state/selectionStore";
import { BrickIdContext } from "@/bricks/contract-hooks";
import { dispatch } from "@/engine/dispatch";

export function EditableText({
  prop,
  value,
  bound = false,
  className,
}: {
  prop: string;
  value: string;
  bound?: boolean;
  className?: string;
}) {
  const id = React.useContext(BrickIdContext);
  const editingId = useSelectionStore((s) => s.editingId);
  const exitEdit = useSelectionStore((s) => s.exitEdit);
  const editing = !!id && editingId === id && !bound;
  const ref = React.useRef<HTMLSpanElement>(null);

  // Seed + focus ONCE when editing begins; do not re-seed on prop changes.
  React.useEffect(() => {
    if (!editing || !ref.current) return;
    ref.current.textContent = value ?? "";
    ref.current.focus();
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) {
    // Show a subtle lock when this text is driven by a binding (can't edit statically).
    if (bound) {
      return (
        <span className={className} title="Bound to live data — edit the binding, not the text">
          {value}
          <Lock size={10} className="ml-1 inline opacity-40 align-baseline" />
        </span>
      );
    }
    return <span className={className}>{value}</span>;
  }

  return (
    <span
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => {
        if (id && ref.current) dispatch({ type: "tree/patch", id, setProps: { [prop]: ref.current.textContent ?? "" } });
        exitEdit();
      }}
      onKeyDown={(e) => {
        e.stopPropagation(); // don't let canvas shortcuts (Delete/Backspace) fire mid-edit
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          exitEdit();
        }
      }}
      style={{ outline: "2px solid var(--accent-brand)", outlineOffset: 2, borderRadius: 4, minWidth: 8 }}
    />
  );
}
