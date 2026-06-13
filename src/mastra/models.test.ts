import { describe, it, expect } from "vitest";
import {
  parseModelId,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
} from "./models";

describe("parseModelId (runtime model selection)", () => {
  it("returns an empty selection for nullish input (→ env default)", () => {
    expect(parseModelId(undefined)).toEqual({});
    expect(parseModelId(null)).toEqual({});
    expect(parseModelId("")).toEqual({});
  });

  it("splits a provider:model id on the FIRST colon only", () => {
    expect(parseModelId("anthropic:claude-opus-4-8")).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-8",
    });
    // dated model ids contain no extra colons, but be robust if they did
    expect(parseModelId("openai:gpt-5.4-nano")).toEqual({
      provider: "openai",
      model: "gpt-5.4-nano",
    });
  });

  it("treats a bare id (no colon) as a model on the default provider", () => {
    expect(parseModelId("claude-sonnet-4-6")).toEqual({ model: "claude-sonnet-4-6" });
  });

  it("round-trips every curated AVAILABLE_MODELS id", () => {
    for (const m of AVAILABLE_MODELS) {
      expect(parseModelId(m.id)).toEqual({ provider: m.provider, model: m.model });
    }
  });

  it("exposes a default model id that is one of the curated options", () => {
    expect(AVAILABLE_MODELS.some((m) => m.id === DEFAULT_MODEL_ID)).toBe(true);
  });
});
