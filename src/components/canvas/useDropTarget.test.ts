import { describe, it, expect } from "vitest";
import { indexFromRows } from "./useDropTarget";

const rows = [
  { top: 0, bottom: 20 }, // child 0: mid 10
  { top: 20, bottom: 40 }, // child 1: mid 30
  { top: 40, bottom: 60 }, // child 2: mid 50
];

describe("indexFromRows (drop index from pointer y)", () => {
  it("inserts before the first child whose midpoint is below the pointer", () => {
    expect(indexFromRows(rows, 5).index).toBe(0); // above child 0's mid
    expect(indexFromRows(rows, 25).index).toBe(1); // between child0 mid and child1 mid
    expect(indexFromRows(rows, 45).index).toBe(2);
  });

  it("appends past the last midpoint", () => {
    expect(indexFromRows(rows, 100).index).toBe(3);
  });

  it("reports the line y at the chosen slot", () => {
    expect(indexFromRows(rows, 5).lineY).toBe(0); // top of child 0
    expect(indexFromRows(rows, 100).lineY).toBe(60); // bottom of last child
  });

  it("empty list → index 0", () => {
    expect(indexFromRows([], 10).index).toBe(0);
  });
});
