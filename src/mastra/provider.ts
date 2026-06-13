/**
 * Shared model provider for the agent, API, and verification scripts.
 *
 * The model is selectable three ways, in increasing precedence:
 *   1. ENV default      — AGENT_PROVIDER (anthropic|openai) + AGENT_MODEL (id).
 *   2. Per-request       — the API body / UI passes { provider, model }.
 *   3. (unset)           — falls back to the env default, else latest Sonnet.
 *
 * Defaults to Anthropic (Claude). Set AGENT_PROVIDER=openai for OpenAI or a
 * local OpenAI-compatible endpoint (Ollama via OPENAI_BASE_URL). The network
 * path to the model API can be flaky (ECONNRESET / timeouts) and the compose
 * loop makes several sequential calls, so we wrap fetch with connection-level
 * retries + exponential backoff to ride through transient resets.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  AVAILABLE_MODELS,
  parseModelId,
  type ProviderId,
  type ModelSelection,
} from "./models";

export { AVAILABLE_MODELS, parseModelId };
export type { ProviderId, ModelSelection };

const MAX_ATTEMPTS = Number(process.env.AGENT_FETCH_RETRIES ?? 4);

/** fetch with retry on connection errors (ECONNRESET, timeouts). */
const resilientFetch: typeof fetch = async (input, init) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      // Respect explicit user/SDK aborts — don't retry those.
      if (init?.signal?.aborted) throw err;
      lastErr = err;
      const backoff = 400 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
};

/** ENV-configured default provider + model. */
export const DEFAULT_PROVIDER: ProviderId =
  (process.env.AGENT_PROVIDER as ProviderId) ??
  (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");

const PROVIDER_DEFAULT_MODEL: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.4-nano",
};

export const MODEL =
  process.env.AGENT_MODEL ?? PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER];

/** The env-default selection as a "provider:model" string. */
export const DEFAULT_MODEL_ID = `${DEFAULT_PROVIDER}:${MODEL}`;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  fetch: resilientFetch,
});

const openai = createOpenAI({
  // Unset → https://api.openai.com/v1. Set OPENAI_BASE_URL=http://localhost:11434/v1 for Ollama.
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? "",
  fetch: resilientFetch,
});

/**
 * Resolve a language model for a (possibly partial) selection, falling back to
 * the env defaults. This is the single entry point used by the agent, the build
 * API, and scripts.
 */
export function resolveModel(sel: ModelSelection = {}) {
  const provider: ProviderId =
    sel.provider === "openai" || sel.provider === "anthropic"
      ? sel.provider
      : DEFAULT_PROVIDER;
  const id =
    sel.model ?? (provider === DEFAULT_PROVIDER ? MODEL : PROVIDER_DEFAULT_MODEL[provider]);
  return provider === "anthropic" ? anthropic(id) : openai(id);
}

/** Back-compat: `provider(id)` / `model(id)` resolve against the default provider. */
export function model(id: string = MODEL) {
  return resolveModel({ model: id });
}
export const provider = model;
