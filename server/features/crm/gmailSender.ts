import crypto from "node:crypto";
import { formatEmailSender } from "../../lib/email-sender";
import {
  createGoogleOAuthClient,
  decryptGoogleToken,
} from "../business-analytics/googleAuth";
import * as googleStorage from "../business-analytics/storage";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const MAX_INLINE_IMAGE_BYTES = 20 * 1024 * 1024;

export type GmailSenderStatus = {
  connected: boolean;
  accountEmail: string | null;
  status: string | null;
  lastError: string | null;
};

type GmailSendInput = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  imageUrl: string;
  messageKey: string;
  signal?: AbortSignal;
};

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedHeader(value: string): string {
  const clean = cleanHeader(value);
  return /^[\x20-\x7e]*$/.test(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function foldedBase64(value: Buffer | string): string {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function boundary(label: string, key: string): string {
  return `${label}_${crypto.createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

export function buildGmailRawMessage(input: GmailSendInput & {
  image: Buffer;
  imageContentType?: string;
}): string {
  const relatedBoundary = boundary("related", input.messageKey);
  const alternativeBoundary = boundary("alternative", input.messageKey);
  const messageIdKey = crypto.createHash("sha256").update(input.messageKey).digest("hex").slice(0, 32);
  const inlineHtml = input.html.split(input.imageUrl).join("cid:scan-report");
  const lines = [
    `From: ${cleanHeader(formatEmailSender(input.from))}`,
    `To: ${cleanHeader(input.to)}`,
    ...(input.replyTo ? [`Reply-To: ${cleanHeader(input.replyTo)}`] : []),
    `Subject: ${encodedHeader(input.subject)}`,
    `Message-ID: <scan-report-${messageIdKey}@vivawebdesigns.com>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    "",
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldedBase64(input.text),
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldedBase64(inlineHtml),
    `--${alternativeBoundary}--`,
    `--${relatedBoundary}`,
    `Content-Type: ${cleanHeader(input.imageContentType || "image/png")}; name="google-maps-scan.png"`,
    "Content-Transfer-Encoding: base64",
    "Content-ID: <scan-report>",
    'Content-Disposition: inline; filename="google-maps-scan.png"',
    "",
    foldedBase64(input.image),
    `--${relatedBoundary}--`,
    "",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function getGmailSenderStatus(): Promise<GmailSenderStatus> {
  const connection = await googleStorage.getGoogleConnection("gmail");
  return {
    connected: connection?.status === "connected",
    accountEmail: connection?.accountEmail ?? null,
    status: connection?.status ?? null,
    lastError: connection?.lastError ?? null,
  };
}

export async function requireGmailSender(expectedEmail: string) {
  const connection = await googleStorage.getGoogleConnection("gmail");
  if (!connection || connection.status !== "connected") {
    throw Object.assign(new Error("Connect Google Workspace before sending CRM report emails."), { statusCode: 409 });
  }
  if (connection.accountEmail?.toLowerCase() !== expectedEmail.trim().toLowerCase()) {
    throw Object.assign(new Error(`Google Workspace must be connected as ${expectedEmail}.`), { statusCode: 409 });
  }
  return connection;
}

export async function sendScanReportWithGmail(input: GmailSendInput): Promise<{ id: string; threadId: string | null }> {
  const connection = await requireGmailSender(input.from);
  const imageResponse = await fetch(input.imageUrl, { signal: input.signal });
  if (!imageResponse.ok) {
    throw new Error(`Could not load the report image (${imageResponse.status}).`);
  }
  const declaredLength = Number(imageResponse.headers.get("content-length") || 0);
  if (declaredLength > MAX_INLINE_IMAGE_BYTES) throw new Error("The report image is too large to send through Gmail.");
  const image = Buffer.from(await imageResponse.arrayBuffer());
  if (image.byteLength > MAX_INLINE_IMAGE_BYTES) throw new Error("The report image is too large to send through Gmail.");

  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: decryptGoogleToken(connection.encryptedRefreshToken) });
  const raw = buildGmailRawMessage({
    ...input,
    image,
    imageContentType: imageResponse.headers.get("content-type") || "image/png",
  });
  try {
    const response = await client.request<{ id?: string; threadId?: string }>({
      url: GMAIL_SEND_URL,
      method: "POST",
      data: { raw },
      signal: input.signal,
    });
    if (!response.data.id) throw new Error("Gmail accepted the request without returning a message ID.");
    await googleStorage.updateGoogleConnection("gmail", {
      status: "connected",
      lastError: null,
      lastSyncedAt: new Date(),
    }).catch((error) => console.warn("[gmail] Could not update connection health after send:", error?.message || error));
    return { id: response.data.id, threadId: response.data.threadId ?? null };
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || "Gmail send failed";
    const authorizationFailed = /invalid_grant|unauthorized|authentication|credential|permission|forbidden|401|403/i.test(message);
    await googleStorage.updateGoogleConnection("gmail", {
      status: authorizationFailed ? "error" : "connected",
      lastError: message,
    }).catch((storageError) => console.warn("[gmail] Could not store connection failure:", storageError?.message || storageError));
    throw new Error(message);
  }
}
