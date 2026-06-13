/**
 * Shared model provider for the agent + verification scripts.
 *
 * The network path to api.openai.com here is flaky (frequent ECONNRESET /
 * timeouts), and the compose loop makes several sequential LLM calls, so a
 * single reset kills a run. We wrap fetch with connection-level retries +
 * exponential backoff to ride through transient resets. Env-configurable so the
 * same agent runs against OpenAI or a local OpenAI-compatible endpoint (Ollama).
 */
import { createOpenAI } from "@ai-sdk/openai";

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

export const provider = createOpenAI({
  // Unset → https://api.openai.com/v1. Set OPENAI_BASE_URL=http://localhost:11434/v1 for Ollama.
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? "",
  fetch: resilientFetch,
});

export const MODEL = process.env.AGENT_MODEL ?? "gpt-5.4-nano";
