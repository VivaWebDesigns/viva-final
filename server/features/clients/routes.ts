import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { db } from "../../db";
import { crmCompanies, crmContacts, crmLeads, pipelineOpportunities, onboardingRecords } from "@shared/schema";
import { sql, desc, eq, count } from "drizzle-orm";

const router = Router();

router.get("/", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const search = (req.query.search as string || "").toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: crmCompanies.id,
        name: crmCompanies.name,
        dba: crmCompanies.dba,
        industry: crmCompanies.industry,
        city: crmCompanies.city,
        state: crmCompanies.state,
        phone: crmCompanies.phone,
        email: crmCompanies.email,
        website: crmCompanies.website,
        createdAt: crmCompanies.createdAt,
        contactCount: sql<number>`(
          SELECT count(*)::int FROM crm_contacts WHERE company_id = ${crmCompanies.id}
        )`,
        leadCount: sql<number>`(
          SELECT count(*)::int FROM crm_leads WHERE company_id = ${crmCompanies.id}
        )`,
        opportunityValue: sql<number>`(
          SELECT coalesce(sum(value::numeric), 0) FROM pipeline_opportunities WHERE company_id = ${crmCompanies.id}
        )`,
        opportunityCount: sql<number>`(
          SELECT count(*)::int FROM pipeline_opportunities WHERE company_id = ${crmCompanies.id}
        )`,
        activeOnboardings: sql<number>`(
          SELECT count(*)::int FROM onboarding_records WHERE company_id = ${crmCompanies.id} AND status NOT IN ('completed', 'on_hold')
        )`,
      })
      .from(crmCompanies)
      .orderBy(desc(crmCompanies.createdAt))
      .limit(limit)
      .offset(offset);

    const filtered = search
      ? rows.filter(r =>
          r.name.toLowerCase().includes(search) ||
          (r.industry || "").toLowerCase().includes(search) ||
          (r.city || "").toLowerCase().includes(search)
        )
      : rows;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmCompanies);

    res.json({ items: filtered, total, page, limit });
  } catch (err: any) {
    console.error("Clients list error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
