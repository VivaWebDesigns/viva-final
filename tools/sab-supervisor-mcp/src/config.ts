import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SupervisorConfig = {
  codexPath: string;
  codexTimeoutMs: number;
  maxCodexOutputBytes: number;
  logDirectory: string;
  watcher: {
    pollIntervalMs: number;
    resumeTimeoutMs: number;
    maxRetries: number;
    claudeExtensionId: string;
  };
};

const defaults: SupervisorConfig = {
  codexPath: process.env.CODEX_PATH || "codex",
  codexTimeoutMs: 120_000,
  maxCodexOutputBytes: 512 * 1024,
  logDirectory: path.join(
    os.homedir(),
    ".local",
    "state",
    "viva-sab-supervisor",
  ),
  watcher: {
    pollIntervalMs: 750,
    resumeTimeoutMs: 10_000,
    maxRetries: 2,
    claudeExtensionId: "fcoeoabgfenejglbffodgkkbkcdhcgfn",
  },
};

function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function loadConfig(configPath?: string): SupervisorConfig {
  const selectedPath = configPath || process.env.SAB_SUPERVISOR_CONFIG;
  if (!selectedPath) return defaults;

  const parsed = JSON.parse(
    fs.readFileSync(selectedPath, "utf8"),
  ) as Partial<SupervisorConfig>;
  const merged: SupervisorConfig = {
    ...defaults,
    ...parsed,
    watcher: { ...defaults.watcher, ...parsed.watcher },
  };
  merged.logDirectory = expandHome(merged.logDirectory);
  return merged;
}
