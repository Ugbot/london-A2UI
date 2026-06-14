import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { CompositionNode } from "@/bricks/composition";
import {
  ORIGIN,
  getCanvas,
  getData,
  readTree,
  writeTree,
  observeTree,
  applyDataAction,
  readData,
  readAllData,
  observeDataKey,
} from "./doc-model";

const sample = (): CompositionNode => ({
  brick: "Stack",
  id: "stack-1",
  props: { gap: 6 },
  children: [
    { brick: "Heading", id: "heading-1", props: { text: "Sales", level: 1 } },
    { brick: "StatCard", id: "stat-1", props: { label: "Revenue", value: 42 } },
  ],
});

describe("doc-model: fine-grained tree", () => {
  it("round-trips a tree through writeTree/readTree", () => {
    const doc = new Y.Doc();
    const tree = sample();
    writeTree(doc, tree);
    expect(readTree(doc)).toEqual(tree);
  });

  it("assigns ids to nodes missing them (via ensureIds)", () => {
    const doc = new Y.Doc();
    writeTree(doc, {
      brick: "Stack",
      props: {},
      children: [{ brick: "Heading", props: { text: "Hi" } }],
    });
    const out = readTree(doc)!;
    expect(out.id).toBeTruthy();
    expect(out.children![0].id).toBeTruthy();
  });

  it("clears the tree on writeTree(null)", () => {
    const doc = new Y.Doc();
    writeTree(doc, sample());
    writeTree(doc, null);
    expect(readTree(doc)).toBeNull();
  });

  it("prunes orphaned nodes when a subtree is removed", () => {
    const doc = new Y.Doc();
    writeTree(doc, sample());
    const nodes = getCanvas(doc).get("nodes") as Y.Map<unknown>;
    expect([...nodes.keys()].sort()).toEqual(["heading-1", "stack-1", "stat-1"]);
    // remove the StatCard child
    writeTree(doc, {
      brick: "Stack",
      id: "stack-1",
      props: { gap: 6 },
      children: [{ brick: "Heading", id: "heading-1", props: { text: "Sales", level: 1 } }],
    });
    expect([...nodes.keys()].sort()).toEqual(["heading-1", "stack-1"]);
  });

  it("emits a MINIMAL delta when one prop changes (only that node's props map)", () => {
    const doc = new Y.Doc();
    writeTree(doc, sample());
    const canvas = getCanvas(doc);
    const changedTargets: unknown[] = [];
    const handler = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      for (const e of events) changedTargets.push(e.target);
    };
    canvas.observeDeep(handler);
    // change only heading text
    writeTree(doc, {
      brick: "Stack",
      id: "stack-1",
      props: { gap: 6 },
      children: [
        { brick: "Heading", id: "heading-1", props: { text: "REVENUE", level: 1 } },
        { brick: "StatCard", id: "stat-1", props: { label: "Revenue", value: 42 } },
      ],
    });
    canvas.unobserveDeep(handler);
    // exactly one Y type changed: the heading's props map
    const headingMap = (canvas.get("nodes") as Y.Map<Y.Map<unknown>>).get("heading-1")!;
    const headingProps = headingMap.get("props");
    expect(changedTargets).toHaveLength(1);
    expect(changedTargets[0]).toBe(headingProps);
  });

  it("fires observeTree on any deep change", () => {
    const doc = new Y.Doc();
    writeTree(doc, sample());
    let fired = 0;
    const off = observeTree(doc, () => (fired += 1));
    writeTree(doc, { ...sample(), props: { gap: 10 } });
    off();
    expect(fired).toBeGreaterThan(0);
  });

  it("tags the write transaction with the given origin", () => {
    const doc = new Y.Doc();
    const origins: unknown[] = [];
    doc.on("afterTransaction", (txn: Y.Transaction) => origins.push(txn.origin));
    writeTree(doc, sample(), ORIGIN.agent);
    expect(origins).toContain(ORIGIN.agent);
  });
});

describe("doc-model: legacy migration", () => {
  it("reads the old coarse `widget` blob when no fine-grained root exists", () => {
    const doc = new Y.Doc();
    getCanvas(doc).set("widget", sample());
    expect(readTree(doc)).toEqual(sample());
  });

  it("upgrades to fine-grained on first write and drops the legacy key", () => {
    const doc = new Y.Doc();
    const canvas = getCanvas(doc);
    canvas.set("widget", sample());
    writeTree(doc, readTree(doc));
    expect(canvas.has("widget")).toBe(false);
    expect(canvas.get("root")).toBe("stack-1");
    expect(readTree(doc)).toEqual(sample());
  });
});

describe("doc-model: keyed read-model", () => {
  it("set/merge/append/remove follow StreamAction semantics", () => {
    const doc = new Y.Doc();
    applyDataAction(doc, { action: "set", target: "k", value: { a: 1 } });
    expect(readData(doc, "k")).toEqual({ a: 1 });
    applyDataAction(doc, { action: "merge", target: "k", value: { b: 2 } });
    expect(readData(doc, "k")).toEqual({ a: 1, b: 2 });

    applyDataAction(doc, { action: "set", target: "list", value: [1] });
    applyDataAction(doc, { action: "append", target: "list", value: 2 });
    expect(readData(doc, "list")).toEqual([1, 2]);

    applyDataAction(doc, { action: "remove", target: "k" });
    expect(readData(doc, "k")).toBeUndefined();
  });

  it("append starts a fresh array when the key is empty", () => {
    const doc = new Y.Doc();
    applyDataAction(doc, { action: "append", target: "new", value: "x" });
    expect(readData(doc, "new")).toEqual(["x"]);
  });

  it("readAllData snapshots the whole model", () => {
    const doc = new Y.Doc();
    applyDataAction(doc, { action: "set", target: "a", value: 1 });
    applyDataAction(doc, { action: "set", target: "b", value: 2 });
    expect(readAllData(doc)).toEqual({ a: 1, b: 2 });
  });

  it("observeDataKey fires ONLY for its key (keyed pub/sub)", () => {
    const doc = new Y.Doc();
    let kHits = 0;
    const off = observeDataKey(doc, "k", () => (kHits += 1));
    applyDataAction(doc, { action: "set", target: "other", value: 1 });
    expect(kHits).toBe(0);
    applyDataAction(doc, { action: "set", target: "k", value: 1 });
    expect(kHits).toBe(1);
    off();
  });

  it("data writes can be tagged worker origin (excluded from undo later)", () => {
    const doc = new Y.Doc();
    const origins: unknown[] = [];
    doc.on("afterTransaction", (txn: Y.Transaction) => origins.push(txn.origin));
    applyDataAction(doc, { action: "set", target: "k", value: 1 }, ORIGIN.worker);
    expect(origins).toContain(ORIGIN.worker);
  });
});
