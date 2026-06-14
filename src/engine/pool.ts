/**
 * The worker pool — the main-thread manager that owns the background fetch worker and
 * wires its replica to the session doc. `dispatch()` routes worker-bound commands here.
 *
 * Robustness: if the worker can't be constructed (Turbopack/runtime hiccup, SSR, or an
 * environment with no Worker), the pool transparently runs the data engine IN-PROCESS
 * on the main doc — the feature always works; the worker is an offload, not a crutch.
 * Designed to scale to MANY workers (a derive worker, etc.) behind the same interface.
 */
import type * as Y from "yjs";
import { connectDocChannel, type SyncChannel } from "./worker-provider";
import { runDataCommand } from "./data-engine";
import type { Command } from "./commands";

export class WorkerPool {
  private readonly doc: Y.Doc;
  private worker: Worker | null = null;
  private disconnect: (() => void) | null = null;
  private inproc = false;

  constructor(doc: Y.Doc) {
    this.doc = doc;
  }

  /** Whether a real Web Worker is backing the pool (vs the in-process fallback). */
  get usingWorker(): boolean {
    return this.worker !== null;
  }

  start(): void {
    if (this.worker || this.inproc) return;
    if (typeof Worker === "undefined") {
      this.inproc = true;
      return;
    }
    try {
      const worker = new Worker(new URL("./fetch-worker.ts", import.meta.url), { type: "module" });
      const channel: SyncChannel = {
        post: (u) => worker.postMessage({ t: "y", u }),
        onMessage: (handler) => {
          const h = (e: MessageEvent) => {
            if (e.data?.t === "y") handler(e.data.u as Uint8Array);
          };
          worker.addEventListener("message", h);
          return () => worker.removeEventListener("message", h);
        },
      };
      this.disconnect = connectDocChannel(this.doc, channel);
      this.worker = worker;
    } catch {
      this.inproc = true; // graceful fallback: run the data engine on the main doc
    }
  }

  /** Route a worker-bound command to the worker (or run in-process as a fallback). */
  enqueue(command: Command): void {
    if (this.worker) this.worker.postMessage({ t: "c", c: command });
    else void runDataCommand(this.doc, command);
  }

  stop(): void {
    this.disconnect?.();
    this.worker?.terminate();
    this.worker = null;
    this.disconnect = null;
  }
}

let activePool: WorkerPool | null = null;
export function setActivePool(pool: WorkerPool | null): void {
  activePool = pool;
}
export function getActivePool(): WorkerPool | null {
  return activePool;
}
