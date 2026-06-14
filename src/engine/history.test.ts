import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { HistoryLog, readCheckpoint } from "./history";
import { setActiveDoc } from "./doc-registry";
import { dispatch } from "./dispatch";
import { readTree, readData } from "@/collab/doc-model";
import type { CompositionNode } from "@/bricks/composition";

const tree = (text: string): CompositionNode => ({
  brick: "Stack",
  id: "stack-1",
  props: {},
  children: [{ brick: "Heading", id: "heading-1", props: { text, level: 1 } }],
});

let doc: Y.Doc;
beforeEach(() => {
  doc = new Y.Doc();
  setActiveDoc(doc);
});

describe("history: checkpoints + rewind", () => {
  it("captures full-doc checkpoints (tree + data) and reads them back", () => {
    const log = new HistoryLog(doc);
    dispatch({ type: "tree/render", tree: tree("V1") });
    dispatch({ type: "data/set", target: "k", value: 1 });
    log.capture("v1", 1000);

    dispatch({ type: "tree/patch", id: "heading-1", setProps: { text: "V2" } });
    dispatch({ type: "data/set", target: "k", value: 2 });
    log.capture("v2", 2000);

    expect(log.size()).toBe(2);
    const first = readCheckpoint(log.list()[0]);
    expect(first.tree!.children![0].props.text).toBe("V1");
    expect(first.data.k).toBe(1);
  });

  it("restores an earlier checkpoint as a forward edit (tree + data)", () => {
    const log = new HistoryLog(doc);
    dispatch({ type: "tree/render", tree: tree("ORIGINAL") });
    dispatch({ type: "data/set", target: "k", value: "a" });
    log.capture("v1", 1000);

    dispatch({ type: "tree/patch", id: "heading-1", setProps: { text: "CHANGED" } });
    dispatch({ type: "data/set", target: "k", value: "b" });
    expect(readTree(doc)!.children![0].props.text).toBe("CHANGED");

    // rewind to checkpoint 0
    const snap = log.at(0)!;
    dispatch({ type: "tree/render", tree: snap.tree! });
    for (const [key, value] of Object.entries(snap.data)) {
      dispatch({ type: "data/set", target: key, value });
    }
    expect(readTree(doc)!.children![0].props.text).toBe("ORIGINAL");
    expect(readData(doc, "k")).toBe("a");
  });

  it("is bounded by the limit (drops oldest)", () => {
    const log = new HistoryLog(doc, 3);
    dispatch({ type: "tree/render", tree: tree("x") });
    for (let i = 0; i < 5; i++) log.capture(`c${i}`, i);
    expect(log.size()).toBe(3);
    expect(log.list()[0].label).toBe("c2"); // oldest two dropped
  });
});
