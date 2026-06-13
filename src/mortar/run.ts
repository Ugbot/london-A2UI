/**
 * Mortar runner — the typed "mortar" between bricks. A mortar module is a small
 * TS module that default-exports a pure function `(input, ctx) => output`. We
 * transpile it (sucrase, no deps beyond it), then run it in a GUARDED scope: the
 * dangerous globals (fetch/window/globalThis/process/etc.) are shadowed to
 * undefined, so mortar is pure data logic — outbound calls go through Connections,
 * never mortar. Compiled functions are cached by source.
 *
 * This is not a hardened security boundary against a determined adversary in the
 * browser (same trust model as the foundry's generated code); it prevents the
 * common escapes and keeps mortar to data transforms/derivations.
 */
import { transform } from "sucrase";

export interface MortarContext {
  /** Read another store key (for derivations across keys). */
  get?: (key: string) => unknown;
  /** The current record (inside a Repeater), if any. */
  record?: unknown;
  [k: string]: unknown;
}

type MortarFn = (input: unknown, ctx: MortarContext) => unknown;

// Shadowed to undefined as function params. NOTE: "import"/"eval"/"arguments"
// are reserved/restricted as param names (would throw under strict mode), so they
// are intentionally excluded — this is a soft guard for common escapes, not a
// hardened sandbox (same trust model as foundry-generated code).
const SHADOWED = [
  "fetch", "window", "globalThis", "self", "global", "process", "require",
  "Function", "XMLHttpRequest", "WebSocket", "document",
  "localStorage", "sessionStorage", "navigator", "location",
];

const cache = new Map<string, MortarFn>();

/** Transpile + compile a mortar module's source into a callable function. */
export function compileMortar(source: string): MortarFn {
  const cached = cache.get(source);
  if (cached) return cached;

  // Transpile TS → JS (strip types). Wrap so a default export OR a bare
  // `(input, ctx) => ...` / function body both resolve to `__mortar__`.
  let js: string;
  try {
    js = transform(source, { transforms: ["typescript"], production: true }).code;
  } catch (e) {
    throw new Error(`mortar compile error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Build a module-ish scope: collect a default export into __out.
  const body = `
    "use strict";
    let __default;
    const exports = {};
    const module = { get exports() { return exports; }, set exports(v){ __default = v; } };
    ${js.replace(/export\s+default\s+/g, "__default = ")}
    const fn = (typeof __default === "function") ? __default
      : (typeof exports.default === "function") ? exports.default
      : (typeof exports === "function") ? exports
      : null;
    if (typeof fn !== "function") throw new Error("mortar must default-export a function (input, ctx) => output");
    return fn(input, ctx);
  `;

  // Shadow dangerous globals as undefined params.
  const fn = ((): MortarFn => {
    const factory = new Function("input", "ctx", ...SHADOWED, body) as (
      input: unknown,
      ctx: MortarContext,
      ...shadow: undefined[]
    ) => unknown;
    return (input, ctx) => factory(input, ctx, ...SHADOWED.map(() => undefined));
  })();

  cache.set(source, fn);
  return fn;
}

/** Run a mortar source against an input. Errors are caught and returned as null. */
export function runMortar(source: string, input: unknown, ctx: MortarContext = {}): unknown {
  try {
    return compileMortar(source)(input, ctx);
  } catch {
    return undefined;
  }
}

/** Like runMortar but throws — used by callers that want to surface errors. */
export function runMortarStrict(source: string, input: unknown, ctx: MortarContext = {}): unknown {
  return compileMortar(source)(input, ctx);
}
