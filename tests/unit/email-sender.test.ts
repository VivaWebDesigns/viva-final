import { describe, expect, it } from "vitest";
import {
  emailSenderDisplayName,
  formatEmailSender,
} from "../../server/lib/email-sender";

describe("email sender identity", () => {
  it("always identifies Matt's Viva address as Matt Carney", () => {
    expect(emailSenderDisplayName("matt@vivawebdesigns.com")).toBe("Matt Carney");
    expect(emailSenderDisplayName(" MATT@VIVAWEBDesigns.com ", "Another Name")).toBe("Matt Carney");
    expect(formatEmailSender("matt@vivawebdesigns.com")).toBe(
      "Matt Carney <matt@vivawebdesigns.com>",
    );
  });

  it("preserves the configured display name for other sender addresses", () => {
    expect(emailSenderDisplayName("reports@vivawebdesigns.com", "Viva Reports")).toBe("Viva Reports");
    expect(formatEmailSender("reports@vivawebdesigns.com", "Viva Reports")).toBe(
      "Viva Reports <reports@vivawebdesigns.com>",
    );
  });
});
