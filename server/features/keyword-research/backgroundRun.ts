import type { KeywordResearchProject } from "@shared/schema";
import type { ProjectRunStep } from "@shared/keywordResearch";
import { updateProject } from "./repository";

/** A run still marked "running" after this long was interrupted (a deploy or restart). It is never resubmitted on its own: the paid work is not repeated without someone asking. */
export const STALE_RUN_MS = 45 * 60 * 1000;

type Changes = Parameters<typeof updateProject>[1];

export function runBusy(project: KeywordResearchProject) {
  const run = project.activeRun;
  return run?.status === "running" && Date.now() - new Date(run.startedAt).getTime() < STALE_RUN_MS;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The step failed.";
}

/**
 * Marks the step running, answers right away with the project, and finishes the work after the response, so a
 * 2-minute step never hits the proxy's request timeout. The page polls the project until the run is done or failed.
 */
export async function startRun(project: KeywordResearchProject, step: ProjectRunStep, work: () => Promise<{ changes: Changes; cost: number }>) {
  const startedAt = new Date().toISOString();
  const started = await updateProject(project.id, { activeRun: { step, status: "running", startedAt, finishedAt: null, error: null } });
  void work()
    .then(({ changes, cost }) => updateProject(project.id, { ...changes, activeRun: { step, status: "done", startedAt, finishedAt: new Date().toISOString(), error: null } }, cost))
    .catch(error => {
      console.error(`[keyword-research] ${step} failed for ${project.id}:`, error);
      return updateProject(project.id, { activeRun: { step, status: "failed", startedAt, finishedAt: new Date().toISOString(), error: message(error) } });
    })
    .catch(error => console.error(`[keyword-research] could not record the ${step} result for ${project.id}:`, error));
  return started;
}
