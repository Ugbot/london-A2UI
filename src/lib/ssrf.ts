/**
 * SSRF guard for the outbound proxy. The proxy is the ONE place a user-controlled
 * URL is fetched server-side, so this is the security-critical control: only
 * https (http for localhost in dev), an optional host-allowlist (the connection's
 * own host), and a DNS-resolve-then-block of private/loopback/link-local/metadata
 * ranges (mitigating DNS rebinding by checking the addresses we'd actually hit).
 *
 * Pure where it counts: `isBlockedAddress` is dependency-free and unit-tested;
 * `assertSafeUrl` accepts an injectable `lookup` so the resolution path is tested
 * without real DNS.
 */
import { lookup as dnsLookup } from "node:dns/promises";

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function ipv4ToParts(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

function isBlockedIpv4(ip: string): boolean {
  const p = ipv4ToParts(ip);
  if (!p) return false;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  return false;
}

/** True if `ip` (v4 or v6 literal) is loopback/private/link-local/metadata. */
export function isBlockedAddress(ip: string): boolean {
  const addr = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();
  if (!addr) return true;

  if (isBlockedIpv4(addr)) return true;

  // IPv6 (and IPv4-mapped IPv6)
  if (addr.includes(":")) {
    if (addr === "::1" || addr === "::") return true; // loopback / unspecified
    // IPv4-mapped: ::ffff:127.0.0.1 — check the embedded v4
    const mapped = /(?:::ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(addr);
    if (mapped && isBlockedIpv4(mapped[1])) return true;
    const head = addr.split(":")[0];
    if (head.startsWith("fe8") || head.startsWith("fe9") || head.startsWith("fea") || head.startsWith("feb"))
      return true; // fe80::/10 link-local
    if (head.startsWith("fc") || head.startsWith("fd")) return true; // fc00::/7 unique-local
  }
  return false;
}

function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return ipv4ToParts(h) !== null || h.includes(":");
}

function isLocalhostName(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost");
}

export interface SsrfOptions {
  /** When set, the URL host MUST equal this (the connection's base-url host). */
  allowedHost?: string;
  /** Dev escape hatch: permit http + localhost/private targets. */
  allowLocal?: boolean;
  /** Injectable resolver (tests). Returns the addresses a host resolves to. */
  lookup?: (host: string) => Promise<string[]>;
}

async function resolveAll(host: string): Promise<string[]> {
  const res = await dnsLookup(host, { all: true });
  return res.map((r) => r.address);
}

/**
 * Validate a target URL for outbound fetch. Throws SsrfError if unsafe; returns
 * the parsed URL if allowed.
 */
export async function assertSafeUrl(rawUrl: string, opts: SsrfOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("invalid URL");
  }

  const isHttps = url.protocol === "https:";
  const isHttp = url.protocol === "http:";
  if (!isHttps && !isHttp) throw new SsrfError("only http(s) URLs are allowed");
  if (isHttp && !(opts.allowLocal && isLocalhostName(url.hostname))) {
    throw new SsrfError("https is required");
  }

  if (opts.allowedHost && url.hostname.toLowerCase() !== opts.allowedHost.toLowerCase()) {
    throw new SsrfError("host is not allowed for this connection");
  }

  // localhost in dev is allowed explicitly; otherwise localhost is blocked.
  if (isLocalhostName(url.hostname)) {
    if (opts.allowLocal) return url;
    throw new SsrfError("localhost is not allowed");
  }

  if (isIpLiteral(url.hostname)) {
    if (!opts.allowLocal && isBlockedAddress(url.hostname)) {
      throw new SsrfError("address is not allowed");
    }
    return url;
  }

  // Resolve the hostname and block if ANY address is private/loopback/etc.
  const lk = opts.lookup ?? resolveAll;
  let addrs: string[];
  try {
    addrs = await lk(url.hostname);
  } catch {
    throw new SsrfError("DNS resolution failed");
  }
  if (addrs.length === 0) throw new SsrfError("DNS resolution failed");
  if (!opts.allowLocal) {
    for (const a of addrs) {
      if (isBlockedAddress(a)) throw new SsrfError("host resolves to a blocked address");
    }
  }
  return url;
}
