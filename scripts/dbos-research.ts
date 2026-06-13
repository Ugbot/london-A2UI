/**
 * Verify DBOS durable execution: launches DBOS, runs the research workflow
 * (a retrying Linkup step in a checkpointed workflow), prints the result.
 * Run: node --env-file=.env --import tsx scripts/dbos-research.ts
 */
import { research } from "../src/server/linkup";
import { DBOS } from "@dbos-inc/dbos-sdk";

async function main() {
  console.log("running durable research workflow…");
  const r = await research("global electric vehicle market share 2025 by manufacturer", "standard");
  console.log("answer:", r.answer.slice(0, 180));
  console.log("sources:", r.sources.length, "— e.g.", r.sources[0]?.name);
  console.log("✅ durable research via DBOS completed");
  await DBOS.shutdown();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ DBOS research failed:", e);
    process.exit(1);
  });
