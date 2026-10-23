import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));
import { computeTwilioSignature, isValidTwilioSignature } from "../../server/features/sms/twilio";
import { buildSmsReplyAlert, toUsE164 } from "../../server/features/sms/scanText";
import { isOptInKeyword, optOutKeyword } from "../../shared/scanText";

describe("Twilio webhook signature", () => {
  const url = "https://vivawebdesigns.com/api/twilio/sms/inbound";
  const params = { From: "+17045550123", To: "+19804463350", Body: "Thanks!", MessageSid: "SM123" };

  beforeEach(() => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "secret-token");
    vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "MG1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a request signed with the auth token", () => {
    const signature = computeTwilioSignature("secret-token", url, params);
    expect(isValidTwilioSignature(signature, url, params)).toBe(true);
  });

  it("rejects tampered params, another URL, another token or no signature", () => {
    const signature = computeTwilioSignature("secret-token", url, params);
    expect(isValidTwilioSignature(signature, url, { ...params, Body: "STOP" })).toBe(false);
    expect(isValidTwilioSignature(signature, `${url}?x=1`, params)).toBe(false);
    expect(isValidTwilioSignature(computeTwilioSignature("other", url, params), url, params)).toBe(false);
    expect(isValidTwilioSignature(undefined, url, params)).toBe(false);
  });

  it("rejects everything when Twilio isn't configured", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    expect(isValidTwilioSignature(computeTwilioSignature("", url, params), url, params)).toBe(false);
  });
});

describe("opt-out keywords", () => {
  it("recognizes Twilio's default STOP words regardless of case or punctuation", () => {
    expect(optOutKeyword("stop")).toBe("STOP");
    expect(optOutKeyword(" Unsubscribe. ")).toBe("UNSUBSCRIBE");
    expect(optOutKeyword("please stop texting me")).toBeNull();
    expect(optOutKeyword("How much?")).toBeNull();
  });

  it("recognizes opt-in words", () => {
    expect(isOptInKeyword("START")).toBe(true);
    expect(isOptInKeyword("unstop")).toBe(true);
    expect(isOptInKeyword("yes please")).toBe(false);
  });
});

describe("phone normalization", () => {
  it("returns E.164 only for 10-digit US numbers", () => {
    expect(toUsE164("(704) 555-0123")).toBe("+17045550123");
    expect(toUsE164("+1 704 555 0123")).toBe("+17045550123");
    expect(toUsE164("555-0123")).toBeNull();
    expect(toUsE164(null)).toBeNull();
  });
});

describe("reply alert email", () => {
  const base = {
    leadId: "lead-1",
    companyName: "Evers Electric",
    contactName: null,
    fromNumber: "+17045550123",
    body: "How much would it cost to fix this?",
    mediaCount: 0,
    optedOut: false,
  };

  it("uses the company name and links to the lead", () => {
    const { subject, html } = buildSmsReplyAlert(base);
    expect(subject).toBe("Text reply from Evers Electric");
    expect(html).toContain("Evers Electric &middot; (704) 555-0123");
    expect(html).toContain("/admin/crm/leads/lead-1");
  });

  it("adds the contact name when there is one and escapes the message", () => {
    const { html } = buildSmsReplyAlert({ ...base, contactName: "Dan Evers", body: "<b>hi</b>" });
    expect(html).toContain("Evers Electric &middot; Dan Evers &middot; (704) 555-0123");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("falls back to the number for unknown senders and flags opt-outs", () => {
    const unknown = buildSmsReplyAlert({ ...base, leadId: null, companyName: null });
    expect(unknown.subject).toBe("Text reply from (704) 555-0123");
    expect(unknown.html).toContain("isn't matched to a lead");
    expect(buildSmsReplyAlert({ ...base, body: "STOP", optedOut: true }).subject).toBe("Text reply from Evers Electric (opted out)");
  });
});
