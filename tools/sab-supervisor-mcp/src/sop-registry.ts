import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, type SupervisorConfig } from "./config.js";
import {
  registerSopInputSchema,
  registeredSopSchema,
  type RegisteredSop,
  type RegisterSopInput,
} from "./types.js";

type StoredSop = RegisteredSop & { registered_at: string };

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function registryPaths(
  config: SupervisorConfig,
  handle: string,
  contentHash: string,
) {
  const root = path.join(config.logDirectory, "sops");
  return {
    root,
    contentDirectory: path.join(root, "content"),
    metadataDirectory: path.join(root, "registrations"),
    textPath: path.join(root, "content", `${contentHash}.txt`),
    metadataPath: path.join(root, "registrations", `${handle}.json`),
  };
}

async function writeImmutable(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    const file = await fs.open(filePath, "wx", 0o600);
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await fs.readFile(filePath, "utf8");
    if (existing !== content)
      throw new Error(`Immutable SOP registry collision at ${filePath}`);
  }
}

export async function registerSopForReview(
  rawInput: unknown,
  config: SupervisorConfig = loadConfig(),
): Promise<RegisteredSop> {
  const input: RegisterSopInput = registerSopInputSchema.parse(rawInput);
  const contentHash = sha256(input.exact_document_text);
  const identity = JSON.stringify({
    source_url: input.source_url,
    document_title_version: input.document_title_version,
    drive_revision_id: input.drive_revision_id || null,
    content_sha256: contentHash,
  });
  const identityHash = sha256(identity);
  const handle = `sop_${contentHash.slice(0, 24)}_${identityHash.slice(0, 24)}`;
  const locations = registryPaths(config, handle, contentHash);
  await fs.mkdir(locations.contentDirectory, { recursive: true, mode: 0o700 });
  await fs.mkdir(locations.metadataDirectory, { recursive: true, mode: 0o700 });
  await writeImmutable(locations.textPath, input.exact_document_text);

  const result: RegisteredSop = {
    registered_sop_handle: handle,
    local_file_path: locations.textPath,
    content_sha256: contentHash,
    source_url: input.source_url,
    document_title_version: input.document_title_version,
    drive_revision_id: input.drive_revision_id || null,
  };
  const metadata: StoredSop = {
    ...result,
    registered_at: new Date().toISOString(),
  };
  try {
    await writeImmutable(
      locations.metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  } catch (error) {
    const existing = JSON.parse(
      await fs.readFile(locations.metadataPath, "utf8"),
    ) as StoredSop;
    const { registered_at: _existingAt, ...existingResult } = existing;
    if (JSON.stringify(existingResult) !== JSON.stringify(result)) throw error;
  }
  return result;
}

export async function resolveRegisteredSop(
  handle: string,
  config: SupervisorConfig = loadConfig(),
): Promise<{ registration: RegisteredSop; exactText: string }> {
  const parsedHandle =
    registeredSopSchema.shape.registered_sop_handle.parse(handle);
  const root = path.join(config.logDirectory, "sops", "registrations");
  const metadataPath = path.join(root, `${parsedHandle}.json`);
  const stored = JSON.parse(
    await fs.readFile(metadataPath, "utf8"),
  ) as StoredSop;
  const registration = registeredSopSchema.parse(stored);
  if (registration.registered_sop_handle !== parsedHandle)
    throw new Error("Registered SOP handle mismatch");
  const expectedPath = registryPaths(
    config,
    parsedHandle,
    registration.content_sha256,
  ).textPath;
  if (
    path.resolve(registration.local_file_path) !== path.resolve(expectedPath)
  ) {
    throw new Error("Registered SOP local path mismatch");
  }
  const exactText = await fs.readFile(expectedPath, "utf8");
  if (sha256(exactText) !== registration.content_sha256)
    throw new Error("Registered SOP content hash mismatch");
  return { registration, exactText };
}
