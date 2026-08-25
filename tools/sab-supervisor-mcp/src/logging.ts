import fs from "node:fs/promises";
import path from "node:path";

export async function appendJsonLog(
  logDirectory: string,
  fileName: string,
  record: Record<string, unknown>,
): Promise<void> {
  await fs.mkdir(logDirectory, { recursive: true, mode: 0o700 });
  await fs.appendFile(
    path.join(logDirectory, fileName),
    `${JSON.stringify(record)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}
