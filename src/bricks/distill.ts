/**
 * Distillation: turn a concrete composition tree into a reusable PARTIAL —
 * a template where content-bearing props (text, labels, values, data arrays)
 * become typed holes, while structural props (layout, variants, levels) stay
 * fixed. This is what makes a baked widget reusable: retrieval returns a
 * scaffold the agent fills, not a one-off.
 */
import type { z } from "zod";
import { registry } from "./registry";
import type { CompositionNode } from "./composition";
import type { Hole, HoleType } from "./types";

/** A composition node that may contain hole references at prop-value positions. */
export interface TemplateNode {
  brick: string;
  props: Record<string, unknown>;
  children?: TemplateNode[];
}

interface ZodInner {
  typeName?: string;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
}

/** Unwrap Optional/Default to the base Zod type name (e.g. "ZodString"). */
function baseTypeName(field: z.ZodTypeAny): string | undefined {
  let def = (field as unknown as { _def: ZodInner })._def;
  while (def && (def.typeName === "ZodOptional" || def.typeName === "ZodDefault")) {
    if (!def.innerType) break;
    def = (def.innerType as unknown as { _def: ZodInner })._def;
  }
  return def?.typeName;
}

/** Map a content prop's Zod type to a hole type; null = keep fixed (structural). */
function holeTypeForField(field: z.ZodTypeAny | undefined): HoleType | null {
  if (!field) return null;
  switch (baseTypeName(field)) {
    case "ZodString":
      return "string";
    case "ZodArray":
      return "json";
    default:
      // numbers (gap, cols, level, percent), enums (variant), booleans: structural
      return null;
  }
}

/** Get the prop-name -> Zod field map for a brick, if it is a ZodObject. */
function brickShape(brickName: string): Record<string, z.ZodTypeAny> | null {
  const brick = registry.get(brickName);
  if (!brick) return null;
  const def = (brick.schema as unknown as { _def: { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> } })._def;
  if (def.typeName !== "ZodObject" || !def.shape) return null;
  return def.shape();
}

/**
 * Distill a concrete tree into a template + the list of holes to fill.
 * Hole names are stable, sequential (`h0`, `h1`, …) in tree order.
 */
export function distill(tree: CompositionNode): { template: TemplateNode; holes: Hole[] } {
  const holes: Hole[] = [];
  let counter = 0;

  const walk = (node: CompositionNode): TemplateNode => {
    const shape = brickShape(node.brick);
    const props: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(node.props ?? {})) {
      const holeType = shape ? holeTypeForField(shape[key]) : null;
      if (holeType === null || value === undefined || value === null) {
        props[key] = value;
        continue;
      }
      const name = `h${counter++}`;
      const sample = typeof value === "string" ? `"${value}"` : JSON.stringify(value).slice(0, 40);
      holes.push({
        name,
        type: holeType,
        description: `${node.brick}.${key} (e.g. ${sample})`,
      });
      props[key] = { $hole: name };
    }

    const template: TemplateNode = { brick: node.brick, props };
    if (node.children?.length) template.children = node.children.map(walk);
    return template;
  };

  return { template: walk(tree), holes };
}

/** A stable signature of a tree's brick structure (ignores prop values). */
export function structureSig(tree: CompositionNode): string {
  const sig = (node: CompositionNode): string => {
    const kids = node.children?.length
      ? `(${node.children.map(sig).join(",")})`
      : "";
    return `${node.brick}${kids}`;
  };
  return sig(tree);
}

/** Fill a template's holes with values, producing a concrete tree. */
export function fillTemplate(
  template: TemplateNode,
  values: Record<string, unknown>,
): CompositionNode {
  const resolve = (val: unknown): unknown => {
    if (val && typeof val === "object" && "$hole" in (val as Record<string, unknown>)) {
      const name = (val as { $hole: string }).$hole;
      return values[name];
    }
    return val;
  };

  const walk = (node: TemplateNode): CompositionNode => {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.props)) {
      props[key] = resolve(value);
    }
    const out: CompositionNode = { brick: node.brick, props };
    if (node.children?.length) out.children = node.children.map(walk);
    return out;
  };

  return walk(template);
}
