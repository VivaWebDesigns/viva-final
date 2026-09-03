import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getConnection: vi.fn(), updateConnection: vi.fn() }));
vi.mock("../../server/features/business-analytics/storage", () => ({
  getGoogleConnection: mocks.getConnection,
  updateGoogleConnection: mocks.updateConnection,
}));

import { buildGmailRawMessage, requireGmailSender } from "../../server/features/crm/gmailSender";

describe("Gmail CRM sender", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds an inline report with a stable message ID and ordinary filename", () => {
    const raw = buildGmailRawMessage({
      to: "prospect@example.com",
      from: "matt@vivawebdesigns.com",
      replyTo: "matt@vivawebdesigns.com",
      subject: "Google Maps issues",
      text: "Here is the report.",
      html: '<p>Here is the report.</p><img src="https://reports.example/very-long-hash.png">',
      imageUrl: "https://reports.example/very-long-hash.png",
      image: Buffer.from("png-data"),
      imageContentType: "image/png",
      messageKey: "job-123",
    });
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    const htmlPart = mime.match(/Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--alternative_/)?.[1];

    expect(mime).toContain("From: Matt Carney <matt@vivawebdesigns.com>");
    expect(mime).toContain("Content-ID: <scan-report>");
    expect(mime).toContain('filename="google-maps-scan.png"');
    expect(mime).toMatch(/Message-ID: <scan-report-[a-f0-9]{32}@vivawebdesigns\.com>/);
    expect(htmlPart).toBeTruthy();
    expect(Buffer.from(htmlPart!.replace(/\r\n/g, ""), "base64").toString("utf8")).toContain('src="cid:scan-report"');
  });

  it("hard-fails when a different Google account is connected", async () => {
    mocks.getConnection.mockResolvedValue({
      status: "connected",
      accountEmail: "someone-else@gmail.com",
    });

    await expect(requireGmailSender("matt@vivawebdesigns.com"))
      .rejects.toThrow("Google Workspace must be connected as matt@vivawebdesigns.com");
  });
});
