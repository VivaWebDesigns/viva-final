import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), gmailSend: vi.fn(), select: vi.fn(), update: vi.fn(), record: vi.fn(), state: vi.fn() }));
vi.mock("../../server/db", () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("../../server/features/crm/gmailSender", () => ({ sendScanReportWithGmail: mocks.gmailSend }));
vi.mock("../../server/features/crm/reportOutreach", () => ({ recordReportEmailSent: mocks.record, getReportOutreachState: mocks.state }));
vi.mock("../../server/features/crm/ingest", () => ({ ingestWebsiteFormSubmission: vi.fn() }));
import { processJob } from "../../server/features/workflow/processor";
import type { WorkflowJob } from "@shared/schema";

const job = { id: "job-1", type: "email_notification", attempts: 1, maxAttempts: 1,
  payload: { to: "prospect@example.com", from: "matt@vivawebdesigns.com", subject: "Report", html: "<p><img src=\"https://reports.example/image.png\"></p>", text: "Report", imageUrl: "https://reports.example/image.png", category: "scan_report", deliveryId: "delivery-1", noteId: "note-1" },
} as unknown as WorkflowJob;
const updates: Record<string, unknown>[] = [];
function rows(values: unknown[]) {
  const q: any = { then: (resolve: any) => Promise.resolve(values).then(resolve) };
  for (const name of ["from", "where", "limit"]) q[name] = () => q;
  return q;
}
beforeEach(() => {
  vi.clearAllMocks(); updates.length = 0;
  mocks.select.mockReturnValue(rows([{ id: "delivery-1", leadId: "lead-1", sentAt: null }]));
  mocks.update.mockReturnValue({ set: (values: any) => { updates.push(values); return { where: vi.fn().mockResolvedValue([]) }; } });
  mocks.state.mockResolvedValue({ reportEmailCount: 0, reportOutreachDisposition: null });
  mocks.record.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue({ data: { id: "provider-id" }, error: null });
  mocks.gmailSend.mockResolvedValue({ id: "gmail-id", threadId: "thread-id" });
});

describe("report email worker", () => {
  it("sends scan reports through Gmail and advances outreach only after acceptance", async () => {
    await processJob(job);
    expect(mocks.gmailSend).toHaveBeenCalledWith(expect.objectContaining({
      from: "matt@vivawebdesigns.com",
      messageKey: "job-1",
    }));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith("delivery-1");
    expect(mocks.gmailSend.mock.invocationCallOrder[0]).toBeLessThan(mocks.record.mock.invocationCallOrder[0]);
    expect(updates).toContainEqual(expect.objectContaining({
      metadata: expect.objectContaining({
        provider: "gmail",
        providerMessageId: "gmail-id",
        providerThreadId: "thread-id",
      }),
    }));
  });
  it("does not advance outreach after an email failure", async () => {
    mocks.gmailSend.mockRejectedValue(new Error("Invalid recipient"));
    await expect(processJob(job)).rejects.toThrow("Invalid recipient");
    expect(mocks.record).not.toHaveBeenCalled();
    expect(updates.some(v => v.status === "failed")).toBe(true);
  });
  it("retries bookkeeping without resending an already accepted email", async () => {
    mocks.select.mockReturnValue(rows([{ id: "delivery-1", leadId: "lead-1", sentAt: new Date() }]));
    await processJob(job);
    expect(mocks.gmailSend).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith("delivery-1");
  });
  it("does not relabel accepted mail as failed if CRM bookkeeping fails", async () => {
    mocks.record.mockRejectedValue(new Error("Temporary database error"));
    await expect(processJob(job)).rejects.toThrow("Temporary database");
    expect(updates.some(v => v.status === "failed" || v.status === "retrying")).toBe(false);
  });
  it.each(["replied", "opted_out", "bounced", "no_response"])("cancels queued mail if outreach became %s", async disposition => {
    mocks.state.mockResolvedValue({ reportEmailCount: 1, reportOutreachDisposition: disposition });
    await processJob(job);
    expect(mocks.gmailSend).not.toHaveBeenCalled();
    expect(updates.some(v => v.status === "cancelled")).toBe(true);
  });
  it("does not send a queued third email", async () => {
    mocks.state.mockResolvedValue({ reportEmailCount: 2, reportOutreachDisposition: "active" });
    await processJob(job);
    expect(mocks.gmailSend).not.toHaveBeenCalled();
  });

  it("keeps non-CRM notifications on Resend", async () => {
    const notification = {
      ...job,
      id: "job-notification",
      payload: { to: "team@example.com", subject: "New form", html: "<p>New lead</p>" },
    } as unknown as WorkflowJob;
    await processJob(notification);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Matt Carney <matt@vivawebdesigns.com>" }),
      { idempotencyKey: "workflow-email/job-notification" },
    );
    expect(mocks.gmailSend).not.toHaveBeenCalled();
  });
});
