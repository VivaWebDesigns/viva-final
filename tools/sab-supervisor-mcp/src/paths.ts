import { fileURLToPath } from "node:url";
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
export const watcherBinaryPath = path.join(
  swiftPackagePath,
  ".build",
  "release",
  "sab-permission-watcher",
);
