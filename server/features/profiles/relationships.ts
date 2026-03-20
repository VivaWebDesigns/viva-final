import { db } from "../../db";
import {
  crmLeads,
  crmCompanies,
  pipelineOpportunities,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import type { ResolvedIdentity } from "./types";

export async function resolveByCompanyId(
  companyId: string,
): Promise<ResolvedIdentity> {
  const [company] = await db
    .select({ id: crmCompanies.id })
    .from(crmCompanies)
    .where(eq(crmCompanies.id, companyId));

  if (!company) throw new Error(`Company not found: ${companyId}`);

  const [lead] = await db
    .select({ id: crmLeads.id })
    .from(crmLeads)
    .where(eq(crmLeads.companyId, companyId))
    .limit(1);

  const [opportunity] = lead
    ? await db
        .select({ id: pipelineOpportunities.id })
        .from(pipelineOpportunities)
        .where(eq(pipelineOpportunities.leadId, lead.id))
        .limit(1)
    : [];

  return {
    companyId,
    leadId: lead?.id ?? null,
    opportunityId: opportunity?.id ?? null,
    resolvedVia: "company",
  };
}

export async function resolveByLeadId(
  leadId: string,
): Promise<ResolvedIdentity> {
  const [lead] = await db
    .select({ id: crmLeads.id, companyId: crmLeads.companyId })
    .from(crmLeads)
    .where(eq(crmLeads.id, leadId));

  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const [opportunity] = await db
    .select({ id: pipelineOpportunities.id })
    .from(pipelineOpportunities)
    .where(eq(pipelineOpportunities.leadId, leadId))
    .limit(1);

  return {
    companyId: lead.companyId ?? null,
    leadId,
    opportunityId: opportunity?.id ?? null,
    resolvedVia: "lead",
  };
}

export async function resolveByOpportunityId(
  opportunityId: string,
): Promise<ResolvedIdentity> {
  const [opp] = await db
    .select({
      id: pipelineOpportunities.id,
      leadId: pipelineOpportunities.leadId,
      companyId: pipelineOpportunities.companyId,
    })
    .from(pipelineOpportunities)
    .where(eq(pipelineOpportunities.id, opportunityId));

  if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

  let resolvedCompanyId = opp.companyId ?? null;

  if (!resolvedCompanyId && opp.leadId) {
    const [lead] = await db
      .select({ companyId: crmLeads.companyId })
      .from(crmLeads)
      .where(eq(crmLeads.id, opp.leadId));
    resolvedCompanyId = lead?.companyId ?? null;
  }

  return {
    companyId: resolvedCompanyId,
    leadId: opp.leadId ?? null,
    opportunityId,
    resolvedVia: "opportunity",
  };
}
