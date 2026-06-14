import { describe, it, expect } from "vitest";
import { resolveSx, STYLE_TOKENS } from "./style-tokens";

describe("resolveSx (style tokens → classes)", () => {
  it("maps known tokens to their literal Tailwind classes", () => {
    expect(resolveSx(["pad", "shadow", "rounded"])).toBe(
      "p-4 shadow-md rounded-[var(--radius)]",
    );
  });

  it("drops unknown tokens", () => {
    expect(resolveSx(["pad", "totally-bogus", "center"])).toBe("p-4 text-center");
  });

  it("returns '' for non-array / empty input", () => {
    expect(resolveSx(undefined)).toBe("");
    expect(resolveSx("pad")).toBe("");
    expect(resolveSx([])).toBe("");
    expect(resolveSx([1, 2, null])).toBe("");
  });

  it("every curated token resolves to a non-empty class", () => {
    for (const token of Object.keys(STYLE_TOKENS)) {
      expect(resolveSx([token])).toBeTruthy();
    }
  });

  it("auto-layout child tokens resolve to flex utilities", () => {
    expect(resolveSx(["w-fit", "self-center", "grow"])).toBe("w-fit self-center grow");
  });
});
