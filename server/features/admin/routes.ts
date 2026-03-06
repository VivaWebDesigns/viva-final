import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import { user, contacts, docArticles, docCategories, integrationRecords, auditLogs, crmLeads, crmCompanies, crmContacts as crmContactsTable } from "@shared/schema";
import { sql, desc, eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { logAudit } from "../audit/service";

const router = Router();

router.get("/stats", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  const [contactCount] = await db.select({ count: sql<number>`count(*)::int` }).from(contacts);
  const [articleCount] = await db.select({ count: sql<number>`count(*)::int` }).from(docArticles);
  const [categoryCount] = await db.select({ count: sql<number>`count(*)::int` }).from(docCategories);
  const [integrationCount] = await db.select({ count: sql<number>`count(*)::int` }).from(integrationRecords);
  const [leadCount] = await db.select({ count: sql<number>`count(*)::int` }).from(crmLeads);
  const [companyCount] = await db.select({ count: sql<number>`count(*)::int` }).from(crmCompanies);
  const [crmContactCount] = await db.select({ count: sql<number>`count(*)::int` }).from(crmContactsTable);

  const recentLeads = await db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt)).limit(5);

  res.json({
    users: userCount.count,
    contacts: contactCount.count,
    articles: articleCount.count,
    categories: categoryCount.count,
    integrations: integrationCount.count,
    leads: leadCount.count,
    companies: companyCount.count,
    crmContacts: crmContactCount.count,
    recentLeads,
  });
});

router.get("/audit-logs", requireRole("admin"), async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  res.json(logs);
});

router.post("/seed-admin", async (req, res) => {
  try {
    const existing = await db.select().from(user).where(eq(user.email, "admin@vivawebdesigns.com"));
    if (existing.length > 0) {
      return res.json({ message: "Admin user already exists", userId: existing[0].id });
    }

    const result = await auth.api.signUpEmail({
      body: {
        name: "Admin",
        email: "admin@vivawebdesigns.com",
        password: "VivaAdmin2026!",
      },
    });

    if (result?.user?.id) {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, result.user.id));
      await logAudit({
        action: "seed_admin",
        entity: "user",
        entityId: result.user.id,
        metadata: { email: "admin@vivawebdesigns.com" },
      });
    }

    res.json({ message: "Admin user created", userId: result?.user?.id });
  } catch (error: any) {
    console.error("Seed admin error:", error);
    res.status(500).json({ message: error.message || "Failed to seed admin" });
  }
});

export default router;
