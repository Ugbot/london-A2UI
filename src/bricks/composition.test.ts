import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateComposition } from "./composition";
import { defineBrick, type BrickDef } from "./types";

// A tiny, self-contained registry keeps this test light (no client components).
const registry = new Map<string, BrickDef>([
  [
    "Stack",
    defineBrick({
      name: "Stack",
      description: "layout",
      tags: [],
      schema: z.object({ gap: z.number().int().default(4) }),
      acceptsChildren: true,
      Component: () => null,
    }),
  ],
  [
    "StatCard",
    defineBrick({
      name: "StatCard",
      description: "metric",
      tags: [],
      schema: z.object({ label: z.string(), value: z.string() }),
      Component: () => null,
    }),
  ],
]);

describe("validateComposition", () => {
  it("accepts a valid tree", () => {
    const res = validateComposition(
      { brick: "Stack", props: { gap: 6 }, children: [{ brick: "StatCard", props: { label: "R", value: "1" } }] },
      registry,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects an unknown brick with a pathed error", () => {
    const res = validateComposition({ brick: "Nope", props: {} }, registry);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0].path).toContain("brick");
  });

  it("rejects bad props against the brick schema", () => {
    const res = validateComposition({ brick: "StatCard", props: { label: 5 } }, registry);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.path.includes("props"))).toBe(true);
  });

  it("rejects children on a brick that doesn't accept them", () => {
    const res = validateComposition(
      { brick: "StatCard", props: { label: "x", value: "1" }, children: [{ brick: "StatCard", props: { label: "y", value: "2" } }] },
      registry,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.path.endsWith("children"))).toBe(true);
  });
});
