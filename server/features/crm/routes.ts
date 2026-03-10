import express, { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { notifyLeadAssignment } from "../notifications/triggers";
import * as crmStorage from "./storage";
import {
  exportLeadsToCSV, exportContactsToCSV,
  importLeadsFromCSV, importContactsFromCSV,
} from "./csvImportExport";
import {
  insertCrmCompanySchema, insertCrmContactSchema, insertCrmLeadSchema,
  insertCrmLeadNoteSchema, insertCrmTagSchema,
} from "@shared/schema";

const updateCrmLeadSchema = z.object({
  title: z.string().min(1).optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  statusId: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const updateCrmCompanySchema = z.object({
  name: z.string().min(1).optional(),
  dba: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const updateCrmContactSchema = z.object({
  companyId: z.string().nullable().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  altPhone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const tagIdsSchema = z.object({
  tagIds: z.array(z.string()).optional().default([]),
});

const bulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one lead required").max(200, "Maximum 200 leads at once"),
});

const bulkAssignSchema = bulkIdsSchema.extend({
  assignedTo: z.string().nullable(),
});

const bulkStatusSchema = bulkIdsSchema.extend({
  statusId: z.string().nullable(),
});

const bulkTagsSchema = bulkIdsSchema.extend({
  tagIds: z.array(z.string()).min(1, "At least one tag required"),
});

const router = Router();

router.get("/leads", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { search, statusId, source, assignedTo, fromWebsiteForm, page, limit } = req.query;
    const result = await crmStorage.getLeads({
      search: search as string | undefined,
      statusId: statusId as string | undefined,
      source: source as string | undefined,
      assignedTo: assignedTo as string | undefined,
      fromWebsiteForm: fromWebsiteForm === "true" ? true : fromWebsiteForm === "false" ? false : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    const leads = await crmStorage.enrichLeads(result.items);
    res.json({ leads, total: result.total, page: result.page, pageSize: result.limit });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/leads", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmLeadSchema.parse(req.body);
    const lead = await crmStorage.createLead(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title },
      ipAddress: req.ip,
    });
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/assignable-users", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  try {
    const users = await crmStorage.getAssignableUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/leads/bulk/assign", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { ids, assignedTo } = bulkAssignSchema.parse(req.body);
    const count = await crmStorage.bulkAssignLeads(ids, assignedTo);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_assign",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, assignedTo, count },
      ipAddress: req.ip,
    });
    res.json({ updated: count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/status", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { ids, statusId } = bulkStatusSchema.parse(req.body);
    const count = await crmStorage.bulkUpdateLeadStatus(ids, statusId);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_status",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, statusId, count },
      ipAddress: req.ip,
    });
    res.json({ updated: count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/tags/add", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { ids, tagIds } = bulkTagsSchema.parse(req.body);
    await crmStorage.bulkAddTagsToLeads(ids, tagIds);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_tags_add",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, tagIds, count: ids.length },
      ipAddress: req.ip,
    });
    res.json({ updated: ids.length });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/tags/remove", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { ids, tagIds } = bulkTagsSchema.parse(req.body);
    await crmStorage.bulkRemoveTagsFromLeads(ids, tagIds);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_tags_remove",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, tagIds, count: ids.length },
      ipAddress: req.ip,
    });
    res.json({ updated: ids.length });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/delete", requireRole("admin"), async (req, res) => {
  try {
    const { ids } = bulkIdsSchema.parse(req.body);
    const count = await crmStorage.bulkDeleteLeads(ids);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_delete",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, count },
      ipAddress: req.ip,
    });
    res.json({ deleted: count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/export-csv", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const csv = await exportLeadsToCSV();
    const date = new Date().toISOString().split("T")[0];
    await logAudit({
      userId: req.authUser?.id,
      action: "export",
      entity: "crm_lead",
      entityId: "csv",
      metadata: { date },
      ipAddress: req.ip,
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="leads-${date}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post(
  "/leads/import-csv",
  requireRole("admin", "sales_rep"),
  express.text({ limit: "5mb" }),
  async (req, res) => {
    try {
      const csvText = req.body as string;
      if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
        return res.status(400).json({ message: "Request body must be a non-empty CSV text" });
      }
      const result = await importLeadsFromCSV(csvText);
      await logAudit({
        userId: req.authUser?.id,
        action: "import",
        entity: "crm_lead",
        entityId: "csv",
        metadata: {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        },
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get("/leads/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const lead = await crmStorage.getLeadById(id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });
  res.json(lead);
});

router.put("/leads/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getLeadById(id);
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    const validated = updateCrmLeadSchema.parse(req.body);
    const lead = await crmStorage.updateLead(id, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title },
      ipAddress: req.ip,
    });
    if (validated.assignedTo && validated.assignedTo !== existing.assignedTo) {
      try { notifyLeadAssignment({ id: lead.id, title: lead.title }, validated.assignedTo); } catch (_) {}
    }
    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const notes = await crmStorage.getLeadNotes(id);
  res.json(notes);
});

router.post("/leads/:id/notes", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const data = insertCrmLeadNoteSchema.parse({
      ...req.body,
      leadId: id,
      userId: req.authUser?.id || null,
    });
    const note = await crmStorage.addLeadNote(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead_note",
      entityId: note.id,
      metadata: { leadId: id, type: note.type },
      ipAddress: req.ip,
    });
    res.status(201).json(note);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id/tags", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const tags = await crmStorage.getLeadTags(id);
  res.json(tags);
});

router.put("/leads/:id/tags", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { tagIds } = tagIdsSchema.parse(req.body);
    await crmStorage.setLeadTags(id, tagIds);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_lead_tags",
      entityId: id,
      metadata: { tagIds },
      ipAddress: req.ip,
    });
    res.json({ message: "Tags updated" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/companies", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await crmStorage.getCompanies({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/companies", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmCompanySchema.parse(req.body);
    const company = await crmStorage.createCompany(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_company",
      entityId: company.id,
      metadata: { name: company.name },
      ipAddress: req.ip,
    });
    res.status(201).json(company);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/companies/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const company = await crmStorage.getCompanyById(id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(company);
});

router.put("/companies/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getCompanyById(id);
    if (!existing) return res.status(404).json({ message: "Company not found" });
    const validated = updateCrmCompanySchema.parse(req.body);
    const company = await crmStorage.updateCompany(id, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_company",
      entityId: company.id,
      metadata: { name: company.name },
      ipAddress: req.ip,
    });
    res.json(company);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/contacts", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await crmStorage.getContacts({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/contacts", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmContactSchema.parse(req.body);
    const contact = await crmStorage.createContact(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { name: `${contact.firstName} ${contact.lastName || ""}`.trim() },
      ipAddress: req.ip,
    });
    res.status(201).json(contact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/contacts/export-csv", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const csv = await exportContactsToCSV();
    const date = new Date().toISOString().split("T")[0];
    await logAudit({
      userId: req.authUser?.id,
      action: "export",
      entity: "crm_contact",
      entityId: "csv",
      metadata: { date },
      ipAddress: req.ip,
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="contacts-${date}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post(
  "/contacts/import-csv",
  requireRole("admin", "sales_rep"),
  express.text({ limit: "5mb" }),
  async (req, res) => {
    try {
      const csvText = req.body as string;
      if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
        return res.status(400).json({ message: "Request body must be a non-empty CSV text" });
      }
      const result = await importContactsFromCSV(csvText);
      await logAudit({
        userId: req.authUser?.id,
        action: "import",
        entity: "crm_contact",
        entityId: "csv",
        metadata: {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        },
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get("/contacts/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const contact = await crmStorage.getContactById(id);
  if (!contact) return res.status(404).json({ message: "Contact not found" });
  res.json(contact);
});

router.put("/contacts/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getContactById(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    const validated = updateCrmContactSchema.parse(req.body);
    const contact = await crmStorage.updateContact(id, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { name: `${contact.firstName} ${contact.lastName || ""}`.trim() },
      ipAddress: req.ip,
    });
    res.json(contact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/statuses", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  const statuses = await crmStorage.getLeadStatuses();
  res.json(statuses);
});

router.get("/tags", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  const tags = await crmStorage.getTags();
  res.json(tags);
});

router.post("/tags", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmTagSchema.parse(req.body);
    const tag = await crmStorage.createTag(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_tag",
      entityId: tag.id,
      metadata: { name: tag.name },
      ipAddress: req.ip,
    });
    res.status(201).json(tag);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
