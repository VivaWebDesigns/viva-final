#!/usr/bin/env node
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config.js";
import { runMcpServer } from "./mcp.js";
import {
  builtWatcherAppPath,
  builtWatcherBinaryPath,
  installedWatcherAppPath,
  installedWatcherBinaryPath,
  packageRoot,
} from "./paths.js";
import { analyzeUsage, formatUsageAnalysis } from "./usage-analysis.js";

const serviceLabel = "com.viva.sab-permission-watcher";
const launchServicesRegisterPath =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

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

function verifyAppSignature(appPath: string): boolean {
  return (
    spawnSync(
      "/usr/bin/codesign",
      ["--verify", "--deep", "--strict", appPath],
      { stdio: "ignore" },
    ).status === 0
  );
}

function requireBuiltWatcherApp(): void {
  if (
    !fs.existsSync(builtWatcherBinaryPath) ||
    !verifyAppSignature(builtWatcherAppPath)
  ) {
    throw new Error(
      `Signed watcher app is missing. Run: cd ${packageRoot} && npm run build`,
    );
  }
}

function watcherBinaryPath(): string {
  if (
    fs.existsSync(installedWatcherBinaryPath) &&
    verifyAppSignature(installedWatcherAppPath)
  ) {
    return installedWatcherBinaryPath;
  }
  requireBuiltWatcherApp();
  return builtWatcherBinaryPath;
}

function filesEqual(left: string, right: string): boolean {
  if (!fs.existsSync(left) || !fs.existsSync(right)) return false;
  return fs.readFileSync(left).equals(fs.readFileSync(right));
}

function installedAppIsCurrent(): boolean {
  return (
    verifyAppSignature(installedWatcherAppPath) &&
    filesEqual(builtWatcherBinaryPath, installedWatcherBinaryPath) &&
    filesEqual(
      path.join(builtWatcherAppPath, "Contents", "Info.plist"),
      path.join(installedWatcherAppPath, "Contents", "Info.plist"),
    )
  );
}

function registerWatcherApp(): void {
  const result = spawnSync(
    launchServicesRegisterPath,
    ["-f", installedWatcherAppPath],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("Unable to register the watcher app with Launch Services");
  }
}

function installWatcherApp(): void {
  requireBuiltWatcherApp();
  if (installedAppIsCurrent()) {
    registerWatcherApp();
    console.log(`Watcher app is already current: ${installedWatcherAppPath}`);
    return;
  }

  fs.mkdirSync(path.dirname(installedWatcherAppPath), {
    recursive: true,
    mode: 0o755,
  });
  const stagingPath = path.join(
    path.dirname(installedWatcherAppPath),
    `.SAB Permission Watcher.app.installing-${process.pid}`,
  );
  const backupPath = path.join(
    path.dirname(installedWatcherAppPath),
    `.SAB Permission Watcher.app.backup-${process.pid}`,
  );
  fs.rmSync(stagingPath, { recursive: true, force: true });
  fs.rmSync(backupPath, { recursive: true, force: true });
  try {
    fs.cpSync(builtWatcherAppPath, stagingPath, {
      recursive: true,
      preserveTimestamps: true,
    });
    if (!verifyAppSignature(stagingPath)) {
      throw new Error("Copied watcher app failed code-signature verification");
    }
    if (fs.existsSync(installedWatcherAppPath)) {
      fs.renameSync(installedWatcherAppPath, backupPath);
    }
    try {
      fs.renameSync(stagingPath, installedWatcherAppPath);
    } catch (error) {
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, installedWatcherAppPath);
      }
      throw error;
    }
  } finally {
    fs.rmSync(stagingPath, { recursive: true, force: true });
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
  registerWatcherApp();
  console.log(`Installed watcher app: ${installedWatcherAppPath}`);
}

function spawnWatcher(dryRun = false, redirectForMcp = false): ChildProcess {
  const executablePath = watcherBinaryPath();
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
      return spawn(executablePath, watcherArguments(dryRun), {
        stdio: ["ignore", stdoutFd, stderrFd],
        shell: false,
      });
    } finally {
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
    }
  }
  return spawn(executablePath, watcherArguments(dryRun), {
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
  installWatcherApp();
  const config = loadConfig();
  fs.mkdirSync(path.dirname(launchAgentPath()), { recursive: true });
  fs.mkdirSync(config.logDirectory, { recursive: true, mode: 0o700 });
  const argumentsXml = [installedWatcherBinaryPath, ...watcherArguments(false)]
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
  const result = spawnSync("/bin/launchctl", args, {
    encoding: "utf8",
  });
  const status = result.status ?? 1;
  if (status === 0 || !allowFailure) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (status !== 0 && !allowFailure) process.exitCode = status;
  return status;
}

function startService(): void {
  stopService();
  installService();
  launchctl(["bootstrap", launchDomain(), launchAgentPath()]);
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

function dateArgument(args: string[], flag: string): Date | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const raw = args[index + 1];
  if (!raw) throw new Error(`${flag} requires an ISO-8601 timestamp`);
  const value = new Date(raw);
  if (Number.isNaN(value.getTime()))
    throw new Error(`${flag} must be a valid ISO-8601 timestamp`);
  return value;
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
      const executablePath = watcherBinaryPath();
      const result = spawnSync(
        executablePath,
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
      stopService();
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
    case "analyze-usage": {
      const config = loadConfig();
      const analysis = await analyzeUsage(config.logDirectory, {
        since: dateArgument(args, "--since"),
        until: dateArgument(args, "--until"),
      });
      if (args.includes("--json"))
        console.log(JSON.stringify(analysis, null, 2));
      else process.stdout.write(formatUsageAnalysis(analysis));
      return;
    }
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
  analyze-usage    Summarize reviewer tokens, cache use, timing, and verdicts
                   [--since ISO-8601] [--until ISO-8601] [--json]
  uninstall        Disable and remove the watcher LaunchAgent`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
