"use client";

/**
 * "Bake to brick": turn a composition (the whole canvas or a selected subtree) into a
 * REAL reusable brick via the Foundry composite path — it then appears in the palette +
 * agent catalog (export becomes import). POSTs to /api/foundry with the tree and polls
 * the background job to completion.
 */

/** Sanitize a user label into a valid PascalCase brick name (the Foundry's NAME_RE). */
export function toPascalBrickName(input: string): string {
  const parts = input.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const pascal = parts.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  const name = pascal || "Baked";
  return /^[A-Z]/.test(name) ? name.slice(0, 40) : ("B" + name).slice(0, 40);
}

/** Bake a composition `tree` into a brick named `name`. Resolves with a status message. */
export async function bakeToBrick(name: string, tree: unknown): Promise<string> {
  const res = await fetch("/api/foundry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, tree }),
  });
  const start = (await res.json()) as { jobId?: string; error?: string };
  if (!res.ok || !start.jobId) throw new Error(start.error ?? `HTTP ${res.status}`);

  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const job = (await (await fetch(`/api/foundry?jobId=${start.jobId}`)).json()) as {
      status?: string;
      message?: string;
      detail?: string;
    };
    if (job.status === "done") return job.message ?? `Baked "${name}".`;
    if (job.status === "error") throw new Error(`${job.message ?? "bake error"}${job.detail ? `: ${job.detail}` : ""}`);
  }
  throw new Error("bake timed out");
}
