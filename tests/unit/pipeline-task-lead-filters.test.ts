import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock("../../server/db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return { db: drizzle({ query } as any) };
});

import { getOpportunities } from "../../server/features/pipeline/storage";
import { getTasksDueToday } from "../../server/features/tasks/storage";

describe("Pipeline and Task shared lead filters", () => {
  beforeEach(() => query.mockClear());

  it("filters the full opportunity query by outreach and every selected tag", async () => {
    await getOpportunities({ reportOutreach: "needs_attention", tagIds: ["tag-a", "tag-b"] });

    expect(query).toHaveBeenCalledTimes(2);
    for (const [config] of query.mock.calls as any[]) {
      expect(config.text).toContain("scan_report_deliveries");
      expect(config.text).toContain("report_email_followup");
      expect(config.text.match(/crm_lead_tags/g)).toHaveLength(2);
    }
  });

  it("filters tasks through either their direct lead or opportunity-linked lead", async () => {
    await getTasksDueToday(undefined, { reportOutreach: "one_sent", tagIds: ["tag-a"] });

    const [config] = query.mock.calls[0] as any[];
    expect(config.text).toContain("followup_tasks");
    expect(config.text).toContain("pipeline_opportunities");
    expect(config.text).toContain("crm_leads");
    expect(config.text).toContain("crm_lead_tags");
    expect(config.text).toContain("scan_report_deliveries");
  });
});
