import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  crmLeads,
  crmContacts,
  crmLeadStatuses,
  pipelineOpportunities,
  pipelineStages,
  user,
  marketplaceQueueItems,
} from "@shared/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { scoreHispanicName } from "./nameScore";

const router = Router();

function normalizeSellerUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

async function findExistingCrmLead(normalizedUrl: string) {
  const [row] = await db
    .select({
      leadId: crmLeads.id,
      leadFirstName: crmContacts.firstName,
      leadLastName: crmContacts.lastName,
      assignedToUserId: user.id,
      assignedToName: user.name,
      stageName: pipelineStages.name,
      statusName: crmLeadStatuses.name,
    })
    .from(crmLeads)
    .innerJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
    .leftJoin(user, eq(crmLeads.assignedTo, user.id))
    .leftJoin(pipelineOpportunities, eq(pipelineOpportunities.leadId, crmLeads.id))
    .leftJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
    .leftJoin(crmLeadStatuses, eq(crmLeads.statusId, crmLeadStatuses.id))
    .where(
      and(
        sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedUrl}`,
        eq(crmLeads.source, "outreach")
      )
    )
    .orderBy(desc(crmLeads.createdAt))
    .limit(1);
  return row ?? null;
}

router.post(
  "/check-seller",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({ sellerProfileUrl: z.string().url() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);
    const row = await findExistingCrmLead(normalizedUrl);

    if (!row) {
      return res.json({
        exists: false,
        leadId: null,
        leadName: null,
        assignedTo: null,
        currentStage: null,
      });
    }

    const leadName =
      [row.leadFirstName, row.leadLastName].filter(Boolean).join(" ") || null;

    return res.json({
      exists: true,
      leadId: row.leadId,
      leadName,
      assignedTo: row.assignedToUserId
        ? { name: row.assignedToName, userId: row.assignedToUserId }
        : null,
      currentStage: row.stageName ?? row.statusName ?? null,
    });
  }
);

router.post(
  "/name-score",
  requireAuth,
  async (req, res) => {
    const schema = z.object({ sellerName: z.string().min(2) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const result = scoreHispanicName(parsed.data.sellerName);
    return res.json(result);
  }
);

// ─── Queue Endpoints ───────────────────────────────────────────

const addToQueueSchema = z.object({
  sellerName: z.string().min(1),
  sellerProfileUrl: z.string().url(),
  adUrl: z.string().url().optional().or(z.literal("")),
  trade: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

router.post(
  "/queue",
  requireRole("admin", "lead_gen"),
  async (req, res) => {
    const parsed = addToQueueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const { sellerName, sellerProfileUrl, adUrl, trade, city, state } = parsed.data;
    const normalizedUrl = normalizeSellerUrl(sellerProfileUrl);
    const normalizedAdUrl = adUrl ? normalizeSellerUrl(adUrl) : null;

    const scoreResult = scoreHispanicName(sellerName);

    if (scoreResult.hispanicNameScore < 70) {
      const [item] = await db
        .insert(marketplaceQueueItems)
        .values({
          sellerName: sellerName.trim(),
          sellerProfileUrl: normalizedUrl,
          adUrl: normalizedAdUrl,
          trade: trade?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          normalizedName: scoreResult.normalizedName,
          firstName: scoreResult.firstName,
          lastName: scoreResult.lastName,
          hispanicNameScore: scoreResult.hispanicNameScore,
          spanishOutreachRecommended: scoreResult.spanishOutreachRecommended,
          status: "auto_skipped",
          addedBy: req.authUser?.id ?? null,
        })
        .returning();
      return res.status(201).json({
        item,
        autoSkipped: true,
        reason: "Hispanic name score below threshold (< 70)",
      });
    }

    const existingLead = await findExistingCrmLead(normalizedUrl);
    if (existingLead) {
      const leadName =
        [existingLead.leadFirstName, existingLead.leadLastName].filter(Boolean).join(" ") || null;
      return res.status(200).json({
        alreadyInCrm: true,
        existingLeadId: existingLead.leadId,
        existingLeadName: leadName,
      });
    }

    const [item] = await db
      .insert(marketplaceQueueItems)
      .values({
        sellerName: sellerName.trim(),
        sellerProfileUrl: normalizedUrl,
        adUrl: normalizedAdUrl,
        trade: trade?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        normalizedName: scoreResult.normalizedName,
        firstName: scoreResult.firstName,
        lastName: scoreResult.lastName,
        hispanicNameScore: scoreResult.hispanicNameScore,
        spanishOutreachRecommended: scoreResult.spanishOutreachRecommended,
        status: "pending",
        addedBy: req.authUser?.id ?? null,
      })
      .returning();

    return res.status(201).json({ item, autoSkipped: false, alreadyInCrm: false });
  }
);

const queueStatusSchema = z.enum(["pending", "reviewed", "skipped", "converted", "auto_skipped"]);

router.get(
  "/queue",
  requireRole("admin", "lead_gen"),
  async (req, res) => {
    const statusRaw = req.query.status as string | undefined;
    let statusParam: z.infer<typeof queueStatusSchema> | undefined;

    if (statusRaw !== undefined) {
      const parsed = queueStatusSchema.safeParse(statusRaw);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      statusParam = parsed.data;
    }

    const rows = await db
      .select()
      .from(marketplaceQueueItems)
      .where(
        statusParam !== undefined
          ? eq(marketplaceQueueItems.status, statusParam)
          : ne(marketplaceQueueItems.status, "auto_skipped")
      )
      .orderBy(desc(marketplaceQueueItems.createdAt));

    return res.json(rows);
  }
);

router.get(
  "/queue/counts",
  requireRole("admin", "lead_gen"),
  async (req, res) => {
    const rows = await db
      .select({
        status: marketplaceQueueItems.status,
        count: sql<number>`count(*)::int`,
      })
      .from(marketplaceQueueItems)
      .groupBy(marketplaceQueueItems.status);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.status] = row.count;
    }
    return res.json(counts);
  }
);

const patchQueueSchema = z.object({
  status: z.enum(["reviewed", "skipped", "converted"]),
  createdLeadId: z.string().optional(),
});

router.patch(
  "/queue/:id",
  requireRole("admin", "lead_gen"),
  async (req, res) => {
    const { id } = req.params;
    const parsed = patchQueueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const [existing] = await db
      .select({ status: marketplaceQueueItems.status })
      .from(marketplaceQueueItems)
      .where(sql`${marketplaceQueueItems.id} = ${id}`)
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Queue item not found" });
    }

    if (existing.status === "converted") {
      return res.status(409).json({ message: "Cannot change status of a converted item" });
    }

    const [updated] = await db
      .update(marketplaceQueueItems)
      .set({
        status: parsed.data.status,
        createdLeadId: parsed.data.createdLeadId ?? undefined,
        updatedAt: new Date(),
      })
      .where(sql`${marketplaceQueueItems.id} = ${id}`)
      .returning();

    return res.json(updated);
  }
);

router.delete(
  "/queue/:id",
  requireRole("admin", "developer"),
  async (req, res) => {
    const { id } = req.params;

    const [deleted] = await db
      .delete(marketplaceQueueItems)
      .where(sql`${marketplaceQueueItems.id} = ${id}`)
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Queue item not found" });
    }

    return res.json({ success: true });
  }
);

export default router;
