/**
 * Pure JSON-repair helpers (no SDK imports — safe in the browser and server).
 *
 * Models sometimes emit malformed JSON for tool-call arguments — typically valid
 * JSON followed by trailing junk ("Unexpected non-whitespace character after JSON
 * at position N"), or repeated objects like `{}{}`. These helpers salvage the
 * first valid value or report that it can't be repaired.
 */

/** Find the first complete balanced JSON value in `text`, honoring strings. */
export function firstBalancedJson(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Return a parseable JSON arguments string, or null if it can't be salvaged.
 * Empty input becomes "{}" (a no-arg call), which is always valid.
 */
export function repairToolArgs(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return "{}";
  try {
    JSON.parse(text);
    return text;
  } catch {
    /* fall through to repair */
  }
  const sliced = firstBalancedJson(text);
  if (sliced) {
    try {
      JSON.parse(sliced);
      return sliced;
    } catch {
      /* unrepairable */
    }
  }
  return null;
}
