import { describe, it, expect } from "vitest";
import {
  deriveHealth,
  resolveValue,
  resolvePrimaryContact,
  resolveNextAction,
  resolveLastActivityAt,
  mapLeadNoteToTimelineEvent,
  mapPipelineActivityToTimelineEvent,
} from "../../server/features/profiles/mappers";
import type { CrmContact, PipelineOpportunity, FollowupTask, CrmLeadNote, PipelineActivity } from "../../shared/schema";

// ── deriveHealth ──────────────────────────────────────────────────────

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

// ── resolveValue ──────────────────────────────────────────────────────

const makeOpp = (status: "open" | "won" | "lost", value: string | null): PipelineOpportunity =>
  ({ id: "o1", title: "T", status, value } as unknown as PipelineOpportunity);

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

// ── resolvePrimaryContact ─────────────────────────────────────────────

const makeContact = (id: string, isPrimary: boolean): CrmContact =>
  ({ id, isPrimary, firstName: "A", lastName: "B" } as unknown as CrmContact);

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

// ── resolveNextAction ─────────────────────────────────────────────────

const makeTask = (id: string, completed: boolean, daysFromNow: number): FollowupTask =>
  ({
    id,
    completed,
    dueDate: new Date(Date.now() + daysFromNow * 86400000),
    title: "T",
  } as unknown as FollowupTask);

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

// ── resolveLastActivityAt ─────────────────────────────────────────────

const makeNote = (createdAt: Date): CrmLeadNote =>
  ({ id: "n1", leadId: "l1", type: "note", content: "", userId: null, createdAt, metadata: null } as unknown as CrmLeadNote);

const makeActivity = (createdAt: Date): PipelineActivity =>
  ({ id: "a1", opportunityId: "o1", type: "note", content: "", userId: null, createdAt, metadata: null } as unknown as PipelineActivity);

describe("resolveLastActivityAt", () => {
  it("returns null when no notes or activities", () => {
    expect(resolveLastActivityAt([], [])).toBeNull();
  });

  it("returns the most recent date across both collections", () => {
    const older = new Date(Date.now() - 10 * 86400000);
    const newer = new Date(Date.now() - 1 * 86400000);
    const result = resolveLastActivityAt([makeNote(older)], [makeActivity(newer)]);
    expect(result?.getTime()).toBe(newer.getTime());
  });

  it("works when only lead notes are present", () => {
    const d = new Date(Date.now() - 5 * 86400000);
    expect(resolveLastActivityAt([makeNote(d)], [])?.getTime()).toBe(d.getTime());
  });
});

// ── mapLeadNoteToTimelineEvent ────────────────────────────────────────

describe("mapLeadNoteToTimelineEvent", () => {
  it("maps a lead note to a timeline event with entityType=lead", () => {
    const note = makeNote(new Date());
    const event = mapLeadNoteToTimelineEvent({ ...note, id: "n42", leadId: "l99" });
    expect(event.entityType).toBe("lead");
    expect(event.entityId).toBe("l99");
    expect(event.id).toBe("n42");
  });

  it("maps metadata field correctly", () => {
    const note = { ...makeNote(new Date()), metadata: { foo: "bar" } } as unknown as CrmLeadNote;
    const event = mapLeadNoteToTimelineEvent(note);
    expect(event.metadata).toEqual({ foo: "bar" });
  });
});

// ── mapPipelineActivityToTimelineEvent ────────────────────────────────

describe("mapPipelineActivityToTimelineEvent", () => {
  it("maps a pipeline activity to a timeline event with entityType=opportunity", () => {
    const activity = makeActivity(new Date());
    const event = mapPipelineActivityToTimelineEvent({ ...activity, id: "a99", opportunityId: "o42" });
    expect(event.entityType).toBe("opportunity");
    expect(event.entityId).toBe("o42");
    expect(event.id).toBe("a99");
  });
});
