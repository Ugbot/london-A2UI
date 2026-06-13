/**
 * The brick registry — the lookup the renderer and the agent share.
 *
 * Server-safe (no "use client"): the agent imports `listBricks`/`brickCatalog`
 * for tool definitions and embedding; the canvas imports `registry` to render.
 */
import { zodToJsonSchema } from "@/lib/zod-to-json-schema";
import { BRICKS } from "./defs";
import type { BrickDef } from "./types";

/** name -> BrickDef. */
export const registry: Map<string, BrickDef> = new Map(
  BRICKS.map((b) => [b.name, b]),
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
