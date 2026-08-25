import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

export const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const reviewPromptPath = path.join(
  packageRoot,
  "prompts",
  "reviewer.md",
);
export const reviewSchemaPath = path.join(
  packageRoot,
  "assets",
  "review-result.schema.json",
);
export const swiftPackagePath = path.join(packageRoot, "swift");
export const watcherAppName = "SAB Permission Watcher.app";
export const watcherBundleIdentifier = "com.viva.sab-permission-watcher";
export const builtWatcherAppPath = path.join(
  packageRoot,
  "build",
  watcherAppName,
);
export const builtWatcherBinaryPath = path.join(
  builtWatcherAppPath,
  "Contents",
  "MacOS",
  "sab-permission-watcher",
);
export const installedWatcherAppPath = path.join(
  os.homedir(),
  "Applications",
  watcherAppName,
);
export const installedWatcherBinaryPath = path.join(
  installedWatcherAppPath,
  "Contents",
  "MacOS",
  "sab-permission-watcher",
);
