import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, primaryKey, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  business: text("business"),
  city: text("city"),
  trade: text("trade"),
  service: text("service"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone is required"),
  business: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  trade: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const insertInquirySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone is required"),
  zipCode: z.string().optional(),
  service: z.string().optional(),
  message: z.string().optional(),
});

export type InsertInquiry = z.infer<typeof insertInquirySchema>;

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("sales_rep"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").references(() => user.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const docCategories = pgTable("doc_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const docArticles = pgTable("doc_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  categoryId: varchar("category_id").references(() => docCategories.id),
  authorId: text("author_id").references(() => user.id),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const docTags = pgTable("doc_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const docArticleTags = pgTable("doc_article_tags", {
  articleId: varchar("article_id").notNull().references(() => docArticles.id),
  tagId: varchar("tag_id").notNull().references(() => docTags.id),
}, (t) => [
  primaryKey({ columns: [t.articleId, t.tagId] }),
]);

export const docRevisions = pgTable("doc_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => docArticles.id),
  content: text("content").notNull(),
  authorId: text("author_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const integrationRecords = pgTable("integration_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  configComplete: boolean("config_complete").notNull().default(false),
  lastTested: timestamp("last_tested"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CRM Tables ──────────────────────────────────────────────────────

export const crmCompanies = pgTable("crm_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  dba: text("dba"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  country: text("country").default("US"),
  industry: text("industry"),
  preferredLanguage: text("preferred_language").default("es"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("crm_companies_name_idx").on(t.name),
  index("crm_companies_email_idx").on(t.email),
  index("crm_companies_phone_idx").on(t.phone),
]);

export const crmContacts = pgTable("crm_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  altPhone: text("alt_phone"),
  title: text("title"),
  preferredLanguage: text("preferred_language").default("es"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("crm_contacts_email_idx").on(t.email),
  index("crm_contacts_phone_idx").on(t.phone),
  index("crm_contacts_company_idx").on(t.companyId),
]);

export const crmLeadStatuses = pgTable("crm_lead_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#6B7280"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isClosed: boolean("is_closed").notNull().default(false),
});

export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  statusId: varchar("status_id").references(() => crmLeadStatuses.id),
  title: text("title").notNull(),
  value: numeric("value"),
  source: text("source"),
  sourceLabel: text("source_label"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  referrer: text("referrer"),
  landingPage: text("landing_page"),
  formPageUrl: text("form_page_url"),
  fromWebsiteForm: boolean("from_website_form").notNull().default(false),
  assignedTo: text("assigned_to").references(() => user.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("crm_leads_status_idx").on(t.statusId),
  index("crm_leads_company_idx").on(t.companyId),
  index("crm_leads_contact_idx").on(t.contactId),
  index("crm_leads_created_idx").on(t.createdAt),
  index("crm_leads_assigned_idx").on(t.assignedTo),
]);

export const LEAD_NOTE_TYPES = ["note", "call", "email", "task", "status_change", "system"] as const;
export type LeadNoteType = typeof LEAD_NOTE_TYPES[number];

export const crmLeadNotes = pgTable("crm_lead_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => crmLeads.id),
  userId: text("user_id").references(() => user.id),
  type: text("type").notNull().default("note"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("crm_lead_notes_lead_idx").on(t.leadId),
  index("crm_lead_notes_created_idx").on(t.createdAt),
]);

export const crmTags = pgTable("crm_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  color: text("color").default("#6B7280"),
});

export const crmLeadTags = pgTable("crm_lead_tags", {
  leadId: varchar("lead_id").notNull().references(() => crmLeads.id),
  tagId: varchar("tag_id").notNull().references(() => crmTags.id),
}, (t) => [
  primaryKey({ columns: [t.leadId, t.tagId] }),
]);

// ─── Pipeline Tables ─────────────────────────────────────────────────

export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#6B7280"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isClosed: boolean("is_closed").notNull().default(false),
});

export const OPPORTUNITY_STATUSES = ["open", "won", "lost"] as const;
export type OpportunityStatus = typeof OPPORTUNITY_STATUSES[number];

export const pipelineOpportunities = pgTable("pipeline_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  value: numeric("value"),
  stageId: varchar("stage_id").references(() => pipelineStages.id),
  leadId: varchar("lead_id").references(() => crmLeads.id),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  assignedTo: text("assigned_to").references(() => user.id),
  status: text("status").notNull().default("open"),
  expectedCloseDate: timestamp("expected_close_date"),
  nextActionDate: timestamp("next_action_date"),
  followUpDate: timestamp("follow_up_date"),
  stageEnteredAt: timestamp("stage_entered_at").defaultNow(),
  probability: integer("probability").default(0),
  sourceLeadTitle: text("source_lead_title"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("pipeline_opp_stage_idx").on(t.stageId),
  index("pipeline_opp_assigned_idx").on(t.assignedTo),
  index("pipeline_opp_status_idx").on(t.status),
  index("pipeline_opp_close_date_idx").on(t.expectedCloseDate),
  index("pipeline_opp_created_idx").on(t.createdAt),
  index("pipeline_opp_lead_idx").on(t.leadId),
  index("pipeline_opp_company_idx").on(t.companyId),
]);

export const PIPELINE_ACTIVITY_TYPES = ["stage_change", "note", "call", "email", "task", "system"] as const;
export type PipelineActivityType = typeof PIPELINE_ACTIVITY_TYPES[number];

export const pipelineActivities = pgTable("pipeline_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id").notNull().references(() => pipelineOpportunities.id),
  userId: text("user_id").references(() => user.id),
  type: text("type").notNull().default("note"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pipeline_act_opp_idx").on(t.opportunityId),
  index("pipeline_act_created_idx").on(t.createdAt),
]);

// ─── Pipeline Zod Schemas & Types ────────────────────────────────────

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({ id: true });
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

export const insertPipelineOpportunitySchema = createInsertSchema(pipelineOpportunities).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPipelineOpportunity = z.infer<typeof insertPipelineOpportunitySchema>;
export type PipelineOpportunity = typeof pipelineOpportunities.$inferSelect;

export const insertPipelineActivitySchema = createInsertSchema(pipelineActivities).omit({ id: true, createdAt: true });
export type InsertPipelineActivity = z.infer<typeof insertPipelineActivitySchema>;
export type PipelineActivity = typeof pipelineActivities.$inferSelect;

// ─── Onboarding Tables ───────────────────────────────────────────────

export const ONBOARDING_STATUSES = ["pending", "in_progress", "completed", "on_hold"] as const;
export type OnboardingStatus = typeof ONBOARDING_STATUSES[number];

export const CHECKLIST_CATEGORIES = [
  "contract", "payment", "branding", "domain_dns", "website",
  "google_business", "google_ads", "meta_facebook", "social", "content", "kickoff",
] as const;
export type ChecklistCategory = typeof CHECKLIST_CATEGORIES[number];

export const ONBOARDING_NOTE_TYPES = ["note", "system", "status_change", "checklist_update"] as const;
export type OnboardingNoteType = typeof ONBOARDING_NOTE_TYPES[number];

export const onboardingTemplates = pgTable("onboarding_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const onboardingRecords = pgTable("onboarding_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  status: text("status").notNull().default("pending"),
  opportunityId: varchar("opportunity_id").references(() => pipelineOpportunities.id),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  assignedTo: text("assigned_to").references(() => user.id),
  templateId: varchar("template_id").references(() => onboardingTemplates.id),
  kickoffDate: timestamp("kickoff_date"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("onboarding_status_idx").on(t.status),
  index("onboarding_assigned_idx").on(t.assignedTo),
  index("onboarding_opp_idx").on(t.opportunityId),
  index("onboarding_company_idx").on(t.companyId),
  index("onboarding_due_idx").on(t.dueDate),
  index("onboarding_created_idx").on(t.createdAt),
]);

export const onboardingChecklistItems = pgTable("onboarding_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  onboardingId: varchar("onboarding_id").notNull().references(() => onboardingRecords.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(true),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedBy: text("completed_by").references(() => user.id),
  sortOrder: integer("sort_order").notNull().default(0),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("checklist_onboarding_idx").on(t.onboardingId),
  index("checklist_category_idx").on(t.category),
  index("checklist_completed_idx").on(t.isCompleted),
]);

export const onboardingNotes = pgTable("onboarding_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  onboardingId: varchar("onboarding_id").notNull().references(() => onboardingRecords.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id),
  type: text("type").notNull().default("note"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("onboarding_note_record_idx").on(t.onboardingId),
  index("onboarding_note_created_idx").on(t.createdAt),
]);

// ─── Onboarding Zod Schemas & Types ─────────────────────────────────

export const insertOnboardingTemplateSchema = createInsertSchema(onboardingTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOnboardingTemplate = z.infer<typeof insertOnboardingTemplateSchema>;
export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;

export const insertOnboardingRecordSchema = createInsertSchema(onboardingRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOnboardingRecord = z.infer<typeof insertOnboardingRecordSchema>;
export type OnboardingRecord = typeof onboardingRecords.$inferSelect;

export const insertOnboardingChecklistItemSchema = createInsertSchema(onboardingChecklistItems).omit({ id: true, createdAt: true });
export type InsertOnboardingChecklistItem = z.infer<typeof insertOnboardingChecklistItemSchema>;
export type OnboardingChecklistItem = typeof onboardingChecklistItems.$inferSelect;

export const insertOnboardingNoteSchema = createInsertSchema(onboardingNotes).omit({ id: true, createdAt: true });
export type InsertOnboardingNote = z.infer<typeof insertOnboardingNoteSchema>;
export type OnboardingNote = typeof onboardingNotes.$inferSelect;

// ─── CRM Zod Schemas & Types ────────────────────────────────────────

export const insertCrmCompanySchema = createInsertSchema(crmCompanies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmCompany = z.infer<typeof insertCrmCompanySchema>;
export type CrmCompany = typeof crmCompanies.$inferSelect;

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmContact = typeof crmContacts.$inferSelect;

export const insertCrmLeadStatusSchema = createInsertSchema(crmLeadStatuses).omit({ id: true });
export type InsertCrmLeadStatus = z.infer<typeof insertCrmLeadStatusSchema>;
export type CrmLeadStatus = typeof crmLeadStatuses.$inferSelect;

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type CrmLead = typeof crmLeads.$inferSelect;

export const insertCrmLeadNoteSchema = createInsertSchema(crmLeadNotes).omit({ id: true, createdAt: true });
export type InsertCrmLeadNote = z.infer<typeof insertCrmLeadNoteSchema>;
export type CrmLeadNote = typeof crmLeadNotes.$inferSelect;

export const insertCrmTagSchema = createInsertSchema(crmTags).omit({ id: true });
export type InsertCrmTag = z.infer<typeof insertCrmTagSchema>;
export type CrmTag = typeof crmTags.$inferSelect;

export const utmAttributionSchema = z.object({
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  referrer: z.string().optional(),
  landingPage: z.string().optional(),
  formPageUrl: z.string().optional(),
  honeypot: z.string().optional(),
});
export type UtmAttribution = z.infer<typeof utmAttributionSchema>;

// ─── Existing Schemas ────────────────────────────────────────────────

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const insertDocCategorySchema = createInsertSchema(docCategories).omit({ id: true, createdAt: true });
export type InsertDocCategory = z.infer<typeof insertDocCategorySchema>;
export type DocCategory = typeof docCategories.$inferSelect;

export const insertDocArticleSchema = createInsertSchema(docArticles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocArticle = z.infer<typeof insertDocArticleSchema>;
export type DocArticle = typeof docArticles.$inferSelect;

export const insertDocTagSchema = createInsertSchema(docTags).omit({ id: true });
export type InsertDocTag = z.infer<typeof insertDocTagSchema>;
export type DocTag = typeof docTags.$inferSelect;

export const insertDocRevisionSchema = createInsertSchema(docRevisions).omit({ id: true, createdAt: true });
export type InsertDocRevision = z.infer<typeof insertDocRevisionSchema>;
export type DocRevision = typeof docRevisions.$inferSelect;

export const insertIntegrationRecordSchema = createInsertSchema(integrationRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationRecord = z.infer<typeof insertIntegrationRecordSchema>;
export type IntegrationRecord = typeof integrationRecords.$inferSelect;

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;

export const ROLES = ["admin", "developer", "sales_rep"] as const;
export type Role = typeof ROLES[number];
