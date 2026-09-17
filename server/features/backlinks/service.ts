import type { BacklinkInput } from "./schema";
import { assembleBacklinkReport, backlinkPlan, type BacklinkPlan, type BacklinkReport } from "./report";
import { dataForSeoBacklinksConfigured, fetchBacklinkSection, type BacklinkRequest, type BacklinkSection } from "./provider";

export type Snapshot = {
  id: string; fingerprint: string; domain: string; kind: string; status: string;
  createdAt: Date; completedAt: Date | null; report: unknown; sections: unknown;
};
export interface BacklinkStore {
  claim(plan: BacklinkPlan, actor: string): Promise<{ created: boolean; snapshot: Snapshot }>;
  saveSection(id: string, key: string, section: BacklinkSection): Promise<void>;
  finish(id: string, report: BacklinkReport): Promise<Snapshot>;
}
export async function runBacklinkSnapshot(input: BacklinkInput, actor: string, store: BacklinkStore, options: {
  now?: Date; configured?: boolean; fetchSection?: (request: BacklinkRequest) => Promise<BacklinkSection>;
} = {}) {
  const plan = backlinkPlan(input, options.now);
  if (plan.estimated_cost_usd > input.max_cost_usd) throw new Error(`Estimated API cost $${plan.estimated_cost_usd.toFixed(4)} exceeds max_cost_usd; no requests submitted.`);
  if (!(options.configured ?? dataForSeoBacklinksConfigured())) throw new Error("DataForSEO credentials are not configured; no requests submitted.");
  const { snapshot, created } = await store.claim(plan, actor);
  if (snapshot.fingerprint !== plan.fingerprint) throw new Error("refresh_id was already used for a different report. Reuse its original inputs or explicitly request a new report.");
  if (!created) return { snapshot_id: snapshot.id, created_at: snapshot.createdAt, completed_at: snapshot.completedAt,
    cached: true, charged_this_call_usd: 0, status: snapshot.status, report: snapshot.report,
    ...(snapshot.status === "running" ? { partial_receipts: snapshot.sections, message: "This snapshot was already claimed. It may be running or interrupted; no automatic resubmission. Read history before explicitly requesting a new refresh." } : {}) };
  const sections: Record<string, BacklinkSection> = {};
  const fetchSection = options.fetchSection ?? fetchBacklinkSection;
  // Bounded fan-out; each receipt is durably recorded before advancing to the next batch.
  for (let offset = 0; offset < plan.requests.length; offset += 4) {
    const batch = await Promise.allSettled(plan.requests.slice(offset, offset + 4).map(async request => {
      const section = await fetchSection({ ...request, body: { ...request.body, tag: `viva:${snapshot.id}:${request.section}` } });
      sections[request.section] = section;
      await store.saveSection(snapshot.id, request.section, section);
    }));
    if (batch.some(result => result.status === "rejected")) throw new Error(`Snapshot ${snapshot.id} was interrupted. Retrieve its saved receipts; do not automatically resubmit paid work.`);
  }
  const report = assembleBacklinkReport(plan, sections);
  const saved = await store.finish(snapshot.id, report);
  return { snapshot_id: saved.id, created_at: saved.createdAt, completed_at: saved.completedAt,
    cached: false, status: saved.status, charged_this_call_usd: report.receipt.cost_complete ? report.receipt.known_cost_usd : null, report };
}
