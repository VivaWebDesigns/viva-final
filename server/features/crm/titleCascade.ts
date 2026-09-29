import { eq } from "drizzle-orm";
import { db } from "../../db";
import { crmLeads, pipelineOpportunities } from "@shared/schema";

type OwnerColumn = "companyId" | "contactId";

// Rewrites lead and opportunity titles that embed a renamed company or contact name.
async function cascadeNameToTitles(owner: OwnerColumn, ownerId: string, oldName: string, newName: string) {
  if (!oldName || oldName === newName) return;
  const [leads, opps] = await Promise.all([
    db.select({ id: crmLeads.id, title: crmLeads.title })
      .from(crmLeads).where(eq(crmLeads[owner], ownerId)),
    db.select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
      .from(pipelineOpportunities).where(eq(pipelineOpportunities[owner], ownerId)),
  ]);

  const leadUpdates = leads
    .filter((lead) => lead.title?.includes(oldName))
    .map((lead) => db.update(crmLeads).set({ title: lead.title!.replace(oldName, newName) }).where(eq(crmLeads.id, lead.id)));

  const oppUpdates = opps.flatMap((opp) => {
    const updates: Record<string, string> = {};
    if (opp.title.includes(oldName)) updates.title = opp.title.replace(oldName, newName);
    if (opp.sourceLeadTitle?.includes(oldName)) updates.sourceLeadTitle = opp.sourceLeadTitle.replace(oldName, newName);
    if (Object.keys(updates).length === 0) return [];
    return [db.update(pipelineOpportunities).set(updates).where(eq(pipelineOpportunities.id, opp.id))];
  });

  await Promise.all([...leadUpdates, ...oppUpdates]);
}

export function cascadeCompanyNameToTitles(companyId: string, oldName: string, newName: string) {
  return cascadeNameToTitles("companyId", companyId, oldName, newName);
}

export function cascadeContactNameToTitles(contactId: string, oldFullName: string, newFullName: string) {
  return cascadeNameToTitles("contactId", contactId, oldFullName, newFullName);
}
