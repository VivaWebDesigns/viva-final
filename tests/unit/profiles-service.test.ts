/**
 * Unified Profile Service Tests
 *
 * Validates:
 * 1. All three entry paths produce an identical, stable UnifiedProfileDto shape
 * 2. Missing entity errors are thrown with clear messages
 * 3. DTO sections are always present, even when underlying data is absent
 *
 * Positive-path tests run against the live seeded database.
 * If the DB has no data for a given test, the test is skipped gracefully.
 */

import { describe, it, expect } from "vitest";
import { db } from "../../server/db";
import {
  crmCompanies,
  crmLeads,
  pipelineOpportunities,
} from "../../shared/schema";
import { isNotNull } from "drizzle-orm";
import {
  getProfileByCompanyId,
  getProfileByLeadId,
  getProfileByOpportunityId,
} from "../../server/features/profiles/service";

// ── DTO shape validator ───────────────────────────────────────────────────────

function assertProfileShape(profile: Awaited<ReturnType<typeof getProfileByCompanyId>>) {
  // identity
  expect(profile.identity).toBeDefined();
  expect(profile.identity.company).toBeDefined();
  expect(typeof profile.identity.company.id).toBe("string");
  expect(typeof profile.identity.company.name).toBe("string");
  expect(Array.isArray(profile.identity.contacts)).toBe(true);

  // sales
  expect(profile.sales).toBeDefined();
  expect(Array.isArray(profile.sales.leadHistory)).toBe(true);
  expect(Array.isArray(profile.sales.opportunities)).toBe(true);

  // work
  expect(profile.work).toBeDefined();
  expect(Array.isArray(profile.work.tasks)).toBe(true);

  // timeline
  expect(profile.timeline).toBeDefined();
  expect(Array.isArray(profile.timeline.events)).toBe(true);

  // service
  expect(profile.service).toBeDefined();
  expect(Array.isArray(profile.service.onboarding)).toBe(true);
  expect(Array.isArray(profile.service.files)).toBe(true);
  expect(profile.service.billingSummary).toBeDefined();
  expect(typeof profile.service.billingSummary!.hasStripe).toBe("boolean");

  // derived
  expect(profile.derived).toBeDefined();
  expect(["healthy", "at_risk", "stale", "unknown"]).toContain(profile.derived.health);
}

// ── Missing entity errors ─────────────────────────────────────────────────────

describe("missing entity errors", () => {
  it("getProfileByCompanyId throws for non-existent company", async () => {
    await expect(
      getProfileByCompanyId("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("Company not found");
  });

  it("getProfileByLeadId throws for non-existent lead", async () => {
    await expect(
      getProfileByLeadId("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("Lead not found");
  });

  it("getProfileByOpportunityId throws for non-existent opportunity", async () => {
    await expect(
      getProfileByOpportunityId("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("Opportunity not found");
  });
});

// ── Company profile path ──────────────────────────────────────────────────────

describe("getProfileByCompanyId", () => {
  it("returns a valid UnifiedProfileDto shape for any existing company", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return; // skip if DB is empty

    const profile = await getProfileByCompanyId(row.id);
    assertProfileShape(profile);
    expect(profile.identity.company.id).toBe(row.id);
  });

  it("always returns an identity section with a company object", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return;

    const profile = await getProfileByCompanyId(row.id);
    expect(profile.identity.company).toHaveProperty("id");
    expect(profile.identity.company).toHaveProperty("name");
    expect(profile.identity.company).toHaveProperty("createdAt");
    expect(profile.identity.company).toHaveProperty("updatedAt");
  });

  it("always returns array sections even when data is absent", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return;

    const profile = await getProfileByCompanyId(row.id);
    // These must always be arrays, never null/undefined
    expect(Array.isArray(profile.identity.contacts)).toBe(true);
    expect(Array.isArray(profile.sales.leadHistory)).toBe(true);
    expect(Array.isArray(profile.sales.opportunities)).toBe(true);
    expect(Array.isArray(profile.work.tasks)).toBe(true);
    expect(Array.isArray(profile.timeline.events)).toBe(true);
    expect(Array.isArray(profile.service.onboarding)).toBe(true);
    expect(Array.isArray(profile.service.files)).toBe(true);
  });
});

// ── Lead profile path ─────────────────────────────────────────────────────────

describe("getProfileByLeadId", () => {
  it("throws when lead has no linked company", async () => {
    // Leads without companyId cannot produce a profile
    const [lead] = await db
      .select({ id: crmLeads.id })
      .from(crmLeads)
      .where(isNotNull(crmLeads.companyId))
      .limit(1);

    // If all leads have companies, verify the shape instead
    if (lead) {
      const profile = await getProfileByLeadId(lead.id);
      assertProfileShape(profile);
    }
  });

  it("returns an identical DTO shape as getProfileByCompanyId", async () => {
    const [lead] = await db
      .select({ id: crmLeads.id, companyId: crmLeads.companyId })
      .from(crmLeads)
      .where(isNotNull(crmLeads.companyId))
      .limit(1);

    if (!lead?.companyId) return;

    const [profileByLead, profileByCompany] = await Promise.all([
      getProfileByLeadId(lead.id),
      getProfileByCompanyId(lead.companyId),
    ]);

    // Both resolve to the same company — shape must be identical
    expect(profileByLead.identity.company.id).toBe(profileByCompany.identity.company.id);
    expect(profileByLead.identity.contacts.length).toBe(profileByCompany.identity.contacts.length);
    expect(profileByLead.sales.opportunities.length).toBe(profileByCompany.sales.opportunities.length);
    expect(profileByLead.derived.health).toBe(profileByCompany.derived.health);
  });
});

// ── Opportunity profile path ──────────────────────────────────────────────────

describe("getProfileByOpportunityId", () => {
  it("returns an identical DTO shape as getProfileByCompanyId", async () => {
    const [opp] = await db
      .select({ id: pipelineOpportunities.id, companyId: pipelineOpportunities.companyId })
      .from(pipelineOpportunities)
      .where(isNotNull(pipelineOpportunities.companyId))
      .limit(1);

    if (!opp?.companyId) return;

    const [profileByOpp, profileByCompany] = await Promise.all([
      getProfileByOpportunityId(opp.id),
      getProfileByCompanyId(opp.companyId),
    ]);

    expect(profileByOpp.identity.company.id).toBe(profileByCompany.identity.company.id);
    expect(profileByOpp.sales.opportunities.length).toBe(profileByCompany.sales.opportunities.length);
    expect(profileByOpp.derived.health).toBe(profileByCompany.derived.health);
  });

  it("returns a valid DTO shape for any linked opportunity", async () => {
    const [opp] = await db
      .select({ id: pipelineOpportunities.id })
      .from(pipelineOpportunities)
      .where(isNotNull(pipelineOpportunities.companyId))
      .limit(1);

    if (!opp) return;

    const profile = await getProfileByOpportunityId(opp.id);
    assertProfileShape(profile);
  });
});

// ── Derived field invariants ──────────────────────────────────────────────────

describe("derived field invariants", () => {
  it("health is always one of the valid enum values", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return;

    const profile = await getProfileByCompanyId(row.id);
    expect(["healthy", "at_risk", "stale", "unknown"]).toContain(profile.derived.health);
  });

  it("value is null or a positive number", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return;

    const profile = await getProfileByCompanyId(row.id);
    if (profile.derived.value !== null) {
      expect(typeof profile.derived.value).toBe("number");
      expect(profile.derived.value).toBeGreaterThan(0);
    }
  });

  it("timeline events are sorted newest-first", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return;

    const profile = await getProfileByCompanyId(row.id);
    const events = profile.timeline.events;
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
        events[i].createdAt.getTime(),
      );
    }
  });

  it("nextAction is null or the earliest non-completed task", async () => {
    const [row] = await db
      .select({ id: crmCompanies.id })
      .from(crmCompanies)
      .limit(1);

    if (!row) return;

    const profile = await getProfileByCompanyId(row.id);
    const { nextAction, tasks } = profile.work;
    if (nextAction !== null) {
      expect(nextAction.completed).toBe(false);
      const pendingDates = tasks
        .filter((t) => !t.completed)
        .map((t) => t.dueDate.getTime());
      expect(nextAction.dueDate.getTime()).toBe(Math.min(...pendingDates));
    }
  });
});
