/**
 * M3 verification: brick search, distill/fill round-trip, bake-with-dedup, and
 * partial search — the growing cache. No LLM involved.
 *
 * Run: node --env-file=.env --import tsx scripts/m3-verify.ts
 */
import { ensureCache, searchBricks, searchPartials, bakePartial } from "../src/server/cache";
import { distill, fillTemplate } from "../src/bricks/distill";
import { validateComposition, type CompositionNode } from "../src/bricks/composition";
import { registry } from "../src/bricks/registry";
import { getPool, closePool } from "../src/server/db";

const TREE: CompositionNode = {
  brick: "Stack",
  props: { gap: 6 },
  children: [
    { brick: "Heading", props: { text: "Sales Dashboard", level: 1 } },
    {
      brick: "Grid",
      props: { cols: 3 },
      children: [
        { brick: "StatCard", props: { label: "Revenue", value: "$1.2M", delta: "12%", trend: "up" } },
        { brick: "StatCard", props: { label: "Users", value: "8,932", delta: "3%", trend: "up" } },
        { brick: "StatCard", props: { label: "Churn", value: "2.1%", delta: "0.4%", trend: "down" } },
      ],
    },
    {
      brick: "Card",
      props: { title: "Monthly Sales" },
      children: [
        { brick: "BarChart", props: { data: [{ label: "Jan", value: 100 }, { label: "Feb", value: 140 }] } },
      ],
    },
  ],
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  await ensureCache();
  const pool = await getPool();
  // start clean for deterministic counts
  await pool.query("DELETE FROM partials");

  console.log("1. brick search");
  const bricks = await searchBricks("a chart comparing monthly sales by category", 3);
  console.log("   top bricks:", bricks.map((b) => `${b.name}(${b.distance.toFixed(2)})`).join(", "));
  assert(bricks.some((b) => b.name === "BarChart"), "BarChart is among nearest bricks for a sales-bar query");

  console.log("2. distill + fill round-trip");
  const { template, holes } = distill(TREE);
  console.log(`   ${holes.length} holes extracted`);
  assert(holes.length > 0, "distill extracts content holes");
  const values = Object.fromEntries(
    holes.map((h) => [h.name, h.type === "json" ? [{ label: "X", value: 1 }] : "filled"]),
  );
  const filled = fillTemplate(template, values);
  assert(validateComposition(filled, registry).ok, "filled template validates against the registry");

  console.log("3. bake with dedup");
  const first = await bakePartial({ name: "sales-dashboard", description: "revenue KPIs and a monthly sales bar chart", tree: TREE });
  assert(!first.merged, "first bake inserts a new partial");
  const second = await bakePartial({ name: "sales-dashboard", description: "revenue KPIs and a monthly sales bar chart", tree: TREE });
  assert(second.merged && second.id === first.id, "identical re-bake dedups (merges, bumps usage)");
  const { rows } = await pool.query("SELECT usage_count FROM partials WHERE id=$1", [first.id]);
  assert(rows[0].usage_count === 2, "usage_count incremented to 2 on merge");

  console.log("4. partial search (reuse)");
  const partials = await searchPartials("build a sales dashboard with revenue and a bar chart", 3);
  console.log("   hits:", partials.map((p) => `${p.name}(${p.distance.toFixed(2)})`).join(", "));
  assert(partials.length > 0 && partials[0].name === "sales-dashboard", "baked partial is retrieved for a similar request");
  assert(Array.isArray(partials[0].holes) && partials[0].holes.length > 0, "retrieved partial carries its typed holes");

  console.log("\n✅ M3 cache verified: search + distill + bake/dedup + reuse");
  await closePool();
}

main().catch((err) => {
  console.error("❌ M3 verify failed:", err);
  process.exitCode = 1;
});
