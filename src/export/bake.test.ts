import { describe, it, expect } from "vitest";
import { toPascalBrickName } from "./bake";

describe("toPascalBrickName", () => {
  it("converts a label into a valid PascalCase brick name", () => {
    expect(toPascalBrickName("my section")).toBe("MySection");
    expect(toPascalBrickName("hero banner!")).toBe("HeroBanner");
    expect(toPascalBrickName("pricing-table 2")).toBe("PricingTable2");
  });

  it("ensures it starts with an uppercase letter", () => {
    expect(toPascalBrickName("123 grid")).toMatch(/^[A-Z]/); // leading digit → prefixed
    expect(toPascalBrickName("")).toBe("Baked");
  });
});
