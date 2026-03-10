import * as pipelineStorage from "./storage";

const DEFAULT_STAGES = [
  { name: "New Lead",       slug: "new-lead",       color: "#3B82F6", sortOrder: 0, isDefault: true,  isClosed: false },
  { name: "Contacted",      slug: "contacted",      color: "#6366F1", sortOrder: 1, isDefault: false, isClosed: false },
  { name: "Demo Scheduled", slug: "demo-scheduled", color: "#8B5CF6", sortOrder: 2, isDefault: false, isClosed: false },
  { name: "Demo Completed", slug: "demo-completed", color: "#F59E0B", sortOrder: 3, isDefault: false, isClosed: false },
  { name: "Payment Sent",   slug: "payment-sent",   color: "#F97316", sortOrder: 4, isDefault: false, isClosed: false },
  { name: "Closed \u2013 Won",  slug: "closed-won",     color: "#10B981", sortOrder: 5, isDefault: false, isClosed: true  },
  { name: "Closed \u2013 Lost", slug: "closed-lost",    color: "#EF4444", sortOrder: 6, isDefault: false, isClosed: true  },
];

export async function seedPipelineStages() {
  for (const stage of DEFAULT_STAGES) {
    await pipelineStorage.upsertStage(stage);
  }
  return { count: DEFAULT_STAGES.length };
}
