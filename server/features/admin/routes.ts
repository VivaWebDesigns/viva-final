import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import { user, contacts, docArticles, docCategories, integrationRecords, auditLogs, crmLeads, crmCompanies, crmContacts as crmContactsTable, pipelineOpportunities } from "@shared/schema";
import { sql, desc, eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { logAudit } from "../audit/service";
import * as pipelineStorage from "../pipeline/storage";
import * as crmStorage from "../crm/storage";
import { z } from "zod";

const router = Router();

router.get("/stats", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
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

  const rawRecentLeads = await db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt)).limit(5);
  const enrichedLeads = await crmStorage.enrichLeads(rawRecentLeads);
  const recentLeads = req.authUser?.role === "sales_rep"
    ? enrichedLeads.map(l => ({ ...l, sellerProfileUrl: null }))
    : enrichedLeads;

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

router.get("/audit-logs", requireRole("admin", "developer"), async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  res.json(logs);
});

// Bootstrap endpoint — creates the first admin account.
// Security gates (both must pass before execution):
//   1. Blocked entirely in production unless SEED_ADMIN_SECRET is set in the environment.
//   2. When SEED_ADMIN_SECRET is set, the caller must supply the matching value in the
//      X-Seed-Secret request header. Without a matching secret the request is rejected.
// Admin email and password are read exclusively from environment variables:
//   SEED_ADMIN_EMAIL   — required (no default)
//   SEED_ADMIN_PASSWORD — required (no default)
// Idempotent: returns success without re-creating if the account already exists.
router.post("/seed-admin", async (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const seedSecret   = process.env.SEED_ADMIN_SECRET;

  // Gate 1: block in production when no secret is configured.
  if (isProduction && !seedSecret) {
    return res.status(403).json({ message: "Bootstrap endpoint is disabled in production. Set SEED_ADMIN_SECRET to enable it." });
  }

  // Gate 2: when a secret is configured (any environment), require it in the header.
  if (seedSecret) {
    const provided = req.headers["x-seed-secret"];
    if (!provided || provided !== seedSecret) {
      return res.status(403).json({ message: "Missing or invalid X-Seed-Secret header." });
    }
  }

  const adminEmail    = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return res.status(400).json({ message: "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables must be set." });
  }

  try {
    const existing = await db.select().from(user).where(eq(user.email, adminEmail));
    if (existing.length > 0) {
      return res.json({ message: "Admin user already exists", userId: existing[0].id });
    }

    const result = await auth.api.signUpEmail({
      body: { name: "Admin", email: adminEmail, password: adminPassword },
    });

    if (result?.user?.id) {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, result.user.id));
      await logAudit({
        action: "seed_admin",
        entity: "user",
        entityId: result.user.id,
        metadata: { email: adminEmail },
        ipAddress: req.ip,
      });
    }

    res.json({ message: "Admin user created", userId: result?.user?.id });
  } catch (error: any) {
    console.error("Seed admin error:", error);
    res.status(500).json({ message: error.message || "Failed to seed admin" });
  }
});

// ── Full Feature Seed (all config data) ──────────────────────────────
// Runs all feature seeds idempotently: CRM statuses, pipeline stages,
// onboarding templates, integrations, and App Docs articles.
// Does NOT create or modify user accounts.
// Requires X-Seed-Secret header matching SEED_ADMIN_SECRET env var.
// Returns a summary of what was seeded.

router.post("/seed-all", requireRole("admin"), async (req, res) => {
  const seedSecret = process.env.SEED_ADMIN_SECRET;
  if (seedSecret) {
    const provided = req.headers["x-seed-secret"];
    if (!provided || provided !== seedSecret) {
      return res.status(403).json({ message: "Missing or invalid X-Seed-Secret header." });
    }
  }

  try {
    const { runFeatureSeeds } = await import("../../bootstrap");
    const results = await runFeatureSeeds();
    const failed = results.filter((r) => !r.ok);
    const succeeded = results.filter((r) => r.ok);

    if (failed.length === results.length) {
      return res.status(500).json({
        message: "All feature seeds failed.",
        ok: false,
        results,
      });
    }

    if (failed.length > 0) {
      return res.status(207).json({
        message: `${succeeded.length} of ${results.length} seeds succeeded. ${failed.length} failed.`,
        ok: false,
        results,
      });
    }

    res.json({
      message: `All ${results.length} feature seeds completed successfully.`,
      ok: true,
      results,
    });
  } catch (err: any) {
    console.error("[seed-all] error:", err);
    res.status(500).json({ message: err.message || "Seed failed" });
  }
});

// ── User Management ──────────────────────────────────────────────────

router.get("/users", requireRole("admin", "developer"), async (_req, res) => {
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
      role: z.enum(["admin", "developer", "sales_rep", "lead_gen"]).default("sales_rep"),
    });
    const { name, email, password, role: newRole } = schema.parse(req.body);

    const result = await auth.api.signUpEmail({ body: { name, email, password } });
    if (!result?.user?.id) throw new Error("Failed to create user");

    await db.update(user).set({ role: newRole }).where(eq(user.id, result.user.id));
    await logAudit({
      userId: req.authUser?.id,
      action: "create_user",
      entity: "user",
      entityId: result.user.id,
      metadata: { email, role: newRole, name },
      ipAddress: req.ip,
    });

    const [created] = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }).from(user).where(eq(user.id, result.user.id));
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/users/:id", requireRole("admin"), async (req, res) => {
  try {
    const schema = z.object({
      role: z.enum(["admin", "developer", "sales_rep", "lead_gen"]).optional(),
      name: z.string().min(1).optional(),
      banned: z.boolean().optional(),
    });
    const updates = schema.parse(req.body);
    await db.update(user).set(updates).where(eq(user.id, req.params.id as string));
    await logAudit({
      userId: req.authUser?.id,
      action: "update_user",
      entity: "user",
      entityId: req.params.id as string,
      metadata: updates,
      ipAddress: req.ip,
    });
    const [updated] = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, createdAt: user.createdAt }).from(user).where(eq(user.id, req.params.id as string));
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
