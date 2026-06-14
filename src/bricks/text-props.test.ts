import { describe, it, expect } from "vitest";
import { TEXT_PROPS, primaryTextProps, defaultTextProp, isBoundProp } from "./text-props";
import { getBrick } from "./registry";
import { zodToJsonSchema } from "@/lib/zod-to-json-schema";

describe("text-props: map matches the registry schemas", () => {
  it("every mapped text prop exists on its brick's schema", () => {
    for (const [brick, props] of Object.entries(TEXT_PROPS)) {
      const def = getBrick(brick);
      expect(def, `brick "${brick}" registered`).toBeTruthy();
      const json = zodToJsonSchema(def!.schema) as { properties?: Record<string, unknown> };
      const properties = json.properties ?? {};
      for (const prop of props) {
        expect(properties[prop], `${brick}.${prop} in schema`).toBeTruthy();
      }
    }
  });

  it("primaryTextProps + defaultTextProp", () => {
    expect(primaryTextProps("Heading")).toEqual(["text"]);
    expect(defaultTextProp("StatCard")).toBe("label");
    expect(primaryTextProps("DataSource")).toEqual([]); // not a text brick
  });
});

describe("text-props: isBoundProp truth table", () => {
  it("flags bound-overridable props only when a binding is present", () => {
    expect(isBoundProp({ brick: "Heading", props: { bindField: "x" } }, "text")).toBe(true);
    expect(isBoundProp({ brick: "Heading", props: {} }, "text")).toBe(false);
    expect(isBoundProp({ brick: "Text", props: { bindCompute: "export default()=>1" } }, "text")).toBe(true);
    expect(isBoundProp({ brick: "StatCard", props: { bindKey: "k" } }, "value")).toBe(true);
    // StatCard.label is NOT bound-overridable even with a binding present
    expect(isBoundProp({ brick: "StatCard", props: { bindKey: "k" } }, "label")).toBe(false);
    // Button.label is never bound-overridable
    expect(isBoundProp({ brick: "Button", props: { bindKey: "k" } }, "label")).toBe(false);
  });
});
