import { describe, it, expect } from "vitest";
import { runMortar, runMortarStrict } from "./run";

describe("mortar runner", () => {
  it("runs a default-exported transform (TS types stripped)", () => {
    const src = "export default (input: number[]) => input.reduce((a, b) => a + b, 0);";
    expect(runMortar(src, [1, 2, 3])).toBe(6);
  });

  it("maps a dataset's records (CMS transform)", () => {
    const src = `
      interface Post { id: number; title: string }
      export default (posts: Post[]) => posts.map((p) => ({ label: p.title, value: p.id }));
    `;
    expect(runMortar(src, [{ id: 1, title: "A" }, { id: 2, title: "B" }])).toEqual([
      { label: "A", value: 1 },
      { label: "B", value: 2 },
    ]);
  });

  it("can read the context (other store keys / record)", () => {
    const src = "export default (input, ctx) => (input as number) * (ctx.get('mult') as number);";
    expect(runMortar(src, 5, { get: (k) => (k === "mult" ? 3 : undefined) })).toBe(15);
  });

  it("blocks fetch/window/process/globalThis (shadowed to undefined)", () => {
    for (const g of ["fetch", "window", "process", "globalThis"]) {
      const src = `export default () => typeof ${g};`;
      expect(runMortar(src, null)).toBe("undefined");
    }
  });

  it("returns undefined on a thrown/invalid mortar (runMortar swallows)", () => {
    expect(runMortar("export default () => { throw new Error('boom') }", null)).toBeUndefined();
    expect(runMortar("export default 42;", null)).toBeUndefined(); // not a function
  });

  it("runMortarStrict surfaces errors", () => {
    expect(() => runMortarStrict("export default () => { throw new Error('x') }", null)).toThrow();
  });
});
