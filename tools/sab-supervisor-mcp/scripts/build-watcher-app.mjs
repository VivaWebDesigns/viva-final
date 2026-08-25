import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const bundleIdentifier = "com.viva.sab-permission-watcher";
const executableName = "sab-permission-watcher";
const sourceBinary = path.join(
  packageRoot,
  "swift",
  ".build",
  "release",
  executableName,
);
const outputApp = path.join(packageRoot, "build", "SAB Permission Watcher.app");
const outputBinary = path.join(outputApp, "Contents", "MacOS", executableName);
const outputPlist = path.join(outputApp, "Contents", "Info.plist");
const outputSourceHash = path.join(
  outputApp,
  "Contents",
  "Resources",
  "source.sha256",
);
const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>SAB Permission Watcher</string>
  <key>CFBundleExecutable</key><string>${executableName}</string>
  <key>CFBundleIdentifier</key><string>${bundleIdentifier}</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>SAB Permission Watcher</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
`;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} failed${details ? `:\n${details}` : ""}`);
  }
}

function signatureIsValid(appPath) {
  return (
    spawnSync(
      "/usr/bin/codesign",
      ["--verify", "--deep", "--strict", appPath],
      { stdio: "ignore" },
    ).status === 0
  );
}

function fileMatches(filePath, expected) {
  return fs.existsSync(filePath) && fs.readFileSync(filePath).equals(expected);
}

if (!fs.existsSync(sourceBinary)) {
  throw new Error(`Release watcher binary is missing: ${sourceBinary}`);
}

const sourceBytes = fs.readFileSync(sourceBinary);
const sourceHashBytes = Buffer.from(
  `${crypto.createHash("sha256").update(sourceBytes).digest("hex")}\n`,
  "utf8",
);
const plistBytes = Buffer.from(infoPlist, "utf8");
if (
  fileMatches(outputSourceHash, sourceHashBytes) &&
  fileMatches(outputPlist, plistBytes) &&
  signatureIsValid(outputApp)
) {
  console.log(`Signed watcher app is unchanged: ${outputApp}`);
  process.exit(0);
}

const stagingApp = path.join(
  packageRoot,
  "build",
  `.SAB Permission Watcher.app.building-${process.pid}`,
);
fs.rmSync(stagingApp, { recursive: true, force: true });
try {
  const contents = path.join(stagingApp, "Contents");
  const macOSDirectory = path.join(contents, "MacOS");
  const resourcesDirectory = path.join(contents, "Resources");
  fs.mkdirSync(macOSDirectory, { recursive: true, mode: 0o755 });
  fs.mkdirSync(resourcesDirectory, { recursive: true, mode: 0o755 });
  fs.copyFileSync(sourceBinary, path.join(macOSDirectory, executableName));
  fs.chmodSync(path.join(macOSDirectory, executableName), 0o755);
  fs.writeFileSync(path.join(contents, "Info.plist"), infoPlist, {
    mode: 0o644,
  });
  fs.writeFileSync(
    path.join(resourcesDirectory, "source.sha256"),
    sourceHashBytes,
    { mode: 0o644 },
  );
  run("/usr/bin/plutil", ["-lint", path.join(contents, "Info.plist")]);
  run("/usr/bin/codesign", [
    "--force",
    "--sign",
    "-",
    "--identifier",
    bundleIdentifier,
    "--timestamp=none",
    stagingApp,
  ]);
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", stagingApp]);

  fs.mkdirSync(path.dirname(outputApp), { recursive: true, mode: 0o755 });
  fs.rmSync(outputApp, { recursive: true, force: true });
  fs.renameSync(stagingApp, outputApp);
} finally {
  fs.rmSync(stagingApp, { recursive: true, force: true });
}

console.log(`Built and signed watcher app: ${outputApp}`);
