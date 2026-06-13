/**
 * The brick/partial cache: referential search + bake-with-dedup over pgvector.
 *
 * `bricks` is seeded from the code registry (so the agent can semantically find
 * primitives). `partials` grows: every successfully-rendered widget is distilled
 * into a template-with-holes and stored, deduped by structural signature +
 * embedding similarity so the cache stays clean as it grows.
 */
import pgvector from "pgvector/pg";
import { getPool, migrate } from "./db";
import { embed } from "./embeddings";
import { brickCatalog, brickEmbeddingText } from "@/bricks/registry";
import { registry } from "@/bricks/registry";
import { distill, structureSig, type TemplateNode } from "@/bricks/distill";
import { validateComposition, type CompositionNode } from "@/bricks/composition";
import type { Hole } from "@/bricks/types";

/** Cosine-distance threshold under which two partials are "the same". */
const DEDUP_DISTANCE = 0.15;

let ready: Promise<void> | null = null;

/** Run migrations and seed the bricks table once per process. */
export function ensureCache(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await migrate();
    await seedBricks();
  })();
  return ready;
}

/** Embed every registry brick and upsert it into the `bricks` table. */
async function seedBricks(): Promise<void> {
  const pool = await getPool();
  const bricks = [...registry.values()];
  // Skip if already seeded with the current brick count.
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM bricks");
  if (rows[0]?.n === bricks.length) return;

  for (const brick of bricks) {
    const vector = await embed(brickEmbeddingText(brick));
    await pool.query(
      `INSERT INTO bricks (name, description, tags, embedding)
       VALUES ($1, $2, $3, $4::vector)
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             tags = EXCLUDED.tags,
             embedding = EXCLUDED.embedding`,
      [brick.name, brick.description, brick.tags, pgvector.toSql(vector)],
    );
  }
}

export interface BrickHit {
  name: string;
  description: string;
  tags: string[];
  distance: number;
}

/** Semantic search over the brick registry. */
export async function searchBricks(query: string, k = 6): Promise<BrickHit[]> {
  await ensureCache();
  const pool = await getPool();
  const q = await embed(query);
  const { rows } = await pool.query(
    `SELECT name, description, tags, embedding <=> $1::vector AS distance
       FROM bricks ORDER BY distance ASC LIMIT $2`,
    [pgvector.toSql(q), k],
  );
  return rows.map((r) => ({
    name: r.name,
    description: r.description,
    tags: r.tags,
    distance: Number(r.distance),
  }));
}

export interface PartialHit {
  id: string;
  name: string;
  description: string;
  tags: string[];
  template: TemplateNode;
  holes: Hole[];
  usageCount: number;
  distance: number;
}

/** Semantic search over the growing partials cache. */
export async function searchPartials(query: string, k = 3): Promise<PartialHit[]> {
  await ensureCache();
  const pool = await getPool();
  const q = await embed(query);
  const { rows } = await pool.query(
    `SELECT id, name, description, tags, template, holes, usage_count,
            embedding <=> $1::vector AS distance
       FROM partials ORDER BY distance ASC LIMIT $2`,
    [pgvector.toSql(q), k],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags,
    template: r.template,
    holes: r.holes,
    usageCount: r.usage_count,
    distance: Number(r.distance),
  }));
}

export interface BakeResult {
  id: string;
  merged: boolean;
  name: string;
  holeCount: number;
}

/**
 * Distill a rendered widget into a partial and store it, deduping against
 * existing partials with the same structure that are embedding-close. On a
 * near-duplicate, bump `usage_count` instead of inserting a new row.
 */
export async function bakePartial(input: {
  name: string;
  description: string;
  tags?: string[];
  tree: unknown;
}): Promise<BakeResult> {
  await ensureCache();
  // Only bake registry-valid trees.
  const valid = validateComposition(input.tree, registry);
  if (!valid.ok) {
    throw new Error(
      `Cannot bake an invalid tree: ${valid.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
    );
  }
  const tree: CompositionNode = valid.value;
  const { template, holes } = distill(tree);
  const sig = structureSig(tree);
  const vector = await embed(`${input.name}: ${input.description}`);
  const pool = await getPool();

  // Dedup: same structure AND embedding-close -> reinforce existing.
  const dupe = await pool.query(
    `SELECT id, embedding <=> $1::vector AS distance
       FROM partials WHERE structure_sig = $2
       ORDER BY distance ASC LIMIT 1`,
    [pgvector.toSql(vector), sig],
  );
  if (dupe.rows[0] && Number(dupe.rows[0].distance) < DEDUP_DISTANCE) {
    const id = dupe.rows[0].id;
    await pool.query(
      `UPDATE partials SET usage_count = usage_count + 1, updated_at = now()
         WHERE id = $1`,
      [id],
    );
    return { id, merged: true, name: input.name, holeCount: holes.length };
  }

  const inserted = await pool.query(
    `INSERT INTO partials (name, description, tags, template, holes, structure_sig, embedding)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::vector)
     RETURNING id`,
    [
      input.name,
      input.description,
      input.tags ?? [],
      JSON.stringify(template),
      JSON.stringify(holes),
      sig,
      pgvector.toSql(vector),
    ],
  );
  return { id: inserted.rows[0].id, merged: false, name: input.name, holeCount: holes.length };
}

/** Persist a thread's canvas composition tree so it can be restored later. */
export async function saveCanvas(threadId: string, widget: unknown): Promise<void> {
  await migrate();
  const pool = await getPool();
  await pool.query(
    `INSERT INTO canvases (thread_id, widget, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (thread_id) DO UPDATE
       SET widget = EXCLUDED.widget, updated_at = now()`,
    [threadId, JSON.stringify(widget)],
  );
}

/** Load a thread's saved canvas composition tree, or null if none. */
export async function loadCanvas(threadId: string): Promise<unknown | null> {
  await migrate();
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT widget FROM canvases WHERE thread_id = $1`,
    [threadId],
  );
  return rows[0]?.widget ?? null;
}

/** Persist a session's chat transcript (AG-UI message array). */
export async function saveChat(sessionId: string, messages: unknown): Promise<void> {
  await migrate();
  const pool = await getPool();
  await pool.query(
    `INSERT INTO chats (session_id, messages, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (session_id) DO UPDATE
       SET messages = EXCLUDED.messages, updated_at = now()`,
    [sessionId, JSON.stringify(messages)],
  );
}

/** Load a session's saved chat transcript, or null if none. */
export async function loadChat(sessionId: string): Promise<unknown | null> {
  await migrate();
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT messages FROM chats WHERE session_id = $1`,
    [sessionId],
  );
  return rows[0]?.messages ?? null;
}

/** Re-export for tools that surface the brick catalog. */
export { brickCatalog };
