/**
 * Reactive mortar derivations on the Yjs read-model.
 *
 * A derivation recomputes `key` from `deps` whenever any dependency changes, writing
 * the result back into the data map. It's the reactive backbone for mortar's
 * bindCompute / transform — a computed value propagates to every brick bound to `key`.
 *
 * Derived writes are tagged ORIGIN.worker so they're EXCLUDED from the undo stack
 * (they're machine-generated, not user intent). In Phase 1 the recompute runs on the
 * main thread; the {@link Command} `derive/register` also persists {deps,source} into
 * the doc's `derive` map so the worker pool can take over recompute in Phase 2 without
 * changing the contract.
 */
import * as Y from "yjs";
import {
  ORIGIN,
  getData,
  getDerive,
  readData,
  applyDataAction,
} from "@/collab/doc-model";
import { runMortar } from "@/mortar/run";

type Compute = (depValues: unknown[], get: (k: string) => unknown) => unknown;
interface Derivation {
  deps: string[];
  unobserve: () => void;
}

// One registry per doc; WeakMap so docs can be GC'd with their derivations.
const registries = new WeakMap<Y.Doc, Map<string, Derivation>>();
function registry(doc: Y.Doc): Map<string, Derivation> {
  let m = registries.get(doc);
  if (!m) {
    m = new Map();
    registries.set(doc, m);
  }
  return m;
}

/** Tear down a derivation's observer + registry entry (no-op if absent). */
export function unregisterDerivation(doc: Y.Doc, key: string): void {
  const entry = registry(doc).get(key);
  if (entry) {
    entry.unobserve();
    registry(doc).delete(key);
  }
}

/**
 * Register a derivation with an arbitrary compute function (main-thread). Returns an
 * unregister fn; recomputes once immediately. Replaces any prior derivation for `key`.
 */
export function registerDerivation(
  doc: Y.Doc,
  key: string,
  deps: string[],
  compute: Compute,
): () => void {
  unregisterDerivation(doc, key);
  const get = (k: string) => readData(doc, k);
  const recompute = () => {
    let next: unknown;
    try {
      next = compute(deps.map(get), get);
    } catch {
      return; // a throwing derivation must not break the doc
    }
    if (next !== readData(doc, key)) {
      applyDataAction(doc, { action: "set", target: key, value: next }, ORIGIN.worker);
    }
  };

  const data = getData(doc);
  let prev = deps.map(get);
  const handler = (event: Y.YMapEvent<unknown>) => {
    if (!deps.some((d) => event.keysChanged.has(d))) return;
    const cur = deps.map(get);
    if (cur.some((v, i) => v !== prev[i])) {
      prev = cur;
      recompute();
    }
  };
  data.observe(handler);
  registry(doc).set(key, { deps, unobserve: () => data.unobserve(handler) });
  recompute();
  return () => unregisterDerivation(doc, key);
}

/**
 * Register a derivation from a mortar SOURCE string (the serializable form persisted
 * in the doc's `derive` map). The source is compiled + run in-process via runMortar.
 */
export function registerDerivedSource(
  doc: Y.Doc,
  key: string,
  deps: string[],
  source: string,
): () => void {
  // Persist the registration so it survives reload / can be run by the worker pool.
  doc.transact(() => {
    getDerive(doc).set(key, { deps, source });
  }, ORIGIN.worker);
  return registerDerivation(doc, key, deps, (depValues, get) =>
    runMortar(source, depValues, { get }),
  );
}

/** Remove a source-registered derivation and its persisted entry. */
export function unregisterDerivedSource(doc: Y.Doc, key: string): void {
  unregisterDerivation(doc, key);
  doc.transact(() => {
    getDerive(doc).delete(key);
  }, ORIGIN.worker);
}
