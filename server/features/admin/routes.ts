import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import { user, contacts, docArticles, docCategories, integrationRecords, auditLogs, crmLeads, crmCompanies, crmContacts as crmContactsTable, pipelineOpportunities } from "@shared/schema";
import { sql, desc, eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { logAudit } from "../audit/service";
import * as pipelineStorage from "../pipeline/storage";
import { z } from "zod";

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
  const [opportunityCount] = await db.select({ count: sql<number>`count(*)::int` }).from(pipelineOpportunities);
  const pipelineStats = await pipelineStorage.getPipelineStats();

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
    opportunities: opportunityCount.count,
    pipelineStats,
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

// ── User Management ──────────────────────────────────────────────────

router.get("/users", requireRole("admin"), async (_req, res) => {
  try {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/users", requireRole("admin"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["admin", "developer", "sales_rep"]).default("sales_rep"),
    });
    const { name, email, password, role: newRole } = schema.parse(req.body);

    const result = await auth.api.signUpEmail({ body: { name, email, password } });
    if (!result?.user?.id) throw new Error("Failed to create user");

    await db.update(user).set({ role: newRole }).where(eq(user.id, result.user.id));
    await logAudit({ action: "create_user", entity: "user", entityId: result.user.id, metadata: { email, role: newRole } });

    const [created] = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }).from(user).where(eq(user.id, result.user.id));
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/users/:id", requireRole("admin"), async (req, res) => {
  try {
    const schema = z.object({
      role: z.enum(["admin", "developer", "sales_rep"]).optional(),
      name: z.string().min(1).optional(),
      banned: z.boolean().optional(),
    });
    const updates = schema.parse(req.body);
    await db.update(user).set(updates).where(eq(user.id, req.params.id as string));
    await logAudit({ action: "update_user", entity: "user", entityId: req.params.id as string, metadata: updates });
    const [updated] = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, createdAt: user.createdAt }).from(user).where(eq(user.id, req.params.id as string));
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

import * as crmSeed from "../crm/seed-v2";

router.post("/seed", requireRole("admin"), async (_req, res) => {
  try {
    await crmSeed.seedFullDatabase();
    res.json({ message: "Seed complete" });
  } catch (error: any) {
    console.error("Seed error:", error);
    res.status(500).json({ message: error.message || "Failed to seed" });
  }
});

export default router;
