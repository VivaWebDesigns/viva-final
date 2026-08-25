import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const appPath = path.join(packageRoot, "build", "SAB Permission Watcher.app");
const plistPath = path.join(appPath, "Contents", "Info.plist");
const binaryPath = path.join(
  appPath,
  "Contents",
  "MacOS",
  "sab-permission-watcher",
);
const expectedIdentifier = "com.viva.sab-permission-watcher";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} failed${details ? `:\n${details}` : ""}`);
  }
  return `${result.stdout}${result.stderr}`;
}

if (!fs.statSync(appPath).isDirectory()) {
  throw new Error(`Watcher app bundle is missing: ${appPath}`);
}
if (!(fs.statSync(binaryPath).mode & 0o111)) {
  throw new Error("Watcher app executable is not executable");
}

run("/usr/bin/plutil", ["-lint", plistPath]);
const identifier = run("/usr/bin/plutil", [
  "-extract",
  "CFBundleIdentifier",
  "raw",
  "-o",
  "-",
  plistPath,
]).trim();
if (identifier !== expectedIdentifier) {
  throw new Error(`Unexpected bundle identifier: ${identifier}`);
}

run("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
const signature = run("/usr/bin/codesign", ["-d", "--verbose=4", appPath]);
if (!signature.includes(`Identifier=${expectedIdentifier}`)) {
  throw new Error(
    "Code signature identifier does not match the bundle identifier",
  );
}
if (!signature.includes("Signature=adhoc")) {
  throw new Error("Watcher app does not have the expected ad-hoc signature");
}

console.log(
  `Watcher app packaging verified (APPL bundle, executable, Info.plist, ${expectedIdentifier}, ad-hoc signature).`,
);
