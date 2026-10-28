import crypto from "node:crypto";

const TWILIO_API = "https://api.twilio.com/2010-04-01";
export const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://vivawebdesigns.com").replace(/\/$/, "");
export const TWILIO_STATUS_CALLBACK_URL = `${PUBLIC_SITE_URL}/api/twilio/sms/status`;

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (!accountSid || !authToken || !messagingServiceSid) return null;
  return { accountSid, authToken, messagingServiceSid };
}

export function isTwilioConfigured() {
  return twilioConfig() !== null;
}

export class TwilioSendError extends Error {
  constructor(message: string, readonly code: string | null, readonly statusCode = 502) {
    super(message);
  }
}

export interface TwilioSendResult {
  sid: string;
  status: string;
}

/** Sends through the messaging service, so it uses (980) 446-3350 and the approved campaign. */
export async function sendTwilioMessage(input: { to: string; body: string; mediaUrl?: string | string[] }): Promise<TwilioSendResult> {
  const config = twilioConfig();
  if (!config) {
    throw new TwilioSendError(
      "Texting isn't set up yet. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID are required.",
      null,
      503,
    );
  }
  const form = new URLSearchParams();
  form.set("MessagingServiceSid", config.messagingServiceSid);
  form.set("To", input.to);
  form.set("Body", input.body);
  // Twilio keeps repeated MediaUrl fields in order; some phones still show them as separate bubbles.
  for (const mediaUrl of [input.mediaUrl ?? []].flat()) form.append("MediaUrl", mediaUrl);
  form.set("StatusCallback", TWILIO_STATUS_CALLBACK_URL);

  const response = await fetch(`${TWILIO_API}/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    throw new TwilioSendError(body.message || `Twilio rejected the text (${response.status})`, body.code ? String(body.code) : null);
  }
  return { sid: body.sid, status: body.status };
}

/** Twilio's X-Twilio-Signature: HMAC-SHA1 of the full URL plus each POST param name and value, sorted by name. */
export function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const payload = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", authToken).update(Buffer.from(payload, "utf-8")).digest("base64");
}

export function isValidTwilioSignature(signature: string | undefined, url: string, params: Record<string, string>) {
  const config = twilioConfig();
  if (!config || !signature) return false;
  const expected = Buffer.from(computeTwilioSignature(config.authToken, url, params));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
