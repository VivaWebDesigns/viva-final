import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync("server/features/technical-seo/routes.ts", "utf8");
const repository = readFileSync("server/features/technical-seo/repository.ts", "utf8");
const page = readFileSync("client/src/features/technical-seo/TechnicalSeoScannerPage.tsx", "utf8");

describe("technical SEO company history deletion", () => {
  it("exposes grouped history and a company-wide delete endpoint", () => {
    expect(routes).toContain('router.get("/scan-companies"');
    expect(routes).toContain('router.delete("/scan-companies"');
    expect(repository).toContain("deleteCompanyScans");
    expect(repository).toContain("tx.delete(technicalSeoScans)");
  });

  it("requires a destructive confirmation that names all stored report data", () => {
    expect(page).toContain("Delete all history for");
    expect(page).toContain("stored scans, technical evidence, results, and generated report data");
    expect(page).toContain("This cannot be undone");
  });
});
