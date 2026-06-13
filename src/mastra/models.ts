/**
 * Client-safe model metadata — no SDK imports, so it can be used in both the
 * browser (the runtime model picker) and the server (provider.ts). The actual
 * model clients (with API keys) live in provider.ts.
 */
export type ProviderId = "anthropic" | "openai";

export interface ModelOption {
  /** "provider:model", the value passed at runtime. */
  id: string;
  provider: ProviderId;
  model: string;
  label: string;
}

/**
 * Models surfaced in the runtime picker (UI dropdown / API docs). Not a hard
 * allow-list — any id the configured provider accepts works — just the curated
 * set shown to users. The first entry is the UI default.
 */
export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "anthropic:claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "anthropic:claude-opus-4-8", provider: "anthropic", model: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "anthropic:claude-haiku-4-5-20251001", provider: "anthropic", model: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "openai:gpt-5.4-nano", provider: "openai", model: "gpt-5.4-nano", label: "GPT-5.4 nano" },
];

/** UI default selection (server falls back to its own env default if unset). */
export const DEFAULT_MODEL_ID = AVAILABLE_MODELS[0].id;

export interface ModelSelection {
  provider?: string;
  model?: string;
}

/**
 * Parse a "provider:model" string (e.g. "anthropic:claude-opus-4-8") into a
 * selection. A bare model id with no provider prefix keeps the default provider.
 */
export function parseModelId(id?: string | null): ModelSelection {
  if (!id) return {};
  const idx = id.indexOf(":");
  if (idx === -1) return { model: id };
  return { provider: id.slice(0, idx), model: id.slice(idx + 1) };
}
