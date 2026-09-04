import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  code = "UNSAFE_URL";
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function blockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  );
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return blockedIpv4(mapped);
  const hexMapped = normalized.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const high = Number.parseInt(hexMapped[1], 16);
    const low = Number.parseInt(hexMapped[2], 16);
    return blockedIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  if (normalized.startsWith("2001:db8") || normalized.startsWith("2001:0000") || normalized.startsWith("2002:")) return true;
  if (normalized.startsWith("64:ff9b:") || normalized.startsWith("64:ff9b:1:")) return true;
  return false;
}

export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blockedIpv4(address);
  if (family === 6) return blockedIpv6(address);
  return true;
}

export function normalizePublicUrl(input: string): string {
  const candidate = input.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new UnsafeUrlError("Enter a valid public HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only HTTP and HTTPS URLs are supported.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs containing credentials are not supported.");
  if (!url.hostname || url.hostname.length > 253) throw new UnsafeUrlError("The URL hostname is invalid.");
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) throw new UnsafeUrlError("Only standard public web ports are supported.");
  url.hash = "";
  return url.toString();
}

export async function assertSafePublicUrl(input: string): Promise<URL> {
  const normalized = normalizePublicUrl(input);
  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
    hostname.endsWith(".internal") || hostname === "metadata.google.internal" || !hostname.includes(".")
  ) throw new UnsafeUrlError("Local and internal hostnames cannot be scanned.");

  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new UnsafeUrlError("Private, local, and reserved network addresses cannot be scanned.");
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await Promise.race([
      dns.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DNS lookup timed out")), 3_000)),
    ]);
  } catch {
    throw new UnsafeUrlError("The hostname could not be resolved.");
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new UnsafeUrlError("The hostname resolves to a private, local, or reserved address.");
  }
  return url;
}
