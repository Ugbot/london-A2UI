"use client";

/**
 * Registers the builder service worker (public/sw.js) in production so the app is
 * installable + offline-capable. No-op in dev (so it doesn't interfere with HMR /
 * Turbopack) and where service workers aren't supported. Provider-free — works even if
 * other providers fail to init. Renders nothing.
 */
import * as React from "react";

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
