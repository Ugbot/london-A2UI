import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { connectDocChannel, type SyncChannel } from "./worker-provider";
import { applyDataAction, readData } from "@/collab/doc-model";

/** A synchronous in-memory channel pair (stands in for the postMessage link). */
function makePair(): [SyncChannel, SyncChannel] {
  const aHandlers: ((u: Uint8Array) => void)[] = [];
  const bHandlers: ((u: Uint8Array) => void)[] = [];
  const a: SyncChannel = {
    post: (u) => bHandlers.forEach((h) => h(u)),
    onMessage: (h) => {
      aHandlers.push(h);
      return () => aHandlers.splice(aHandlers.indexOf(h), 1);
    },
  };
  const b: SyncChannel = {
    post: (u) => aHandlers.forEach((h) => h(u)),
    onMessage: (h) => {
      bHandlers.push(h);
      return () => bHandlers.splice(bHandlers.indexOf(h), 1);
    },
  };
  return [a, b];
}

describe("worker-provider: Yjs sync over a channel", () => {
  it("propagates data both directions (worker write → main, and back)", () => {
    const main = new Y.Doc();
    const worker = new Y.Doc();
    const [chMain, chWorker] = makePair();
    connectDocChannel(main, chMain);
    connectDocChannel(worker, chWorker);

    // worker writes a fetched dataset → appears on the main doc
    applyDataAction(worker, { action: "set", target: "rows", value: [1, 2, 3] });
    expect(readData(main, "rows")).toEqual([1, 2, 3]);

    // main writes a form field → appears in the worker replica
    applyDataAction(main, { action: "set", target: "form.q", value: "hello" });
    expect(readData(worker, "form.q")).toBe("hello");
  });

  it("does not echo (a change settles without looping forever)", () => {
    const main = new Y.Doc();
    const worker = new Y.Doc();
    const [chMain, chWorker] = makePair();
    connectDocChannel(main, chMain);
    connectDocChannel(worker, chWorker);

    let posts = 0;
    main.on("update", () => (posts += 1));
    applyDataAction(worker, { action: "set", target: "k", value: 1 });
    // main received exactly one applied update (no echo storm)
    expect(posts).toBe(1);
    expect(readData(main, "k")).toBe(1);
  });

  it("disconnect stops further propagation", () => {
    const main = new Y.Doc();
    const worker = new Y.Doc();
    const [chMain, chWorker] = makePair();
    const off = connectDocChannel(main, chMain);
    connectDocChannel(worker, chWorker);
    off();
    applyDataAction(worker, { action: "set", target: "late", value: 9 });
    expect(readData(main, "late")).toBeUndefined();
  });
});
