import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), select: vi.fn(), update: vi.fn(), record: vi.fn(), state: vi.fn() }));
vi.mock("../../server/db", () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("../../server/features/crm/reportOutreach", () => ({ recordReportEmailSent: mocks.record, getReportOutreachState: mocks.state }));
vi.mock("../../server/features/crm/ingest", () => ({ ingestWebsiteFormSubmission: vi.fn() }));
import { processJob } from "../../server/features/workflow/processor";
import type { WorkflowJob } from "@shared/schema";

const job = { id: "job-1", type: "email_notification", attempts: 1, maxAttempts: 3,
  payload: { to: "prospect@example.com", subject: "Report", html: "<p>Report</p>", category: "scan_report", deliveryId: "delivery-1", noteId: "note-1" },
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
});

describe("report email worker", () => {
  it("advances outreach only after provider acceptance and uses a stable idempotency key", async () => {
    await processJob(job);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Matt Carney <matt@vivawebdesigns.com>",
        tags: [{ name: "category", value: "scan_report" }],
      }),
      { idempotencyKey: "workflow-email/job-1" },
    );
    expect(mocks.send.mock.calls[0][0]).not.toHaveProperty("headers");
    expect(mocks.record).toHaveBeenCalledWith("delivery-1");
    expect(mocks.send.mock.invocationCallOrder[0]).toBeLessThan(mocks.record.mock.invocationCallOrder[0]);
  });
  it("does not advance outreach after an email failure", async () => {
    mocks.send.mockResolvedValue({ error: { message: "Invalid recipient" } });
    await expect(processJob(job)).rejects.toThrow("Resend error");
    expect(mocks.record).not.toHaveBeenCalled();
    expect(updates.some(v => v.status === "retrying")).toBe(true);
  });
  it("retries bookkeeping without resending an already accepted email", async () => {
    mocks.select.mockReturnValue(rows([{ id: "delivery-1", leadId: "lead-1", sentAt: new Date() }]));
    await processJob(job);
    expect(mocks.send).not.toHaveBeenCalled();
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
    expect(mocks.send).not.toHaveBeenCalled();
    expect(updates.some(v => v.status === "cancelled")).toBe(true);
  });
  it("does not send a queued third email", async () => {
    mocks.state.mockResolvedValue({ reportEmailCount: 2, reportOutreachDisposition: "active" });
    await processJob(job);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
