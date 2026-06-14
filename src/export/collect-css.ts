"use client";

/**
 * Collect the app's REAL compiled CSS from the live document so exports carry full
 * styles offline. The previous export pulled Tailwind from cdn.tailwindcss.com, so an
 * installed/offline PWA lost every brick class — this reads the document's own
 * same-origin stylesheets (Next/Tailwind output + globals) and concatenates their rules.
 * Cross-origin sheets (e.g. a font CDN) throw on `cssRules` and are skipped.
 */
export function collectDocumentCss(): string {
  if (typeof document === "undefined") return "";
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules; // throws for cross-origin stylesheets
    } catch {
      rules = null;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) out.push(rule.cssText);
  }
  return out.join("\n");
}
