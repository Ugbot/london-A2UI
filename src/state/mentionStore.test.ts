import { describe, it, expect, beforeEach } from "vitest";
import { useMentionStore } from "./mentionStore";

beforeEach(() => useMentionStore.setState({ mode: "none", pendingInsert: null }));

describe("mentionStore", () => {
  it("mentionElement queues an @id for the chat composer", () => {
    useMentionStore.getState().mentionElement("btc-chart");
    expect(useMentionStore.getState().pendingInsert).toBe("@btc-chart ");
  });

  it("consumeInsert returns the queued text once, then clears", () => {
    useMentionStore.getState().mentionElement("x");
    expect(useMentionStore.getState().consumeInsert()).toBe("@x ");
    expect(useMentionStore.getState().consumeInsert()).toBeNull();
  });

  it("setMode drives the tool mode", () => {
    useMentionStore.getState().setMode("move");
    expect(useMentionStore.getState().mode).toBe("move");
  });
});
