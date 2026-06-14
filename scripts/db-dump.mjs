#!/usr/bin/env node
/**
 * Dump the `widgetcache` database so the bricks (+ projects, partials, connections) can
 * be rebuilt elsewhere. Runs pg_dump INSIDE the Postgres container (the local pg_dump is
 * older than the pg16 server and would refuse), writing plain SQL to ./db.
 *
 *   node --env-file=.env scripts/db-dump.mjs            # full backup (has secrets → gitignored)
 *   node --env-file=.env scripts/db-dump.mjs --bricks   # generated_bricks + partials only (committable)
 *
 * Override the container with PG_CONTAINER; user/db/password come from PG* env (.env).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, openSync, statSync, closeSync } from "node:fs";

function postgresContainer() {
  if (process.env.PG_CONTAINER) return process.env.PG_CONTAINER;
  const r = spawnSync("podman", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
  const name = (r.stdout || "").split("\n").map((s) => s.trim()).find((n) => /postgres/i.test(n));
  if (!name) {
    console.error("No running Postgres container found. Start the infra (npm run dev) or set PG_CONTAINER.");
    process.exit(1);
  }
  return name;
}

const user = process.env.PGUSER ?? "intelligence";
const password = process.env.PGPASSWORD ?? "intelligence";
const db = process.env.WIDGETCACHE_DB ?? "widgetcache";
const bricksOnly = process.argv.includes("--bricks");

mkdirSync("db", { recursive: true });
const outPath = bricksOnly ? "db/bricks.sql" : "db/widgetcache.sql";

const dumpArgs = ["--no-owner", "--no-privileges", "--clean", "--if-exists"];
if (bricksOnly) dumpArgs.push("-t", "generated_bricks", "-t", "partials");

const fd = openSync(outPath, "w");
const res = spawnSync(
  "podman",
  ["exec", "-e", `PGPASSWORD=${password}`, postgresContainer(), "pg_dump", "-U", user, "-d", db, ...dumpArgs],
  { stdio: ["ignore", fd, "inherit"] },
);
closeSync(fd);

if (res.status !== 0) {
  console.error(`pg_dump failed (exit ${res.status}).`);
  process.exit(res.status ?? 1);
}
const kb = Math.round(statSync(outPath).size / 1024);
console.log(`✓ Wrote ${outPath} (${kb} KB)${bricksOnly ? "" : "  — contains secrets; gitignored"}`);
