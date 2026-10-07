import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".ts", ".tsx"]);

function collectTextFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return collectTextFiles(path);
    return TEXT_EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

describe("public website phone number", () => {
  it("uses the current Viva number everywhere", () => {
    const root = process.cwd();
    const files = [
      ...collectTextFiles(join(root, "client", "public")),
      ...collectTextFiles(join(root, "client", "src")),
      join(root, "server", "public-scan-report.ts"),
    ];

    const legacyReferences = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ file: relative(root, file), line: index + 1, text: line.trim() }))
        // CRM SMS templates intentionally keep the 704 number; only website copy must change.
        .filter(({ text }) => /704\D{0,15}222\D{0,15}7067/.test(text) && !text.startsWith("closingSms:")),
    );
    const websiteSource = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(legacyReferences).toEqual([]);
    expect(websiteSource).toContain("(980) 475-4924");
    expect(websiteSource).toContain("tel:+19804754924");
  });
});
