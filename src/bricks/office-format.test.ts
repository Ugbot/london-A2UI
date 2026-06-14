import { describe, it, expect } from "vitest";
import { toggleToken, setExclusiveToken, nextTextSize, ALIGN_TOKENS } from "./office-format";

describe("office-format token mapping", () => {
  it("toggleToken adds then removes", () => {
    expect(toggleToken([], "weight-bold")).toEqual(["weight-bold"]);
    expect(toggleToken(["weight-bold"], "weight-bold")).toEqual([]);
  });

  it("setExclusiveToken clears the rest of the group", () => {
    expect(setExclusiveToken(["left", "italic"], ALIGN_TOKENS, "center")).toEqual(["italic", "center"]);
  });

  it("nextTextSize steps up/down through the scale, clamped, replacing the old size", () => {
    expect(nextTextSize([], 1)).toEqual(["text-lg"]); // default base → +1
    expect(nextTextSize(["text-lg"], 1)).toEqual(["text-xl"]);
    expect(nextTextSize(["text-2xl"], 1)).toEqual(["text-2xl"]); // clamp high
    expect(nextTextSize(["text-sm"], -1)).toEqual(["text-sm"]); // clamp low
    expect(nextTextSize(["italic", "text-lg"], -1)).toEqual(["italic", "text-base"]); // keeps others
  });
});
