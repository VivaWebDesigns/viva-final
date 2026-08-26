import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SupervisorConfig } from "./config.js";
import { reviewSchemaPath } from "./paths.js";
import type { CodexExecution, CodexTokenUsage } from "./types.js";

export type SpawnCodex = (
  command: string,
  args: readonly string[],
) => ChildProcessWithoutNullStreams;

const defaultSpawn: SpawnCodex = (command, args) =>
  spawn(command, [...args], {
    cwd: os.tmpdir(),
    env: {
      PATH: process.env.PATH,
      CODEX_HOME: process.env.CODEX_HOME,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
    },
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

function appendBounded(current: Buffer, next: Buffer, limit: number): Buffer {
  if (current.length >= limit) return current;
  return Buffer.concat([current, next.subarray(0, limit - current.length)]);
}

export function parseCodexUsageEvent(
  line: string,
): CodexTokenUsage | undefined {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!event || typeof event !== "object") return undefined;
  const record = event as Record<string, unknown>;
  if (record.type !== "turn.completed") return undefined;
  const rawUsage = record.usage;
  if (!rawUsage || typeof rawUsage !== "object") return undefined;
  const usage = rawUsage as Record<string, unknown>;
  const read = (key: string): number => {
    const value = usage[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    inputTokens: read("input_tokens"),
    cachedInputTokens: read("cached_input_tokens"),
    cacheWriteInputTokens: read("cache_write_input_tokens"),
    outputTokens: read("output_tokens"),
    reasoningOutputTokens: read("reasoning_output_tokens"),
  };
}

export async function executeCodex(
  prompt: string,
  config: SupervisorConfig,
  outputSchemaPath: string = reviewSchemaPath,
  spawnCodex: SpawnCodex = defaultSpawn,
): Promise<CodexExecution> {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "sab-supervisor-review-"),
  );
  const resultPath = path.join(temporaryDirectory, "result.json");
  const args = [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--cd",
    temporaryDirectory,
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "--json",
    "--output-schema",
    outputSchemaPath,
    "--output-last-message",
    resultPath,
    "-",
  ] as const;

  const startedAt = Date.now();
  let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let timedOut = false;
  let usage: CodexTokenUsage | undefined;
  let pendingJsonLine = "";
  let child: ChildProcessWithoutNullStreams;

  try {
    child = spawnCodex(config.codexPath, args);
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  child.stdout.on("data", (chunk: Buffer) => {
    stdout = appendBounded(stdout, chunk, config.maxCodexOutputBytes);
    pendingJsonLine += chunk.toString("utf8");
    const lines = pendingJsonLine.split("\n");
    pendingJsonLine = lines.pop() || "";
    for (const line of lines) usage = parseCodexUsageEvent(line) || usage;
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = appendBounded(stderr, chunk, config.maxCodexOutputBytes);
  });

  let exitCode: number | null;
  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        const forceTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
        forceTimer.unref();
      }, config.codexTimeoutMs);

      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        resolve(code);
      });
      child.stdin.end(prompt);
    });
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  let resultText: string | undefined;
  usage = parseCodexUsageEvent(pendingJsonLine) || usage;
  try {
    resultText = await fs.readFile(resultPath, "utf8");
  } catch {
    resultText = undefined;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }

  return {
    exitCode,
    stdout: stdout.toString("utf8"),
    stderr: stderr.toString("utf8"),
    timedOut,
    durationMs: Date.now() - startedAt,
    resultText,
    usage,
  };
}
