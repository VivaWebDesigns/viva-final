#!/usr/bin/env node
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config.js";
import { runMcpServer } from "./mcp.js";
import { packageRoot, watcherBinaryPath } from "./paths.js";

const serviceLabel = "com.viva.sab-permission-watcher";

function watcherArguments(dryRun = false): string[] {
  const config = loadConfig();
  const args = [
    "watch",
    "--log-directory",
    config.logDirectory,
    "--poll-interval-ms",
    String(config.watcher.pollIntervalMs),
    "--resume-timeout-ms",
    String(config.watcher.resumeTimeoutMs),
    "--max-retries",
    String(config.watcher.maxRetries),
    "--extension-id",
    config.watcher.claudeExtensionId,
  ];
  if (dryRun) args.push("--dry-run");
  return args;
}

function requireWatcherBinary(): void {
  if (!fs.existsSync(watcherBinaryPath)) {
    throw new Error(
      `Watcher binary is missing. Run: cd ${packageRoot} && npm run build`,
    );
  }
}

function spawnWatcher(dryRun = false, redirectForMcp = false): ChildProcess {
  requireWatcherBinary();
  if (redirectForMcp) {
    const config = loadConfig();
    fs.mkdirSync(config.logDirectory, { recursive: true, mode: 0o700 });
    const stdoutFd = fs.openSync(
      path.join(config.logDirectory, "watcher.stdout.log"),
      "a",
    );
    const stderrFd = fs.openSync(
      path.join(config.logDirectory, "watcher.stderr.log"),
      "a",
    );
    try {
      return spawn(watcherBinaryPath, watcherArguments(dryRun), {
        stdio: ["ignore", stdoutFd, stderrFd],
        shell: false,
      });
    } finally {
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
    }
  }
  return spawn(watcherBinaryPath, watcherArguments(dryRun), {
    stdio: "inherit",
    shell: false,
  });
}

function launchAgentPath(): string {
  return path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${serviceLabel}.plist`,
  );
}

function launchDomain(): string {
  return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
}

function plistEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function installService(): void {
  requireWatcherBinary();
  const config = loadConfig();
  fs.mkdirSync(path.dirname(launchAgentPath()), { recursive: true });
  fs.mkdirSync(config.logDirectory, { recursive: true, mode: 0o700 });
  const argumentsXml = [watcherBinaryPath, ...watcherArguments(false)]
    .map((value) => `    <string>${plistEscape(value)}</string>`)
    .join("\n");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${serviceLabel}</string>
  <key>ProgramArguments</key>
  <array>
${argumentsXml}
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${plistEscape(path.join(config.logDirectory, "watcher.stdout.log"))}</string>
  <key>StandardErrorPath</key><string>${plistEscape(path.join(config.logDirectory, "watcher.stderr.log"))}</string>
</dict>
</plist>
`;
  fs.writeFileSync(launchAgentPath(), plist, { mode: 0o600 });
  console.log(`Installed ${launchAgentPath()}`);
}

function launchctl(args: string[], allowFailure = false): number {
  const result = spawnSync("/bin/launchctl", args, { stdio: "inherit" });
  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) process.exitCode = status;
  return status;
}

function startService(): void {
  if (!fs.existsSync(launchAgentPath())) installService();
  launchctl(["bootstrap", launchDomain(), launchAgentPath()], true);
  launchctl(["kickstart", "-k", `${launchDomain()}/${serviceLabel}`]);
}

function stopService(): void {
  launchctl(["bootout", launchDomain(), launchAgentPath()], true);
}

function uninstallService(): void {
  stopService();
  if (fs.existsSync(launchAgentPath())) fs.unlinkSync(launchAgentPath());
  console.log(
    "Watcher LaunchAgent removed. Local logs and config were preserved.",
  );
}

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  switch (command) {
    case "mcp":
      await runMcpServer();
      return;
    case "watcher": {
      const child = spawnWatcher(args.includes("--dry-run"));
      process.on("SIGTERM", () => child.kill("SIGTERM"));
      process.on("SIGINT", () => child.kill("SIGINT"));
      await new Promise<void>((resolve, reject) => {
        child.once("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`Watcher exited with ${code}`)),
        );
      });
      return;
    }
    case "dry-run": {
      requireWatcherBinary();
      const result = spawnSync(
        watcherBinaryPath,
        [...watcherArguments(true), "--once"],
        { stdio: "inherit" },
      );
      process.exitCode = result.status ?? 1;
      return;
    }
    case "all": {
      const watcher = spawnWatcher(args.includes("--dry-run"), true);
      const stop = () => watcher.kill("SIGTERM");
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
      try {
        await runMcpServer();
      } finally {
        stop();
      }
      return;
    }
    case "install-service":
      installService();
      return;
    case "start":
      startService();
      return;
    case "stop":
      stopService();
      return;
    case "restart":
      stopService();
      startService();
      return;
    case "status":
      launchctl(["print", `${launchDomain()}/${serviceLabel}`], true);
      return;
    case "logs":
      console.log(loadConfig().logDirectory);
      return;
    case "uninstall":
      uninstallService();
      return;
    default:
      console.log(`Usage: sab-supervisor <command>

Commands:
  mcp              Run only the event-driven MCP reviewer on stdio
  watcher          Run only the permission watcher in the foreground
  dry-run          Detect one prompt without clicking
  all              Run reviewer and watcher together in the foreground
  install-service  Install the watcher LaunchAgent
  start|stop|restart|status
  logs             Print the structured log directory
  uninstall        Disable and remove the watcher LaunchAgent`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
