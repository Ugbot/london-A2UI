"use client";

/**
 * Style inspector — the right-side panel (dark chrome) for the SELECTED element.
 * Toggling chips edits the element's `sx` style tokens; the change is applied
 * transactionally (via the parent's onSetSx → patchById → applyTree → undoable).
 * This is the visual half of the style system (bricks · mortar · styles).
 */
import { Lock, X } from "lucide-react";
import type { CompositionNode } from "@/bricks/composition";
import { getBrick } from "@/bricks/registry";
import { zodToJsonSchema } from "@/lib/zod-to-json-schema";
import { primaryTextProps, isBoundProp } from "@/bricks/text-props";
import { dispatch } from "@/engine/dispatch";

const SKIP_PROPS = new Set(["sx", "style", "bindKey", "bindField", "bindCompute"]);

/** Ordered editable string props for a node (primary text props first). */
function stringProps(node: CompositionNode): string[] {
  const def = getBrick(node.brick);
  if (!def) return [];
  const json = zodToJsonSchema(def.schema) as { properties?: Record<string, { type?: string }> };
  const all = Object.entries(json.properties ?? {})
    .filter(([k, v]) => v?.type === "string" && !SKIP_PROPS.has(k))
    .map(([k]) => k);
  const primary = primaryTextProps(node.brick).filter((p) => all.includes(p));
  return [...primary, ...all.filter((p) => !primary.includes(p))];
}

/** A single text field that commits on blur/Enter (remounts when the value changes externally). */
function ContentField({ node, prop }: { node: CompositionNode; prop: string }) {
  const value = String((node.props as Record<string, unknown>)[prop] ?? "");
  const bound = isBoundProp(node, prop);
  const commit = (v: string) => {
    if (v !== value) dispatch({ type: "tree/patch", id: node.id!, setProps: { [prop]: v } });
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {prop}
        {bound && <Lock size={9} className="opacity-60" />}
      </span>
      <input
        key={`${node.id}:${prop}:${value}`}
        defaultValue={value}
        disabled={bound}
        title={bound ? "Bound to live data" : undefined}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            (e.target as HTMLInputElement).value = value;
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-7 rounded-[var(--radius-sm)] border border-[var(--input)] bg-[var(--background)] px-2 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
      />
    </label>
  );
}

interface Group {
  label: string;
  exclusive: boolean;
  tokens: string[];
}

const GROUPS: Group[] = [
  { label: "Background", exclusive: true, tokens: ["bg-muted", "bg-card", "bg-secondary", "bg-primary", "bg-accent"] },
  { label: "Padding", exclusive: true, tokens: ["pad-sm", "pad", "pad-lg", "pad-xl"] },
  { label: "Radius", exclusive: true, tokens: ["rounded", "rounded-lg", "rounded-xl", "rounded-full", "rounded-none"] },
  { label: "Shadow", exclusive: true, tokens: ["shadow-sm", "shadow", "shadow-lg"] },
  { label: "Text size", exclusive: true, tokens: ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"] },
  { label: "Weight", exclusive: true, tokens: ["weight-medium", "weight-semibold", "weight-bold"] },
  { label: "Align", exclusive: true, tokens: ["left", "center", "right"] },
  { label: "Width", exclusive: true, tokens: ["w-fit", "w-full"] },
  { label: "Self align", exclusive: true, tokens: ["self-start", "self-center", "self-end", "self-stretch"] },
  { label: "More", exclusive: false, tokens: ["border", "italic", "uppercase", "muted", "grow", "mx-auto"] },
];

// Short chip labels (the token without its group prefix).
const SHORT: Record<string, string> = {
  "bg-muted": "muted", "bg-card": "card", "bg-secondary": "secondary", "bg-primary": "primary", "bg-accent": "accent",
  "pad-sm": "sm", pad: "md", "pad-lg": "lg", "pad-xl": "xl",
  rounded: "md", "rounded-lg": "lg", "rounded-xl": "xl", "rounded-full": "full", "rounded-none": "none",
  "shadow-sm": "sm", shadow: "md", "shadow-lg": "lg",
  "text-sm": "sm", "text-base": "base", "text-lg": "lg", "text-xl": "xl", "text-2xl": "2xl",
  "weight-medium": "medium", "weight-semibold": "semibold", "weight-bold": "bold",
  "w-fit": "hug", "w-full": "fill",
  "self-start": "start", "self-center": "center", "self-end": "end", "self-stretch": "stretch",
};

// Auto-layout props (real flex/grid CSS) edited directly on container bricks.
const LAYOUT_PROPS = ["direction", "justify", "align", "gap", "cols"];

/** Auto-Layout section: surfaces a container brick's flex/grid props as controls. */
function LayoutSection({ node }: { node: CompositionNode }) {
  const def = getBrick(node.brick);
  const json = def
    ? (zodToJsonSchema(def.schema) as { properties?: Record<string, { type?: string; enum?: string[] }> })
    : {};
  const properties = json.properties ?? {};
  const present = LAYOUT_PROPS.filter((p) => properties[p]);
  if (present.length === 0) return null;
  const set = (prop: string, value: unknown) =>
    dispatch({ type: "tree/patch", id: node.id!, setProps: { [prop]: value } });
  const cur = node.props as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Auto layout</div>
      {present.map((prop) => {
        const spec = properties[prop];
        if (spec?.enum) {
          return (
            <div key={prop} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{prop}</span>
              <div className="flex flex-wrap gap-1">
                {spec.enum.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => set(prop, opt)}
                    className={[
                      "rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px]",
                      cur[prop] === opt
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        // numeric (gap 0-12, cols 1-6)
        const [min, max] = prop === "cols" ? [1, 6] : [0, 12];
        const value = Math.max(min, Math.min(max, Number(cur[prop]) || 0));
        return (
          <div key={prop} className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{prop}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => set(prop, Math.max(min, value - 1))}
                className="grid h-6 w-6 place-items-center rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
              >
                −
              </button>
              <span className="w-6 text-center text-xs tabular-nums">{value}</span>
              <button
                onClick={() => set(prop, Math.min(max, value + 1))}
                className="grid h-6 w-6 place-items-center rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Inspector({
  node,
  onSetSx,
  onClose,
}: {
  node: CompositionNode;
  onSetSx: (sx: string[]) => void;
  onClose: () => void;
}) {
  const current = Array.isArray((node.props as { sx?: unknown })?.sx)
    ? ((node.props as { sx?: string[] }).sx as string[])
    : [];
  const has = (t: string) => current.includes(t);

  const toggle = (token: string, group: Group) => {
    const next = new Set(current);
    if (next.has(token)) next.delete(token);
    else {
      if (group.exclusive) group.tokens.forEach((t) => next.delete(t));
      next.add(token);
    }
    onSetSx([...next]);
  };

  return (
    <div className="chrome absolute right-4 top-4 z-30 flex max-h-[calc(100%-2rem)] w-60 flex-col overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold">Style</div>
          <div className="truncate font-mono text-[10px] text-[var(--muted-foreground)]">@{node.id} · {node.brick}</div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {(() => {
          const props = stringProps(node);
          return props.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Content</div>
              {props.map((p) => (
                <ContentField key={p} node={node} prop={p} />
              ))}
            </div>
          ) : null;
        })()}
        <LayoutSection node={node} />
        {GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-1.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{g.label}</div>
            <div className="flex flex-wrap gap-1">
              {g.tokens.map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(t, g)}
                  className={[
                    "rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] transition-colors",
                    has(t)
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {SHORT[t] ?? t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
