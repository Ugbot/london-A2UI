/**
 * Portable, version-independent export/import of the ENTIRE widgetcache DB to a single
 * JSON archive — no pg_dump/container/client-version constraints (uses the pg protocol).
 * The most "rebuild anywhere" backup: clone the repo, point at any Postgres, import.
 *
 *   npm run db:export                 # → db/archive.json (ALL tables; has secrets → gitignored)
 *   npm run db:import [db/archive.json]
 *
 * Import is idempotent (upsert on each table's primary key) and schema-driven: column
 * types are read from information_schema so jsonb / vector / text[] all round-trip.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { getPool, migrate, closePool } from "../src/server/db";

/** table → primary-key column(s). No FKs between these, so order is irrelevant. */
const TABLES: Record<string, string[]> = {
  bricks: ["name"],
  partials: ["id"],
  generated_bricks: ["name"],
  canvases: ["thread_id"],
  chats: ["session_id"],
  connections: ["id"],
};

type Pool = Awaited<ReturnType<typeof getPool>>;

async function columnTypes(pool: Pool, table: string): Promise<Record<string, string>> {
  const { rows } = await pool.query(
    `SELECT column_name, udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return Object.fromEntries(rows.map((r) => [r.column_name as string, r.udt_name as string]));
}

async function doExport(file: string): Promise<void> {
  await migrate();
  const pool = await getPool();
  const tables: Record<string, unknown[]> = {};
  for (const t of Object.keys(TABLES)) {
    const { rows } = await pool.query(`SELECT * FROM ${t}`);
    tables[t] = rows;
    console.log(`  ${t}: ${rows.length}`);
  }
  mkdirSync("db", { recursive: true });
  writeFileSync(file, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tables }, null, 2));
  console.log(`✓ exported → ${file} (contains connection secrets — keep private)`);
}

async function doImport(file: string): Promise<void> {
  await migrate();
  const pool = await getPool();
  const data = JSON.parse(readFileSync(file, "utf8")) as { tables?: Record<string, Record<string, unknown>[]> };
  for (const [t, pk] of Object.entries(TABLES)) {
    const rows = data.tables?.[t] ?? [];
    if (!rows.length) {
      console.log(`  ${t}: 0`);
      continue;
    }
    const types = await columnTypes(pool, t);
    for (const row of rows) {
      const keys = Object.keys(row).filter((k) => k in types);
      const params: unknown[] = [];
      const placeholders = keys.map((k, i) => {
        const udt = types[k];
        const v = (row as Record<string, unknown>)[k];
        if ((udt === "jsonb" || udt === "json") && v !== null) {
          params.push(JSON.stringify(v));
          return `$${i + 1}::${udt}`;
        }
        if (udt === "vector" && v !== null) {
          params.push(typeof v === "string" ? v : JSON.stringify(v));
          return `$${i + 1}::vector`;
        }
        params.push(v); // scalars, timestamps (ISO string), and text[] (JS array → node-pg array literal)
        return `$${i + 1}`;
      });
      const updates = keys.filter((k) => !pk.includes(k)).map((k) => `${k} = EXCLUDED.${k}`).join(", ");
      const sql =
        `INSERT INTO ${t} (${keys.join(", ")}) VALUES (${placeholders.join(", ")}) ` +
        `ON CONFLICT (${pk.join(", ")}) DO UPDATE SET ${updates || pk.map((k) => `${k} = EXCLUDED.${k}`).join(", ")}`;
      await pool.query(sql, params);
    }
    console.log(`  ${t}: ${rows.length} upserted`);
  }
  console.log(`✓ imported ← ${file}`);
}

const mode = process.argv[2];
const file = process.argv[3] ?? "db/archive.json";

const run =
  mode === "export" ? doExport(file) : mode === "import" ? doImport(file) : Promise.reject(new Error("usage: db-archive (export|import) [file]"));

run
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
