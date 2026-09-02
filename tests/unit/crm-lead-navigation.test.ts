import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../server/db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return { db: drizzle({ query } as any) };
});

import { getLeadNavigation } from "../../server/features/crm/storage";

describe("CRM lead navigation", () => {
  beforeEach(() => query.mockReset());

  it("returns adjacent leads from the same deterministic filtered order", async () => {
    query.mockResolvedValue({
      rows: [["lead-2", "lead-1", "Previous lead", "lead-3", "Next lead"]],
    });

    const result = await getLeadNavigation("lead-2", {
      search: "roofing",
      source: "local_falcon",
      statusId: "new",
      tagIds: ["email-ready"],
      assignedTo: "rep-1",
    });

    expect(result).toEqual({
      previous: { id: "lead-1", title: "Previous lead" },
      next: { id: "lead-3", title: "Next lead" },
    });

    const [config, params] = query.mock.calls[0] as any[];
    expect(config.text).toContain("lag(");
    expect(config.text).toContain("lead(");
    expect(config.text).toContain('order by "crm_leads"."created_at" desc, "crm_leads"."id" desc');
    expect(params).toEqual(expect.arrayContaining([
      "%roofing%", "local_falcon", "new", "email-ready", "rep-1", "lead-2",
    ]));
  });

  it("returns undefined when the current lead is outside the filtered results", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(getLeadNavigation("missing", { source: "manual" })).resolves.toBeUndefined();
  });
});
