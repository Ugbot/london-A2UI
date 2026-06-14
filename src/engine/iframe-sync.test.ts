import { describe, it, expect } from "vitest";
import { isYjsMessage } from "./iframe-sync";

describe("iframe-sync: message guard", () => {
  it("accepts a tagged binary sync message", () => {
    expect(isYjsMessage({ t: "a2ui-y", u: new Uint8Array([1, 2, 3]) })).toBe(true);
  });

  it("rejects everything else (other postMessages must be ignored)", () => {
    expect(isYjsMessage({ t: "a2ui-y", u: [1, 2, 3] })).toBe(false); // not a Uint8Array
    expect(isYjsMessage({ t: "a2ui-ready" })).toBe(false);
    expect(isYjsMessage({ t: "other", u: new Uint8Array() })).toBe(false);
    expect(isYjsMessage(null)).toBe(false);
    expect(isYjsMessage("hi")).toBe(false);
    expect(isYjsMessage(undefined)).toBe(false);
  });
});
