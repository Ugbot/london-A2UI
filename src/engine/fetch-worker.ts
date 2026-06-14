/**
 * The fetch worker (a real Web Worker, the "heavy" thread).
 *
 * It owns a Y.Doc REPLICA synced to the main doc via the worker-provider, and runs the
 * data engine: data/fetch · data/poll · form/submit. Fetched results are written into
 * the replica's read-model and flow back to the main doc (and thus to the UI) over the
 * sync channel. Commands arrive as `{ t: "c", c }`; Yjs updates as `{ t: "y", u }`.
 *
 * This file is the worker ENTRY — it must stay free of React/DOM imports.
 */
/// <reference lib="webworker" />
import * as Y from "yjs";
import { connectDocChannel, type SyncChannel } from "./worker-provider";
import { runDataCommand } from "./data-engine";
import { commandSchema } from "./commands";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const doc = new Y.Doc();

const channel: SyncChannel = {
  post: (update) => ctx.postMessage({ t: "y", u: update }),
  onMessage: (handler) => {
    const h = (e: MessageEvent) => {
      if (e.data?.t === "y") handler(e.data.u as Uint8Array);
    };
    ctx.addEventListener("message", h);
    return () => ctx.removeEventListener("message", h);
  },
};
connectDocChannel(doc, channel);

ctx.addEventListener("message", (e: MessageEvent) => {
  if (e.data?.t !== "c") return;
  const parsed = commandSchema.safeParse(e.data.c);
  if (parsed.success) void runDataCommand(doc, parsed.data);
});
