/**
 * The style system — the third primitive alongside bricks (what) and mortar
 * (logic): "styles" (how it looks). A Tailwind-INSPIRED, curated vocabulary of
 * `sx` tokens that can be applied to ANY brick. Each token maps to a LITERAL
 * Tailwind class string here (so Tailwind v4's scanner compiles them — no
 * dynamic-class problem). Bricks carry `sx: string[]`; the Renderer resolves it
 * onto the element's wrapper. Inline `style` overrides cover arbitrary values.
 *
 * Server-safe (no "use client"): the prompt + validation import it too.
 */
export const STYLE_TOKENS: Record<string, string> = {
  // Padding
  "pad-none": "p-0",
  "pad-sm": "p-2",
  pad: "p-4",
  "pad-lg": "p-6",
  "pad-xl": "p-8",
  // Background (paired with a readable foreground where needed)
  "bg-muted": "bg-[var(--muted)]",
  "bg-card": "bg-[var(--card)]",
  "bg-secondary": "bg-[var(--secondary)]",
  "bg-primary": "bg-[var(--primary)] text-[var(--primary-foreground)]",
  "bg-accent": "bg-[var(--accent-brand)] text-white",
  // Radius
  "rounded-none": "rounded-none",
  rounded: "rounded-[var(--radius)]",
  "rounded-lg": "rounded-[var(--radius-lg)]",
  "rounded-xl": "rounded-[var(--radius-xl)]",
  "rounded-full": "rounded-full",
  // Elevation
  "shadow-sm": "shadow-sm",
  shadow: "shadow-md",
  "shadow-lg": "shadow-lg",
  // Border
  border: "border border-[var(--border)]",
  // Text size
  "text-sm": "text-sm",
  "text-base": "text-base",
  "text-lg": "text-lg",
  "text-xl": "text-xl",
  "text-2xl": "text-2xl",
  // Weight / emphasis
  "weight-medium": "font-medium",
  "weight-semibold": "font-semibold",
  "weight-bold": "font-bold",
  italic: "italic",
  uppercase: "uppercase tracking-wide",
  muted: "text-[var(--muted-foreground)]",
  // Alignment / width
  center: "text-center",
  left: "text-left",
  right: "text-right",
  "w-full": "w-full",
  "w-fit": "w-fit",
  "mx-auto": "mx-auto",
};

/** The set of valid token names (for the inspector + agent docs). */
export const STYLE_TOKEN_NAMES = Object.keys(STYLE_TOKENS);

/** Resolve an `sx` token list into a className string (unknown tokens dropped). */
export function resolveSx(tokens?: unknown): string {
  if (!Array.isArray(tokens)) return "";
  return tokens
    .map((t) => (typeof t === "string" ? STYLE_TOKENS[t] : undefined))
    .filter(Boolean)
    .join(" ");
}
