/**
 * Linkup web-research client. Used by the agent's `research` tool to fetch
 * up-to-date, sourced information to build dashboards from.
 *
 * Server-only (uses LINKUP_API_KEY). The request shape is verified against the
 * Linkup v1 API; a 429 INSUFFICIENT_FUNDS_CREDITS means the org needs topping up.
 */
import { DBOS } from "@dbos-inc/dbos-sdk";
import { ensureDbos, FLAKY_RETRY } from "./dbos";

const LINKUP_API_KEY = process.env.LINKUP_API_KEY;
const LINKUP_URL = "https://api.linkup.so/v1/search";

export interface LinkupSource {
  name: string;
  url: string;
  snippet?: string;
}

export interface SourcedAnswer {
  answer: string;
  sources: LinkupSource[];
}

/** The raw Linkup call, registered as a DBOS step so it retries on flaky network. */
const linkupStep = DBOS.registerStep(
  (query: string, depth: "standard" | "deep") => linkupFetch(query, depth),
  {
    name: "linkup.search",
    ...FLAKY_RETRY,
    // Retry only transient network / 5xx errors — not auth, bad query, or
    // out-of-funds (4xx/429), which won't recover within a few attempts.
    shouldRetry: (e) =>
      /fetch failed|ECONNRESET|ETIMEDOUT|network|socket|50[0234]/i.test(
        String(e instanceof Error ? e.message : e),
      ),
  },
);

/** Durable workflow wrapping the research call (checkpointed + recoverable). */
const researchWorkflow = DBOS.registerWorkflow(
  (query: string, depth: "standard" | "deep") => linkupStep(query, depth),
  { name: "research" },
);

/**
 * Run a sourced-answer web search via Linkup with DURABLE EXECUTION: the call is
 * a retrying DBOS step inside a checkpointed workflow, so transient network
 * failures are retried with backoff and an interrupted run can be recovered.
 */
export async function research(
  query: string,
  depth: "standard" | "deep" = "standard",
): Promise<SourcedAnswer> {
  await ensureDbos();
  return researchWorkflow(query, depth);
}

/** The underlying Linkup HTTP request. Throws on API error (so DBOS retries). */
async function linkupFetch(
  query: string,
  depth: "standard" | "deep",
): Promise<SourcedAnswer> {
  if (!LINKUP_API_KEY) throw new Error("LINKUP_API_KEY is not set");

  const res = await fetch(LINKUP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINKUP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, depth, outputType: "sourcedAnswer" }),
  });

  const data = (await res.json()) as {
    answer?: string;
    sources?: Array<{ name?: string; url?: string; snippet?: string }>;
    error?: { code?: string; message?: string };
  };

  if (!res.ok || data.error) {
    throw new Error(
      `Linkup ${res.status}${data.error?.code ? ` ${data.error.code}` : ""}: ${data.error?.message ?? "request failed"}`,
    );
  }

  return {
    answer: data.answer ?? "",
    sources: (data.sources ?? []).slice(0, 10).map((s) => ({
      name: s.name ?? s.url ?? "source",
      url: s.url ?? "",
      snippet: s.snippet,
    })),
  };
}
