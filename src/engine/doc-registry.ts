/**
 * The active session Y.Doc, accessible OUTSIDE React.
 *
 * React components reach the doc through `useCollab()`, but several call paths run
 * imperatively and can't use a hook: the agent's frontend tools, brick event
 * handlers, and `dispatch()`. The session provider registers its doc here on mount,
 * so those paths operate on the SAME doc that components read — keeping imperative
 * writes and reactive reads consistent.
 *
 * Client-only by design: there is no active doc during SSR (reads fall back, writes
 * no-op), which also avoids any cross-request module-singleton leak on the server.
 */
import type * as Y from "yjs";

let activeDoc: Y.Doc | null = null;

export function setActiveDoc(doc: Y.Doc | null): void {
  activeDoc = doc;
}

export function getActiveDoc(): Y.Doc | null {
  return activeDoc;
}
