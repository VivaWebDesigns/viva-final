import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn(), state: vi.fn() }));
vi.mock("../../server/db", () => ({ db: mocks }));
vi.mock("../../server/features/crm/reportOutreach", () => ({ getReportOutreachState: mocks.state }));
vi.mock("../../server/services/storage", () => ({
  getFileBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from("image") }),
  uploadPublishedReport: vi.fn().mockResolvedValue({ url: "https://reports.example.com/image.png" }),
}));
import { getScanReportEmailPreview, sendScanReportEmail } from "../../server/features/crm/scanReportEmail";

function rows(values: unknown[]) {
  const q: any = { then: (resolve: any) => Promise.resolve(values).then(resolve) };
  for (const name of ["from", "innerJoin", "leftJoin", "where", "limit", "for", "returning", "onConflictDoUpdate"]) q[name] = () => q;
  return q;
}
const record = { lead: { id: "lead-1", title: "Acme" }, company: { name: "Acme" }, contact: { firstName: "Ana", email: "ana@example.com" },
  report: { snapshotStorageKey: "image", companyName: "Acme", scanKeyword: "roofing" } };
const input = { leadId: "lead-1", reportId: "report-1", recipient: "ana@example.com", subject: "Report", preheader: "Your report",
  message: "Here is your report", imagePlacement: "after_intro" as const, requestId: "request-1", actorId: "rep-1", actorEmail: "rep@vivawebdesigns.com" };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.SCAN_REPORT_SHARE_SECRET = "unit-test-report-sharing-secret";
  mocks.select.mockReset();
  mocks.transaction.mockImplementation(async fn => fn(mocks));
  mocks.state.mockResolvedValue({ reportEmailCount: 0, reportOutreachDisposition: null });
  mocks.select.mockReturnValue(rows([]));
  mocks.insert.mockImplementation(table => ({ values: (value: any) => rows([{ id: getTableName(table), ...value }]) }));
  mocks.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue([]) }) });
});
function sendReads(pending: unknown[] = []) {
  mocks.select.mockReturnValueOnce(rows([record]))
    .mockReturnValueOnce(rows([])) // existing job before uploading
    .mockReturnValueOnce(rows([{ id: "lead-1" }])) // locked lead
    .mockReturnValueOnce(rows([])) // re-check idempotency under lock
    .mockReturnValueOnce(rows(pending));
}

describe("two-email report queue", () => {
  it("commits the delivery, note, and job in the same transaction", async () => {
    sendReads();
    const result = await sendScanReportEmail(input);
    expect(result.duplicate).toBe(false);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls.map(([table]) => getTableName(table))).toEqual(["scan_report_shares", "scan_report_deliveries", "crm_lead_notes", "workflow_jobs"]);
  });
  it("rejects a third email before reserving or queuing anything", async () => {
    sendReads();
    mocks.state.mockResolvedValue({ reportEmailCount: 2, reportOutreachDisposition: "active" });
    await expect(sendScanReportEmail(input)).rejects.toThrow("Both report emails");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("blocks a parallel send while another delivery is pending", async () => {
    sendReads([{ id: "pending-delivery" }]);
    await expect(sendScanReportEmail(input)).rejects.toThrow("already queued");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("returns an existing request without another job", async () => {
    mocks.select.mockReturnValueOnce(rows([record])).mockReturnValueOnce(rows([{ id: "old-job" }]));
    expect(await sendScanReportEmail(input)).toMatchObject({ duplicate: true, jobId: "old-job" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("provides a distinct follow-up draft for the second send", async () => {
    mocks.select.mockReturnValueOnce(rows([record]));
    mocks.state.mockResolvedValue({ reportEmailCount: 1, reportOutreachDisposition: "active" });
    const preview = await getScanReportEmailPreview("lead-1", "report-1", input.actorEmail);
    expect(preview.sentCount).toBe(1);
    expect(preview.message).toContain("Following up");
    expect(preview.message).toContain("same report");
    expect(preview.blockedReason).toBeNull();
  });
});
