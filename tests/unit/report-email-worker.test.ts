import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../../server/db", () => ({ db: {} }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("../../server/features/crm/reportOutreach", () => ({
  recordReportEmailSent: vi.fn(),
  getReportOutreachState: vi.fn(),
}));
vi.mock("../../server/features/crm/ingest", () => ({ ingestWebsiteFormSubmission: vi.fn() }));

import { processJob } from "../../server/features/workflow/processor";
import type { WorkflowJob } from "@shared/schema";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ data: { id: "provider-id" }, error: null });
});

describe("email notification worker", () => {
  it("keeps website and system notifications on Resend", async () => {
    const job = {
      id: "job-notification",
      type: "email_notification",
      attempts: 1,
      maxAttempts: 3,
      payload: { to: "team@example.com", subject: "New form", html: "<p>New lead</p>" },
    } as unknown as WorkflowJob;

    await processJob(job);

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Matt Carney <matt@vivawebdesigns.com>",
        to: "team@example.com",
      }),
      { idempotencyKey: "workflow-email/job-notification" },
    );
  });

  it("refuses every legacy automated scan-report job", async () => {
    const job = {
      id: "job-report",
      type: "email_notification",
      attempts: 1,
      maxAttempts: 1,
      payload: {
        to: "prospect@example.com",
        subject: "Google Maps issues",
        html: "<p>Report</p>",
        category: "scan_report",
      },
    } as unknown as WorkflowJob;

    await expect(processJob(job)).rejects.toThrow("Automated prospect delivery is disabled");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
