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
  dueDate: z.string().datetime({ message: "Valid due date required" }),
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

router.get("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;

    const [company] = await db
      .select({
        company: crmCompanies,
        accountOwner: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(crmCompanies)
      .leftJoin(user, eq(crmCompanies.accountOwnerId, user.id))
      .where(eq(crmCompanies.id, id))
      .limit(1);

    if (!company) {
      return res.status(404).json({ message: "Client not found" });
    }

    const [contacts, leads, opportunities, onboardings, recentNotes, taskCount] = await Promise.all([
      db.select().from(crmContacts).where(eq(crmContacts.companyId, id)).orderBy(desc(crmContacts.isPrimary), desc(crmContacts.createdAt)),
      db.select({
        id: crmLeads.id,
        title: crmLeads.title,
        status: {
          name: crmLeadStatuses.name,
          color: crmLeadStatuses.color,
        },
        createdAt: crmLeads.createdAt,
      })
      .from(crmLeads)
      .leftJoin(crmLeadStatuses, eq(crmLeads.statusId, crmLeadStatuses.id))
      .where(eq(crmLeads.companyId, id))
      .orderBy(desc(crmLeads.createdAt))
      .limit(10),
      db.select({
        id: pipelineOpportunities.id,
        title: pipelineOpportunities.title,
        stage: pipelineStages.name,
        value: pipelineOpportunities.value,
        createdAt: pipelineOpportunities.createdAt,
      })
      .from(pipelineOpportunities)
      .leftJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
      .where(eq(pipelineOpportunities.companyId, id))
      .orderBy(desc(pipelineOpportunities.createdAt))
      .limit(10),
      db.select().from(onboardingRecords).where(eq(onboardingRecords.companyId, id)).orderBy(desc(onboardingRecords.createdAt)),
      db.select({
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
      .orderBy(desc(clientNotes.isPinned), desc(clientNotes.createdAt))
      .limit(20),
      db.select({ count: sql<number>`count(*)::int` }).from(followupTasks)
        .where(and(eq(followupTasks.companyId, id), eq(followupTasks.completed, false))),
    ]);

    const openTaskCount = taskCount[0]?.count ?? 0;

    res.json({
      ...company.company,
      accountOwner: company.accountOwner,
      contacts,
      leads,
      opportunities,
      onboardings,
      recentNotes,
      openTaskCount,
    });
  } catch (err: any) {
    console.error("Client profile error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Client Update ─────────────────────────────────────────────────────

router.patch("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, id)).limit(1);
    if (!existing) return res.status(404).json({ message: "Client not found" });

    const validated = updateClientSchema.parse(req.body);
    const [updated] = await db.update(crmCompanies).set(validated).where(eq(crmCompanies.id, id)).returning();

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
      appendHistorySafe({
        entityType: "client",
        entityId: id,
        event: "owner_changed",
        fieldName: "accountOwnerId",
        fromValue: (existing.accountOwnerId as string) ?? null,
        toValue: (validated.accountOwnerId as string) ?? null,
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

    appendHistorySafe({
      entityType: "client",
      entityId: id,
      event: "field_updated",
      note: "Account health / key dates updated",
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

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
      metadata: { noteId: note.id, type: note.type },
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
    const noteId = req.params.noteId;
    await db.delete(clientNotes).where(eq(clientNotes.id, noteId));
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

    if (validated.isPrimary) {
      await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, id));
    }

    const [contact] = await db.update(crmContacts).set(validated).where(eq(crmContacts.id, contactId)).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_contact_updated",
      entity: "crm_contact",
      entityId: contactId,
      metadata: { companyId: id },
      ipAddress: req.ip,
    });

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
      dueDate: new Date(validated.dueDate),
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
      event: "field_updated",
      note: `Task created: ${task.title}`,
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
    const taskId = req.params.taskId;
    const [existing] = await db.select().from(followupTasks).where(eq(followupTasks.id, taskId)).limit(1);
    if (!existing) return res.status(404).json({ message: "Task not found" });

    const nowCompleted = !existing.completed;
    const [task] = await db.update(followupTasks)
      .set({
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date() : null,
      })
      .where(eq(followupTasks.id, taskId))
      .returning();

    await logAudit({
      userId: req.authUser?.id,
      action: nowCompleted ? "client_task_completed" : "client_task_reopened",
      entity: "followup_task",
      entityId: taskId,
      metadata: { companyId: req.params.id, title: task.title },
      ipAddress: req.ip,
    });

    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id/tasks/:taskId", requireRole("admin", "developer"), async (req, res) => {
  try {
    const taskId = req.params.taskId;
    await db.delete(followupTasks).where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, req.params.id)));
    await logAudit({
      userId: req.authUser?.id,
      action: "client_task_deleted",
      entity: "followup_task",
      entityId: taskId,
      metadata: { companyId: req.params.id },
      ipAddress: req.ip,
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
