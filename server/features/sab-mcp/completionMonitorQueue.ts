import { createHash } from "node:crypto";
import { enqueueJob } from "../workflow/queue";
import {
  inSabRunStateQueue,
  recordSabCompletionMonitorScheduled,
} from "./runState";
import type { SabSheetsRepository } from "./sheets";
import type { SabCompletionMonitorPayload } from "./completionMonitor";

const SYSTEM_ACTOR = "sab-completion-monitor@vivawebdesigns.com";

function monitorSourceId(workflowSheet: string, runId: string, authorizationId: string) {
  return `sab-completion:${createHash("sha256")
    .update(JSON.stringify({ workflowSheet, runId, authorizationId }))
    .digest("hex")}`;
}

export async function scheduleSabCompletionMonitor(input: {
  workflow_sheet: string;
  sheet_name: string;
  run_id: string;
  authorization_id: string;
  repository: SabSheetsRepository;
  actor_email?: string;
}) {
  const now = new Date().toISOString();
  const payload: SabCompletionMonitorPayload = {
    workflow_sheet: input.workflow_sheet,
    sheet_name: input.sheet_name,
    run_id: input.run_id,
    authorization_id: input.authorization_id,
    scheduled_at: now,
    poll_count: 0,
  };
  const job = await enqueueJob(
    "sab_report_completion",
    payload,
    monitorSourceId(input.workflow_sheet, input.run_id, input.authorization_id),
    "sab_scan_batch",
    { maxAttempts: 5 },
  );
  await inSabRunStateQueue(async () => {
    const state = await input.repository.getRunState(input.run_id);
    const batch = state?.batches.find(candidate => candidate.authorization_id === input.authorization_id);
    if (!state || !batch) throw new Error("The completion monitor cannot find its exact SAB batch.");
    if (batch.completion_monitor?.status === "scheduled" || batch.completion_monitor?.status === "completed") return;
    const next = recordSabCompletionMonitorScheduled(state, input.authorization_id, now);
    await input.repository.saveRunState(next, state.version, input.actor_email ?? SYSTEM_ACTOR);
  });
  return { job_id: job.id, status: job.status, source_id: job.sourceId };
}
