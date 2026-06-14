"use client";

/**
 * The ONE toolbar trigger/affordance — replaces the per-menu ad-hoc button classes so the
 * chrome is consistent (same height/padding/hover/active). Icon + optional label; `active`
 * highlights it (open menu / on toggle).
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const MenuButton = React.forwardRef<
  HTMLButtonElement,
  {
    icon?: LucideIcon;
    label?: string;
    active?: boolean;
    title?: string;
    onClick?: () => void;
    disabled?: boolean;
  }
>(function MenuButton({ icon: Icon, label, active, title, onClick, disabled }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius)] border px-2 text-xs font-medium transition-colors disabled:opacity-40",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--secondary)]",
      )}
    >
      {Icon && <Icon size={13} />}
      {label && <span>{label}</span>}
    </button>
  );
});
