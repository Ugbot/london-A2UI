import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { z } from "zod";
import {
  defineContract,
  brickApi,
  brickBus,
  stateKey,
  validateAndDispatch,
  type BusMessage,
} from "./contract";
import { actionButtonContract, formContract, dataSourceContract } from "./contracts";
import { getContract, contractSummary, getBrick } from "./registry";
import { setActiveDoc } from "@/engine/doc-registry";
import { applyDataAction } from "@/collab/doc-model";

describe("contract: authoring + schema validation", () => {
  it("defineContract returns the contract with inferable shapes", () => {
    const c = defineContract({
      commands: { go: z.object({ n: z.number() }) },
      events: { done: z.object({}) },
    });
    expect(c.commands.go.safeParse({ n: 1 }).success).toBe(true);
    expect(c.commands.go.safeParse({ n: "x" }).success).toBe(false);
  });

  it("example contracts validate their payloads", () => {
    expect(actionButtonContract.events.clicked.safeParse({ target: "k", value: 1 }).success).toBe(true);
    expect(actionButtonContract.events.clicked.safeParse({ value: 1 }).success).toBe(false); // missing target
  });
});

describe("contract: brickApi typed handle", () => {
  it("send validates + dispatches; bad payload throws", () => {
    const received: BusMessage[] = [];
    const off = brickBus.subscribe("form-1", (m) => received.push(m));
    const api = brickApi("form-1", formContract);

    api.send("submit", {});
    expect(received).toEqual([{ type: "submit", payload: {} }]);

    // @ts-expect-error — "nope" is not a command of formContract
    expect(() => api.send("nope", {})).toThrow();
    off();
  });

  it("on receives emitted events", () => {
    const seen: unknown[] = [];
    const api = brickApi("ds-1", dataSourceContract);
    const off = api.on("loaded", (p) => seen.push(p));
    brickBus.emit("ds-1", { type: "loaded", payload: { count: 3 } });
    expect(seen).toEqual([{ count: 3 }]);
    off();
  });

  it("state() reads the read-model slice the brick published", () => {
    const doc = new Y.Doc();
    setActiveDoc(doc);
    applyDataAction(doc, { action: "set", target: stateKey("x-1"), value: { open: true } });
    expect(brickApi("x-1", formContract).state()).toEqual({ open: true });
  });
});

describe("contract: validateAndDispatch (agent send_to_brick core)", () => {
  beforeEach(() => {
    /* fresh listeners each test via unique ids */
  });

  it("errors on a brick with no contract", () => {
    expect(validateAndDispatch("a", undefined, "x", {})).toMatch(/no contract/i);
  });

  it("errors on an unknown command (lists available)", () => {
    const err = validateAndDispatch("f", formContract, "frobnicate", {});
    expect(err).toMatch(/no command "frobnicate"/);
    expect(err).toMatch(/submit/);
  });

  it("errors on an invalid payload", () => {
    const c = defineContract({ commands: { go: z.object({ n: z.number() }) }, events: {} });
    expect(validateAndDispatch("g", c, "go", { n: "bad" })).toMatch(/invalid payload/i);
  });

  it("dispatches a valid command and returns null", () => {
    const got: BusMessage[] = [];
    const off = brickBus.subscribe("ds-9", (m) => got.push(m));
    expect(validateAndDispatch("ds-9", dataSourceContract, "refresh", {})).toBeNull();
    expect(got).toEqual([{ type: "refresh", payload: {} }]);
    off();
  });
});

describe("contract: registry integration", () => {
  it("getContract exposes a brick's contract", () => {
    expect(getContract("Form")).toBeDefined();
    expect(getContract("DataSource")?.commands.refresh).toBeDefined();
    expect(getContract("Heading")).toBeUndefined(); // no contract
  });

  it("contractSummary + catalog expose JSON-schema command/event shapes", () => {
    const form = getBrick("Form")!;
    const summary = contractSummary(form)!;
    expect(Object.keys(summary.commands)).toContain("submit");
    expect(Object.keys(summary.events)).toContain("submitted");
  });
});
