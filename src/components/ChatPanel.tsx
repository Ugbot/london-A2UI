"use client";

/**
 * Our own chat sidebar (vendored frame). We OWN the panel: a dark, full-height
 * right rail with our header + collapse, and we drop CopilotKit's wired
 * <CopilotChat> inside it (so tool/preview/HITL renders + streaming all keep
 * working). Theming is via the `.cpk-dark` token remap in globals.css — we stay
 * on CopilotKit's light token structure with DARK values, which sidesteps its
 * hardcoded `.dark` colors entirely. This replaces the opaque <CopilotSidebar>
 * so we control width, header, position, and look.
 */
import * as React from "react";
import { PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { CopilotChat, type CopilotChatLabels } from "@copilotkit/react-core/v2";
import { PresenceBar } from "@/collab/PresenceBar";

export function ChatPanel({
  agentId = "default",
  threadId,
  labels,
}: {
  agentId?: string;
  threadId?: string;
  labels?: Partial<CopilotChatLabels>;
}) {
  const [open, setOpen] = React.useState(true);

  if (!open) {
    return (
      <div className="dark cpk-dark chrome flex h-screen w-12 shrink-0 flex-col items-center border-l border-[var(--border)] bg-[var(--background)] py-3">
        <button
          onClick={() => setOpen(true)}
          title="Open assistant"
          className="grid h-9 w-9 place-items-center rounded-[var(--radius)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          <PanelRightOpen size={18} />
        </button>
        <span className="mt-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
          <Sparkles size={13} />
        </span>
      </div>
    );
  }

  return (
    <aside className="dark cpk-dark chrome flex h-screen w-[26rem] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Sparkles size={13} />
          </span>
          <span className="text-sm font-semibold">Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <PresenceBar />
          <button
            onClick={() => setOpen(false)}
            title="Collapse assistant"
            className="grid h-8 w-8 place-items-center rounded-[var(--radius)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <CopilotChat agentId={agentId} threadId={threadId} labels={labels} />
      </div>
    </aside>
  );
}
