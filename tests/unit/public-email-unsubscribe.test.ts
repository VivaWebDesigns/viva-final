import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import { buildEmailUnsubscribePage, emailUnsubscribeUrl } from "../../server/public-email-unsubscribe";

describe("public email unsubscribe", () => {
  it("builds an opaque unsubscribe URL without recipient data", () => {
    const token = "a".repeat(43);
    const url = new URL(emailUnsubscribeUrl(token));
    expect(url.origin).toBe("https://vivawebdesigns.com");
    expect(url.pathname).toBe(`/email/unsubscribe/${token}`);
    expect(url.search).toBe("");
  });

  it("requires confirmation instead of unsubscribing on a scanner GET", () => {
    const token = "a".repeat(43);
    const html = buildEmailUnsubscribePage(token);
    expect(html).toContain(`method="post" action="/email/unsubscribe/${token}"`);
    expect(html).toContain(">Unsubscribe</button>");
    expect(html).not.toContain("googletagmanager.com");
    expect(html).not.toContain("gtag(");
  });

  it("renders a clear completion message", () => {
    const html = buildEmailUnsubscribePage("a".repeat(43), true);
    expect(html).toContain("You’re unsubscribed");
    expect(html).toContain("won’t send you any more scan-report marketing emails");
    expect(html).not.toContain("<form");
  });
});
