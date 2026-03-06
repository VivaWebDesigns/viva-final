import * as crmStorage from "./storage";

const DEFAULT_STATUSES = [
  { name: "New", slug: "new", color: "#3B82F6", sortOrder: 0, isDefault: true, isClosed: false },
  { name: "Contacted", slug: "contacted", color: "#8B5CF6", sortOrder: 1, isDefault: false, isClosed: false },
  { name: "Qualified", slug: "qualified", color: "#F59E0B", sortOrder: 2, isDefault: false, isClosed: false },
  { name: "Proposal", slug: "proposal", color: "#F97316", sortOrder: 3, isDefault: false, isClosed: false },
  { name: "Won", slug: "won", color: "#10B981", sortOrder: 4, isDefault: false, isClosed: true },
  { name: "Lost", slug: "lost", color: "#EF4444", sortOrder: 5, isDefault: false, isClosed: true },
];

export async function seedCrmStatuses() {
  for (const status of DEFAULT_STATUSES) {
    await crmStorage.upsertLeadStatus(status);
  }
  return { count: DEFAULT_STATUSES.length };
}
