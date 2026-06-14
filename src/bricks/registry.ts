/**
 * The brick registry — the lookup the renderer and the agent share.
 *
 * Server-safe (no "use client"): the agent imports `listBricks`/`brickCatalog`
 * for tool definitions and embedding; the canvas imports `registry` to render.
 */
import { z } from "zod";
import { zodToJsonSchema } from "@/lib/zod-to-json-schema";
import { BRICKS } from "./defs";
import type { BrickDef } from "./types";

/**
 * The style system: EVERY brick accepts `sx` (style tokens) + `style` (inline CSS
 * overrides), applied to its wrapper by the Renderer. We add these centrally here
 * so validation/resolution allow them on any brick without touching 40 schemas.
 * The agent learns the vocabulary from the system prompt (kept out of the
 * per-brick catalog to avoid repeating it 40×).
 */
const STYLEABLE = {
  sx: z.array(z.string()).optional(),
  style: z.record(z.unknown()).optional(),
};
function withStyle(def: BrickDef): BrickDef {
  return def.schema instanceof z.ZodObject
    ? { ...def, schema: def.schema.extend(STYLEABLE) }
    : def;
}

/** name -> BrickDef (with the universal sx/style props merged in). */
export const registry: Map<string, BrickDef> = new Map(
  BRICKS.map((b) => [b.name, withStyle(b)]),
);

/** Look up a brick by name. */
export function getBrick(name: string): BrickDef | undefined {
  return registry.get(name);
}

/** All registered brick names. */
export function brickNames(): string[] {
  return [...registry.keys()];
}

/** A server-safe, embeddable description of a brick (no React component). */
export interface BrickCatalogEntry {
  name: string;
  description: string;
  tags: string[];
  acceptsChildren: boolean;
  /** JSON-schema view of the props, for the agent and for embedding context. */
  props: Record<string, unknown>;
}

/** Build the catalog view of a single brick. */
export function toCatalogEntry(brick: BrickDef): BrickCatalogEntry {
  return {
    name: brick.name,
    description: brick.description,
    tags: brick.tags,
    acceptsChildren: brick.acceptsChildren,
    props: zodToJsonSchema(brick.schema),
  };
}

/** The full catalog (used by the agent's list_bricks tool and embedding). */
export function brickCatalog(): BrickCatalogEntry[] {
  return BRICKS.map(toCatalogEntry);
}

/** The text embedded for a brick's referential-search vector. */
export function brickEmbeddingText(brick: BrickDef): string {
  return `${brick.name}: ${brick.description} (tags: ${brick.tags.join(", ")})`;
}
