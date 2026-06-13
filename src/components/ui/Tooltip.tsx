"use client";

/**
 * A tiny, dependency-free tooltip. Wraps its children and shows `text` in a
 * small bubble positioned above on hover. The wrapper also carries a native
 * `title` as an accessible fallback.
 */
import type { ReactNode } from "react";

export function Tooltip({
  text,
  children,
  className = "",
}: {
  text: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`group relative inline-flex ${className}`} title={text}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius)] bg-[var(--foreground)] px-2 py-1 text-xs text-[var(--background)] shadow-md group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
