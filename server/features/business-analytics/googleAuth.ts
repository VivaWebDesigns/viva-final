import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";

export const GOOGLE_PROVIDERS = ["analytics", "business_profile"] as const;
export type GoogleProvider = typeof GOOGLE_PROVIDERS[number];

const PROVIDER_SCOPES: Record<GoogleProvider, string[]> = {
  analytics: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
  business_profile: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/business.manage",
  ],
};

type OAuthCredentials = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

function decodeJson(raw: string): string {
  const value = raw.trim();
  return value.startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8");
}

export function getGoogleOAuthCredentials(): OAuthCredentials {
  const raw = process.env.GOOGLE_INTEGRATIONS_OAUTH_CLIENT_JSON;
  if (!raw) throw new Error("GOOGLE_INTEGRATIONS_OAUTH_CLIENT_JSON is not configured");
  const parsed = JSON.parse(decodeJson(raw)) as {
    web?: Partial<OAuthCredentials>;
    installed?: Partial<OAuthCredentials>;
  };
  const credentials = parsed.web || parsed.installed;
  if (!credentials?.client_id || !credentials.client_secret) {
    throw new Error("Google integrations OAuth client JSON is invalid");
  }
  return credentials as OAuthCredentials;
}

export function googleOAuthRedirectUri(): string {
  return `${process.env.PUBLIC_SITE_URL || "https://vivawebdesigns.com"}/api/business-analytics/oauth/callback`;
}

export function createGoogleOAuthClient(): OAuth2Client {
  const credentials = getGoogleOAuthCredentials();
  return new OAuth2Client(
    credentials.client_id,
    credentials.client_secret,
    googleOAuthRedirectUri(),
  );
}

export function googleAuthorizationUrl(provider: GoogleProvider, state: string): string {
  return createGoogleOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    state,
    scope: PROVIDER_SCOPES[provider],
  });
}

function encryptionKey(): Buffer {
  const raw = process.env.GOOGLE_INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("GOOGLE_INTEGRATIONS_ENCRYPTION_KEY is not configured");
  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

export function encryptGoogleToken(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptGoogleToken(value: string): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Stored Google token is invalid");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createOAuthState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashOAuthState(state: string): string {
  return crypto.createHash("sha256").update(state).digest("hex");
}

export function googleIntegrationConfigStatus() {
  return {
    oauthClientConfigured: !!process.env.GOOGLE_INTEGRATIONS_OAUTH_CLIENT_JSON,
    encryptionConfigured: !!process.env.GOOGLE_INTEGRATIONS_ENCRYPTION_KEY,
  };
}

