import { describe, expect, it } from "vitest";
import { diagnosticScanError, publicScanError } from "../../server/features/technical-seo/errors";
import { sanitizePostgresJson, sanitizePostgresJsonString } from "../../server/features/technical-seo/sanitize";

describe("technical SEO result sanitization", () => {
  it("replaces PostgreSQL-incompatible nulls in values and property names", () => {
    const result = sanitizePostgresJson({
      "bad\u0000key": "console\u0000message",
      nested: ["safe", "also\u0000unsafe"],
    });
    expect(result).toEqual({
      "bad\uFFFDkey": "console\uFFFDmessage",
      nested: ["safe", "also\uFFFDunsafe"],
    });
    expect(JSON.stringify(result)).not.toContain("\\u0000");
  });

  it("preserves valid surrogate pairs and replaces unpaired surrogates", () => {
    expect(sanitizePostgresJsonString("ok 😀 value")).toBe("ok 😀 value");
    expect(sanitizePostgresJsonString(`left ${String.fromCharCode(0xd800)} right`)).toBe("left � right");
    expect(sanitizePostgresJsonString(`left ${String.fromCharCode(0xdc00)} right`)).toBe("left � right");
  });

  it("keeps internal database details out of user-facing errors", () => {
    const error = Object.assign(new Error("Failed query: update technical_seo_scans params: private report"), {
      cause: Object.assign(new Error("unsupported Unicode escape sequence"), { code: "22P05" }),
    });
    expect(publicScanError(error).message).toBe("The scan could not be completed. Please retry. If this continues, contact support.");
    expect(diagnosticScanError(error)).toBe("22P05: unsupported Unicode escape sequence");
  });
});
