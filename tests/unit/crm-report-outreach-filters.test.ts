import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock("../../server/db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return { db: drizzle({ query } as any) };
});
import { getLeads } from "../../server/features/crm/storage";
import type { ReportOutreachFilter } from "@shared/reportOutreach";

describe("CRM report outreach filters", () => {
  beforeEach(() => query.mockClear());

  it.each([
    ["one_sent", "count(*)", "= 1"],
    ["two_sent", "count(*)", ">= 2"],
    ["engaged", "view_count > 0", "cta_click_count > 0"],
    ["awaiting_response", "report_email_review", "NOT EXISTS"],
    ["no_engagement", "no_response", "report_email_review"],
    ["stopped", "opted_out", "not_interested"],
  ] as const)("builds the %s query against the full lead result set", async (filter, first, second) => {
    await getLeads({ reportOutreach: filter as ReportOutreachFilter, limit: 100 });
    expect(query).toHaveBeenCalledTimes(2);
    for (const [config] of query.mock.calls as any[]) {
      expect(config.text).toContain(first);
      expect(config.text).toContain(second);
    }
  });

  it("prioritizes engaged leads in Needs attention", async () => {
    await getLeads({ reportOutreach: "needs_attention" });
    const results = (query.mock.calls as any[]).find(([config]) => config.text.includes("order by"));
    expect(results[0].text).toContain("CASE WHEN EXISTS");
    expect(results[0].text).toContain("report_email_followup");
    expect(results[0].text).toContain("America/New_York");
  });
});
