/**
 * Profile Service — Hermetic Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Layer:       UNIT — no live database required.
 * Run with:    npm run test:unit
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Validates the business logic of the profile service in isolation:
 *   1. Not-found errors for all three entry points
 *   2. DTO always returns arrays (never null/undefined) even with empty data
 *   3. Derived field invariants: health, value, nextAction, timeline sort
 *   4. Entry-point routing: lead/opportunity paths resolve to the correct company
 *
 * The `server/db` module is mocked.  Each test sets up a deterministic call
 * sequence of DB responses using `setupDbResponses()`.  Tests are hermetic —
 * they do not depend on DB state and never open a network connection.
 *
 * For SQL correctness tests against a live database see:
 *   tests/integration/profiles-service.test.ts
 *
 * ── Mock call-sequence conventions ───────────────────────────────────────────
 * `setupDbResponses(r0, r1, …, rN)` enqueues responses for successive
 * `db.select()` calls.  The service makes queries in a fixed sequence
 * determined by the code path under test.  Each test's fixture comment
 * documents the expected call sequence.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock db BEFORE importing service (vi.mock is hoisted by vitest) ───────────

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));

vi.mock("../../server/db", () => ({ db: { select: mockSelect } }));

import {
  getProfileByCompanyId,
  getProfileByLeadId,
  getProfileByOpportunityId,
} from "../../server/features/profiles/service";
import {
  ProfileNotFoundError,
  ProfileLinkageError,
} from "../../server/features/profiles/errors";

// ── Error capture helper ──────────────────────────────────────────────────────
// Awaits a promise that is expected to reject and returns the thrown value.
// Fails the test if the promise unexpectedly resolves.

async function catchErr(fn: Promise<unknown>): Promise<unknown> {
  try {
    await fn;
    throw new Error("Expected promise to reject but it resolved");
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Expected promise to reject")) {
      throw e;
    }
    return e;
  }
}

// ── Mock chain builder ────────────────────────────────────────────────────────
// Creates a Drizzle-compatible fluent chain that resolves to `data`.
// Every chainable method returns `this` so the full ORM chain compiles.

function makeChain(data: unknown[]): any {
  const chain: Record<string, any> = {};
  for (const m of [
    "from", "where", "limit", "orderBy", "leftJoin",
    "rightJoin", "innerJoin", "groupBy", "returning",
  ]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: any) => any, reject: (e: any) => any) =>
    Promise.resolve(data).then(resolve, reject);
  chain.catch = (reject: (e: any) => any) => Promise.resolve(data).catch(reject);
  chain.finally = (cb: () => void) => Promise.resolve(data).finally(cb);
  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-01-15T12:00:00Z");

const companyIdRow = { id: "c1" } as const;

const companyRow = {
  id: "c1", name: "Acme Corp", dba: null, website: null, phone: null,
  email: null, address: null, city: null, state: null, zip: null,
  country: "US", industry: null, preferredLanguage: "en", notes: null,
  clientStatus: "active", accountOwnerId: null, nextFollowUpDate: null,
  preferredContactMethod: null, launchDate: null, renewalDate: null,
  websiteStatus: null, carePlanStatus: null, serviceTier: null,
  billingNotes: null, createdAt: NOW, updatedAt: NOW,
};

const leadIdRow = { id: "l1", companyId: "c1" } as const;
const leadRow = {
  id: "l1", title: "Lead A", companyId: "c1", contactId: null,
  statusId: null, value: "5000", source: "website", sourceLabel: null,
  utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null,
  utmContent: null, referrer: null, landingPage: null, formPageUrl: null,
  fromWebsiteForm: false, assignedTo: null, notes: null,
  city: null, state: null, timezone: null,
  createdAt: NOW, updatedAt: NOW,
};

const oppIdRow = { id: "o1", leadId: "l1", companyId: "c1" } as const;
const oppRow = {
  id: "o1", title: "Opp A", value: "12000", websitePackage: null,
  stageId: "s1", leadId: "l1", companyId: "c1", contactId: null,
  assignedTo: null, status: "open", expectedCloseDate: null, probability: 0,
  nextActionDate: null, followUpDate: null, stageEnteredAt: null,
  sourceLeadTitle: null, notes: null,
  createdAt: NOW, updatedAt: NOW,
};

const makeClientNote = (id: string, ts: Date) => ({
  id, companyId: "c1", type: "general", content: `note ${id}`,
  userId: null, isPinned: false, createdAt: ts,
});

const makeTask = (id: string, completed: boolean, dueDate: Date) => ({
  id, title: `Task ${id}`, notes: null, taskType: "follow_up",
  dueDate, completed, completedAt: completed ? NOW : null,
  assignedTo: null, opportunityId: null, leadId: null,
  contactId: null, companyId: "c1", createdBy: null,
  createdAt: NOW, followUpTime: null, followUpTimezone: null,
  outcome: null, completionNote: null,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupDbResponses(...responses: unknown[][]) {
  let i = 0;
  mockSelect.mockImplementation(() => makeChain(responses[i++] ?? []));
}

// Standard call sequence for a minimal company (no leads, opps, or tasks).
//
// Call sequence:
//   [0]  resolveByCompanyId:  crmCompanies where id=c1          → [companyIdRow]
//   [1]  resolveByCompanyId:  crmLeads where companyId=c1       → [] (no leads → no Q3)
//   [2]  assembleProfile:     crmCompanies where id=c1          → [companyRow]
//   [3]  assembleProfile:     crmContacts                       → []
//   [4]  assembleProfile:     crmLeads (orderBy desc)           → []
//   [5]  assembleProfile:     pipelineOpportunities             → []
//   [6]  assembleProfile:     onboardingRecords                 → []
//   [7]  assembleProfile:     followupTasks                     → []
//   [8]  assembleProfile:     stripeCustomers                   → []
//   [9]  assembleProfile:     attachments                       → []
//   [10] assembleProfile:     clientNotes                       → clientNoteOverride
//
// If clientNoteOverride is omitted it defaults to [] (no notes, no user lookup).
// No further queries fire because leadIds=[], oppIds=[], allUserIds=[], taskIds=[].
function minimalCompanyResponses(clientNoteOverride: unknown[] = []) {
  return setupDbResponses(
    [companyIdRow],  // [0] resolveByCompanyId — company check
    [],              // [1] resolveByCompanyId — lead check (none)
    [companyRow],    // [2] assembleProfile — company row
    [],              // [3] contacts
    [],              // [4] leads
    [],              // [5] opportunities
    [],              // [6] onboarding
    [],              // [7] tasks
    [],              // [8] stripe
    [],              // [9] files/attachments
    clientNoteOverride, // [10] clientNotes
  );
}

// Call sequence for a company that has one open opportunity (value "12000")
// and two tasks (one pending, one completed). No leads to keep it simple.
//
//   [0]  resolveByCompanyId: company check     → [companyIdRow]
//   [1]  resolveByCompanyId: lead check        → [] (no leads)
//   [2]  assembleProfile:    company row       → [companyRow]
//   [3]  contacts                              → []
//   [4]  leads (orderBy)                       → []
//   [5]  opportunities                         → [oppRow]
//   [6]  onboarding                            → []
//   [7]  tasks (companyId)                     → taskList
//   [8]  stripe                                → []
//   [9]  attachments                           → []
//   [10] clientNotes                           → []
//   —— leadIds=[] → no lead-note/lead-task queries ——
//   [11] pipelineActivities IN [oppId]        → []    (second Promise.all — opp tasks)
//   [12] followupTasks IN [oppId]             → []    (opp tasks)
//   — allUserIds=[] (no notes with userId) → no user query
//   [13] automationExecutionLogs IN taskIds   → []
function companyWithOppAndTasksResponses(taskList: unknown[]) {
  return setupDbResponses(
    [companyIdRow],  // [0]
    [],              // [1] no leads
    [companyRow],    // [2]
    [],              // [3] contacts
    [],              // [4] leads
    [oppRow],        // [5] opps
    [],              // [6] onboarding
    taskList,        // [7] tasks (companyId scope)
    [],              // [8] stripe
    [],              // [9] attachments
    [],              // [10] clientNotes
    [],              // [11] pipelineActivities IN [oppId]
    [],              // [12] followupTasks IN [oppId]
    [],              // [13] automationExecutionLogs
  );
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSelect.mockReset();
});

// ── Not-found errors ──────────────────────────────────────────────────────────

describe("not-found errors", () => {
  const MISSING = "00000000-0000-0000-0000-000000000000";

  it("getProfileByCompanyId throws ProfileNotFoundError (404) for unknown id", async () => {
    setupDbResponses([]); // resolveByCompanyId → company check returns nothing
    const err = await catchErr(getProfileByCompanyId(MISSING));
    expect(err).toBeInstanceOf(ProfileNotFoundError);
    expect((err as ProfileNotFoundError).statusCode).toBe(404);
    expect((err as ProfileNotFoundError).message).toMatch(/Company not found/);
    expect((err as ProfileNotFoundError).entity).toBe("Company");
    expect((err as ProfileNotFoundError).entityId).toBe(MISSING);
  });

  it("getProfileByLeadId throws ProfileNotFoundError (404) for unknown id", async () => {
    setupDbResponses([]); // resolveByLeadId → lead row returns nothing
    const err = await catchErr(getProfileByLeadId(MISSING));
    expect(err).toBeInstanceOf(ProfileNotFoundError);
    expect((err as ProfileNotFoundError).statusCode).toBe(404);
    expect((err as ProfileNotFoundError).message).toMatch(/Lead not found/);
    expect((err as ProfileNotFoundError).entity).toBe("Lead");
  });

  it("getProfileByOpportunityId throws ProfileNotFoundError (404) for unknown id", async () => {
    setupDbResponses([]); // resolveByOpportunityId → opp row returns nothing
    const err = await catchErr(getProfileByOpportunityId(MISSING));
    expect(err).toBeInstanceOf(ProfileNotFoundError);
    expect((err as ProfileNotFoundError).statusCode).toBe(404);
    expect((err as ProfileNotFoundError).message).toMatch(/Opportunity not found/);
    expect((err as ProfileNotFoundError).entity).toBe("Opportunity");
  });
});

// ── Always-arrays guarantee ───────────────────────────────────────────────────

describe("always-arrays guarantee", () => {
  it("all DTO array fields are [] not null or undefined when company has no related data", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(Array.isArray(profile.identity.contacts)).toBe(true);
    expect(Array.isArray(profile.sales.leadHistory)).toBe(true);
    expect(Array.isArray(profile.sales.opportunities)).toBe(true);
    expect(Array.isArray(profile.work.tasks)).toBe(true);
    expect(Array.isArray(profile.timeline.events)).toBe(true);
    expect(Array.isArray(profile.service.onboarding)).toBe(true);
    expect(Array.isArray(profile.service.files)).toBe(true);
  });

  it("all DTO sections are present", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(profile.identity).toBeDefined();
    expect(profile.sales).toBeDefined();
    expect(profile.work).toBeDefined();
    expect(profile.timeline).toBeDefined();
    expect(profile.service).toBeDefined();
    expect(profile.derived).toBeDefined();
  });

  it("identity.company has all required scalar fields", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(profile.identity.company).toHaveProperty("id", "c1");
    expect(profile.identity.company).toHaveProperty("name", "Acme Corp");
    expect(profile.identity.company).toHaveProperty("createdAt");
    expect(profile.identity.company).toHaveProperty("updatedAt");
  });

  it("service.billingSummary is always present with hasStripe boolean", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(profile.service.billingSummary).toBeDefined();
    expect(typeof profile.service.billingSummary!.hasStripe).toBe("boolean");
    expect(profile.service.billingSummary!.hasStripe).toBe(false);
  });
});

// ── Derived field invariants ──────────────────────────────────────────────────

describe("derived field invariants", () => {
  it("health is 'unknown' when there is no activity at all", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(profile.derived.health).toBe("unknown");
  });

  it("value is null when there are no open opportunities", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(profile.derived.value).toBeNull();
  });

  it("work.nextAction is null when there are no tasks", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(profile.work.nextAction).toBeNull();
  });

  it("health is a valid enum value", async () => {
    minimalCompanyResponses();
    const profile = await getProfileByCompanyId("c1");

    expect(["healthy", "at_risk", "stale", "unknown"]).toContain(profile.derived.health);
  });

  it("timeline events are sorted newest-first", async () => {
    const older = new Date("2026-01-10T08:00:00Z");
    const newer = new Date("2026-01-14T18:00:00Z");
    const oldest = new Date("2026-01-05T00:00:00Z");

    minimalCompanyResponses([
      makeClientNote("cn-a", newer),
      makeClientNote("cn-b", oldest),
      makeClientNote("cn-c", older),
    ]);

    const profile = await getProfileByCompanyId("c1");
    const events = profile.timeline.events;

    expect(events).toHaveLength(3);
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
        events[i].timestamp.getTime(),
      );
    }
  });

  it("timeline events have a source field", async () => {
    minimalCompanyResponses([makeClientNote("cn1", NOW)]);
    const profile = await getProfileByCompanyId("c1");

    expect(profile.timeline.events[0]).toHaveProperty("source");
    expect(profile.timeline.events[0].source).toBe("client_notes");
  });

  it("work.nextAction is the earliest pending task", async () => {
    const tomorrow = new Date(NOW.getTime() + 86400_000);
    const dayAfter = new Date(NOW.getTime() + 2 * 86400_000);
    const yesterday = new Date(NOW.getTime() - 86400_000);

    companyWithOppAndTasksResponses([
      makeTask("t-soon", false, tomorrow),
      makeTask("t-later", false, dayAfter),
      makeTask("t-done", true, yesterday),
    ]);

    const profile = await getProfileByCompanyId("c1");

    expect(profile.work.nextAction).not.toBeNull();
    expect(profile.work.nextAction!.id).toBe("t-soon");
    expect(profile.work.nextAction!.completed).toBe(false);
  });

  it("work.nextAction is null when all tasks are completed", async () => {
    const yesterday = new Date(NOW.getTime() - 86400_000);

    companyWithOppAndTasksResponses([
      makeTask("t-done", true, yesterday),
    ]);

    const profile = await getProfileByCompanyId("c1");

    expect(profile.work.nextAction).toBeNull();
  });

  it("derived.value sums only open opportunity values", async () => {
    // oppRow has value="12000" and status="open"
    companyWithOppAndTasksResponses([]);
    const profile = await getProfileByCompanyId("c1");

    expect(profile.derived.value).toBe(12000);
  });
});

// ── Entry-point routing ───────────────────────────────────────────────────────

describe("entry-point routing", () => {
  it("getProfileByLeadId resolves to the same company as getProfileByCompanyId", async () => {
    // ── getProfileByLeadId("l1") call sequence ──────────────────────────────
    // getProfileByLeadId calls resolveByLeadId then assembleProfile directly.
    // It does NOT call resolveByCompanyId.
    //
    //  resolveByLeadId:
    //   [0] crmLeads where id=l1              → [leadIdRow]  (lead found, companyId="c1")
    //   [1] pipelineOpportunities leadId=l1   → []           (no opp by this leadId)
    //  assembleProfile("c1", { primaryLeadId: "l1" }):
    //   [2] crmCompanies where id=c1          → [companyRow]  (FULL row, not just id)
    //   [3]  contacts                         → []
    //   [4]  leads (orderBy)                  → []
    //   [5]  opportunities                    → []
    //   [6]  onboarding                       → []
    //   [7]  tasks                            → []
    //   [8]  stripe                           → []
    //   [9]  attachments                      → []
    //   [10] clientNotes                      → []
    setupDbResponses(
      [leadIdRow],  // [0] resolveByLeadId — lead row
      [],           // [1] resolveByLeadId — opp by leadId
      [companyRow], // [2] assembleProfile — full company row
      [], [], [], [], [], [], [], [], // [3-10] empty sections
    );

    const profile = await getProfileByLeadId("l1");

    expect(profile.identity.company.id).toBe("c1");
    expect(profile.identity.company.name).toBe("Acme Corp");
  });

  it("getProfileByOpportunityId resolves to the same company as getProfileByCompanyId", async () => {
    // ── getProfileByOpportunityId("o1") call sequence ──────────────────────
    // getProfileByOpportunityId calls resolveByOpportunityId then assembleProfile
    // directly. It does NOT call resolveByCompanyId.
    //
    //  resolveByOpportunityId:
    //   [0] pipelineOpportunities where id=o1 → [oppIdRow]  (companyId="c1" set)
    //   (no secondary lead lookup — companyId is present on the opp row)
    //  assembleProfile("c1", { primaryOpportunityId: "o1" }):
    //   [1] crmCompanies where id=c1          → [companyRow]  (FULL row)
    //   [2]  contacts                         → []
    //   [3]  leads                            → []
    //   [4]  opportunities                    → []
    //   [5]  onboarding                       → []
    //   [6]  tasks                            → []
    //   [7]  stripe                           → []
    //   [8]  attachments                      → []
    //   [9]  clientNotes                      → []
    setupDbResponses(
      [oppIdRow],   // [0] resolveByOpportunityId — opp row
      [companyRow], // [1] assembleProfile — full company row
      [], [], [], [], [], [], [], [], // [2-9] empty sections
    );

    const profile = await getProfileByOpportunityId("o1");

    expect(profile.identity.company.id).toBe("c1");
    expect(profile.identity.company.name).toBe("Acme Corp");
  });

  it("getProfileByLeadId throws ProfileLinkageError (422) when lead has no companyId", async () => {
    // resolveByLeadId returns a lead row with companyId=null
    setupDbResponses(
      [{ id: "l-orphan", companyId: null }],  // lead has no company
      [],                                      // pipelineOpportunities
    );

    const err = await catchErr(getProfileByLeadId("l-orphan"));
    expect(err).toBeInstanceOf(ProfileLinkageError);
    expect((err as ProfileLinkageError).statusCode).toBe(422);
    expect((err as ProfileLinkageError).message).toMatch(/no linked company/);
  });

  it("getProfileByOpportunityId throws ProfileLinkageError (422) when opp has no companyId", async () => {
    // resolveByOpportunityId returns opp with companyId=null, leadId=null
    setupDbResponses(
      [{ id: "o-orphan", leadId: null, companyId: null }],  // opp has no company or lead
    );

    const err = await catchErr(getProfileByOpportunityId("o-orphan"));
    expect(err).toBeInstanceOf(ProfileLinkageError);
    expect((err as ProfileLinkageError).statusCode).toBe(422);
    expect((err as ProfileLinkageError).message).toMatch(/no linked company/);
  });
});
