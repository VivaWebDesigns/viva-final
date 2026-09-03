import type { WorkflowJob } from "@shared/schema";
import type { JobProcessingResult } from "../workflow/processor";
import { analyzeAndRecordSabReport, assertReportPlan } from "./orchestration";
import { checkLocalFalconReportCompletion, getSabRankedCells, SabReportPendingError } from "./localFalconRankedCells";
import {
  completeSabRunReports,
  inSabRunStateQueue,
  type SabRunState,
} from "./runState";
import {
  createSabSheetsRepositoryFactoryFromEnv,
  type SabSheetsRepositoryFactory,
} from "./sheets";
import { isNormalModeException } from "./usageOptimization";

const SYSTEM_ACTOR = "sab-completion-monitor@vivawebdesigns.com";
const COMPLETION_POLL_INTERVAL_MS = 5 * 60 * 1000;

export type SabCompletionMonitorPayload = {
  workflow_sheet: string;
  sheet_name: string;
  run_id: string;
  authorization_id: string;
  scheduled_at: string;
  poll_count: number;
};

type MonitorDependencies = {
  repositoryFactory?: SabSheetsRepositoryFactory;
  getReport?: typeof getSabRankedCells;
  checkCompletion?: typeof checkLocalFalconReportCompletion;
  analyze?: typeof analyzeAndRecordSabReport;
  now?: () => Date;
};

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function payloadFrom(value: unknown): SabCompletionMonitorPayload {
  const payload = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const pollCount = Number(payload.poll_count ?? 0);
  if (!Number.isSafeInteger(pollCount) || pollCount < 0) throw new Error("SAB completion poll count is invalid.");
  const scheduledAt = requiredString(payload.scheduled_at, "SAB completion monitor scheduled_at");
  if (!Number.isFinite(Date.parse(scheduledAt))) throw new Error("SAB completion monitor scheduled_at is invalid.");
  return {
    workflow_sheet: requiredString(payload.workflow_sheet, "Workflow Sheet"),
    sheet_name: requiredString(payload.sheet_name, "Workflow sheet name"),
    run_id: requiredString(payload.run_id, "Run ID"),
    authorization_id: requiredString(payload.authorization_id, "Batch authorization ID"),
    scheduled_at: scheduledAt,
    poll_count: pollCount,
  };
}

export function sabCompletionPollDelayMs(pollCount: number) {
  if (!Number.isSafeInteger(pollCount) || pollCount < 0) throw new Error("SAB completion poll count is invalid.");
  return COMPLETION_POLL_INTERVAL_MS;
}

export async function processSabCompletionMonitorJob(
  job: WorkflowJob,
  dependencies: MonitorDependencies = {},
): Promise<JobProcessingResult> {
  const payload = payloadFrom(job.payload);
  const now = dependencies.now?.() ?? new Date();
  const repositoryFactory = dependencies.repositoryFactory ?? createSabSheetsRepositoryFactoryFromEnv();
  const repository = repositoryFactory(payload.workflow_sheet, payload.sheet_name);
  const getReport = dependencies.getReport ?? getSabRankedCells;
  const checkCompletion = dependencies.checkCompletion ?? checkLocalFalconReportCompletion;
  const analyze = dependencies.analyze ?? analyzeAndRecordSabReport;
  const state = await repository.getRunState(payload.run_id);
  const batch = state?.batches.find(candidate => candidate.authorization_id === payload.authorization_id);
  if (!state || !batch) throw new Error("SAB completion monitor cannot find its exact run and batch.");
  if (batch.status === "completed" && batch.completion_monitor?.status === "completed") {
    return { status: "completed" };
  }
  if (batch.status !== "awaiting_completion" || batch.scans.some(scan => scan.submission_status !== "submitted" || !scan.report_key)) {
    throw new Error("SAB completion monitor requires an exact fully submitted awaiting-completion batch.");
  }

  const completion = await Promise.all(batch.scans.map(scan => checkCompletion(scan.report_key!)));
  const reschedule = (): JobProcessingResult => {
    const nextPayload = { ...payload, poll_count: payload.poll_count + 1 };
    return {
      status: "rescheduled",
      payload: nextPayload,
      nextRunAt: new Date(now.getTime() + sabCompletionPollDelayMs(payload.poll_count)),
    };
  };
  if (completion.some(value => !value)) return reschedule();

  let reports: Awaited<ReturnType<typeof getSabRankedCells>>[];
  try {
    reports = await Promise.all(batch.scans.map(scan => getReport(scan.report_key!, [scan.plan.place_id])));
  } catch (error) {
    // A provider replica may briefly return processing after the lightweight
    // status endpoint reported completion. Treat that race as expected state.
    if (error instanceof SabReportPendingError || (error instanceof Error && error.name === "SabReportPendingError")) return reschedule();
    throw error;
  }

  // Verify every immutable provider envelope before writing any classification.
  reports.forEach((report, index) => assertReportPlan(report, batch.scans[index].plan));
  return inSabRunStateQueue(async () => {
    const latest = await repository.getRunState(payload.run_id);
    const currentBatch = latest?.batches.find(candidate => candidate.authorization_id === payload.authorization_id);
    if (!latest || !currentBatch || currentBatch.status !== "awaiting_completion") {
      if (currentBatch?.status === "completed") return { status: "completed" } as const;
      throw new Error("SAB batch changed before completion monitoring could persist verified results.");
    }
    const rows: Array<{place_id:string;company:string;report_key:string;classification:string;reason:string}> = [];
    for (const [index, scan] of currentBatch.scans.entries()) {
      const report = reports[index];
      const decision = await analyze(repository, {
        run_id: payload.run_id,
        report_key: scan.report_key!,
        place_id: scan.plan.place_id,
        stage: scan.plan.scan_role,
      }, SYSTEM_ACTOR, { report, state: latest });
      const row = await repository.getCompany(scan.plan.place_id);
      const persistedDecision = row.decision_state as { evidence_hash?: unknown; source_report_key?: unknown } | null;
      if (persistedDecision?.evidence_hash !== decision.evidence_hash || persistedDecision?.source_report_key !== scan.report_key) {
        throw new Error("Server-side SAB completion readback did not retain the verified decision evidence.");
      }
      rows.push({
        place_id: scan.plan.place_id,
        company: row.company,
        report_key: scan.report_key!,
        classification: decision.action,
        reason: decision.reason,
      });
    }
    const completed = completeSabRunReports(latest, currentBatch.scans.map(scan => scan.report_key!));
    const completedBatch = completed.batches.find(candidate => candidate.authorization_id === payload.authorization_id)!;
    const classifications = [...new Set(rows.map(row => row.classification))].sort();
    completedBatch.completion_monitor = {
      status: "completed",
      scheduled_at: payload.scheduled_at,
      completed_at: now.toISOString(),
      poll_count: payload.poll_count + 1,
      report_count: rows.length,
      classification_counts: Object.fromEntries(classifications.map(classification => [
        classification,
        rows.filter(row => row.classification === classification).length,
      ])),
      exceptions: rows.filter(row => isNormalModeException(row.classification)),
    };
    await repository.saveRunState(completed, latest.version, SYSTEM_ACTOR);
    return { status: "completed" } as const;
  });
}
