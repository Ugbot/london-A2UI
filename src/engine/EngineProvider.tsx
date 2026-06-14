"use client";

/**
 * Boots the worker pool for the active session doc and registers it so `dispatch()`
 * can route data/fetch · poll · form commands to the background thread. Replaces the
 * old TanStack QueryProvider — the worker now owns polling, dedupe, caching, and
 * refetch (the read-model IS the cache). Renders children unchanged.
 */
import * as React from "react";
import { useCollab } from "@/collab/provider";
import { WorkerPool, setActivePool } from "./pool";

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const { doc } = useCollab();

  React.useEffect(() => {
    const pool = new WorkerPool(doc);
    pool.start();
    setActivePool(pool);
    return () => {
      setActivePool(null);
      pool.stop();
    };
  }, [doc]);

  return <>{children}</>;
}
