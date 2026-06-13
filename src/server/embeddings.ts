/**
 * Local embeddings via Ollama's `nomic-embed-text` model (768-dim).
 *
 * Server-only. Used to embed brick descriptions and partial templates so the
 * agent can do referential (vector) search over the growing cache.
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

/** Embedding dimension produced by nomic-embed-text. Must match the pgvector column. */
export const EMBED_DIM = 768;

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

/**
 * Embed a batch of texts in a single Ollama call.
 *
 * @param texts - Inputs to embed. Empty array short-circuits to `[]`.
 * @returns One 768-dim vector per input, in the same order.
 * @throws If Ollama errors, returns the wrong count, or a wrong dimension.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!res.ok) {
    throw new Error(
      `Ollama embed failed: ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }

  const data = (await res.json()) as OllamaEmbedResponse;
  const vectors = data.embeddings ?? [];

  if (vectors.length !== texts.length) {
    throw new Error(
      `Ollama returned ${vectors.length} embeddings for ${texts.length} inputs`,
    );
  }
  for (const v of vectors) {
    if (v.length !== EMBED_DIM) {
      throw new Error(`Expected ${EMBED_DIM}-dim embedding, got ${v.length}`);
    }
  }
  return vectors;
}

/**
 * Embed a single text.
 *
 * @param text - Input to embed.
 * @returns A single 768-dim vector.
 */
export async function embed(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}
