/**
 * Example brick contracts — the typed command/event surface a caller (parent, sibling,
 * host, or the agent via send_to_brick) can drive. Each is authored with `defineContract`
 * and exported so BOTH the brick def (defineBrick({ contract })) and the component
 * (useBrickContract) share one inferred source of truth. Pure (z only) → server-safe.
 */
import { z } from "zod";
import { defineContract } from "./contract";

/** DataSource: tell it to re-pull now; it announces when fresh data has loaded. */
export const dataSourceContract = defineContract({
  commands: {
    refresh: z.object({}),
  },
  events: {
    loaded: z.object({ count: z.number().optional() }),
  },
});

/** Form: drive submit/reset programmatically; observe submission outcome. */
export const formContract = defineContract({
  commands: {
    submit: z.object({}),
    reset: z.object({}),
  },
  events: {
    submitted: z.object({ ok: z.boolean() }),
  },
});

/** ActionButton: observe clicks (the target/value it set). */
export const actionButtonContract = defineContract({
  commands: {},
  events: {
    clicked: z.object({ target: z.string(), value: z.unknown().optional() }),
  },
});
