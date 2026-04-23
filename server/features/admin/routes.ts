import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  user, contacts, docArticles, docCategories, integrationRecords, auditLogs,
  crmLeads, crmCompanies, crmContacts as crmContactsTable, pipelineOpportunities,
  session, account, notifications, notificationPreferences,
  chatMessages, chatDmMessages, chatReadState, chatReactions,
  crmLeadNotes, clientNotes, pipelineActivities,
  followupTasks, onboardingRecords, onboardingChecklistItems, onboardingNotes,
  attachments, demoConfigs, marketplacePendingOutreach,
} from "@shared/schema";
import { sql, desc, eq, or } from "drizzle-orm";
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
    ? enrichedLeads.map(l => ({ ...l, sellerProfileUrl: null, adUrl: null }))
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

router.get("/users", requireRole("admin", "developer"), async (req, res) => {
  try {
    const roleFilter = req.query.role as string | undefined;

    const baseQuery = roleFilter
      ? db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(eq(user.role, roleFilter))
          .orderBy(desc(user.createdAt))
      : db
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

    const rows = await baseQuery;
    res.json(rows);
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
      role: z.enum(["admin", "developer", "sales_rep", "lead_gen", "extension_worker"]).default("sales_rep"),
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
      role: z.enum(["admin", "developer", "sales_rep", "lead_gen", "extension_worker"]).optional(),
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

router.delete("/users/:id", requireRole("admin"), async (req, res) => {
  const targetId = req.params.id as string;

  // 1. Self-delete guard
  if (req.authUser?.id === targetId) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }

  // 2. Verify user exists and capture details for audit log
  const [target] = await db.select().from(user).where(eq(user.id, targetId));
  if (!target) return res.status(404).json({ message: "User not found." });

  // 3. Last-admin guard
  if (target.role === "admin") {
    const [{ count: remainingAdmins }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(sql`role = 'admin' AND id != ${targetId}`);
    if (remainingAdmins === 0) {
      return res.status(400).json({ message: "Cannot delete the last admin account." });
    }
  }

  // 4. Business-record safety check — block before touching anything if records exist
  const [
    [{ count: chatMsgCount }],
    [{ count: chatDmCount }],
    [{ count: mpoCount }],
    [{ count: leadsCount }],
    [{ count: leadNotesCount }],
    [{ count: clientNotesCount }],
    [{ count: opportunitiesCount }],
    [{ count: activitiesCount }],
    [{ count: tasksCount }],
    [{ count: onboardingCount }],
    [{ count: checklistCount }],
    [{ count: onboardingNotesCount }],
    [{ count: attachmentsCount }],
    [{ count: articlesCount }],
    [{ count: demosCount }],
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(chatMessages).where(eq(chatMessages.senderId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(chatDmMessages).where(or(eq(chatDmMessages.senderId, targetId), eq(chatDmMessages.recipientId, targetId))),
    db.select({ count: sql<number>`count(*)::int` }).from(marketplacePendingOutreach).where(eq(marketplacePendingOutreach.createdBy, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(crmLeads).where(eq(crmLeads.assignedTo, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(crmLeadNotes).where(eq(crmLeadNotes.authorId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(clientNotes).where(eq(clientNotes.authorId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(pipelineOpportunities).where(eq(pipelineOpportunities.assignedTo, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(pipelineActivities).where(eq(pipelineActivities.userId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(followupTasks).where(or(eq(followupTasks.assignedTo, targetId), eq(followupTasks.createdBy, targetId))),
    db.select({ count: sql<number>`count(*)::int` }).from(onboardingRecords).where(eq(onboardingRecords.assignedTo, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(onboardingChecklistItems).where(eq(onboardingChecklistItems.completedBy, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(onboardingNotes).where(eq(onboardingNotes.userId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(attachments).where(eq(attachments.uploaderUserId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(docArticles).where(eq(docArticles.authorId, targetId)),
    db.select({ count: sql<number>`count(*)::int` }).from(demoConfigs).where(eq(demoConfigs.createdByUserId, targetId)),
  ]);

  const blockers: Record<string, number> = {};
  if (chatMsgCount > 0) blockers.chatMessages = chatMsgCount;
  if (chatDmCount > 0) blockers.directMessages = chatDmCount;
  if (mpoCount > 0) blockers.marketplaceLeads = mpoCount;
  if (leadsCount > 0) blockers.assignedLeads = leadsCount;
  if (leadNotesCount > 0) blockers.leadNotes = leadNotesCount;
  if (clientNotesCount > 0) blockers.clientNotes = clientNotesCount;
  if (opportunitiesCount > 0) blockers.opportunities = opportunitiesCount;
  if (activitiesCount > 0) blockers.pipelineActivities = activitiesCount;
  if (tasksCount > 0) blockers.tasks = tasksCount;
  if (onboardingCount > 0) blockers.onboardingRecords = onboardingCount;
  if (checklistCount > 0) blockers.checklistItems = checklistCount;
  if (onboardingNotesCount > 0) blockers.onboardingNotes = onboardingNotesCount;
  if (attachmentsCount > 0) blockers.attachments = attachmentsCount;
  if (articlesCount > 0) blockers.docArticles = articlesCount;
  if (demosCount > 0) blockers.demoConfigs = demosCount;

  if (Object.keys(blockers).length > 0) {
    return res.status(409).json({
      message: "This user has existing records and cannot be deleted. Ban the account instead to preserve history.",
      blockers,
    });
  }

  // 5. All clear — auto-clean auth plumbing and ephemeral data, then delete
  await db.update(auditLogs).set({ userId: null }).where(eq(auditLogs.userId, targetId));
  await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, targetId));
  await db.delete(notifications).where(eq(notifications.recipientId, targetId));
  await db.delete(chatReadState).where(eq(chatReadState.userId, targetId));
  await db.delete(chatReactions).where(eq(chatReactions.userId, targetId));
  await db.delete(session).where(eq(session.userId, targetId));
  await db.delete(account).where(eq(account.userId, targetId));

  // 6. Delete user
  await db.delete(user).where(eq(user.id, targetId));

  await logAudit({
    userId: req.authUser?.id,
    action: "delete_user",
    entity: "user",
    entityId: targetId,
    metadata: { name: target.name, email: target.email, role: target.role },
    ipAddress: req.ip,
  });

  res.json({ message: "User deleted successfully." });
});

export default router;
