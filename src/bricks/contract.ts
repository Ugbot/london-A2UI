/**
 * The typed per-brick contract layer.
 *
 * `defineContract` authors a contract with full inference; a brick exports it and uses
 * it both in `defineBrick({ contract })` (erased into the registry) and in its component
 * via `useBrickContract` (contract-hooks.tsx). Any caller gets `brickApi(id, contract)`
 * — a strongly-typed handle to `send` commands / subscribe to events / read state, all
 * Zod-validated at runtime. Commands/events ride a lightweight in-tab bus (ephemeral,
 * not persisted in the CRDT); state reads the Yjs read-model. This module is pure (no
 * React/DOM) so the server-safe registry + defs can import `defineContract`.
 */
import { z } from "zod";
import { getActiveDoc } from "@/engine/doc-registry";
import { readData } from "@/collab/doc-model";

// ----- authoring -----------------------------------------------------------

export interface BrickContractDef<
  Cmds extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
  Evts extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
  St extends z.ZodTypeAny = z.ZodTypeAny,
> {
  commands: Cmds;
  events: Evts;
  state?: St;
}

/** Author a brick contract once; export it so both defineBrick AND the component use it. */
export function defineContract<
  Cmds extends Record<string, z.ZodTypeAny>,
  Evts extends Record<string, z.ZodTypeAny>,
  St extends z.ZodTypeAny = z.ZodNever,
>(c: { commands: Cmds; events: Evts; state?: St }): BrickContractDef<Cmds, Evts, St> {
  return c;
}

// Inference helpers for the typed handle/hooks.
export type CommandsOf<C> = C extends BrickContractDef<infer Cmds, infer _E, infer _S>
  ? { [K in keyof Cmds]: z.infer<Cmds[K]> }
  : never;
export type EventsOf<C> = C extends BrickContractDef<infer _C, infer Evts, infer _S>
  ? { [K in keyof Evts]: z.infer<Evts[K]> }
  : never;
export type StateOf<C> = C extends BrickContractDef<infer _C, infer _E, infer St>
  ? z.infer<St>
  : never;

// ----- bus -----------------------------------------------------------------

export interface BusMessage {
  type: string;
  payload?: unknown;
}
export interface BrickBus {
  /** Send a command TO the brick at `key` (its element id). */
  dispatch(key: string, command: BusMessage): void;
  /** A brick subscribes to commands addressed to it. */
  subscribe(key: string, handler: (command: BusMessage) => void): () => void;
  /** A brick emits an event. */
  emit(key: string, event: BusMessage): void;
  /** A caller subscribes to a brick's events. */
  on(key: string, handler: (event: BusMessage) => void): () => void;
}

type Handlers = Map<string, Set<(m: BusMessage) => void>>;

class InMemoryBus implements BrickBus {
  private commands: Handlers = new Map();
  private events: Handlers = new Map();
  private add(map: Handlers, key: string, h: (m: BusMessage) => void): () => void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(h);
    return () => set!.delete(h);
  }
  dispatch(key: string, command: BusMessage): void {
    this.commands.get(key)?.forEach((h) => h(command));
  }
  subscribe(key: string, handler: (command: BusMessage) => void): () => void {
    return this.add(this.commands, key, handler);
  }
  emit(key: string, event: BusMessage): void {
    this.events.get(key)?.forEach((h) => h(event));
  }
  on(key: string, handler: (event: BusMessage) => void): () => void {
    return this.add(this.events, key, handler);
  }
}

/** The default in-tab bus. Swappable later (e.g. ride Yjs awareness for cross-peer). */
export const brickBus: BrickBus = new InMemoryBus();

/** Where a brick may publish its exposed `state` in the read-model. */
export const stateKey = (id: string) => `__state__:${id}`;

// ----- typed handle --------------------------------------------------------

export interface BrickHandle<C extends BrickContractDef> {
  /** Send a typed command (Zod-validated; throws on a bad payload). */
  send<K extends keyof CommandsOf<C> & string>(type: K, payload: CommandsOf<C>[K]): void;
  /** Subscribe to a typed event; returns an unsubscribe. */
  on<K extends keyof EventsOf<C> & string>(type: K, cb: (payload: EventsOf<C>[K]) => void): () => void;
  /** Read the brick's exposed state from the read-model (undefined if unpublished). */
  state(): StateOf<C> | undefined;
}

/**
 * A strongly-typed handle to command/observe a placed brick by id. Types are inferred
 * from the brick's contract; payloads are Zod-validated before they touch the bus.
 */
export function brickApi<C extends BrickContractDef>(
  id: string,
  contract: C,
  bus: BrickBus = brickBus,
): BrickHandle<C> {
  return {
    send(type, payload) {
      const schema = contract.commands[type as string];
      if (!schema) throw new Error(`Brick "${id}" has no command "${String(type)}"`);
      bus.dispatch(id, { type: type as string, payload: schema.parse(payload) });
    },
    on(type, cb) {
      return bus.on(id, (event) => {
        if (event.type === (type as string)) cb(event.payload as never);
      });
    },
    state() {
      const doc = getActiveDoc();
      return doc ? (readData(doc, stateKey(id)) as StateOf<C> | undefined) : undefined;
    },
  };
}

/**
 * Validate + dispatch a command to a brick by its registry contract (the pure core of
 * the agent's `send_to_brick` tool). Returns an error string or null on success.
 */
export function validateAndDispatch(
  id: string,
  contract: BrickContractDef | undefined,
  command: string,
  payload: unknown,
  bus: BrickBus = brickBus,
): string | null {
  if (!contract) return `Brick "${id}" exposes no contract.`;
  const schema = contract.commands[command];
  if (!schema) {
    const avail = Object.keys(contract.commands).join(", ") || "(none)";
    return `Brick "${id}" has no command "${command}". Available: ${avail}`;
  }
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    return `Invalid payload for ${command}: ${parsed.error.issues.map((i) => i.message).join("; ")}`;
  }
  bus.dispatch(id, { type: command, payload: parsed.data });
  return null;
}
