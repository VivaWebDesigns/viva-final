import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { db } from "../../db";
import { crmCompanies } from "@shared/schema";
import { sql, desc, ilike, or, SQL } from "drizzle-orm";

const router = Router();

router.get("/", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const search = (req.query.search as string || "").trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const searchPattern = `%${search}%`;
    const whereClause: SQL | undefined = search
      ? or(
          ilike(crmCompanies.name, searchPattern),
          ilike(crmCompanies.industry, searchPattern),
          ilike(crmCompanies.city, searchPattern),
        )
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
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
        .$dynamic()
        .where(whereClause)
        .orderBy(desc(crmCompanies.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmCompanies)
        .$dynamic()
        .where(whereClause),
    ]);

    res.json({ items: rows, total, page, limit });
  } catch (err: any) {
    console.error("Clients list error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
