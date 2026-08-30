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
        .filter(({ text }) => /980\D{0,15}475\D{0,15}4924/.test(text)),
    );
    const websiteSource = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(legacyReferences).toEqual([]);
    expect(websiteSource).toContain("(704) 222-7067");
    expect(websiteSource).toContain("tel:+17042227067");
  });
});
