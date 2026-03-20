import { describe, it, expect } from "vitest";
import {
  deriveHealth,
  resolveValue,
  resolvePrimaryContact,
  resolveNextAction,
  resolveLastActivityAt,
  mapCompany,
  mapContact,
  mapLead,
  mapOpportunity,
  mapTask,
  mapOnboarding,
  mapFile,
  mapLeadNoteToTimelineEvent,
  mapClientNoteToTimelineEvent,
  mapPipelineActivityToTimelineEvent,
} from "../../server/features/profiles/mappers";
import type { MappedContact, MappedOpportunity, MappedTask } from "../../server/features/profiles/dto";
import type { CrmLeadNote, PipelineActivity } from "../../shared/schema";

// ── deriveHealth ──────────────────────────────────────────────────────────────

describe("deriveHealth", () => {
  it("returns 'unknown' when lastActivityAt is null", () => {
    expect(deriveHealth(null)).toBe("unknown");
  });

  it("returns 'healthy' when activity was 5 days ago", () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(deriveHealth(date)).toBe("healthy");
  });

  it("returns 'at_risk' when activity was 20 days ago", () => {
    const date = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    expect(deriveHealth(date)).toBe("at_risk");
  });

  it("returns 'stale' when activity was 35 days ago", () => {
    const date = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    expect(deriveHealth(date)).toBe("stale");
  });

  it("returns 'healthy' for activity exactly today", () => {
    expect(deriveHealth(new Date())).toBe("healthy");
  });
});

// ── resolveValue ──────────────────────────────────────────────────────────────

const makeOpp = (status: "open" | "won" | "lost", value: string | null): MappedOpportunity =>
  ({
    id: "o1", title: "T", status, value,
    websitePackage: null, stageId: null, leadId: null, companyId: null,
    contactId: null, assignedTo: null, expectedCloseDate: null,
    nextActionDate: null, followUpDate: null, stageEnteredAt: null,
    sourceLeadTitle: null, createdAt: new Date(), updatedAt: new Date(),
  });

describe("resolveValue", () => {
  it("returns null for empty list", () => {
    expect(resolveValue([])).toBeNull();
  });

  it("returns null when no open opportunities", () => {
    expect(resolveValue([makeOpp("won", "5000")])).toBeNull();
  });

  it("sums value across open opportunities", () => {
    expect(resolveValue([makeOpp("open", "3000"), makeOpp("open", "2000")])).toBe(5000);
  });

  it("ignores closed opportunities in the sum", () => {
    expect(resolveValue([makeOpp("open", "3000"), makeOpp("lost", "9999")])).toBe(3000);
  });

  it("returns null when open opportunities have zero or null value", () => {
    expect(resolveValue([makeOpp("open", "0"), makeOpp("open", null)])).toBeNull();
  });
});

// ── resolvePrimaryContact ─────────────────────────────────────────────────────

const makeContact = (id: string, isPrimary: boolean): MappedContact =>
  ({
    id, isPrimary, firstName: "A", lastName: "B",
    companyId: null, email: null, phone: null, altPhone: null,
    title: null, preferredLanguage: null,
    createdAt: new Date(), updatedAt: new Date(),
  });

describe("resolvePrimaryContact", () => {
  it("returns null for empty list", () => {
    expect(resolvePrimaryContact([])).toBeNull();
  });

  it("returns first contact when none are primary", () => {
    const contacts = [makeContact("c1", false), makeContact("c2", false)];
    expect(resolvePrimaryContact(contacts)?.id).toBe("c1");
  });

  it("returns the primary contact when one exists", () => {
    const contacts = [makeContact("c1", false), makeContact("c2", true)];
    expect(resolvePrimaryContact(contacts)?.id).toBe("c2");
  });
});

// ── resolveNextAction ─────────────────────────────────────────────────────────

const makeTask = (id: string, completed: boolean, daysFromNow: number): MappedTask =>
  ({
    id, completed,
    dueDate: new Date(Date.now() + daysFromNow * 86400000),
    title: "T", notes: null, taskType: null, completedAt: null,
    assignedTo: null, opportunityId: null, leadId: null,
    contactId: null, companyId: null, createdBy: null, createdAt: new Date(),
  });

describe("resolveNextAction", () => {
  it("returns null when no tasks", () => {
    expect(resolveNextAction([])).toBeNull();
  });

  it("returns null when all tasks are completed", () => {
    expect(resolveNextAction([makeTask("t1", true, 1)])).toBeNull();
  });

  it("returns the earliest pending task", () => {
    const tasks = [makeTask("t3", false, 3), makeTask("t1", false, 1), makeTask("t2", false, 2)];
    expect(resolveNextAction(tasks)?.id).toBe("t1");
  });

  it("skips completed tasks when finding earliest pending", () => {
    const tasks = [makeTask("completed", true, 1), makeTask("pending", false, 5)];
    expect(resolveNextAction(tasks)?.id).toBe("pending");
  });
});

// ── resolveLastActivityAt ─────────────────────────────────────────────────────

const makeNote = (createdAt: Date): CrmLeadNote =>
  ({ id: "n1", leadId: "l1", type: "note", content: "", userId: null, createdAt, metadata: null } as unknown as CrmLeadNote);

const makeActivity = (createdAt: Date): PipelineActivity =>
  ({ id: "a1", opportunityId: "o1", type: "note", content: "", userId: null, createdAt, metadata: null } as unknown as PipelineActivity);

describe("resolveLastActivityAt", () => {
  it("returns null when no notes or activities", () => {
    expect(resolveLastActivityAt([], [], [])).toBeNull();
  });

  it("returns the most recent date across all three collections", () => {
    const older = new Date(Date.now() - 10 * 86400000);
    const newer = new Date(Date.now() - 1 * 86400000);
    const result = resolveLastActivityAt([makeNote(older)], [], [makeActivity(newer)]);
    expect(result?.getTime()).toBe(newer.getTime());
  });

  it("works when only lead notes are present", () => {
    const d = new Date(Date.now() - 5 * 86400000);
    expect(resolveLastActivityAt([makeNote(d)], [], [])?.getTime()).toBe(d.getTime());
  });
});

// ── Entity mappers ────────────────────────────────────────────────────────────

describe("mapCompany", () => {
  it("maps all required fields", () => {
    const row = {
      id: "c1", name: "Acme", dba: null, website: null, phone: null,
      email: null, address: null, city: null, state: null, zip: null,
      country: "US", industry: null, preferredLanguage: "es", notes: null,
      clientStatus: null, accountOwnerId: null, nextFollowUpDate: null,
      preferredContactMethod: null, launchDate: null, renewalDate: null,
      websiteStatus: null, carePlanStatus: null, serviceTier: null,
      billingNotes: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Parameters<typeof mapCompany>[0];
    const mapped = mapCompany(row);
    expect(mapped.id).toBe("c1");
    expect(mapped.name).toBe("Acme");
    expect(mapped.preferredLanguage).toBe("es");
  });
});

describe("mapContact", () => {
  it("maps all required fields including isPrimary", () => {
    const row = {
      id: "ct1", companyId: "c1", firstName: "Jane", lastName: "Doe",
      email: "jane@example.com", phone: null, altPhone: null, title: null,
      preferredLanguage: "en", isPrimary: true,
      createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Parameters<typeof mapContact>[0];
    const mapped = mapContact(row);
    expect(mapped.id).toBe("ct1");
    expect(mapped.isPrimary).toBe(true);
    expect(mapped.email).toBe("jane@example.com");
  });
});

describe("mapLead", () => {
  it("maps all required fields", () => {
    const row = {
      id: "l1", title: "Lead A", companyId: "c1", contactId: null,
      statusId: null, value: "5000", source: "website", sourceLabel: null,
      utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null,
      utmContent: null, referrer: null, landingPage: null, formPageUrl: null,
      fromWebsiteForm: false, assignedTo: null, notes: null,
      city: null, state: null, timezone: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Parameters<typeof mapLead>[0];
    const mapped = mapLead(row);
    expect(mapped.id).toBe("l1");
    expect(mapped.value).toBe("5000");
    expect(mapped.fromWebsiteForm).toBe(false);
  });
});

describe("mapOpportunity", () => {
  it("maps status and value correctly", () => {
    const row = {
      id: "o1", title: "Opp A", value: "12000", websitePackage: "domina",
      stageId: "s1", leadId: "l1", companyId: "c1", contactId: null,
      assignedTo: null, status: "open", expectedCloseDate: null,
      nextActionDate: null, followUpDate: null, stageEnteredAt: null,
      probability: 0, sourceLeadTitle: null, notes: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Parameters<typeof mapOpportunity>[0];
    const mapped = mapOpportunity(row);
    expect(mapped.status).toBe("open");
    expect(mapped.value).toBe("12000");
    expect(mapped.websitePackage).toBe("domina");
  });
});

describe("mapTask", () => {
  it("maps completed and dueDate correctly", () => {
    const due = new Date(Date.now() + 86400000);
    const row = {
      id: "t1", title: "Follow up", notes: null, taskType: "follow_up",
      dueDate: due, completed: false, completedAt: null, assignedTo: null,
      opportunityId: "o1", leadId: null, contactId: null, companyId: null,
      createdBy: null, createdAt: new Date(), followUpTime: null,
      followUpTimezone: null, outcome: null, completionNote: null,
    } as unknown as Parameters<typeof mapTask>[0];
    const mapped = mapTask(row);
    expect(mapped.completed).toBe(false);
    expect(mapped.dueDate.getTime()).toBe(due.getTime());
  });
});

describe("mapOnboarding", () => {
  it("maps status and client name", () => {
    const row = {
      id: "ob1", clientName: "Acme Corp", status: "in_progress",
      opportunityId: "o1", companyId: "c1", contactId: null, assignedTo: null,
      templateId: null, kickoffDate: null, dueDate: null, completedAt: null,
      notes: null, createdAt: new Date(), updatedAt: new Date(),
    } as unknown as Parameters<typeof mapOnboarding>[0];
    const mapped = mapOnboarding(row);
    expect(mapped.clientName).toBe("Acme Corp");
    expect(mapped.status).toBe("in_progress");
  });
});

describe("mapFile", () => {
  it("maps url and mimeType", () => {
    const row = {
      id: "f1", key: "uploads/f1.pdf", url: "https://cdn/f1.pdf",
      originalName: "contract.pdf", mimeType: "application/pdf",
      sizeBytes: 12345, uploaderUserId: null, entityType: "company",
      entityId: "c1", createdAt: new Date(),
    } as unknown as Parameters<typeof mapFile>[0];
    const mapped = mapFile(row);
    expect(mapped.url).toBe("https://cdn/f1.pdf");
    expect(mapped.mimeType).toBe("application/pdf");
  });
});

// ── Timeline event mappers ────────────────────────────────────────────────────

const emptyActorMap = new Map<string, string>();

describe("mapLeadNoteToTimelineEvent", () => {
  it("maps a lead note with source=crm_lead_notes", () => {
    const ts = new Date();
    const note = makeNote(ts);
    const event = mapLeadNoteToTimelineEvent({ ...note, id: "n42" }, emptyActorMap);
    expect(event.id).toBe("n42");
    expect(event.source).toBe("crm_lead_notes");
    expect(event.timestamp).toBe(ts);
    expect(event.actor).toBeNull();
  });

  it("resolves actor name from actorMap", () => {
    const note = { ...makeNote(new Date()), userId: "u1" } as unknown as CrmLeadNote;
    const actorMap = new Map([["u1", "Alice"]]);
    const event = mapLeadNoteToTimelineEvent(note, actorMap);
    expect(event.actor).toBe("Alice");
  });
});

describe("mapClientNoteToTimelineEvent", () => {
  it("maps a client note with source=client_notes", () => {
    const ts = new Date();
    const note = {
      id: "cn1", companyId: "c1", type: "general", content: "hello",
      userId: null, isPinned: false, createdAt: ts,
    } as unknown as import("@shared/schema").ClientNote;
    const event = mapClientNoteToTimelineEvent(note, emptyActorMap);
    expect(event.id).toBe("cn1");
    expect(event.source).toBe("client_notes");
    expect(event.timestamp).toBe(ts);
    expect(event.actor).toBeNull();
  });
});

describe("mapPipelineActivityToTimelineEvent", () => {
  it("maps a pipeline activity with source=pipeline_activities", () => {
    const ts = new Date();
    const activity = makeActivity(ts);
    const event = mapPipelineActivityToTimelineEvent({ ...activity, id: "a99", opportunityId: "o42" }, emptyActorMap);
    expect(event.id).toBe("a99");
    expect(event.source).toBe("pipeline_activities");
    expect(event.timestamp).toBe(ts);
    expect(event.actor).toBeNull();
  });
});
