import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), insertValues: vi.fn(), update: vi.fn(), transaction: vi.fn(), state: vi.fn(), record: vi.fn(),
}));

vi.mock("../../server/db", () => ({ db: mocks }));
vi.mock("../../server/features/crm/reportOutreach", () => ({
  getReportOutreachState: mocks.state,
  recordReportEmailSent: mocks.record,
}));
vi.mock("../../server/services/storage", () => ({
  getFileBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from("image") }),
  uploadPublishedReport: vi.fn().mockResolvedValue({ url: "https://reports.example.com/image.png" }),
}));

import {
  confirmManualScanReportEmail,
  getScanReportEmailPreview,
  prepareManualScanReportEmail,
} from "../../server/features/crm/scanReportEmail";

function rows(values: unknown[]) {
  const q: any = { then: (resolve: any) => Promise.resolve(values).then(resolve) };
  for (const name of ["from", "innerJoin", "leftJoin", "where", "limit", "for", "returning", "onConflictDoUpdate"]) q[name] = () => q;
  return q;
}

const record = {
  lead: { id: "lead-1", title: "Acme" },
  company: { name: "Acme" },
  contact: { firstName: "Ana", email: "ana@example.com" },
  report: { snapshotStorageKey: "image", companyName: "Acme", scanKeyword: "roofing" },
};
const input = {
  leadId: "lead-1", reportId: "report-1", recipient: "ana@example.com", subject: "Report", preheader: "Your report",
  message: "Here is your report", templateKey: "A", imagePlacement: "after_intro" as const, requestId: "request-1",
  actorId: "rep-1", actorEmail: "rep@vivawebdesigns.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SCAN_REPORT_SHARE_SECRET = "unit-test-report-sharing-secret";
  mocks.select.mockReset();
  mocks.transaction.mockImplementation(async fn => fn(mocks));
  mocks.state.mockResolvedValue({ reportEmailCount: 0, reportOutreachDisposition: null });
  mocks.record.mockResolvedValue(undefined);
  mocks.select.mockReturnValue(rows([]));
  mocks.insert.mockImplementation(table => ({ values: (value: any) => {
    mocks.insertValues(table, value);
    return rows([{ id: getTableName(table), ...value }]);
  } }));
  mocks.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue([]) }) });
});

describe("manual Gmail report workflow", () => {
  it("prepares Gmail and publishes the report without counting a send", async () => {
    mocks.select.mockReturnValueOnce(rows([record]));
    const result = await prepareManualScanReportEmail(input);
    expect(result.gmailComposeUrl).toContain("mail.google.com/mail/");
    expect(result.gmailComposeUrl).not.toContain("body=");
    expect(result.formattedHtml).toContain(">View the full report here</a>");
    expect(result.landingUrl).toContain("/scan-report/");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.insert.mock.calls.map(([table]) => getTableName(table))).toEqual(["scan_report_shares"]);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("records a send only after explicit confirmation", async () => {
    mocks.select
      .mockReturnValueOnce(rows([record]))
      .mockReturnValueOnce(rows([]))
      .mockReturnValueOnce(rows([{ id: "lead-1" }]))
      .mockReturnValueOnce(rows([]));
    const result = await confirmManualScanReportEmail(input);
    expect(result.duplicate).toBe(false);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls.map(([table]) => getTableName(table))).toEqual([
      "scan_report_shares", "scan_report_deliveries", "crm_lead_notes",
    ]);
    const deliveryValues = mocks.insertValues.mock.calls.find(([table]) => getTableName(table) === "scan_report_deliveries")?.[1];
    expect(deliveryValues).toMatchObject({
      templateKey: "A",
      emailSubject: "Report",
      emailPreheader: "Your report",
      emailMessage: "Here is your report",
      imagePlacement: "after_intro",
    });
    expect(mocks.record).toHaveBeenCalledWith("scan_report_deliveries");
  });

  it("treats a repeated confirmation as the same send", async () => {
    mocks.select
      .mockReturnValueOnce(rows([record]))
      .mockReturnValueOnce(rows([{ id: "delivery-old", noteId: "note-old" }]));
    await expect(confirmManualScanReportEmail(input)).resolves.toMatchObject({ duplicate: true, deliveryId: "delivery-old" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith("delivery-old");
  });

  it("rejects a third email before preparing anything", async () => {
    mocks.select.mockReturnValueOnce(rows([record]));
    mocks.state.mockResolvedValue({ reportEmailCount: 2, reportOutreachDisposition: "active" });
    await expect(prepareManualScanReportEmail(input)).rejects.toThrow("Both report emails");
    expect(mocks.insert).not.toHaveBeenCalled();
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

  it("includes the scanned search phrase in the initial outreach draft", async () => {
    mocks.select.mockReturnValueOnce(rows([record]));
    const preview = await getScanReportEmailPreview("lead-1", "report-1", input.actorEmail);
    expect(preview.message).toContain(
      "I came across Acme and ran a scan to see how the company appears on Google when people nearby search for “roofing”.",
    );
    expect(preview.selectedTemplateKey).toBe("A");
    expect(preview.templates).toEqual([expect.objectContaining({ key: "A", name: "Current outreach" })]);
    expect(preview.message).toContain("the scan above gives you a pretty good idea");
    expect(preview.message).toContain("If this looks like something worth fixing, everything’s below. Take a look.");
    expect(preview.message).toContain("You’ll see a few local companies we’ve turned around from maps that looked a lot like yours");
    expect(preview.message).not.toContain("the scan below");
    expect(preview.message).not.toContain("Just reply here");
  });
});
