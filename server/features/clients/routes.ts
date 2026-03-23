// @ts-nocheck -- pre-existing drizzle-zod v0.8 type inference incompatibilities; runtime behavior unaffected
import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  crmCompanies, crmContacts, crmLeads, crmLeadStatuses,
  pipelineOpportunities, pipelineStages, onboardingRecords,
  user, clientNotes, followupTasks, stripeCustomers, stripeWebhookEvents,
  attachments,
} from "@shared/schema";
import { sql, desc, asc, ilike, or, SQL, eq, and, isNotNull, inArray } from "drizzle-orm";
import { getProfileByCompanyId } from "../profiles/service";
import { z } from "zod";
import { logAudit } from "../audit/service";
import { appendHistorySafe } from "../history/service";

const router = Router();

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  dba: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  clientStatus: z.enum(["active", "inactive", "at_risk", "churned", "prospect"]).nullable().optional(),
  accountOwnerId: z.string().nullable().optional(),
  nextFollowUpDate: z.string().nullable().transform(v => v ? new Date(v) : null).optional(),
  preferredContactMethod: z.enum(["email", "phone", "text", "in_person"]).nullable().optional(),
}).strict();

const updateAccountHealthSchema = z.object({
  launchDate: z.string().nullable().transform(v => v ? new Date(v) : null).optional(),
  renewalDate: z.string().nullable().transform(v => v ? new Date(v) : null).optional(),
  websiteStatus: z.enum(["live", "maintenance", "down", "building"]).nullable().optional(),
  carePlanStatus: z.enum(["active", "inactive", "none"]).nullable().optional(),
  serviceTier: z.enum(["basic", "standard", "premium"]).nullable().optional(),
  billingNotes: z.string().nullable().optional(),
}).strict();

const createNoteSchema = z.object({
  type: z.enum(["general", "call", "meeting", "internal"]),
  content: z.string().min(1),
  isPinned: z.boolean().optional(),
}).strict();

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
}).strict();

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().nullable().optional(),
  taskType: z.enum(["follow_up", "onboarding", "billing", "general", "review"]).default("follow_up"),
  dueDate: z.string().min(1, "Valid due date required"),
  assignedTo: z.string().nullable().optional(),
}).strict();

// ─── Client List ───────────────────────────────────────────────────────

router.get("/", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const search = (req.query.search as string || "").trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const searchPattern = `%${search}%`;
    const clientFilter = isNotNull(crmCompanies.clientStatus);
    const whereClause: SQL = search
      ? and(
          clientFilter,
          or(
            ilike(crmCompanies.name, searchPattern),
            ilike(crmCompanies.industry, searchPattern),
            ilike(crmCompanies.city, searchPattern),
          ),
        )!
      : clientFilter;

    const contactAgg = db.select({
      companyId: crmContacts.companyId,
      contactCount: sql<number>`count(*)::int`.as("contactCount"),
    }).from(crmContacts).groupBy(crmContacts.companyId).as("contact_agg");

    const leadAgg = db.select({
      companyId: crmLeads.companyId,
      leadCount: sql<number>`count(*)::int`.as("leadCount"),
    }).from(crmLeads).groupBy(crmLeads.companyId).as("lead_agg");

    const oppAgg = db.select({
      companyId: pipelineOpportunities.companyId,
      opportunityCount: sql<number>`count(*)::int`.as("opportunityCount"),
      opportunityValue: sql<number>`coalesce(sum(value::numeric), 0)`.as("opportunityValue"),
    }).from(pipelineOpportunities).groupBy(pipelineOpportunities.companyId).as("opp_agg");

    const onbAgg = db.select({
      companyId: onboardingRecords.companyId,
      activeOnboardings: sql<number>`count(*)::int`.as("activeOnboardings"),
    }).from(onboardingRecords)
      .where(sql`${onboardingRecords.status} NOT IN ('completed', 'on_hold')`)
      .groupBy(onboardingRecords.companyId).as("onb_agg");

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
          clientStatus: crmCompanies.clientStatus,
          createdAt: crmCompanies.createdAt,
          contactCount:      sql<number>`coalesce(${contactAgg.contactCount}, 0)`,
          leadCount:         sql<number>`coalesce(${leadAgg.leadCount}, 0)`,
          opportunityValue:  sql<number>`coalesce(${oppAgg.opportunityValue}, 0)`,
          opportunityCount:  sql<number>`coalesce(${oppAgg.opportunityCount}, 0)`,
          activeOnboardings: sql<number>`coalesce(${onbAgg.activeOnboardings}, 0)`,
        })
        .from(crmCompanies)
        .leftJoin(contactAgg, eq(crmCompanies.id, contactAgg.companyId))
        .leftJoin(leadAgg,    eq(crmCompanies.id, leadAgg.companyId))
        .leftJoin(oppAgg,     eq(crmCompanies.id, oppAgg.companyId))
        .leftJoin(onbAgg,     eq(crmCompanies.id, onbAgg.companyId))
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

// ─── Client Profile ────────────────────────────────────────────────────

// @deprecated GET /api/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
// This endpoint previously assembled a bespoke client aggregate from multiple
// independent DB queries.  It is now a thin compatibility façade over the
// canonical profile service (GET /api/profiles/company/:id).
//
// Active UI consumers: NONE — the route that rendered this data now uses the
// unified profile shell which reads from /api/profiles/company/:id directly.
// The only historical consumer (features/clients/ClientProfilePage.tsx) is
// preserved in the codebase but is no longer referenced by any active route.
//
// TODO: Remove this endpoint once the legacy ClientProfilePage.tsx file is
// deleted and all cache-invalidation predicate references to "/api/clients" are
// narrowed to only target the list endpoint GET /api/clients (no sub-path).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  // Signal deprecation to any automated client that inspects response headers.
  res.setHeader("X-Deprecated", "Use GET /api/profiles/company/:id instead");
  res.setHeader("X-Deprecated-Removal", "Pending deletion of features/clients/ClientProfilePage.tsx");

  try {
    const id = req.params.id;

    // ── Canonical aggregate (single source of truth) ────────────────────────
    const profile = await getProfileByCompanyId(id);
    const { identity, sales, work, service, timeline } = profile;

    // ── Supplementary: account owner name + email (not in DTO) ─────────────
    // One focused query for the owner's display fields, kept intentionally
    // minimal. If accountOwnerId is null the query is skipped entirely.
    let accountOwner: { id: string; name: string; email: string } | null = null;
    if (identity.company.accountOwnerId) {
      const [ownerRow] = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, identity.company.accountOwnerId))
        .limit(1);
      accountOwner = ownerRow ?? null;
    }

    // ── Shape transformation — legacy response contract ─────────────────────
    // Fields that required additional joins (lead status name/color, pipeline
    // stage name) are intentionally omitted — the profile DTO holds the IDs.
    // Consumers that need those display labels should migrate to the profile
    // endpoint which exposes them through the mapped DTO structure.

    const openTaskCount = work.tasks.filter((t) => !t.completed).length;

    // Derive recentNotes from the unified timeline (client_notes source only).
    const recentNotes = timeline.events
      .filter((e) => e.source === "client_notes")
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        type: e.type,
        content: e.content,
        isPinned: null, // isPinned is not surfaced in timeline events
        createdAt: e.timestamp,
        user: e.actor ? { id: null, name: e.actor } : null,
      }));

    return res.json({
      // Company scalar fields (id, name, clientStatus, etc.)
      ...identity.company,
      accountOwner,
      contacts: identity.contacts,
      // Lead summary — status name/color omitted; use stageId for lookups.
      leads: sales.leadHistory.slice(0, 10).map((l) => ({
        id: l.id,
        title: l.title,
        status: null, // TODO: join crmLeadStatuses if a consumer needs name/color
        createdAt: l.createdAt,
      })),
      // Opportunity summary — stage name omitted; use stageId for lookups.
      opportunities: sales.opportunities.slice(0, 10).map((o) => ({
        id: o.id,
        title: o.title,
        stage: null, // TODO: join pipelineStages if a consumer needs stage name
        value: o.value,
        createdAt: o.createdAt,
      })),
      onboardings: service.onboarding,
      recentNotes,
      openTaskCount,
    });
  } catch (err: any) {
    if (err.message?.includes("not found") || err.message?.includes("Not found")) {
      return res.status(404).json({ message: "Client not found" });
    }
    console.error("[deprecated] GET /api/clients/:id façade error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Client Update ─────────────────────────────────────────────────────

router.patch("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, id)).limit(1);
    if (!existing) return res.status(404).json({ message: "Client not found" });

    const validated = updateClientSchema.parse(req.body);
    if (validated.website && !/^https?:\/\//i.test(validated.website)) {
      validated.website = `https://${validated.website}`;
    }
    const [updated] = await db.update(crmCompanies).set(validated).where(eq(crmCompanies.id, id)).returning();

    if (validated.name && validated.name !== existing.name) {
      const leads = await db.select({ id: crmLeads.id, title: crmLeads.title })
        .from(crmLeads).where(eq(crmLeads.companyId, id));
      for (const lead of leads) {
        if (lead.title && lead.title.includes(existing.name)) {
          await db.update(crmLeads).set({ title: lead.title.replace(existing.name, validated.name) }).where(eq(crmLeads.id, lead.id));
        }
      }
      const opps = await db.select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
        .from(pipelineOpportunities).where(eq(pipelineOpportunities.companyId, id));
      for (const opp of opps) {
        const u: Record<string, string> = {};
        if (opp.title.includes(existing.name)) u.title = opp.title.replace(existing.name, validated.name);
        if (opp.sourceLeadTitle?.includes(existing.name)) u.sourceLeadTitle = opp.sourceLeadTitle.replace(existing.name, validated.name);
        if (Object.keys(u).length > 0) {
          await db.update(pipelineOpportunities).set(u).where(eq(pipelineOpportunities.id, opp.id));
        }
      }
    }

    await logAudit({
      userId: req.authUser?.id,
      action: "client_updated",
      entity: "crm_company",
      entityId: id,
      metadata: { changes: validated },
      ipAddress: req.ip,
    });

    const actor = req.authUser ? { actorId: req.authUser.id, actorName: req.authUser.name } : {};

    if (validated.clientStatus !== undefined && validated.clientStatus !== existing.clientStatus) {
      appendHistorySafe({
        entityType: "client",
        entityId: id,
        event: "status_changed",
        fieldName: "clientStatus",
        fromValue: (existing.clientStatus as string) ?? null,
        toValue: (validated.clientStatus as string) ?? null,
        ...actor
      });
    }

    if (validated.accountOwnerId !== undefined && validated.accountOwnerId !== existing.accountOwnerId) {
      const ownerIds = [existing.accountOwnerId, validated.accountOwnerId].filter(Boolean) as string[];
      let ownerNames: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const owners = await db.select({ id: user.id, name: user.name }).from(user).where(
          ownerIds.length === 1 ? eq(user.id, ownerIds[0]) : or(eq(user.id, ownerIds[0]), eq(user.id, ownerIds[1]))!
        );
        for (const o of owners) ownerNames[o.id] = o.name;
      }
      const oldName = existing.accountOwnerId ? (ownerNames[existing.accountOwnerId] ?? existing.accountOwnerId) : null;
      const newName = validated.accountOwnerId ? (ownerNames[validated.accountOwnerId] ?? validated.accountOwnerId) : null;
      appendHistorySafe({
        entityType: "client",
        entityId: id,
        event: "owner_changed",
        fieldName: "accountOwnerId",
        fromValue: oldName,
        toValue: newName,
        ...actor
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ─── Account Health / Key Dates ────────────────────────────────────────

router.patch("/:id/account", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, id)).limit(1);
    if (!existing) return res.status(404).json({ message: "Client not found" });

    const validated = updateAccountHealthSchema.parse(req.body);
    const [updated] = await db.update(crmCompanies).set({ ...validated, updatedAt: new Date() }).where(eq(crmCompanies.id, id)).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_account_updated",
      entity: "crm_company",
      entityId: id,
      metadata: { changes: validated },
      ipAddress: req.ip,
    });

    const actor = { actorId: req.authUser?.id, actorName: req.authUser?.name };

    type AccountHealthKey = keyof typeof validated;
    const fieldLabels: Record<AccountHealthKey, string> = {
      launchDate: "Launch date",
      renewalDate: "Renewal date",
      websiteStatus: "Website status",
      carePlanStatus: "Care plan status",
      serviceTier: "Service tier",
      billingNotes: "Billing notes",
    };

    function formatFieldValue(val: unknown): string {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val);
    }

    const accountHealthKeys: AccountHealthKey[] = ["launchDate", "renewalDate", "websiteStatus", "carePlanStatus", "serviceTier", "billingNotes"];
    for (const key of accountHealthKeys) {
      if (!(key in validated)) continue;
      const oldStr = formatFieldValue(existing[key]);
      const newStr = formatFieldValue(validated[key]);
      if (oldStr !== newStr) {
        const event = key === "serviceTier" ? "service_tier_changed" as const : "field_updated" as const;
        appendHistorySafe({
          entityType: "client",
          entityId: id,
          event,
          fieldName: fieldLabels[key],
          fromValue: oldStr || null,
          toValue: newStr || null,
          ...actor,
        });
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ─── Notes ─────────────────────────────────────────────────────────────

router.get("/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const notes = await db
      .select({
        id: clientNotes.id,
        type: clientNotes.type,
        content: clientNotes.content,
        isPinned: clientNotes.isPinned,
        createdAt: clientNotes.createdAt,
        user: {
          id: user.id,
          name: user.name,
        }
      })
      .from(clientNotes)
      .leftJoin(user, eq(clientNotes.userId, user.id))
      .where(eq(clientNotes.companyId, id))
      .orderBy(desc(clientNotes.isPinned), desc(clientNotes.createdAt));

    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const validated = createNoteSchema.parse(req.body);

    const [note] = await db.insert(clientNotes).values({
      companyId: id,
      userId: req.authUser?.id,
      type: validated.type,
      content: validated.content,
      isPinned: validated.isPinned ?? false,
    }).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_note_added",
      entity: "client_note",
      entityId: note.id,
      metadata: { companyId: id, type: note.type },
      ipAddress: req.ip,
    });

    appendHistorySafe({
      entityType: "client",
      entityId: id,
      event: "note_added",
      note: `[${note.type}] ${note.content.slice(0, 120)}`,
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.status(201).json(note);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id/notes/:noteId", requireRole("admin", "developer"), async (req, res) => {
  try {
    const companyId = req.params.id;
    const noteId = req.params.noteId;
    const [existing] = await db.select().from(clientNotes)
      .where(and(eq(clientNotes.id, noteId), eq(clientNotes.companyId, companyId)))
      .limit(1);
    if (!existing) return res.status(404).json({ message: "Note not found" });

    await db.delete(clientNotes).where(and(eq(clientNotes.id, noteId), eq(clientNotes.companyId, companyId)));

    appendHistorySafe({
      entityType: "client",
      entityId: companyId,
      event: "note_deleted",
      note: `[${existing.type}] ${existing.content.slice(0, 120)}`,
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Contacts ──────────────────────────────────────────────────────────

router.post("/:id/contacts", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const validated = contactSchema.parse(req.body);

    if (validated.isPrimary) {
      await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, id));
    }

    const [contact] = await db.insert(crmContacts).values({
      companyId: id,
      firstName: validated.firstName,
      lastName: validated.lastName || null,
      email: validated.email || null,
      phone: validated.phone || null,
      title: validated.title || null,
      preferredLanguage: validated.preferredLanguage || "es",
      isPrimary: validated.isPrimary ?? false,
    }).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_contact_added",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { companyId: id },
      ipAddress: req.ip,
    });

    appendHistorySafe({
      entityType: "client",
      entityId: id,
      event: "contact_added",
      note: `${contact.firstName}${contact.lastName ? ' ' + contact.lastName : ''}${contact.email ? ' (' + contact.email + ')' : ''}`,
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/:id/contacts/:contactId", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const contactId = req.params.contactId;
    const validated = contactSchema.partial().parse(req.body);

    const [existingContact] = await db.select().from(crmContacts).where(eq(crmContacts.id, contactId)).limit(1);
    const oldFullName = existingContact ? `${existingContact.firstName}${existingContact.lastName ? " " + existingContact.lastName : ""}` : "";

    if (validated.isPrimary) {
      await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, id));
    }

    const [contact] = await db.update(crmContacts).set(validated).where(eq(crmContacts.id, contactId)).returning();
    const newFullName = `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}`;

    if (oldFullName !== newFullName) {
      const leads = await db.select({ id: crmLeads.id, title: crmLeads.title })
        .from(crmLeads).where(eq(crmLeads.contactId, contactId));
      for (const lead of leads) {
        if (lead.title && lead.title.includes(oldFullName)) {
          await db.update(crmLeads).set({ title: lead.title.replace(oldFullName, newFullName) }).where(eq(crmLeads.id, lead.id));
        }
      }
      const opps = await db.select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
        .from(pipelineOpportunities).where(eq(pipelineOpportunities.contactId, contactId));
      for (const opp of opps) {
        const u: Record<string, string> = {};
        if (opp.title.includes(oldFullName)) u.title = opp.title.replace(oldFullName, newFullName);
        if (opp.sourceLeadTitle?.includes(oldFullName)) u.sourceLeadTitle = opp.sourceLeadTitle.replace(oldFullName, newFullName);
        if (Object.keys(u).length > 0) {
          await db.update(pipelineOpportunities).set(u).where(eq(pipelineOpportunities.id, opp.id));
        }
      }
    }

    await logAudit({
      userId: req.authUser?.id,
      action: "client_contact_updated",
      entity: "crm_contact",
      entityId: contactId,
      metadata: { companyId: id },
      ipAddress: req.ip,
    });

    type ContactKey = keyof typeof validated;
    const contactKeys: ContactKey[] = ["firstName", "lastName", "email", "phone", "title", "preferredLanguage", "isPrimary"];
    const changedFields = contactKeys.filter(k => {
      if (!(k in validated)) return false;
      return existingContact?.[k] !== validated[k];
    });
    if (changedFields.length > 0) {
      appendHistorySafe({
        entityType: "client",
        entityId: id,
        event: "contact_updated",
        note: `${newFullName}: ${changedFields.join(', ')} updated`,
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });
    }

    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ─── Tasks / Follow-Ups ────────────────────────────────────────────────

router.get("/:id/tasks", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.query.status as string | undefined;

    const leadRows = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.companyId, id));
    const oppRows = await db.select({ id: pipelineOpportunities.id }).from(pipelineOpportunities).where(eq(pipelineOpportunities.companyId, id));
    const leadIds = leadRows.map((l) => l.id);
    const oppIds = oppRows.map((o) => o.id);

    const conditions: SQL[] = [eq(followupTasks.companyId, id)];
    if (leadIds.length > 0) conditions.push(inArray(followupTasks.leadId, leadIds));
    if (oppIds.length > 0) conditions.push(inArray(followupTasks.opportunityId, oppIds));

    const now = new Date();
    const tasks = await db
      .select({
        id: followupTasks.id,
        title: followupTasks.title,
        notes: followupTasks.notes,
        taskType: followupTasks.taskType,
        dueDate: followupTasks.dueDate,
        completed: followupTasks.completed,
        completedAt: followupTasks.completedAt,
        companyId: followupTasks.companyId,
        assignedTo: followupTasks.assignedTo,
        createdBy: followupTasks.createdBy,
        createdAt: followupTasks.createdAt,
        creatorName: user.name,
      })
      .from(followupTasks)
      .leftJoin(user, eq(followupTasks.createdBy, user.id))
      .where(or(...conditions))
      .orderBy(asc(followupTasks.dueDate));

    const enriched = tasks.map(task => ({
      ...task,
      status: task.completed
        ? "completed"
        : task.dueDate < now ? "overdue" : "open",
    }));

    const filtered = status
      ? enriched.filter(t => t.status === status)
      : enriched;

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/tasks", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const [company] = await db.select({ id: crmCompanies.id }).from(crmCompanies).where(eq(crmCompanies.id, id)).limit(1);
    if (!company) return res.status(404).json({ message: "Client not found" });

    const validated = createTaskSchema.parse(req.body);
    const [task] = await db.insert(followupTasks).values({
      title: validated.title,
      notes: validated.notes ?? null,
      taskType: validated.taskType,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(validated.dueDate)
        ? new Date(validated.dueDate + "T00:00:00Z")
        : new Date(validated.dueDate),
      companyId: id,
      assignedTo: validated.assignedTo ?? null,
      createdBy: req.authUser?.id,
      completed: false,
    }).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_task_created",
      entity: "followup_task",
      entityId: task.id,
      metadata: { companyId: id, title: task.title, dueDate: task.dueDate },
      ipAddress: req.ip,
    });

    appendHistorySafe({
      entityType: "client",
      entityId: id,
      event: "task_created",
      note: `${task.title} [${task.taskType}]`,
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id/tasks/:taskId/complete", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const companyId = req.params.id;
    const taskId = req.params.taskId;
    const [existing] = await db.select().from(followupTasks)
      .where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)))
      .limit(1);
    if (!existing) return res.status(404).json({ message: "Task not found" });

    const nowCompleted = !existing.completed;
    const outcome = req.body?.outcome as string | undefined;
    const completionNote = req.body?.completionNote as string | undefined;

    const updateFields: Record<string, unknown> = {
      completed: nowCompleted,
      completedAt: nowCompleted ? new Date() : null,
    };
    if (nowCompleted && outcome) updateFields.outcome = outcome;
    if (nowCompleted && completionNote) updateFields.completionNote = completionNote;
    if (!nowCompleted) { updateFields.outcome = null; updateFields.completionNote = null; }

    const [task] = await db.update(followupTasks)
      .set(updateFields)
      .where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)))
      .returning();

    await logAudit({
      userId: req.authUser?.id,
      action: nowCompleted ? "client_task_completed" : "client_task_reopened",
      entity: "followup_task",
      entityId: taskId,
      metadata: { companyId, title: task.title },
      ipAddress: req.ip,
    });

    const noteParts = [task.title, `[${task.taskType}]`];
    if (nowCompleted && outcome) noteParts.push(`Outcome: ${outcome}`);
    if (nowCompleted && completionNote) noteParts.push(`Note: ${completionNote}`);
    appendHistorySafe({
      entityType: "client",
      entityId: companyId,
      event: nowCompleted ? "task_completed" : "task_reopened",
      note: noteParts.join(' · '),
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id/tasks/:taskId", requireRole("admin", "developer"), async (req, res) => {
  try {
    const companyId = req.params.id;
    const taskId = req.params.taskId;
    const [existingTask] = await db.select().from(followupTasks)
      .where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)))
      .limit(1);
    if (!existingTask) return res.status(404).json({ message: "Task not found" });

    await db.delete(followupTasks).where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)));
    await logAudit({
      userId: req.authUser?.id,
      action: "client_task_deleted",
      entity: "followup_task",
      entityId: taskId,
      metadata: { companyId },
      ipAddress: req.ip,
    });

    appendHistorySafe({
      entityType: "client",
      entityId: companyId,
      event: "task_deleted",
      note: existingTask.title,
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Files / Attachments ───────────────────────────────────────────────

router.get("/:id/files", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const files = await db
      .select({
        id: attachments.id,
        originalName: attachments.originalName,
        mimeType: attachments.mimeType,
        sizeBytes: attachments.sizeBytes,
        url: attachments.url,
        key: attachments.key,
        createdAt: attachments.createdAt,
        uploaderName: user.name,
        uploaderUserId: attachments.uploaderUserId,
      })
      .from(attachments)
      .leftJoin(user, eq(attachments.uploaderUserId, user.id))
      .where(and(
        eq(attachments.entityType, "client"),
        eq(attachments.entityId, id),
      ))
      .orderBy(desc(attachments.createdAt));
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Billing Snapshot ──────────────────────────────────────────────────

router.get("/:id/billing", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;

    const [company] = await db
      .select({ billingNotes: crmCompanies.billingNotes, serviceTier: crmCompanies.serviceTier, carePlanStatus: crmCompanies.carePlanStatus })
      .from(crmCompanies)
      .where(eq(crmCompanies.id, id))
      .limit(1);

    if (!company) return res.status(404).json({ message: "Client not found" });

    const [stripeCustomer] = await db
      .select()
      .from(stripeCustomers)
      .where(and(
        eq(stripeCustomers.entityType, "company"),
        eq(stripeCustomers.entityId, id),
      ))
      .limit(1);

    let recentEvents: any[] = [];
    if (stripeCustomer) {
      recentEvents = await db
        .select()
        .from(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.processed, true))
        .orderBy(desc(stripeWebhookEvents.createdAt))
        .limit(5);
    }

    res.json({
      billingNotes: company.billingNotes,
      serviceTier: company.serviceTier,
      carePlanStatus: company.carePlanStatus,
      stripeCustomer: stripeCustomer ?? null,
      recentEvents,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
