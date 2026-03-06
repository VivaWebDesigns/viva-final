import * as pipelineStorage from "./storage";

const DEFAULT_STAGES = [
  { name: "Discovery", slug: "discovery", color: "#3B82F6", sortOrder: 0, isDefault: true, isClosed: false },
  { name: "Proposal", slug: "proposal", color: "#8B5CF6", sortOrder: 1, isDefault: false, isClosed: false },
  { name: "Negotiation", slug: "negotiation", color: "#F59E0B", sortOrder: 2, isDefault: false, isClosed: false },
  { name: "Closed Won", slug: "closed-won", color: "#10B981", sortOrder: 3, isDefault: false, isClosed: true },
  { name: "Closed Lost", slug: "closed-lost", color: "#EF4444", sortOrder: 4, isDefault: false, isClosed: true },
];

export async function seedPipelineStages() {
  for (const stage of DEFAULT_STAGES) {
    await pipelineStorage.upsertStage(stage);
  }
  return { count: DEFAULT_STAGES.length };
}
