import { describe, it, expect } from "vitest";
import { sanitizeMessages } from "./sanitize-messages";

describe("sanitizeMessages (poisoned-transcript guard)", () => {
  it("returns [] for non-array input", () => {
    expect(sanitizeMessages(null)).toEqual([]);
    expect(sanitizeMessages(undefined)).toEqual([]);
    expect(sanitizeMessages("nope")).toEqual([]);
  });

  it("repairs the `{}{}` tool-call args that caused the position-2 crash", () => {
    const out = sanitizeMessages([
      { id: "m1", role: "assistant", toolCalls: [{ id: "t1", function: { name: "get_current_widget", arguments: "{}{}" } }] },
    ]);
    expect(out[0].toolCalls![0].function!.arguments).toBe("{}");
  });

  it("repairs empty-string args to {}", () => {
    const out = sanitizeMessages([
      { id: "m1", role: "assistant", toolCalls: [{ id: "t1", function: { name: "x", arguments: "" } }] },
    ]);
    expect(out[0].toolCalls![0].function!.arguments).toBe("{}");
  });

  it("drops duplicate tool-call ids (the React duplicate-key crash)", () => {
    const out = sanitizeMessages([
      { id: "m1", role: "assistant", toolCalls: [
        { id: "dup", function: { name: "a", arguments: "{}" } },
        { id: "dup", function: { name: "b", arguments: "{}" } },
      ] },
    ]);
    expect(out[0].toolCalls).toHaveLength(1);
    expect(out[0].toolCalls![0].function!.name).toBe("a");
  });

  it("drops duplicate tool-call ids ACROSS messages", () => {
    const out = sanitizeMessages([
      { id: "m1", role: "assistant", toolCalls: [{ id: "dup", function: { name: "a", arguments: "{}" } }] },
      { id: "m2", role: "assistant", toolCalls: [{ id: "dup", function: { name: "b", arguments: "{}" } }] },
    ]);
    expect(out[1].toolCalls).toHaveLength(0);
  });

  it("drops duplicate message ids", () => {
    const out = sanitizeMessages([
      { id: "m1", role: "user", content: "hi" },
      { id: "m1", role: "user", content: "hi again" },
      { id: "m2", role: "assistant", content: "ok" },
    ]);
    expect(out.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("drops a tool call whose args are unrepairable", () => {
    const out = sanitizeMessages([
      { id: "m1", role: "assistant", toolCalls: [{ id: "t1", function: { name: "x", arguments: "garbage" } }] },
    ]);
    expect(out[0].toolCalls).toHaveLength(0);
  });

  it("passes clean transcripts through intact", () => {
    const clean = [
      { id: "m1", role: "user", content: "build a chart" },
      { id: "m2", role: "assistant", toolCalls: [{ id: "t1", function: { name: "render_widget", arguments: '{"tree":{"brick":"Stack"}}' } }] },
    ];
    expect(sanitizeMessages(clean)).toEqual(clean);
  });
});
