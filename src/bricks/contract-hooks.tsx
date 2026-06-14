"use client";

/**
 * React wiring for brick contracts. A brick calls `useBrickContract(undefined, contract,
 * handlers)` to receive typed commands (validated; bad payloads are dropped, never
 * thrown into render) and gets back `emit` (typed events) + `publishState`. The brick's
 * id comes from `BrickIdContext` (provided per-node by the Renderer) so the contract
 * surface stays off the brick's typed props.
 */
import * as React from "react";
import { getActiveDoc } from "@/engine/doc-registry";
import { applyDataAction, ORIGIN } from "@/collab/doc-model";
import {
  brickBus,
  stateKey,
  type BrickContractDef,
  type CommandsOf,
  type EventsOf,
  type StateOf,
} from "./contract";

/** Per-node element id, provided by the Renderer so contracted bricks can self-identify. */
export const BrickIdContext = React.createContext<string | undefined>(undefined);

type CommandHandlers<C extends BrickContractDef> = Partial<{
  [K in keyof CommandsOf<C> & string]: (payload: CommandsOf<C>[K]) => void;
}>;

export function useBrickContract<C extends BrickContractDef>(
  idArg: string | undefined,
  contract: C,
  handlers: CommandHandlers<C>,
): {
  emit: <K extends keyof EventsOf<C> & string>(type: K, payload: EventsOf<C>[K]) => void;
  publishState: (value: StateOf<C>) => void;
} {
  const ctxId = React.useContext(BrickIdContext);
  const id = idArg ?? ctxId;
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    if (!id) return;
    return brickBus.subscribe(id, (cmd) => {
      const handler = (handlersRef.current as Record<string, ((p: unknown) => void) | undefined>)[cmd.type];
      const schema = contract.commands[cmd.type];
      if (!handler || !schema) return;
      const parsed = schema.safeParse(cmd.payload);
      if (parsed.success) handler(parsed.data);
      else console.warn(`[brick ${id}] dropped invalid command "${cmd.type}"`, parsed.error.issues);
    });
  }, [id, contract]);

  const emit = React.useCallback(
    <K extends keyof EventsOf<C> & string>(type: K, payload: EventsOf<C>[K]) => {
      if (!id) return;
      const schema = contract.events[type as string];
      if (!schema) return;
      brickBus.emit(id, { type: type as string, payload: schema.parse(payload) });
    },
    [id, contract],
  );

  const publishState = React.useCallback(
    (value: StateOf<C>) => {
      if (!id) return;
      const doc = getActiveDoc();
      if (doc) applyDataAction(doc, { action: "set", target: stateKey(id), value }, ORIGIN.worker);
    },
    [id],
  );

  return { emit, publishState };
}
