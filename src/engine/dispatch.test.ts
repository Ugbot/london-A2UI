import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import type { CompositionNode } from "@/bricks/composition";
import { setActiveDoc, getActiveDoc } from "./doc-registry";
import { dispatch, dispatchBatch, applyCommand } from "./dispatch";
import { ORIGIN, readTree, readData, getCanvas, getData } from "@/collab/doc-model";

const tree = (): CompositionNode => ({
  brick: "Stack",
  id: "stack-1",
  props: { gap: 6 },
  children: [{ brick: "Heading", id: "heading-1", props: { text: "Hi", level: 1 } }],
});

let doc: Y.Doc;
beforeEach(() => {
  doc = new Y.Doc();
  setActiveDoc(doc);
});

describe("dispatch: validation + routing", () => {
  it("rejects an unknown/invalid command", () => {
    const r = dispatch({ type: "nope" });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("fails cleanly when no doc is active", () => {
    setActiveDoc(null);
    expect(dispatch({ type: "data/set", target: "k", value: 1 }).ok).toBe(false);
    setActiveDoc(doc);
  });

  it("data/set writes the keyed read-model", () => {
    expect(dispatch({ type: "data/set", target: "k", value: 42 }).ok).toBe(true);
    expect(readData(doc, "k")).toBe(42);
  });

  it("data/set merge/append follow StreamAction semantics", () => {
    dispatch({ type: "data/set", action: "set", target: "o", value: { a: 1 } });
    dispatch({ type: "data/set", action: "merge", target: "o", value: { b: 2 } });
    expect(readData(doc, "o")).toEqual({ a: 1, b: 2 });
  });
});

describe("dispatch: tree commands", () => {
  beforeEach(() => dispatch({ type: "tree/render", tree: tree() }));

  it("tree/render establishes the tree", () => {
    expect(readTree(doc)).toEqual(tree());
  });

  it("tree/patch shallow-merges props on one node", () => {
    dispatch({ type: "tree/patch", id: "heading-1", setProps: { text: "Bye" } });
    expect(readTree(doc)!.children![0].props.text).toBe("Bye");
  });

  it("tree/patch can swap the brick type", () => {
    dispatch({ type: "tree/patch", id: "heading-1", brick: "Text" });
    expect(readTree(doc)!.children![0].brick).toBe("Text");
  });

  it("tree/insert + tree/remove add and drop children", () => {
    dispatch({
      type: "tree/insert",
      parentId: "stack-1",
      node: { brick: "StatCard", id: "stat-9", props: { label: "X", value: 1 } },
    });
    expect(readTree(doc)!.children).toHaveLength(2);
    dispatch({ type: "tree/remove", id: "stat-9" });
    expect(readTree(doc)!.children).toHaveLength(1);
  });

  it("tree/replace swaps a subtree", () => {
    dispatch({
      type: "tree/replace",
      id: "heading-1",
      node: { brick: "Text", id: "text-1", props: { text: "new" } },
    });
    expect(readTree(doc)!.children![0].brick).toBe("Text");
  });

  it("tree/move reorders siblings", () => {
    dispatch({
      type: "tree/insert",
      parentId: "stack-1",
      node: { brick: "StatCard", id: "stat-2", props: { label: "X", value: 1 } },
    });
    // move stat-2 before heading-1
    dispatch({ type: "tree/move", dragId: "stat-2", targetId: "heading-1", position: "before" });
    expect(readTree(doc)!.children!.map((c) => c.id)).toEqual(["stat-2", "heading-1"]);
  });

  it("returns an error for tree edits on an empty canvas", () => {
    const empty = new Y.Doc();
    expect(applyCommand(empty, { type: "tree/patch", id: "x", setProps: {} }).ok).toBe(false);
  });
});

describe("dispatch: atomic batches + origin", () => {
  it("dispatchBatch groups tree + data into ONE undo step", () => {
    dispatch({ type: "tree/render", tree: tree() });
    const undo = new Y.UndoManager([getCanvas(doc), getData(doc)], {
      trackedOrigins: new Set<unknown>([ORIGIN.local]),
    });
    dispatchBatch([
      { type: "tree/patch", id: "heading-1", setProps: { text: "Combined" } },
      { type: "data/set", target: "seed", value: 7 },
    ]);
    expect(readTree(doc)!.children![0].props.text).toBe("Combined");
    expect(readData(doc, "seed")).toBe(7);

    undo.undo(); // a single undo must revert BOTH the tree edit and the data seed
    expect(readTree(doc)!.children![0].props.text).toBe("Hi");
    expect(readData(doc, "seed")).toBeUndefined();
  });

  it("agent-origin edits are tracked; default is local", () => {
    const origins: unknown[] = [];
    doc.on("afterTransaction", (txn: Y.Transaction) => origins.push(txn.origin));
    dispatch({ type: "data/set", target: "k", value: 1 });
    dispatch({ type: "data/set", target: "k", value: 2 }, ORIGIN.agent);
    expect(origins).toContain(ORIGIN.local);
    expect(origins).toContain(ORIGIN.agent);
  });

  it("getActiveDoc reflects the registered doc", () => {
    expect(getActiveDoc()).toBe(doc);
  });
});
