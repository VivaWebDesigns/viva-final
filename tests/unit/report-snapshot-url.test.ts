import { describe, expect, it } from "vitest";
import { reportSnapshotFileUrl } from "@/features/local-visibility-report/snapshotUrl";

describe("report snapshot file URL", () => {
  it("changes when the snapshot is regenerated so browsers fetch the new picture", () => {
    const before = reportSnapshotFileUrl("r1", "c1", "2026-10-06T17:22:50.000Z");
    const after = reportSnapshotFileUrl("r1", "c1", "2026-10-06T22:12:10.000Z");
    expect(before).toBe("/api/local-visibility/reports/r1/snapshot-file?contextCompanyId=c1&v=2026-10-06T17%3A22%3A50.000Z");
    expect(after).not.toBe(before);
  });

  it("omits the version when the report has no snapshot time", () => {
    expect(reportSnapshotFileUrl("r1", "c1", null)).toBe("/api/local-visibility/reports/r1/snapshot-file?contextCompanyId=c1");
  });
});
