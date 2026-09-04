import { describe, expect, it } from "vitest";
import { isBlockedAddress, normalizePublicUrl } from "../../server/features/technical-seo/url-safety";

describe("technical SEO URL safety", () => {
  it.each(["127.0.0.1", "10.0.0.1", "172.16.2.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.51.100.1", "203.0.113.1", "::1", "fd00::1", "fe80::1", "::ffff:7f00:1", "2001:db8::1", "64:ff9b::1"])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it("normalizes a hostname and removes fragments", () => {
    expect(normalizePublicUrl("example.com/path#fragment")).toBe("https://example.com/path");
  });

  it.each(["file:///etc/passwd", "ftp://example.com/file", "http://user:pass@example.com", "https://example.com:22"])("rejects %s", (value) => {
    expect(() => normalizePublicUrl(value)).toThrow();
  });
});
