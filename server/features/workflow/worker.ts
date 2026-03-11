/**
 * Workflow Worker — Polling Outbox Processor
 *
 * Polls the workflow_jobs table every POLL_INTERVAL_MS milliseconds and
 * processes one ready job per tick. Integrates with the bootstrap lifecycle.
 *
 * Call startWorker() once after the server is listening.
 * Call stopWorker() for clean shutdown (tests, SIGTERM).
 */

import { claimNextJob, markJobCompleted, markJobFailed } from "./queue";
import { processJob } from "./processor";

const POLL_INTERVAL_MS = 5_000;
const TAG = "[worker]";

let interval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function startWorker(): void {
  if (interval) return;
  interval = setInterval(tick, POLL_INTERVAL_MS);
  console.log(`${TAG} outbox processor started (${POLL_INTERVAL_MS / 1000}s poll interval)`);
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    console.log(`${TAG} outbox processor stopped`);
  }
}

async function tick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const job = await claimNextJob();
    if (!job) return;

    console.log(`${TAG} processing job ${job.id} type=${job.type} attempt=${job.attempts}`);

    try {
      await processJob(job);
      await markJobCompleted(job.id);
      console.log(`${TAG} job ${job.id} completed`);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`${TAG} job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}): ${msg}`);
      await markJobFailed(job.id, msg, job.attempts, job.maxAttempts);
    }
  } catch (err: any) {
    console.error(`${TAG} worker tick error: ${err?.message ?? err}`);
  } finally {
    isRunning = false;
  }
}
