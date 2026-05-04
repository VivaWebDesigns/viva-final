/**
 * R2 Storage Service
 *
 * Abstraction layer for Cloudflare R2 (S3-compatible) file storage.
 * Uploads require R2 credentials. Missing storage config returns a clear
 * service-unavailable error instead of creating broken placeholder links.
 *
 * Required environment variables for production R2:
 *   R2_ACCOUNT_ID        - Cloudflare account ID
 *   R2_ACCESS_KEY_ID     - R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY - R2 API token (Secret Access Key)
 *   R2_BUCKET_NAME       - Bucket name in R2
 *   R2_PUBLIC_URL        - Public URL prefix (e.g. https://pub-xxx.r2.dev or custom domain)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import crypto from "node:crypto";

export interface UploadResult {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

function firstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function trimTrailingSlash(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, "");
}

function storageNotConfiguredError() {
  const error = new Error("File storage is not configured. Cloudflare R2 environment variables are missing.");
  (error as Error & { statusCode: number }).statusCode = 503;
  return error;
}

function getConfig() {
  const accountId = firstEnv(["R2_ACCOUNT_ID"]);
  const accessKeyId = firstEnv(["R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY", "CLOUDFLARE_R2_ACCESS_KEY_ID"]);
  const secretAccessKey = firstEnv(["R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY"]);
  const bucketName = firstEnv(["R2_BUCKET_NAME", "CLOUDFLARE_R2_BUCKET"]);
  const endpoint = trimTrailingSlash(firstEnv(["R2_ENDPOINT", "CLOUDFLARE_R2_ENDPOINT"]))
    ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const publicUrl = trimTrailingSlash(firstEnv(["R2_PUBLIC_URL", "CLOUDFLARE_R2_PUBLIC_URL"]));
  const configured = !!(endpoint && accessKeyId && secretAccessKey && bucketName);
  return { endpoint, accessKeyId, secretAccessKey, bucketName, publicUrl, configured };
}

function getS3Client() {
  const { endpoint, accessKeyId, secretAccessKey, configured } = getConfig();
  if (!configured) return null;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  });
}

function generateKey(originalName: string, folder = "uploads"): string {
  const ext = path.extname(originalName).toLowerCase();
  const uid = crypto.randomBytes(12).toString("hex");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  return `${folder}/${date}/${uid}${ext}`;
}

export function isConfigured(): boolean {
  return getConfig().configured;
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = "uploads"
): Promise<UploadResult> {
  const { bucketName, publicUrl, configured } = getConfig();
  const key = generateKey(originalName, folder);

  if (!configured) throw storageNotConfiguredError();

  const client = getS3Client()!;
  await client.send(new PutObjectCommand({
    Bucket: bucketName!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentDisposition: `inline; filename="${encodeURIComponent(originalName)}"`,
  }));

  const url = publicUrl ? `${publicUrl}/${key}` : `https://${bucketName}.r2.cloudflarestorage.com/${key}`;
  return { key, url, originalName, mimeType, sizeBytes: buffer.byteLength };
}

export async function deleteFile(key: string): Promise<void> {
  const { bucketName, configured } = getConfig();
  if (!configured) {
    console.warn("[storage] R2 not configured — mock delete. Key:", key);
    return;
  }
  const client = getS3Client()!;
  await client.send(new DeleteObjectCommand({ Bucket: bucketName!, Key: key }));
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const { bucketName, publicUrl, configured } = getConfig();
  if (!configured) throw storageNotConfiguredError();
  if (publicUrl) return `${publicUrl}/${key}`;
  const client = getS3Client()!;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucketName!, Key: key }), { expiresIn: expiresInSeconds });
}

export const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
