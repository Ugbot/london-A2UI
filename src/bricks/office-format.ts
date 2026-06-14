/**
 * Pure mappings from Office-style formatting actions to `sx` style tokens, so the
 * friendly inspector controls (Bold/size/align) drive the same token system the agent
 * + Advanced tab use. Server-safe (no React).
 */
export const TEXT_SIZES = ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"];
export const ALIGN_TOKENS = ["left", "center", "right"];

/** Add/remove a single token. */
export function toggleToken(current: string[], token: string): string[] {
  return current.includes(token) ? current.filter((t) => t !== token) : [...current, token];
}

/** Set one token from a mutually-exclusive group (clears the others). */
export function setExclusiveToken(current: string[], group: string[], token: string): string[] {
  return [...current.filter((t) => !group.includes(t)), token];
}

/** Step the font-size token up (+1) or down (−1) through TEXT_SIZES, clamped. */
export function nextTextSize(current: string[], dir: 1 | -1): string[] {
  const i = TEXT_SIZES.findIndex((s) => current.includes(s));
  const next = Math.max(0, Math.min(TEXT_SIZES.length - 1, (i === -1 ? 1 : i) + dir));
  return [...current.filter((s) => !TEXT_SIZES.includes(s)), TEXT_SIZES[next]];
}
