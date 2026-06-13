import { describe, it, expect } from "vitest";
import { isBlockedAddress, assertSafeUrl, SsrfError } from "./ssrf";

describe("isBlockedAddress", () => {
  it("blocks IPv4 loopback / private / link-local / metadata / CGNAT", () => {
    for (const ip of [
      "127.0.0.1", "127.5.5.5",
      "10.0.0.1", "10.255.255.255",
      "172.16.0.1", "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
      "100.64.0.1", // CGNAT
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.167.0.1", "93.184.216.34"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback / link-local / unique-local / mapped-private", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12::3", "::ffff:127.0.0.1", "[::1]"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });
});

const ok = (addr: string) => async () => [addr];

describe("assertSafeUrl", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(assertSafeUrl("ftp://example.com")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError);
  });

  it("requires https (http rejected unless allowLocal+localhost)", async () => {
    await expect(assertSafeUrl("http://example.com", { lookup: ok("8.8.8.8") })).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("http://localhost:3000", { allowLocal: true })).resolves.toBeInstanceOf(URL);
  });

  it("blocks a public host that RESOLVES to a private address (DNS rebind)", async () => {
    await expect(
      assertSafeUrl("https://evil.example.com", { lookup: ok("10.0.0.5") }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("allows a public host resolving to a public address", async () => {
    await expect(
      assertSafeUrl("https://api.example.com/v1", { lookup: ok("93.184.216.34") }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("blocks literal private IP hosts", async () => {
    await expect(assertSafeUrl("https://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("https://127.0.0.1")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks localhost unless allowLocal", async () => {
    await expect(assertSafeUrl("https://localhost")).rejects.toBeInstanceOf(SsrfError);
  });

  it("enforces the connection host allowlist", async () => {
    await expect(
      assertSafeUrl("https://other.com/x", { allowedHost: "api.example.com", lookup: ok("8.8.8.8") }),
    ).rejects.toBeInstanceOf(SsrfError);
    await expect(
      assertSafeUrl("https://api.example.com/x", { allowedHost: "api.example.com", lookup: ok("8.8.8.8") }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects a host that fails to resolve", async () => {
    await expect(
      assertSafeUrl("https://nope.example.com", { lookup: async () => [] }),
    ).rejects.toBeInstanceOf(SsrfError);
  });
});
