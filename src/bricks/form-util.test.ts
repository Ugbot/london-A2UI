import { describe, it, expect } from "vitest";
import { assembleFormBody } from "./form-util";

describe("assembleFormBody", () => {
  it("collects prefixed keys and strips the prefix", () => {
    const data = {
      "form.signup.email": "a@b.com",
      "form.signup.name": "Ada",
      "form.other.x": 1,
      unrelated: true,
    };
    expect(assembleFormBody(data, "form.signup.")).toEqual({ email: "a@b.com", name: "Ada" });
  });

  it("preserves value types (number/boolean/object)", () => {
    const data = { "f.age": 30, "f.subscribed": true, "f.meta": { a: 1 } };
    expect(assembleFormBody(data, "f.")).toEqual({ age: 30, subscribed: true, meta: { a: 1 } });
  });

  it("returns {} when nothing matches", () => {
    expect(assembleFormBody({ a: 1 }, "form.")).toEqual({});
  });

  it("ignores a key equal to the prefix (no field name)", () => {
    expect(assembleFormBody({ "form.": "x", "form.a": "y" }, "form.")).toEqual({ a: "y" });
  });
});
