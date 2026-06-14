/**
 * Which prop(s) hold a brick's user-visible TEXT — the single source of truth for
 * inline WYSIWYG editing and the Inspector's Content fields. Server-safe (no React).
 *
 * `primaryTextProps(brick)` lists editable text props in priority order (primary first).
 * `isBoundProp(node, prop)` flags props whose static text is OVERRIDDEN by a live binding
 * (bindKey/bindField/bindCompute) — inline-editing those is moot, so the UI disables it
 * and shows a "bound" hint.
 */
import type { CompositionNode } from "./composition";

/** brick name → editable text props (primary first). */
export const TEXT_PROPS: Record<string, string[]> = {
  Heading: ["text"],
  Text: ["text"],
  Button: ["label"],
  ActionButton: ["label"],
  StatCard: ["label", "value"],
  Section: ["title", "description"],
  Card: ["title", "description", "footer"],
  Badge: ["text"],
  Quote: ["text", "author"],
  Alert: ["title", "description"],
  Divider: ["label"],
  FormField: ["label", "hint"],
  Input: ["label"],
  Select: ["label"],
  Checkbox: ["label"],
  Avatar: ["name"],
  ProgressBar: ["label"],
};

/** Props whose value is overridden when the brick has an active binding. */
const BOUND_OVERRIDABLE: Record<string, string[]> = {
  Heading: ["text"],
  Text: ["text"],
  Badge: ["text"],
  StatCard: ["value"],
};

/** Editable text props for a brick (empty if none). */
export function primaryTextProps(brick: string): string[] {
  return TEXT_PROPS[brick] ?? [];
}

/** The single most representative text prop for a brick (for double-click-to-edit). */
export function defaultTextProp(brick: string): string | undefined {
  return TEXT_PROPS[brick]?.[0];
}

/** Does a live binding override this prop's static text on this node? */
export function isBoundProp(node: Pick<CompositionNode, "brick" | "props">, prop: string): boolean {
  if (!BOUND_OVERRIDABLE[node.brick]?.includes(prop)) return false;
  const p = node.props as { bindKey?: unknown; bindField?: unknown; bindCompute?: unknown };
  return Boolean(p.bindKey || p.bindField || p.bindCompute);
}
