import { describe, it, expect } from "vitest";
import { redact, type ConnectionFull } from "./connections";

function base(overrides: Partial<ConnectionFull> = {}): ConnectionFull {
  return {
    id: "c1",
    name: "Stripe",
    baseUrl: "https://api.stripe.com",
    auth: { type: "none" },
    defaultHeaders: {},
    endpoints: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("redact (connection secret boundary)", () => {
  it("strips a bearer token and reports hasSecret", () => {
    const r = redact(base({ auth: { type: "bearer", token: "sk_live_123" } }));
    expect(r.auth).toEqual({ type: "bearer", headerName: undefined, hasSecret: true });
    expect(JSON.stringify(r)).not.toContain("sk_live_123");
  });

  it("strips an apiKey value but keeps the (non-secret) header name", () => {
    const r = redact(base({ auth: { type: "apiKey", headerName: "X-API-Key", key: "abc123" } }));
    expect(r.auth.type).toBe("apiKey");
    expect(r.auth.headerName).toBe("X-API-Key");
    expect(r.auth.hasSecret).toBe(true);
    expect(JSON.stringify(r)).not.toContain("abc123");
  });

  it("strips basic-auth credentials", () => {
    const r = redact(base({ auth: { type: "basic", username: "u", password: "p" } }));
    expect(r.auth.hasSecret).toBe(true);
    const s = JSON.stringify(r);
    expect(s).not.toContain('"password"');
    expect(s).not.toContain('"p"');
  });

  it("hasSecret is false when auth is none or the secret is empty", () => {
    expect(redact(base()).auth.hasSecret).toBe(false);
    expect(redact(base({ auth: { type: "bearer" } })).auth.hasSecret).toBe(false);
  });

  it("masks sensitive default-header VALUES but keeps benign ones", () => {
    const r = redact(
      base({
        defaultHeaders: {
          Authorization: "Bearer leaky",
          "X-Api-Key": "leaky2",
          "Accept": "application/json",
          "X-Tenant": "acme",
        },
      }),
    );
    expect(r.defaultHeaders.Authorization).toBe("••••");
    expect(r.defaultHeaders["X-Api-Key"]).toBe("••••");
    expect(r.defaultHeaders.Accept).toBe("application/json");
    expect(r.defaultHeaders["X-Tenant"]).toBe("acme");
    expect(JSON.stringify(r)).not.toContain("leaky");
  });

  it("preserves structural fields (endpoints, baseUrl, name)", () => {
    const endpoints = [{ id: "charge", method: "POST" as const, path: "/charges", summary: "Create charge" }];
    const r = redact(base({ endpoints }));
    expect(r.endpoints).toEqual(endpoints);
    expect(r.baseUrl).toBe("https://api.stripe.com");
    expect(r.name).toBe("Stripe");
  });
});
