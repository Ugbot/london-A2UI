# Database dumps — rebuild the cache anywhere

The app keeps its state in a `widgetcache` Postgres (pgvector) DB:

| table | what | in git already? |
|---|---|---|
| `generated_bricks` | **forged bricks' source** (schema + component) | yes — also written to `src/bricks/generated/` |
| `partials` | baked composition templates (+ embeddings) | **no — DB only** |
| `bricks` | search embeddings for the catalog | no (regenerable) |
| `canvases` | saved **projects** (+ name) | no |
| `chats` | chat transcripts per project | no |
| `connections` | data-source configs — **contains SECRETS** | no |

## Dump

```bash
npm run db:dump            # FULL backup → db/widgetcache.sql  (has secrets → gitignored)
npm run db:dump:bricks     # generated_bricks + partials → db/bricks.sql  (no secrets → safe to commit)
```

`pg_dump` runs *inside* the Postgres container (the bundled pg16 tools match the server;
a local older pg_dump would refuse). Commit `db/bricks.sql` so the forged bricks + baked
partials travel with the repo; keep `db/widgetcache.sql` private.

## Restore

Bring the infra up and run the app once (it creates the db + tables + the `vector`
extension), then:

```bash
npm run db:restore db/bricks.sql        # just the bricks/partials
npm run db:restore db/widgetcache.sql   # everything (incl. projects + connections)
```

Restore into ANY Postgres directly (e.g. on another host) — the target needs the pgvector
extension (`CREATE EXTENSION IF NOT EXISTS vector;`):

```bash
psql "$DATABASE_URL" -f db/widgetcache.sql
```

Note: the forged brick **files** live in `src/bricks/generated/` (in git), so a fresh
clone already has the brick code; restoring `bricks.sql` repopulates the DB rows that make
them searchable + brings back the baked partials.
