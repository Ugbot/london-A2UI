import { describe, it, expect } from "vitest";
import { isYjsMessage, isThemeMessage } from "./iframe-sync";

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

describe("iframe-sync: theme message guard", () => {
  it("accepts a string→string vars payload", () => {
    expect(isThemeMessage({ t: "a2ui-theme", vars: { "--accent-brand": "#f00", "--radius": "8px" } })).toBe(true);
    expect(isThemeMessage({ t: "a2ui-theme", vars: {} })).toBe(true);
  });

  it("rejects wrong type / non-object vars / non-string values / foreign payloads", () => {
    expect(isThemeMessage({ t: "other", vars: {} })).toBe(false);
    expect(isThemeMessage({ t: "a2ui-theme", vars: null })).toBe(false);
    expect(isThemeMessage({ t: "a2ui-theme", vars: ["x"] })).toBe(false);
    expect(isThemeMessage({ t: "a2ui-theme", vars: { "--x": 5 } })).toBe(false);
    expect(isThemeMessage({ hello: "world" })).toBe(false);
    expect(isThemeMessage(null)).toBe(false);
  });
});
