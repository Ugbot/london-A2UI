import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { setActiveDoc } from "@/engine/doc-registry";
import { useWidgetStore, streamToElement } from "./store";

describe("widget store stream actions", () => {
  // The shim delegates to the active session doc; give each test a fresh one.
  beforeEach(() => setActiveDoc(new Y.Doc()));

  it("set replaces the value at a key", () => {
    streamToElement({ action: "set", target: "k", value: 42 });
    expect(useWidgetStore.getState().get("k")).toBe(42);
    streamToElement({ action: "set", target: "k", value: "hi" });
    expect(useWidgetStore.getState().get("k")).toBe("hi");
  });

  it("merge shallow-merges object values", () => {
    streamToElement({ action: "set", target: "o", value: { a: 1, b: 2 } });
    streamToElement({ action: "merge", target: "o", value: { b: 3, c: 4 } });
    expect(useWidgetStore.getState().get("o")).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("append pushes onto an array (creating it if absent)", () => {
    streamToElement({ action: "append", target: "list", value: "x" });
    streamToElement({ action: "append", target: "list", value: "y" });
    expect(useWidgetStore.getState().get("list")).toEqual(["x", "y"]);
  });

  it("remove deletes the key", () => {
    streamToElement({ action: "set", target: "k", value: 1 });
    streamToElement({ action: "remove", target: "k" });
    expect(useWidgetStore.getState().get("k")).toBeUndefined();
  });
});
