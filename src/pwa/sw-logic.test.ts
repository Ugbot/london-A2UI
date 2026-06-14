import { describe, it, expect } from "vitest";
import { routeRequest } from "./sw-logic";

describe("sw routing policy", () => {
  it("NEVER caches /api/* (live data, auth, proxy)", () => {
    expect(routeRequest("/api/proxy")).toBe("network-only");
    expect(routeRequest("/api/copilotkit")).toBe("network-only");
  });

  it("cache-first for immutable hashed assets", () => {
    expect(routeRequest("/_next/static/chunks/main-abc.js")).toBe("cache-first");
    expect(routeRequest("/icons/icon.svg")).toBe("cache-first");
    expect(routeRequest("/x.css")).toBe("cache-first");
  });

  it("network-first for navigations/pages", () => {
    expect(routeRequest("/")).toBe("network-first");
    expect(routeRequest("/dashboard")).toBe("network-first");
  });
});
