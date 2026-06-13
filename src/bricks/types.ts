/**
 * The brick contract — the single source of truth shared by the React canvas
 * (which renders bricks) and the agent (which composes and validates them).
 *
 * A "brick" is a pre-built, typed, tested UI primitive. The agent never writes
 * JSX; it references bricks by name and supplies props that are validated
 * against the brick's Zod schema. That is what makes generation "bricks, not
 * sand": the output space is bounded to known-good components.
 */
import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";

/** The types a template hole may take ("json" = an array/object content value). */
export type HoleType = "string" | "number" | "boolean" | "string[]" | "number[]" | "json";

/** A typed, named slot in a partial template that the agent fills on reuse. */
export interface Hole {
  name: string;
  type: HoleType;
  description: string;
}

/**
 * A registered brick. Stored type-erased so heterogeneous bricks share one
 * registry; authoring keeps full type-safety via {@link defineBrick}.
 */
export interface BrickDef {
  /** Unique identifier the agent references (e.g. "StatCard"). */
  name: string;
  /** Semantic description; embedded for referential search. */
  description: string;
  /** Search tags; embedded alongside the description. */
  tags: string[];
  /** Validates props before render; the component can trust validated input. */
  schema: z.ZodTypeAny;
  /** Whether this brick renders child composition nodes. */
  acceptsChildren: boolean;
  /**
   * The React component. Props are validated against `schema` before render.
   * Typed-erased here; `defineBrick` preserves the inferred prop type at the
   * authoring site, so the erasure never reaches brick authors.
   */
  Component: ComponentType<Record<string, unknown> & { children?: ReactNode }>;
}

/**
 * Define a brick with full prop-type inference from its Zod schema. The
 * component is authored against `z.infer<S>`; the result is stored type-erased
 * in the registry. The single localized cast is justified: every consumer
 * validates props against `schema` before the component is rendered.
 */
export function defineBrick<S extends z.ZodTypeAny>(def: {
  name: string;
  description: string;
  tags: string[];
  schema: S;
  acceptsChildren?: boolean;
  Component: ComponentType<z.infer<S> & { children?: ReactNode }>;
}): BrickDef {
  return {
    name: def.name,
    description: def.description,
    tags: def.tags,
    schema: def.schema,
    acceptsChildren: def.acceptsChildren ?? false,
    Component: def.Component as BrickDef["Component"],
  };
}
