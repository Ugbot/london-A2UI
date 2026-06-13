/**
 * pgvector-backed storage for the brick/partial cache.
 *
 * Lives in its own `widgetcache` database on the same Postgres instance the
 * CopilotKit Intelligence stack uses, so we never touch CopilotKit's schema.
 * The Postgres image is `pgvector/pgvector:pg16`, which makes the `vector`
 * extension installable. Migrations are idempotent and run on agent boot.
 */
import { Pool } from "pg";
import { EMBED_DIM } from "./embeddings";

const PG_HOST = process.env.PGHOST ?? "localhost";
const PG_PORT = Number(process.env.PGPORT ?? 5432);
const PG_USER = process.env.PGUSER ?? "intelligence";
const PG_PASSWORD = process.env.PGPASSWORD ?? "intelligence";
const ADMIN_DB = process.env.PG_ADMIN_DB ?? "postgres";
const DB_NAME = process.env.WIDGETCACHE_DB ?? "widgetcache";

/** Connection string for the widgetcache database. */
export const DATABASE_URL =
  process.env.DATABASE_URL ??
  `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${DB_NAME}`;

let pool: Pool | null = null;
let migration: Promise<void> | null = null;

/**
 * Create the widgetcache database if it does not exist. `CREATE DATABASE`
 * cannot run inside a transaction nor be parameterized, so the name is
 * validated against a strict identifier pattern before interpolation.
 */
async function ensureDatabase(): Promise<void> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(DB_NAME)) {
    throw new Error(`Unsafe database name: ${DB_NAME}`);
  }
  const admin = new Pool({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: ADMIN_DB,
  });
  try {
    const { rowCount } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_NAME],
    );
    if (!rowCount) {
      await admin.query(`CREATE DATABASE ${DB_NAME}`);
    }
  } finally {
    await admin.end();
  }
}

/**
 * Get the shared connection pool to the widgetcache database, creating the
 * database on first use.
 */
export async function getPool(): Promise<Pool> {
  if (!pool) {
    await ensureDatabase();
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

/**
 * Idempotently create the `vector` extension, the `bricks` and `partials`
 * tables, and their HNSW (cosine) indexes. Safe to call repeatedly; the work
 * runs at most once per process.
 */
export function migrate(): Promise<void> {
  if (migration) return migration;
  migration = (async () => {
    const p = await getPool();
    const client = await p.connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");

      await client.query(`
        CREATE TABLE IF NOT EXISTS bricks (
          name        text PRIMARY KEY,
          description text NOT NULL,
          tags        text[] NOT NULL DEFAULT '{}',
          embedding   vector(${EMBED_DIM}) NOT NULL
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS partials (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name          text NOT NULL,
          description   text NOT NULL,
          tags          text[] NOT NULL DEFAULT '{}',
          template      jsonb NOT NULL,
          holes         jsonb NOT NULL DEFAULT '[]'::jsonb,
          structure_sig text NOT NULL,
          usage_count   int NOT NULL DEFAULT 1,
          embedding     vector(${EMBED_DIM}) NOT NULL,
          created_at    timestamptz NOT NULL DEFAULT now(),
          updated_at    timestamptz NOT NULL DEFAULT now()
        )
      `);

      // Per-thread canvas snapshots so a previous chat restores its widget.
      await client.query(`
        CREATE TABLE IF NOT EXISTS canvases (
          thread_id  text PRIMARY KEY,
          widget     jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      // Foundry-generated bricks (agent-authored components, possibly backed by
      // a newly-installed npm lib). The source is recorded so they can be
      // rebuilt; an embedding row is also written to `bricks` for search.
      await client.query(`
        CREATE TABLE IF NOT EXISTS generated_bricks (
          name           text PRIMARY KEY,
          description    text NOT NULL,
          tags           text[] NOT NULL DEFAULT '{}',
          npm_package    text,
          schema_source  text NOT NULL,
          component_source text NOT NULL,
          created_at     timestamptz NOT NULL DEFAULT now()
        )
      `);

      await client.query(
        `CREATE INDEX IF NOT EXISTS bricks_embedding_idx
           ON bricks USING hnsw (embedding vector_cosine_ops)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS partials_embedding_idx
           ON partials USING hnsw (embedding vector_cosine_ops)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS partials_structure_sig_idx
           ON partials (structure_sig)`,
      );
    } finally {
      client.release();
    }
  })();
  return migration;
}

/** Close the pool. Used by tests and verification scripts. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    migration = null;
  }
}
