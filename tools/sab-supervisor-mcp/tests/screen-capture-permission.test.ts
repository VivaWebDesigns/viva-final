import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("optional watcher screenshots", () => {
  it("preflights Screen Recording access without requesting permission", async () => {
    const source = await readFile(
      new URL(
        "../swift/Sources/SABPermissionWatcher/Support.swift",
        import.meta.url,
      ),
      "utf8",
    );
    const preflight = source.indexOf("CGPreflightScreenCaptureAccess()");
    const capture = source.indexOf(
      'URL(fileURLWithPath: "/usr/sbin/screencapture")',
    );

    expect(preflight).toBeGreaterThan(-1);
    expect(capture).toBeGreaterThan(preflight);
    expect(source).not.toContain("CGRequestScreenCaptureAccess");
  });
});
