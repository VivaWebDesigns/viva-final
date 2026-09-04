import os from "node:os";
import { claimNextScan, deleteExpiredScans, failExhaustedStaleScans, failScan } from "./features/technical-seo/repository";
import { processTechnicalSeoScan } from "./features/technical-seo/scanner";
import { diagnosticScanError } from "./features/technical-seo/errors";

const workerId = `${os.hostname()}:${process.pid}`;
const pollMs = Number(process.env.SCANNER_POLL_INTERVAL_MS ?? 2_000);
let stopping = false;
let lastCleanupAt = 0;

async function run() {
  console.log(`[technical-seo-worker] started worker=${workerId}`);
  while (!stopping) {
    try {
      await failExhaustedStaleScans();
      if (Date.now() - lastCleanupAt > 60 * 60 * 1000) {
        await deleteExpiredScans();
        lastCleanupAt = Date.now();
      }
      const scan = await claimNextScan(workerId);
      if (!scan) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      console.log(`[technical-seo-worker] processing scan=${scan.id} attempt=${scan.attemptCount}`);
      try {
        await processTechnicalSeoScan(scan, workerId);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        await failScan(scan, workerId, normalized);
        console.error(`[technical-seo-worker] scan=${scan.id} failed: ${diagnosticScanError(normalized)}`);
      }
    } catch (error) {
      console.error(`[technical-seo-worker] loop error: ${diagnosticScanError(error)}`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
void run();
