import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  crmLeads,
  crmContacts,
  crmLeadStatuses,
  crmLeadNotes,
  crmCompanies,
  pipelineOpportunities,
  pipelineStages,
  user,
  MARKETPLACE_PENDING_OUTREACH_STATUSES,
} from "@shared/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { scoreHispanicName } from "./nameScore";
import {
  scoreCaptureMatch,
  extractPhoneFromText,
  normalizePhone,
} from "./captureReplyHelpers";
import { normalizePhoneDigits } from "@shared/phone";
import * as crmStorage from "../crm/storage";
import * as pipelineStorage from "../pipeline/storage";
import * as marketplaceStorage from "./storage";
import { logAudit } from "../audit/service";
import { executeStageAutomations } from "../automations/trigger";

const DEFAULT_SALES_REP_ID = "o3UuGD02vDKCBSusAGK6O9A2RzfI3uhE";

const router = Router();

function normalizeSellerUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

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
  "/check-seller",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({ sellerProfileUrl: z.string().url() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);

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

router.post(
  "/precheck",
  // DEV: Temporary bypass for Marketplace Assistant Chrome extension.
  // If MARKETPLACE_BOT_SECRET is set and the request carries
  // "Authorization: Bearer <secret>", skip normal session auth.
  // Remove this bypass once the extension uses full token-based login.
  (req, res, next) => {
    const botSecret = process.env.MARKETPLACE_BOT_SECRET;
    if (botSecret) {
      const authHeader = req.headers.authorization ?? "";
      if (authHeader === `Bearer ${botSecret}`) return next();
    }
    return requireRole("admin", "developer", "lead_gen")(req, res, next);
  },
  async (req, res) => {
    const schema = z.object({
      sellerName: z.string().min(2),
      sellerProfileUrl: z.string().url(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);
    const score = scoreHispanicName(parsed.data.sellerName);
    const { normalizedName, firstName, lastName, hispanicNameScore, spanishOutreachRecommended } = score;

    if (hispanicNameScore < 70) {
      return res.json({
        shouldContinue: false,
        reason: "name_score_below_threshold",
        normalizedName,
        firstName,
        lastName,
        hispanicNameScore,
        spanishOutreachRecommended,
        sellerExistsInCrm: false,
      });
    }

    const [row] = await db
      .select({
        leadId: crmLeads.id,
        leadFirstName: crmContacts.firstName,
        leadLastName: crmContacts.lastName,
      })
      .from(crmLeads)
      .innerJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
      .where(
        sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedUrl}`
      )
      .orderBy(desc(crmLeads.createdAt))
      .limit(1);

    if (row) {
      const existingLeadName =
        [row.leadFirstName, row.leadLastName].filter(Boolean).join(" ") || null;
      return res.json({
        shouldContinue: false,
        reason: "seller_already_in_crm",
        normalizedName,
        firstName,
        lastName,
        hispanicNameScore,
        spanishOutreachRecommended,
        sellerExistsInCrm: true,
        existingLeadId: row.leadId,
        existingLeadName,
      });
    }

    return res.json({
      shouldContinue: true,
      reason: "passed",
      normalizedName,
      firstName,
      lastName,
      hispanicNameScore,
      spanishOutreachRecommended,
      sellerExistsInCrm: false,
    });
  }
);

router.post(
  "/create-outreach-lead",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({
      sellerName:                 z.string().trim().min(1),
      companyName:                z.string().trim().min(1),
      email:                      z.string().trim().email(),
      phone:                      z.string().trim().min(1),
      sellerProfileUrl:           z.string().url(),
      adUrl:                      z.string().url(),
      trade:                      z.string().min(1),
      city:                       z.string().min(1),
      state:                      z.string().length(2),
      hispanicNameScore:          z.number().int().min(0).max(100),
      spanishOutreachRecommended: z.boolean(),
      firstOutreachMessage:       z.string().min(1),
      firstOutreachSentAt:        z.string().datetime(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedSellerUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);
    const normalizedAdUrl = normalizeSellerUrl(parsed.data.adUrl);

    const [existing] = await db
      .select({ id: crmLeads.id })
      .from(crmLeads)
      .where(
        sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedSellerUrl}`
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({
        message: "Seller already exists in CRM",
        existingLeadId: existing.id,
      });
    }

    const { firstName: rawFirstName, lastName: rawLastName } = scoreHispanicName(parsed.data.sellerName);
    const toTitleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
    const firstName = toTitleCase(rawFirstName);
    const lastName = rawLastName ? toTitleCase(rawLastName) : null;
    const companyNameNormalized = parsed.data.companyName.trim();
    const stateCode = parsed.data.state.trim().toUpperCase();

    const defaultStatus = await crmStorage.getDefaultLeadStatus();

    const [defaultRep] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "sales_rep"), eq(user.banned, false)))
      .orderBy(user.createdAt)
      .limit(1);
    const defaultAssignedRepId = defaultRep?.id ?? req.authUser!.id;

    const { lead, contact, company } = await db.transaction(async (tx) => {
      let [contact] = await tx
        .select()
        .from(crmContacts)
        .where(
          lastName
            ? and(
                ilike(crmContacts.firstName, firstName),
                ilike(crmContacts.lastName, lastName)
              )
            : and(
                ilike(crmContacts.firstName, firstName),
                sql`${crmContacts.lastName} is null`
              )
        )
        .limit(1);

      if (!contact) {
        [contact] = await tx
          .insert(crmContacts)
          .values({
            firstName,
            lastName,
            phone: parsed.data.phone,
            email: parsed.data.email,
            preferredLanguage: "es",
          })
          .returning();
      } else {
        const contactUpdates: Record<string, string> = {};
        if (!contact.phone) contactUpdates.phone = parsed.data.phone;
        if (!contact.email) contactUpdates.email = parsed.data.email;
        if (Object.keys(contactUpdates).length > 0) {
          await tx.update(crmContacts).set(contactUpdates).where(eq(crmContacts.id, contact.id));
          contact = { ...contact, ...contactUpdates };
        }
      }

      let [company] = await tx
        .select()
        .from(crmCompanies)
        .where(
          and(
            ilike(crmCompanies.name, companyNameNormalized),
            eq(crmCompanies.state, stateCode)
          )
        )
        .limit(1);

      if (!company) {
        [company] = await tx
          .insert(crmCompanies)
          .values({
            name:     companyNameNormalized,
            phone:    parsed.data.phone,
            email:    parsed.data.email,
            industry: parsed.data.trade,
            city:     parsed.data.city,
            state:    stateCode,
          })
          .returning();
      } else {
        const companyUpdates: Record<string, string> = {};
        if (!company.phone)    companyUpdates.phone    = parsed.data.phone;
        if (!company.email)    companyUpdates.email    = parsed.data.email;
        if (!company.industry) companyUpdates.industry = parsed.data.trade;
        if (!company.city)     companyUpdates.city     = parsed.data.city;
        if (Object.keys(companyUpdates).length > 0) {
          await tx.update(crmCompanies).set(companyUpdates).where(eq(crmCompanies.id, company.id));
          company = { ...company, ...companyUpdates };
        }
      }

      if (!contact.companyId) {
        await tx
          .update(crmContacts)
          .set({ companyId: company.id })
          .where(eq(crmContacts.id, contact.id));
        contact = { ...contact, companyId: company.id };
      }

      const [lead] = await tx
        .insert(crmLeads)
        .values({
          title:                      companyNameNormalized,
          companyId:                  company.id,
          contactId:                  contact.id,
          statusId:                   defaultStatus?.id ?? null,
          source:                     "outreach",
          sourceLabel:                "Outreach",
          city:                       parsed.data.city,
          state:                      stateCode,
          timezone:                   US_STATE_TIMEZONES[stateCode] ?? null,
          sellerProfileUrl:           normalizedSellerUrl,
          adUrl:                      normalizedAdUrl,
          hispanicNameScore:          parsed.data.hispanicNameScore,
          spanishOutreachRecommended: parsed.data.spanishOutreachRecommended,
          firstOutreachSentAt:        new Date(parsed.data.firstOutreachSentAt),
          fromWebsiteForm:            false,
          assignedTo:                 defaultAssignedRepId,
        })
        .returning();

      await tx.insert(crmLeadNotes).values({
        leadId:   lead.id,
        userId:   req.authUser!.id,
        type:     "system",
        content:  parsed.data.firstOutreachMessage,
        metadata: { noteType: "system", source: "marketplace", createdBy: req.authUser!.id },
      });

      return { lead, contact, company };
    });

    const newLeadStage = await pipelineStorage.getStageBySlug("new-lead");
    if (newLeadStage) {
      const opp = await pipelineStorage.createOpportunity({
        title:           lead.title,
        leadId:          lead.id,
        companyId:       company.id,
        contactId:       contact.id,
        stageId:         newLeadStage.id,
        status:          "open",
        sourceLeadTitle: lead.title,
        assignedTo:      defaultAssignedRepId,
      });
      try {
        await executeStageAutomations({
          opportunityId: opp.id,
          leadId:        lead.id,
          contactId:     contact.id,
          companyId:     company.id,
          assignedTo:    defaultAssignedRepId,
          stageSlug:     "new-lead",
          actorId:       req.authUser!.id,
        });
      } catch (err: unknown) {
        console.error("[marketplace/create-outreach-lead] executeStageAutomations failed:", err);
      }
    }

    await logAudit({
      userId:    req.authUser?.id,
      action:    "create",
      entity:    "crm_lead",
      entityId:  lead.id,
      metadata:  { title: lead.title, source: "marketplace-bot" },
      ipAddress: req.ip,
    });

    return res.status(201).json({ leadId: lead.id, lead });
  }
);

// ─── Pending Outreach routes ───────────────────────────────────────────────
// All three routes share the same auth middleware: MARKETPLACE_BOT_SECRET
// bearer bypass, then fall back to requireRole("admin","developer","lead_gen").

function botOrRole(req: Request, res: Response, next: NextFunction) {
  const botSecret = process.env.MARKETPLACE_BOT_SECRET;
  if (botSecret) {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader === `Bearer ${botSecret}`) return next();
  }
  return requireRole("admin", "developer", "lead_gen")(req, res, next);
}

const createPendingOutreachSchema = z.object({
  sellerFullName:   z.string().trim().min(1),
  sellerProfileUrl: z.string().url(),
  listingUrl:       z.string().url().optional(),
  listingTitleRaw:  z.string().optional(),
  city:             z.string().optional(),
  state:            z.string().length(2).optional(),
  tradeGuess:       z.string().optional(),
  facebookJoinYear: z.number().int().optional(),
  nameScore:        z.number().int().min(0).max(100),
  precheckPassed:   z.boolean(),
  precheckReason:   z.string().optional(),
  outreachMessage:  z.string().optional(),
}).strict();

const patchPendingOutreachSchema = z.object({
  messageStatus:    z.enum(MARKETPLACE_PENDING_OUTREACH_STATUSES).optional(),
  outreachMessage:  z.string().optional(),
  outreachSentAt:   z.string().datetime().optional(),
  replyReceivedAt:  z.string().datetime().optional(),
  extractedPhone:   z.string().optional(),
  threadIdentifier: z.string().optional(),
  crmLeadId:        z.string().optional(),
  convertedAt:      z.string().datetime().optional(),
}).strict();

router.post(
  "/pending-outreach",
  botOrRole,
  async (req, res) => {
    const parsed = createPendingOutreachSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const d = parsed.data;
    const normalizedSellerUrl = normalizeSellerUrl(d.sellerProfileUrl);
    const normalizedListingUrl = d.listingUrl ? normalizeSellerUrl(d.listingUrl) : undefined;
    const listingTitleNormalized = d.listingTitleRaw ? d.listingTitleRaw.trim().toLowerCase() : undefined;

    const { firstName: derivedFirstName } = scoreHispanicName(d.sellerFullName);

    const existing = await marketplaceStorage.findActivePendingOutreachBySellerUrl(normalizedSellerUrl);
    if (existing) {
      return res.status(409).json({
        message: "Active pending record already exists",
        existingId: existing.id,
      });
    }

    const createdBy = req.authUser?.id ?? null;

    const record = await marketplaceStorage.createPendingOutreach({
      sellerFullName:         d.sellerFullName,
      sellerFirstName:        derivedFirstName || null,
      sellerProfileUrl:       normalizedSellerUrl,
      listingUrl:             normalizedListingUrl ?? null,
      listingTitleRaw:        d.listingTitleRaw ?? null,
      listingTitleNormalized: listingTitleNormalized ?? null,
      city:                   d.city ?? null,
      state:                  d.state ?? null,
      tradeGuess:             d.tradeGuess ?? null,
      facebookJoinYear:       d.facebookJoinYear ?? null,
      nameScore:              d.nameScore,
      precheckPassed:         d.precheckPassed,
      precheckReason:         d.precheckReason ?? null,
      messageStatus:          "ready_to_message",
      outreachMessage:        d.outreachMessage ?? null,
      createdBy:              createdBy,
    });

    return res.status(201).json(record);
  }
);

router.get(
  "/pending-outreach/:id",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;
    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.json(record);
  }
);

router.patch(
  "/pending-outreach/:id",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;
    const parsed = patchPendingOutreachSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const d = parsed.data;
    const updateData: Parameters<typeof marketplaceStorage.updatePendingOutreach>[1] = {
      ...(d.messageStatus    !== undefined && { messageStatus:    d.messageStatus }),
      ...(d.outreachMessage  !== undefined && { outreachMessage:  d.outreachMessage }),
      ...(d.outreachSentAt   !== undefined && { outreachSentAt:   new Date(d.outreachSentAt) }),
      ...(d.replyReceivedAt  !== undefined && { replyReceivedAt:  new Date(d.replyReceivedAt) }),
      ...(d.extractedPhone   !== undefined && { extractedPhone:   d.extractedPhone }),
      ...(d.threadIdentifier !== undefined && { threadIdentifier: d.threadIdentifier }),
      ...(d.crmLeadId        !== undefined && { crmLeadId:        d.crmLeadId }),
      ...(d.convertedAt      !== undefined && { convertedAt:      new Date(d.convertedAt) }),
    };

    const updated = await marketplaceStorage.updatePendingOutreach(id, updateData);
    if (!updated) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.json(updated);
  }
);

const markMessageSentSchema = z.object({
  outreachMessage: z.string().optional(),
  outreachSentAt:  z.string().datetime().optional(),
}).strict();

const BLOCKED_FOR_MARK_SENT: string[] = ["skipped", "converted"];

router.post(
  "/pending-outreach/:id/mark-message-sent",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;

    const parsed = markMessageSentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }

    if (BLOCKED_FOR_MARK_SENT.includes(record.messageStatus)) {
      return res.status(400).json({
        message: `Cannot mark message sent: record is already ${record.messageStatus}`,
        currentStatus: record.messageStatus,
      });
    }

    const d = parsed.data;
    const updated = await marketplaceStorage.markPendingOutreachMessageSent(id, {
      outreachSentAt:  d.outreachSentAt ? new Date(d.outreachSentAt) : new Date(),
      outreachMessage: d.outreachMessage,
    });

    return res.json(updated);
  }
);

const captureReplySchema = z.object({
  replyText:            z.string().min(1),
  sellerFirstNameSeen:  z.string().optional(),
  listingTitleSeen:     z.string().optional(),
  threadIdentifier:     z.string().optional(),
  replyReceivedAt:      z.string().datetime().optional(),
}).strict();

const ALLOWED_FOR_CAPTURE_REPLY: string[] = [
  "awaiting_reply",
  "manual_review_required",
  "reply_received",
];

router.post(
  "/pending-outreach/:id/capture-reply",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;

    const parsed = captureReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }

    if (!ALLOWED_FOR_CAPTURE_REPLY.includes(record.messageStatus)) {
      const message = record.messageStatus === "ready_to_message"
        ? "Cannot capture reply: outreach has not been marked as sent yet."
        : `Cannot capture reply: record is already ${record.messageStatus}`;
      return res.status(400).json({ message, currentStatus: record.messageStatus });
    }

    const d = parsed.data;

    const rawPhone = extractPhoneFromText(d.replyText);
    if (!rawPhone) {
      return res.status(400).json({
        message: "No valid phone number could be extracted from the reply.",
      });
    }

    const listingTitleSeenNormalized = d.listingTitleSeen
      ? d.listingTitleSeen.trim().toLowerCase()
      : null;

    const matchResult = scoreCaptureMatch(record, {
      sellerFirstNameNormalized: d.sellerFirstNameSeen
        ? d.sellerFirstNameSeen.trim().toLowerCase()
        : null,
      listingTitleNormalized:    listingTitleSeenNormalized,
      threadIdentifier:          d.threadIdentifier ?? null,
    });

    if (matchResult.confidence === "low") {
      return res.status(400).json({
        message: "Match confidence too low to attach phone. Provide a listing title or thread identifier.",
        confidence: matchResult.confidence,
        method:     matchResult.method,
      });
    }

    const normalizedPhone = normalizePhone(rawPhone);

    const newStatus     = matchResult.confidence === "high" ? "reply_received" : "manual_review_required";
    const reviewReason  = matchResult.confidence === "medium"
      ? `Fuzzy match via ${matchResult.method} — requires human review`
      : null;

    const updated = await marketplaceStorage.captureReplyOnPendingOutreach(id, {
      lastReplyText:        d.replyText,
      extractedPhone:       rawPhone,
      replyPhoneNormalized: normalizedPhone,
      replyMatchConfidence: matchResult.confidence,
      replyMatchMethod:     matchResult.method,
      replyReceivedAt:      d.replyReceivedAt ? new Date(d.replyReceivedAt) : new Date(),
      manualReviewReason:   reviewReason,
      messageStatus:        newStatus,
      ...(d.threadIdentifier !== undefined && { threadIdentifier: d.threadIdentifier }),
    });

    return res.json(updated);
  }
);

// ─── Helper: split "First Rest Of Name" → { firstName, lastName } ─────────
function splitSellerName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName  = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

// ─── Helper: build Marketplace snapshot note ─────────────────────────────
function buildOutreachSnapshot(record: {
  sellerFullName: string;
  listingTitleRaw: string | null;
  sellerProfileUrl: string;
  listingUrl: string | null;
  lastReplyText: string | null;
  replyPhoneNormalized: string | null;
  extractedPhone: string | null;
  facebookJoinYear: number | null;
}): string {
  const lines: string[] = ["Marketplace Outreach Snapshot", ""];
  const add = (label: string, val: string | number | null | undefined) => {
    if (val !== null && val !== undefined && String(val).trim() !== "") {
      lines.push(`${label}: ${val}`);
    }
  };
  add("Seller Name",        record.sellerFullName);
  add("Listing Title",      record.listingTitleRaw);
  add("Seller Profile URL", record.sellerProfileUrl);
  add("Listing URL",        record.listingUrl);
  add("Reply Text",         record.lastReplyText);
  add("Extracted Phone",    record.replyPhoneNormalized ?? record.extractedPhone);
  add("Facebook Join Year", record.facebookJoinYear);
  return lines.join("\n");
}

const convertToCrmSchema = z.object({
  assignedTo:            z.string().optional(),
  overrideFirstName:     z.string().optional(),
  overrideLastName:      z.string().optional(),
  overrideBusinessName:  z.string().optional(),
  overrideTrade:         z.string().optional(),
  overrideCity:          z.string().optional(),
  overrideState:         z.string().optional(),
}).strict();

const ELIGIBLE_FOR_CONVERSION = ["reply_received", "manual_review_required"] as const;

router.post(
  "/pending-outreach/:id/convert-to-crm",
  botOrRole,
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Pending outreach record not found." });
    }

    if (record.messageStatus === "converted") {
      return res.status(400).json({
        message: "This record has already been converted to a CRM lead.",
        currentStatus: record.messageStatus,
        crmLeadId: record.crmLeadId,
      });
    }

    if (!(ELIGIBLE_FOR_CONVERSION as readonly string[]).includes(record.messageStatus)) {
      return res.status(400).json({
        message: `Cannot convert: record status is "${record.messageStatus}". Only reply_received or manual_review_required records may be converted.`,
        currentStatus: record.messageStatus,
      });
    }

    const parsed = convertToCrmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const opts = parsed.data;

    // ── Name resolution ───────────────────────────────────────────────────
    const { firstName: defaultFirst, lastName: defaultLast } = splitSellerName(record.sellerFullName);
    const firstName    = opts.overrideFirstName   ?? defaultFirst;
    const lastName     = opts.overrideLastName    ?? defaultLast;
    const businessName = opts.overrideBusinessName ?? null;
    const trade        = opts.overrideTrade        ?? record.tradeGuess ?? null;
    const city         = opts.overrideCity         ?? record.city       ?? null;
    const state        = opts.overrideState        ?? record.state      ?? null;

    // ── Phone resolution ──────────────────────────────────────────────────
    const rawPhone        = record.replyPhoneNormalized ?? record.extractedPhone ?? null;
    const normalizedPhone = rawPhone ? normalizePhoneDigits(rawPhone) : "";

    // ── Assignee ──────────────────────────────────────────────────────────
    const resolvedAssignee = opts.assignedTo ?? req.authUser?.id ?? DEFAULT_SALES_REP_ID;

    // ── Duplicate check ───────────────────────────────────────────────────
    const dupCheck = await crmStorage.checkManualLeadDuplicate({
      normalizedPhone,
      firstName,
      lastName:         lastName ?? "",
      businessName:     businessName ?? undefined,
      state:            state ?? "",
      source:           "outreach",
      sellerProfileUrl: record.sellerProfileUrl,
    });
    if (dupCheck.isDuplicate) {
      return res.status(409).json({ code: "DUPLICATE_LEAD", match: dupCheck.match });
    }

    // ── Contact: find or create ───────────────────────────────────────────
    let contact = normalizedPhone
      ? await crmStorage.findContactByPhone(normalizedPhone)
      : null;
    if (!contact) {
      contact = await crmStorage.createContact({
        firstName,
        lastName: lastName ?? null,
        phone:    normalizedPhone || null,
        email:    null,
        notes:    null,
        isPrimary: true,
        preferredLanguage: null,
      });
    }

    // ── Company: find or create ───────────────────────────────────────────
    const fullDisplayName = lastName ? `${firstName} ${lastName}`.trim() : firstName;
    const companyName     = businessName?.trim() || fullDisplayName;
    let company = await crmStorage.findCompanyByName(companyName);
    if (!company) {
      company = await crmStorage.createCompany({
        name:     companyName,
        industry: trade ?? undefined,
        website:  null,
        phone:    normalizedPhone || null,
        email:    null,
      });
    }
    const companyId = company.id;
    if (!contact.companyId) {
      await crmStorage.updateContact(contact.id, { companyId });
    }

    // ── Default CRM status ────────────────────────────────────────────────
    const defaultStatus =
      (await crmStorage.getDefaultLeadStatus()) ??
      (await crmStorage.getLeadStatusBySlug("new"));

    // ── Lead title & notes ────────────────────────────────────────────────
    const leadTitle = businessName?.trim()
      ? `${businessName.trim()} – ${fullDisplayName}`
      : fullDisplayName;

    const notes = buildOutreachSnapshot(record);

    // ── Create CRM lead ───────────────────────────────────────────────────
    const lead = await crmStorage.createLead({
      title:            leadTitle,
      companyId,
      contactId:        contact.id,
      statusId:         defaultStatus?.id ?? null,
      source:           "outreach",
      sourceLabel:      "Outreach",
      notes,
      fromWebsiteForm:  false,
      city:             city ?? null,
      state:            state ?? null,
      timezone:         null,
      assignedTo:       resolvedAssignee,
      sellerProfileUrl: record.sellerProfileUrl,
      adUrl:            record.listingUrl ?? null,
    });

    // ── Pipeline opportunity ──────────────────────────────────────────────
    const newLeadStage = await pipelineStorage.getStageBySlug("new-lead");
    if (newLeadStage) {
      const opp = await pipelineStorage.createOpportunity({
        title:           leadTitle,
        leadId:          lead.id,
        companyId,
        contactId:       contact.id,
        stageId:         newLeadStage.id,
        status:          "open",
        sourceLeadTitle: leadTitle,
        notes,
        assignedTo:      resolvedAssignee,
      });
      executeStageAutomations({
        opportunityId: opp.id,
        leadId:        lead.id,
        contactId:     contact.id,
        companyId,
        assignedTo:    resolvedAssignee,
        stageSlug:     "new-lead",
        actorId:       resolvedAssignee,
      }).catch((err: unknown) => {
        console.error("[marketplace/convert-to-crm] executeStageAutomations failed:", err);
      });
    }

    // ── Mark pending outreach as converted ────────────────────────────────
    const convertedRecord = await marketplaceStorage.updatePendingOutreach(id, {
      crmLeadId:     lead.id,
      messageStatus: "converted",
      convertedAt:   new Date(),
    });

    await logAudit({
      userId:    req.authUser?.id,
      action:    "create",
      entity:    "crm_lead",
      entityId:  lead.id,
      metadata:  { title: lead.title, source: "marketplace_outreach", pendingOutreachId: id },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      pendingOutreachId: id,
      crmLeadId:         lead.id,
      messageStatus:     "converted",
      lead,
    });
  }
);

export default router;
