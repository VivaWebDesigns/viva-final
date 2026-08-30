import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock("../../server/db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return { db: drizzle({ query } as any) };
});

import { getLeads } from "../../server/features/crm/storage";

describe("CRM lead tag filters", () => {
  beforeEach(() => query.mockClear());

  it("requires both tags in the results and count queries, alongside other filters", async () => {
    await getLeads({ tagIds: ["sab", "ready"], source: "local_falcon", statusId: "new", assignedTo: "rep", page: 2, limit: 100 });
    expect(query).toHaveBeenCalledTimes(2);
    for (const [config, params] of query.mock.calls as any[]) {
      expect(config.text.match(/"crm_lead_tags"\."tag_id" =/g)).toHaveLength(2);
      expect(config.text).toContain(') and "crm_leads"."id" in (');
      expect(params).toEqual(expect.arrayContaining(["sab", "ready", "local_falcon", "new", "rep"]));
    }
    const resultsQuery = (query.mock.calls as any[]).find(([config]) => config.text.includes("order by"));
    expect(resultsQuery[1].slice(-2)).toEqual([100, 100]);
  });

  it("preserves legacy tagId and deduplicates repeated selections", async () => {
    await getLeads({ tagId: "sab", tagIds: ["sab", "ready", "ready"] });
    for (const [config, params] of query.mock.calls as any[]) {
      expect(config.text.match(/"crm_lead_tags"\."tag_id" =/g)).toHaveLength(2);
      expect(params.filter((value: string) => value === "sab")).toHaveLength(1);
      expect(params.filter((value: string) => value === "ready")).toHaveLength(1);
    }
  });

  it("leaves the query unfiltered when selections are cleared", async () => {
    await getLeads({ tagIds: [] });
    for (const [config] of query.mock.calls as any[]) expect(config.text).not.toContain("crm_lead_tags");
  });
});
