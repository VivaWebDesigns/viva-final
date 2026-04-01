import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  crmLeads,
  crmContacts,
  crmCompanies,
  crmLeadNotes,
  crmLeadStatuses,
  pipelineOpportunities,
  pipelineStages,
  user,
  marketplaceQueueItems,
} from "@shared/schema";
import { eq, and, desc, sql, ne, ilike } from "drizzle-orm";
import { scoreHispanicName } from "./nameScore";
import { executeStageAutomations } from "../automations/trigger";
import { logAudit } from "../audit/service";

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
      sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedUrl}`
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

const US_STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago",    AK: "America/Anchorage",  AZ: "America/Phoenix",
  AR: "America/Chicago",    CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York",   DE: "America/New_York",   FL: "America/New_York",
  GA: "America/New_York",   HI: "Pacific/Honolulu",   ID: "America/Denver",
  IL: "America/Chicago",    IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago",    KY: "America/New_York",   LA: "America/Chicago",
  ME: "America/New_York",   MD: "America/New_York",   MA: "America/New_York",
  MI: "America/New_York",   MN: "America/Chicago",    MS: "America/Chicago",
  MO: "America/Chicago",    MT: "America/Denver",     NE: "America/Chicago",
  NV: "America/Los_Angeles",NH: "America/New_York",   NJ: "America/New_York",
  NM: "America/Denver",     NY: "America/New_York",   NC: "America/New_York",
  ND: "America/Chicago",    OH: "America/New_York",   OK: "America/Chicago",
  OR: "America/Los_Angeles",PA: "America/New_York",   RI: "America/New_York",
  SC: "America/New_York",   SD: "America/Chicago",    TN: "America/Chicago",
  TX: "America/Chicago",    UT: "America/Denver",     VT: "America/New_York",
  VA: "America/New_York",   WA: "America/Los_Angeles",WV: "America/New_York",
  WI: "America/Chicago",    WY: "America/Denver",
};

router.post(
  "/queue/:id/convert",
  requireRole("admin", "lead_gen"),
  async (req, res) => {
    const { id } = req.params;
    const actorId = req.authUser!.id;

    const [queueItem] = await db
      .select()
      .from(marketplaceQueueItems)
      .where(sql`${marketplaceQueueItems.id} = ${id}`)
      .limit(1);

    if (!queueItem) {
      return res.status(404).json({ message: "Queue item not found" });
    }

    if (queueItem.createdLeadId) {
      return res.status(409).json({
        message: "Queue item already converted",
        alreadyConverted: true,
        leadId: queueItem.createdLeadId,
      });
    }

    const normalizedUrl = normalizeSellerUrl(queueItem.sellerProfileUrl);

    const existingCrmLead = await findExistingCrmLead(normalizedUrl);
    if (existingCrmLead) {
      const leadName =
        [existingCrmLead.leadFirstName, existingCrmLead.leadLastName].filter(Boolean).join(" ") || null;
      return res.status(409).json({
        message: "A lead with this seller profile URL already exists in the CRM",
        existingLeadId: existingCrmLead.leadId,
        existingLeadName: leadName,
      });
    }

    const defaultStatus = await db
      .select()
      .from(crmLeadStatuses)
      .where(eq(crmLeadStatuses.isDefault, true))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const newLeadStage = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.slug, "new-lead"))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const firstName = queueItem.firstName ?? queueItem.sellerName.split(" ")[0] ?? queueItem.sellerName;
    const lastName = queueItem.lastName ?? (queueItem.sellerName.split(" ").length > 1
      ? queueItem.sellerName.split(" ").slice(1).join(" ")
      : null);
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const leadTitle = fullName;
    const nowTs = new Date();

    const { lead, contact, company, opportunity } = await db.transaction(async (tx) => {
      let contact = await tx
        .select()
        .from(crmContacts)
        .where(
          and(
            ilike(crmContacts.firstName, firstName),
            lastName ? ilike(crmContacts.lastName, lastName) : sql`${crmContacts.lastName} IS NULL`,
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!contact) {
        const [newContact] = await tx
          .insert(crmContacts)
          .values({
            firstName,
            lastName: lastName ?? null,
            phone: null,
            email: null,
            isPrimary: true,
            preferredLanguage: "es",
          })
          .returning();
        contact = newContact;
      }

      const sellerNameNormalized = queueItem.sellerName.trim();
      let company = await tx
        .select()
        .from(crmCompanies)
        .where(
          and(
            ilike(crmCompanies.name, sellerNameNormalized),
            queueItem.state
              ? eq(crmCompanies.state, queueItem.state)
              : sql`${crmCompanies.state} IS NULL`,
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!company) {
        const [newCompany] = await tx
          .insert(crmCompanies)
          .values({
            name: sellerNameNormalized,
            industry: queueItem.trade ?? null,
            city: queueItem.city ?? null,
            state: queueItem.state ?? null,
          })
          .returning();
        company = newCompany;
      }

      if (!contact.companyId) {
        await tx
          .update(crmContacts)
          .set({ companyId: company.id, updatedAt: nowTs })
          .where(eq(crmContacts.id, contact.id));
      }

      const [lead] = await tx
        .insert(crmLeads)
        .values({
          title: leadTitle,
          companyId: company.id,
          contactId: contact.id,
          statusId: defaultStatus?.id ?? null,
          source: "outreach",
          sourceLabel: "Marketplace Outreach",
          fromWebsiteForm: false,
          city: queueItem.city ?? null,
          state: queueItem.state ?? null,
          timezone: queueItem.state ? (US_STATE_TIMEZONES[queueItem.state] ?? null) : null,
          assignedTo: actorId,
          sellerProfileUrl: normalizedUrl,
          adUrl: queueItem.adUrl ? normalizeSellerUrl(queueItem.adUrl) : null,
          hispanicNameScore: queueItem.hispanicNameScore,
          spanishOutreachRecommended: queueItem.spanishOutreachRecommended,
          firstOutreachSentAt: nowTs,
        })
        .returning();

      await tx.insert(crmLeadNotes).values({
        leadId: lead.id,
        userId: actorId,
        type: "system",
        content: "What's a good contact number?",
        metadata: {
          noteType: "system",
          source: "marketplace",
          createdBy: actorId,
        },
      });

      await tx
        .update(marketplaceQueueItems)
        .set({
          status: "converted",
          createdLeadId: lead.id,
          updatedAt: nowTs,
        })
        .where(sql`${marketplaceQueueItems.id} = ${id}`);

      let opportunity = null;
      if (newLeadStage) {
        const [opp] = await tx
          .insert(pipelineOpportunities)
          .values({
            title: leadTitle,
            leadId: lead.id,
            companyId: company.id,
            contactId: contact.id,
            stageId: newLeadStage.id,
            status: "open",
            sourceLeadTitle: leadTitle,
            assignedTo: actorId,
          })
          .returning();
        opportunity = opp;
      }

      return { lead, contact, company, opportunity };
    });

    if (newLeadStage && opportunity) {
      executeStageAutomations({
        opportunityId: opportunity.id,
        leadId: lead.id,
        contactId: contact.id,
        companyId: company.id,
        assignedTo: actorId,
        stageSlug: "new-lead",
        actorId,
      }).catch((err: unknown) => {
        console.error("[marketplace/convert] executeStageAutomations failed:", err);
      });
    }

    await logAudit({
      userId: actorId,
      action: "create",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title, source: "marketplace", queueItemId: id },
      ipAddress: req.ip,
    });

    return res.status(201).json({ leadId: lead.id, lead });
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
