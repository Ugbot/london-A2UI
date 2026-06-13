/**
 * The composition tree — what the agent emits and the renderer walks.
 *
 * A {@link CompositionNode} references a brick by name and supplies props plus
 * optional children. {@link validateComposition} checks every node against the
 * registry and returns JSON-path-keyed errors that drive the agent repair loop.
 */
import { z } from "zod";
import type { BrickDef, Hole } from "./types";

/** A node in a concrete composition tree (all props filled after parsing). */
export interface CompositionNode {
  brick: string;
  /** Stable handle for @-targeting and in-place editing (optional). */
  id?: string;
  props: Record<string, unknown>;
  children?: CompositionNode[];
}

/** Input shape before parsing — `props`/`id` may be omitted. */
interface CompositionNodeInput {
  brick: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: CompositionNodeInput[];
}

/** Recursive schema for a composition node (shape only; bricks checked separately). */
export const compositionNodeSchema: z.ZodType<
  CompositionNode,
  z.ZodTypeDef,
  CompositionNodeInput
> = z.lazy(() =>
  z.object({
    brick: z.string().min(1),
    id: z.string().optional(),
    props: z.record(z.unknown()).default({}),
    children: z.array(compositionNodeSchema).optional(),
  }),
);

/**
 * Loose, non-recursive input schema for the `render_widget` tool. Deep
 * recursion confuses LLM tool-schema generation, so the param is shallow (the
 * agent still nests `children` freely) and {@link validateComposition} does the
 * real recursive check against the registry.
 */
export const renderWidgetInputSchema = z.object({
  tree: z.object({
    brick: z.string(),
    props: z.record(z.unknown()).optional(),
    children: z.array(z.unknown()).optional(),
  }),
});

/** A hole reference inside a partial template, e.g. `{ $hole: "label" }`. */
export interface HoleRef {
  $hole: string;
}

/** Narrow an unknown prop value to a template hole reference. */
export function isHoleRef(value: unknown): value is HoleRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "$hole" in value &&
    typeof (value as HoleRef).$hole === "string"
  );
}

/** A composition error keyed by a human-readable JSON path. */
export interface CompositionError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: CompositionNode }
  | { ok: false; errors: CompositionError[] };

/**
 * Validate a composition tree against the brick registry: every node's `brick`
 * must exist, its `props` must satisfy that brick's schema, and `children` are
 * only allowed where the brick accepts them. Returns ALL errors (not just the
 * first) so the agent can repair in one pass.
 */
export function validateComposition(
  tree: unknown,
  registry: Map<string, BrickDef>,
): ValidationResult {
  const shape = compositionNodeSchema.safeParse(tree);
  if (!shape.success) {
    return {
      ok: false,
      errors: shape.error.issues.map((i) => ({
        path: i.path.join(".") || "root",
        message: i.message,
      })),
    };
  }

  const errors: CompositionError[] = [];
  const available = [...registry.keys()].join(", ");

  const walk = (node: CompositionNode, path: string): void => {
    const brick = registry.get(node.brick);
    if (!brick) {
      errors.push({
        path: `${path}.brick`,
        message: `Unknown brick "${node.brick}". Available bricks: ${available}`,
      });
      return;
    }

    const props = brick.schema.safeParse(node.props);
    if (!props.success) {
      for (const issue of props.error.issues) {
        errors.push({
          path: `${path}.props.${issue.path.join(".")}`.replace(/\.$/, ""),
          message: issue.message,
        });
      }
    }

    const childCount = node.children?.length ?? 0;
    if (childCount > 0 && !brick.acceptsChildren) {
      errors.push({
        path: `${path}.children`,
        message: `Brick "${node.brick}" does not accept children`,
      });
    }
    node.children?.forEach((child, i) => walk(child, `${path}.children[${i}]`));
  };

  walk(shape.data, "root");

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: shape.data };
}

/**
 * Parse a node's props through its brick schema, applying defaults/coercion so
 * the rendered component receives clean, typed values. Assumes the node has
 * already passed {@link validateComposition}.
 */
export function resolveProps(
  node: CompositionNode,
  registry: Map<string, BrickDef>,
): Record<string, unknown> {
  const brick = registry.get(node.brick);
  if (!brick) return node.props;
  const parsed = brick.schema.safeParse(node.props);
  return parsed.success
    ? (parsed.data as Record<string, unknown>)
    : node.props;
}

/** Re-export for convenience. */
export type { Hole };
