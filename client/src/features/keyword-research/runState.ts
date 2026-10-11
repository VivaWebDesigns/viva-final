import type { KeywordResearchProject } from "@shared/schema";
import type { ProjectRunStep } from "@shared/keywordResearch";

// Matches the server: a run still "running" after this long was interrupted and is never resubmitted on its own.
const STALE_RUN_MS = 45 * 60 * 1000;

/** Whether a background step is running, failed, or was interrupted, for the card that started it. */
export function runState(project: KeywordResearchProject, step: ProjectRunStep) {
  const run = project.activeRun;
  if (!run || run.step !== step) return { running: false, error: null as string | null };
  const stale = run.status === "running" && Date.now() - new Date(run.startedAt).getTime() > STALE_RUN_MS;
  if (stale) return { running: false, error: "The last run was interrupted (the server restarted). Nothing was re-run automatically; start it again." };
  return { running: run.status === "running", error: run.status === "failed" ? run.error ?? "The step failed." : null };
}

export function anyRunning(project: KeywordResearchProject | undefined) {
  const run = project?.activeRun;
  return !!run && run.status === "running" && Date.now() - new Date(run.startedAt).getTime() <= STALE_RUN_MS;
}
