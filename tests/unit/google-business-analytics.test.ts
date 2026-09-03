import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptGoogleToken,
  encryptGoogleToken,
  googleAuthorizationUrl,
  googleBusinessProfileEnabled,
  googleOAuthRedirectUri,
  hashOAuthState,
} from "../../server/features/business-analytics/googleAuth";

const ORIGINAL_ENV = { ...process.env };

describe("Google business analytics integration", () => {
  beforeEach(() => {
    process.env.GOOGLE_INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.GOOGLE_INTEGRATIONS_OAUTH_CLIENT_JSON = JSON.stringify({
      web: {
        client_id: "test-client.apps.googleusercontent.com",
        client_secret: "test-secret",
      },
    });
    process.env.PUBLIC_SITE_URL = "https://vivawebdesigns.com";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("encrypts refresh tokens with authenticated encryption", () => {
    const encrypted = encryptGoogleToken("refresh-token-value");

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptGoogleToken(encrypted)).toBe("refresh-token-value");
  });

  it("rejects a tampered encrypted token", () => {
    const encrypted = encryptGoogleToken("refresh-token-value");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptGoogleToken(tampered)).toThrow();
  });

  it("builds a server callback URL and least-privilege Analytics authorization", () => {
    const url = new URL(googleAuthorizationUrl("analytics", "secure-state"));

    expect(googleOAuthRedirectUri()).toBe("https://vivawebdesigns.com/api/business-analytics/oauth/callback");
    expect(url.searchParams.get("redirect_uri")).toBe(googleOAuthRedirectUri());
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("analytics.readonly");
    expect(url.searchParams.get("scope")).not.toContain("business.manage");
  });

  it("requests Business Profile access separately from Analytics", () => {
    const url = new URL(googleAuthorizationUrl("business_profile", "secure-state"));

    expect(url.searchParams.get("scope")).toContain("business.manage");
    expect(url.searchParams.get("scope")).not.toContain("analytics.readonly");
  });

  it("keeps Business Profile disabled unless explicitly enabled", () => {
    delete process.env.GOOGLE_BUSINESS_PROFILE_ENABLED;
    expect(googleBusinessProfileEnabled()).toBe(false);

    process.env.GOOGLE_BUSINESS_PROFILE_ENABLED = "true";
    expect(googleBusinessProfileEnabled()).toBe(true);
  });

  it("stores only a hash of each one-time OAuth state", () => {
    expect(hashOAuthState("secure-state")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOAuthState("secure-state")).not.toContain("secure-state");
  });
});
