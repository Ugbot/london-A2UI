"use client";

/**
 * Floating quick-action bar pinned above the selected element (Figma-style): edit
 * text, duplicate, delete, and "mention in chat". pointer-events:auto so it's
 * clickable (the rest of the overlay is pass-through). Commits via the canonical
 * dispatch path so actions are transactional + rewindable.
 */
import * as React from "react";
import { Pencil, Copy, Trash2, AtSign } from "lucide-react";
import { dispatch } from "@/engine/dispatch";
import { useSelectionStore } from "@/state/selectionStore";
import { useMentionStore } from "@/state/mentionStore";
import { primaryTextProps } from "@/bricks/text-props";

export function SelectionToolbar({ id, brick, rect }: { id: string; brick: string; rect: DOMRect }) {
  const enterEdit = useSelectionStore((s) => s.enterEdit);
  const clear = useSelectionStore((s) => s.clear);
  const mentionElement = useMentionStore((s) => s.mentionElement);
  const editable = primaryTextProps(brick).length > 0;

  const Btn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid h-7 w-7 place-items-center rounded text-white/90 hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  );

  return (
    <div
      className="pointer-events-auto fixed z-[1002] flex items-center gap-0.5 rounded-md bg-[var(--accent-brand)] px-1 py-0.5 shadow-lg"
      style={{ top: Math.max(4, rect.top - 38), left: rect.left }}
    >
      {editable && (
        <Btn title="Edit text (double-click)" onClick={() => enterEdit(id)}>
          <Pencil size={14} />
        </Btn>
      )}
      <Btn title="Duplicate" onClick={() => dispatch({ type: "tree/duplicate", id })}>
        <Copy size={14} />
      </Btn>
      <Btn title="Mention in chat" onClick={() => mentionElement(id)}>
        <AtSign size={14} />
      </Btn>
      <Btn
        title="Delete"
        onClick={() => {
          dispatch({ type: "tree/remove", id });
          clear();
        }}
      >
        <Trash2 size={14} />
      </Btn>
    </div>
  );
}
