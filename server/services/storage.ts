/**
 * R2 Storage Service
 *
 * Abstraction layer for Cloudflare R2 (S3-compatible) file storage.
 * Falls back to local/mock mode when R2 credentials are not configured.
 *
 * Required environment variables for production R2:
 *   R2_ACCOUNT_ID      — Cloudflare account ID
 *   R2_ACCESS_KEY_ID   — R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY — R2 API token (Secret Access Key)
 *   R2_BUCKET_NAME     — Bucket name in R2
 *   R2_PUBLIC_URL      — Public URL prefix (e.g. https://pub-xxx.r2.dev or custom domain)
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

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const configured = !!(accountId && accessKeyId && secretAccessKey && bucketName);
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, configured };
}

function getS3Client() {
  const { accountId, accessKeyId, secretAccessKey, configured } = getConfig();
  if (!configured) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
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

  if (!configured) {
    const mockUrl = `/api/attachments/mock/${key}`;
    console.warn("[storage] R2 not configured — using mock upload. Key:", key);
    return { key, url: mockUrl, originalName, mimeType, sizeBytes: buffer.byteLength };
  }

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
  if (!configured) return `/api/attachments/mock/${key}`;
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
