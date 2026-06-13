"use client";

/**
 * Record context — the CMS templating primitive. A Repeater wraps its child
 * template in a <RecordProvider record={...}> per dataset row; display bricks
 * inside read a field of that record via `useRecordField("path")` (their
 * `bindField` prop). This is how one template renders many records, Gatsby/Wix
 * "repeater" style — driven by React context, so each row re-renders independently.
 */
import * as React from "react";

const RecordContext = React.createContext<unknown>(undefined);

export function RecordProvider({
  record,
  children,
}: {
  record: unknown;
  children: React.ReactNode;
}) {
  return <RecordContext.Provider value={record}>{children}</RecordContext.Provider>;
}

export function useRecord(): unknown {
  return React.useContext(RecordContext);
}

/** Dot-path read into a record value (e.g. "address.city"). */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

/**
 * Read a field of the CURRENT record. Returns undefined when there is no record
 * in scope or no path — callers fall back to their static prop. Safe to call
 * unconditionally (Rules of Hooks): always reads the context.
 */
export function useRecordField(path?: string): unknown {
  const record = React.useContext(RecordContext);
  if (record === undefined || path === undefined) return undefined;
  if (path === "" || path === ".") return record; // bind the whole record
  return getPath(record, path);
}
