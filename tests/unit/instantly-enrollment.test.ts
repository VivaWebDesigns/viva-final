import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));
import { selectInstantlyCandidates, type InstantlyCandidateRow } from "../../server/features/instantly/enrollment";

function row(overrides: Partial<InstantlyCandidateRow>): InstantlyCandidateRow {
  return {
    leadId: "lead",
    reportId: "report",
    email: "owner@example.com",
    businessName: "Example Co",
    searchPhrase: "plumber near me",
    snapshotStorageKey: "local-visibility-snapshots/a.png",
    source: "local_falcon",
    reportEmailCount: 0,
    disposition: null,
    enrollmentStatus: null,
    ...overrides,
  };
}

describe("Instantly candidate selection", () => {
  it("keeps a fresh lead and normalizes its email", () => {
    const { eligible, excluded } = selectInstantlyCandidates([row({ email: " Owner@Example.com " })]);
    expect(eligible.map(item => item.email)).toEqual(["owner@example.com"]);
    expect(excluded).toEqual([]);
  });

  it.each([
    ["crm_only", { source: "local_falcon_crm_only" }],
    ["no_snapshot", { snapshotStorageKey: null }],
    ["no_email", { email: null }],
    ["already_emailed", { reportEmailCount: 1, disposition: "active" }],
    ["outreach_stopped", { disposition: "opted_out" }],
    ["already_enrolled", { enrollmentStatus: "enrolled" }],
  ] as const)("excludes %s leads", (reason, overrides) => {
    const { eligible, excluded } = selectInstantlyCandidates([row(overrides)]);
    expect(eligible).toEqual([]);
    expect(excluded[0].reason).toBe(reason);
  });

  it("re-stages a ready lead so its image can be refreshed", () => {
    expect(selectInstantlyCandidates([row({ enrollmentStatus: "ready" })]).eligible).toHaveLength(1);
  });

  it("keeps only the first lead for a shared email address", () => {
    const { eligible, excluded } = selectInstantlyCandidates([
      row({ leadId: "first" }),
      row({ leadId: "second", email: "OWNER@example.com" }),
    ]);
    expect(eligible.map(item => item.leadId)).toEqual(["first"]);
    expect(excluded).toEqual([{ leadId: "second", businessName: "Example Co", reason: "duplicate_email" }]);
  });
});
