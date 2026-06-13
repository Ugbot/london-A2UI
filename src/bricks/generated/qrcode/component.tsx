"use client";
import { QRCodeSVG } from "qrcode.react";
import type { Props } from "./schema";
export function Component({ value, size }: Props) {
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <QRCodeSVG value={value} size={size} />
      <span className="max-w-[200px] truncate text-xs text-[var(--muted-foreground)]">{value}</span>
    </div>
  );
}
