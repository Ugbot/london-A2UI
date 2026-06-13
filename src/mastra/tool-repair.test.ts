import { describe, it, expect } from "vitest";
import { repairToolArgs } from "./tool-repair";

describe("repairToolArgs (malformed tool-call guard)", () => {
  it("passes through valid JSON unchanged", () => {
    const ok = '{"id":"stat-1","setProps":{"value":"$9.9M"}}';
    expect(repairToolArgs(ok)).toBe(ok);
  });

  it("treats empty/whitespace args as an empty object", () => {
    expect(repairToolArgs("")).toBe("{}");
    expect(repairToolArgs("   ")).toBe("{}");
  });

  it("repairs valid JSON followed by trailing junk (the Haiku failure mode)", () => {
    const repaired = repairToolArgs('{"id":"heading-1","setProps":{"text":"Hi"}}garbage');
    expect(repaired).not.toBeNull();
    expect(() => JSON.parse(repaired!)).not.toThrow();
    expect(JSON.parse(repaired!)).toEqual({ id: "heading-1", setProps: { text: "Hi" } });
  });

  it("repairs a double-object emission to the first object", () => {
    const repaired = repairToolArgs('{"a":1}{"b":2}');
    expect(JSON.parse(repaired!)).toEqual({ a: 1 });
  });

  it("handles braces inside strings without miscounting depth", () => {
    const tricky = '{"label":"a } b { c","n":1}trailing';
    expect(JSON.parse(repairToolArgs(tricky)!)).toEqual({ label: "a } b { c", n: 1 });
  });

  it("repairs a top-level array argument with trailing junk", () => {
    expect(JSON.parse(repairToolArgs('[1,2,3] oops')!)).toEqual([1, 2, 3]);
  });

  it("drops (returns null) truly unparseable args", () => {
    expect(repairToolArgs("not json at all")).toBeNull();
    expect(repairToolArgs('{"unterminated":')).toBeNull();
  });
});
