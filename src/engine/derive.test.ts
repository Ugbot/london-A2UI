import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  registerDerivation,
  registerDerivedSource,
  unregisterDerivation,
} from "./derive";
import { applyDataAction, readData, getDerive, ORIGIN } from "@/collab/doc-model";

let doc: Y.Doc;
beforeEach(() => {
  doc = new Y.Doc();
});

describe("derive: reactive recompute", () => {
  it("recomputes once on register, then on dependency change", () => {
    applyDataAction(doc, { action: "set", target: "a", value: 2 });
    applyDataAction(doc, { action: "set", target: "b", value: 3 });
    registerDerivation(doc, "sum", ["a", "b"], ([a, b]) => (a as number) + (b as number));
    expect(readData(doc, "sum")).toBe(5);

    applyDataAction(doc, { action: "set", target: "a", value: 10 });
    expect(readData(doc, "sum")).toBe(13);
  });

  it("does not recompute when an unrelated key changes", () => {
    applyDataAction(doc, { action: "set", target: "a", value: 1 });
    let runs = 0;
    registerDerivation(doc, "d", ["a"], ([a]) => {
      runs += 1;
      return a;
    });
    expect(runs).toBe(1);
    applyDataAction(doc, { action: "set", target: "other", value: 99 });
    expect(runs).toBe(1);
  });

  it("a throwing derivation does not break the doc", () => {
    applyDataAction(doc, { action: "set", target: "a", value: 1 });
    registerDerivation(doc, "boom", ["a"], () => {
      throw new Error("nope");
    });
    expect(readData(doc, "boom")).toBeUndefined();
    // doc still usable
    applyDataAction(doc, { action: "set", target: "a", value: 2 });
    expect(readData(doc, "a")).toBe(2);
  });

  it("unregister stops recomputation", () => {
    applyDataAction(doc, { action: "set", target: "a", value: 1 });
    registerDerivation(doc, "d", ["a"], ([a]) => (a as number) * 2);
    expect(readData(doc, "d")).toBe(2);
    unregisterDerivation(doc, "d");
    applyDataAction(doc, { action: "set", target: "a", value: 5 });
    expect(readData(doc, "d")).toBe(2); // frozen at last value
  });

  it("writes derived values with worker origin (excluded from undo)", () => {
    applyDataAction(doc, { action: "set", target: "a", value: 1 });
    const origins: unknown[] = [];
    doc.on("afterTransaction", (txn: Y.Transaction) => origins.push(txn.origin));
    registerDerivation(doc, "d", ["a"], ([a]) => a);
    expect(origins).toContain(ORIGIN.worker);
  });
});

describe("derive: mortar source registration", () => {
  it("runs a TS mortar source and persists the registration in the derive map", () => {
    applyDataAction(doc, { action: "set", target: "price", value: 100 });
    registerDerivedSource(
      doc,
      "label",
      ["price"],
      "export default (deps) => `$${deps[0]}`;",
    );
    expect(readData(doc, "label")).toBe("$100");
    // persisted so the worker pool can take over recompute later
    expect(getDerive(doc).get("label")).toEqual({
      deps: ["price"],
      source: "export default (deps) => `$${deps[0]}`;",
    });

    applyDataAction(doc, { action: "set", target: "price", value: 250 });
    expect(readData(doc, "label")).toBe("$250");
  });
});
