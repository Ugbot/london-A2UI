/**
 * Pure helper: collect the store keys under `prefix` into a request body, with
 * the prefix stripped. Bound form inputs write to `${prefix}<field>` keys; a Form
 * gathers them on submit. Dependency-free + unit-tested.
 */
export function assembleFormBody(
  data: Record<string, unknown>,
  prefix: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (prefix && key.startsWith(prefix)) {
      const field = key.slice(prefix.length);
      if (field) body[field] = value;
    }
  }
  return body;
}
