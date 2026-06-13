/**
 * Durable execution via DBOS — survives flaky networks and restarts.
 *
 * DBOS checkpoints workflows/steps in its own Postgres system database, so a
 * step that fails on a network blip is retried with backoff, and an
 * in-flight workflow is recovered if the process restarts. We use it to wrap
 * the flaky outbound calls (Linkup research; extendable to the foundry).
 *
 * Launch is lazy + guarded across HMR reloads (globalThis flag) so the dev
 * server doesn't double-launch.
 */
import { DBOS } from "@dbos-inc/dbos-sdk";

const SYS_DB_URL =
  process.env.DBOS_SYSTEM_DATABASE_URL ??
  "postgresql://intelligence:intelligence@localhost:5433/dbos_sys";

const g = globalThis as typeof globalThis & { __dbosLaunch?: Promise<void> };

/** Launch DBOS once per process (idempotent across HMR). */
export function ensureDbos(): Promise<void> {
  if (!g.__dbosLaunch) {
    g.__dbosLaunch = (async () => {
      DBOS.setConfig({ name: "widget-composer", systemDatabaseUrl: SYS_DB_URL });
      try {
        await DBOS.launch();
      } catch (err) {
        // Already launched (HMR) is fine; rethrow anything else.
        if (!/already (launched|initialized)/i.test(String(err))) throw err;
      }
    })();
  }
  return g.__dbosLaunch;
}

/** Default retry policy tuned for flaky outbound network calls. */
export const FLAKY_RETRY = {
  retriesAllowed: true as const,
  maxAttempts: 5,
  intervalSeconds: 1,
  backoffRate: 2,
};
