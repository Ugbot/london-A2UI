#!/usr/bin/env node
/**
 * Restore a db-dump.mjs SQL file into `widgetcache` (via the Postgres container).
 *
 *   node --env-file=.env scripts/db-restore.mjs [db/bricks.sql | db/widgetcache.sql]
 *
 * Rebuilding on a NEW machine: bring up the infra + run the app once (it creates the db,
 * tables, and the pgvector extension), then run this. To restore into ANY Postgres
 * directly, instead pipe the SQL with your own client:
 *   psql "$DATABASE_URL" -f db/widgetcache.sql   (the target needs `CREATE EXTENSION vector`)
 */
import { spawnSync } from "node:child_process";
import { openSync, existsSync } from "node:fs";

function postgresContainer() {
  if (process.env.PG_CONTAINER) return process.env.PG_CONTAINER;
  const r = spawnSync("podman", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
  const name = (r.stdout || "").split("\n").map((s) => s.trim()).find((n) => /postgres/i.test(n));
  if (!name) {
    console.error("No running Postgres container found (set PG_CONTAINER).");
    process.exit(1);
  }
  return name;
}

const user = process.env.PGUSER ?? "intelligence";
const password = process.env.PGPASSWORD ?? "intelligence";
const db = process.env.WIDGETCACHE_DB ?? "widgetcache";
const file = process.argv[2] ?? "db/bricks.sql";

if (!existsSync(file)) {
  console.error(`No such dump file: ${file}`);
  process.exit(1);
}

const fd = openSync(file, "r");
const res = spawnSync(
  "podman",
  ["exec", "-i", "-e", `PGPASSWORD=${password}`, postgresContainer(), "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", db],
  { stdio: [fd, "inherit", "inherit"] },
);
process.exit(res.status ?? 1);
