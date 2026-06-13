"use client";

/** Copies the current session URL so others can join the same collaborative room. */
import { useState } from "react";
import { useCollab } from "./provider";

export function ShareButton() {
  const { session } = useCollab();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard may be blocked; fall back to a prompt
      window.prompt("Copy this session URL:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!session) return null;
  return (
    <button
      onClick={share}
      title="Copy a shareable link to this session"
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]"
    >
      {copied ? "Link copied ✓" : "Share"}
    </button>
  );
}
