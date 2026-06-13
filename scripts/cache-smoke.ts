/**
 * M0 smoke check: migrate the widgetcache schema, embed a few brick-like
 * descriptions, insert them, and run an ANN search to confirm pgvector +
 * Ollama embeddings work end-to-end.
 *
 * Run with: npx tsx scripts/cache-smoke.ts
 */
import pgvector from "pgvector/pg";
import { embed, embedBatch } from "../src/server/embeddings";
import { getPool, migrate, closePool } from "../src/server/db";

const SAMPLES = [
  { name: "BarChart", description: "A bar chart for comparing categorical values", tags: ["viz", "chart"] },
  { name: "StatCard", description: "A KPI card showing a metric, its value and a delta", tags: ["display", "metric"] },
  { name: "Input", description: "A single-line text input field for forms", tags: ["form", "input"] },
  { name: "Table", description: "A data table with columns and rows", tags: ["display", "data"] },
];

async function main() {
  await migrate();
  const pool = await getPool();

  const vectors = await embedBatch(SAMPLES.map((s) => `${s.name}: ${s.description}`));
  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i];
    await pool.query(
      `INSERT INTO bricks (name, description, tags, embedding)
       VALUES ($1, $2, $3, $4::vector)
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             tags = EXCLUDED.tags,
             embedding = EXCLUDED.embedding`,
      [s.name, s.description, s.tags, pgvector.toSql(vectors[i])],
    );
  }

  const query = "something to show monthly sales as bars";
  const q = await embed(query);
  const { rows } = await pool.query(
    `SELECT name, description, embedding <=> $1::vector AS distance
       FROM bricks
       ORDER BY distance ASC
       LIMIT 3`,
    [pgvector.toSql(q)],
  );

  console.log(`\nANN search for: "${query}"`);
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(10)} dist=${Number(r.distance).toFixed(4)}  (${r.description})`);
  }

  const top = rows[0]?.name;
  if (top !== "BarChart") {
    throw new Error(`Expected BarChart as nearest neighbour, got ${top}`);
  }
  console.log("\n✅ embed → insert → ANN search round-trip works; nearest = BarChart");

  await closePool();
}

main().catch((err) => {
  console.error("❌ cache smoke failed:", err);
  process.exitCode = 1;
});
