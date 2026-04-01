import { sql } from "drizzle-orm";
import { normalizePhoneDigits } from "./phone";
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
}, (t) => [
  index("contacts_created_idx").on(t.createdAt),
  index("contacts_email_idx").on(t.email),
  index("contacts_trade_idx").on(t.trade),
]);

export const insertContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone is required").refine(
    (v) => normalizePhoneDigits(v).length === 10,
    { message: "Enter a valid 10-digit US phone number" }
  ),
  business: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  trade: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
});

// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const insertInquirySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone is required").refine(
    (v) => normalizePhoneDigits(v).length === 10,
    { message: "Enter a valid 10-digit US phone number" }
  ),
  zipCode: z.string().optional(),
  service: z.string().optional(),
  message: z.string().optional(),
});

// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
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
}, (t) => [
  index("session_user_idx").on(t.userId),
  index("session_expires_idx").on(t.expiresAt),
]);

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
}, (t) => [
  index("account_user_idx").on(t.userId),
  index("account_provider_account_idx").on(t.providerId, t.accountId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("verification_identifier_idx").on(t.identifier),
  index("verification_expires_idx").on(t.expiresAt),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").references(() => user.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("audit_user_idx").on(t.userId),
  index("audit_entity_idx").on(t.entity, t.entityId),
  index("audit_created_idx").on(t.createdAt),
  index("audit_action_idx").on(t.action),
]);

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
}, (t) => [
  index("doc_articles_category_idx").on(t.categoryId),
  index("doc_articles_status_idx").on(t.status),
  index("doc_articles_updated_idx").on(t.updatedAt),
  index("doc_articles_author_idx").on(t.authorId),
]);

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
  index("doc_article_tags_tag_idx").on(t.tagId),
]);

export const docRevisions = pgTable("doc_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => docArticles.id),
  content: text("content").notNull(),
  authorId: text("author_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("doc_revisions_article_idx").on(t.articleId),
  index("doc_revisions_created_idx").on(t.createdAt),
]);

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
  clientStatus: text("client_status"),
  accountOwnerId: varchar("account_owner_id").references(() => user.id),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  preferredContactMethod: text("preferred_contact_method"),
  launchDate: timestamp("launch_date"),
  renewalDate: timestamp("renewal_date"),
  websiteStatus: text("website_status"),
  carePlanStatus: text("care_plan_status"),
  serviceTier: text("service_tier"),
  billingNotes: text("billing_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("crm_companies_name_idx").on(t.name),
  index("crm_companies_email_idx").on(t.email),
  index("crm_companies_phone_idx").on(t.phone),
  index("crm_companies_created_idx").on(t.createdAt),
  index("crm_companies_industry_idx").on(t.industry),
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
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("crm_contacts_email_idx").on(t.email),
  index("crm_contacts_phone_idx").on(t.phone),
  index("crm_contacts_company_idx").on(t.companyId),
  index("crm_contacts_created_idx").on(t.createdAt),
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
  city: text("city"),
  state: text("state"),
  timezone: text("timezone"),
  sellerProfileUrl: text("seller_profile_url"),
  adUrl: text("ad_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("crm_leads_status_idx").on(t.statusId),
  index("crm_leads_company_idx").on(t.companyId),
  index("crm_leads_contact_idx").on(t.contactId),
  index("crm_leads_created_idx").on(t.createdAt),
  index("crm_leads_assigned_idx").on(t.assignedTo),
  index("crm_leads_source_idx").on(t.source),
  index("crm_leads_web_form_idx").on(t.fromWebsiteForm),
]);

export const LEAD_NOTE_TYPES = ["note", "call", "email", "task", "status_change", "system", "sms"] as const;
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

export const CLIENT_NOTE_TYPES = ["general", "call", "meeting", "internal"] as const;
export type ClientNoteType = typeof CLIENT_NOTE_TYPES[number];

export const clientNotes = pgTable("client_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => crmCompanies.id),
  userId: text("user_id").references(() => user.id),
  type: text("type").notNull().default("general"),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("client_notes_company_idx").on(t.companyId),
  index("client_notes_created_idx").on(t.createdAt),
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
  index("crm_lead_tags_tag_idx").on(t.tagId),
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

export const WEBSITE_PACKAGES = ["empieza", "crece", "domina"] as const;
export type WebsitePackage = typeof WEBSITE_PACKAGES[number];

export const pipelineOpportunities = pgTable("pipeline_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  value: numeric("value"),
  websitePackage: text("website_package"),
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
  index("pipeline_opp_contact_idx").on(t.contactId),
  index("pipeline_opp_next_action_idx").on(t.nextActionDate),
  index("pipeline_opp_status_stage_idx").on(t.status, t.stageId),
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
  index("pipeline_act_user_idx").on(t.userId),
]);

// ─── Pipeline Zod Schemas & Types ────────────────────────────────────

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({ id: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

export const insertPipelineOpportunitySchema = createInsertSchema(pipelineOpportunities).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertPipelineOpportunity = z.infer<typeof insertPipelineOpportunitySchema>;
export type PipelineOpportunity = typeof pipelineOpportunities.$inferSelect;

export const insertPipelineActivitySchema = createInsertSchema(pipelineActivities).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
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
  index("onboarding_contact_idx").on(t.contactId),
  index("onboarding_status_due_idx").on(t.status, t.dueDate),
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
  index("checklist_onboarding_sort_idx").on(t.onboardingId, t.sortOrder),
  index("checklist_completed_by_idx").on(t.completedBy),
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
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertOnboardingTemplate = z.infer<typeof insertOnboardingTemplateSchema>;
export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;

export const insertOnboardingRecordSchema = createInsertSchema(onboardingRecords).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertOnboardingRecord = z.infer<typeof insertOnboardingRecordSchema>;
export type OnboardingRecord = typeof onboardingRecords.$inferSelect;

export const insertOnboardingChecklistItemSchema = createInsertSchema(onboardingChecklistItems).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertOnboardingChecklistItem = z.infer<typeof insertOnboardingChecklistItemSchema>;
export type OnboardingChecklistItem = typeof onboardingChecklistItems.$inferSelect;

export const insertOnboardingNoteSchema = createInsertSchema(onboardingNotes).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertOnboardingNote = z.infer<typeof insertOnboardingNoteSchema>;
export type OnboardingNote = typeof onboardingNotes.$inferSelect;

// ─── Notification Tables ─────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "new_lead", "lead_assignment", "lead_converted", "stage_change", "opportunity_assignment",
  "onboarding_assignment", "onboarding_status", "system_alert",
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const NOTIFICATION_CHANNELS = ["in_app", "email", "both"] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export const EMAIL_STATUSES = ["pending", "sent", "failed", "skipped"] as const;
export type EmailStatus = typeof EMAIL_STATUSES[number];

export const ENTITY_TYPES = ["lead", "opportunity", "onboarding", "company", "contact"] as const;
export type EntityType = typeof ENTITY_TYPES[number];

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientId: text("recipient_id").notNull().references(() => user.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  channel: text("channel").notNull().default("in_app"),
  emailStatus: text("email_status").default("skipped"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("notif_recipient_idx").on(t.recipientId),
  index("notif_type_idx").on(t.type),
  index("notif_read_idx").on(t.isRead),
  index("notif_created_idx").on(t.createdAt),
  index("notif_entity_idx").on(t.relatedEntityType, t.relatedEntityId),
  index("notif_recipient_read_idx").on(t.recipientId, t.isRead),
  index("notif_recipient_created_idx").on(t.recipientId, t.createdAt),
]);

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id),
  type: text("type").notNull(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
}, (t) => [
  index("notif_pref_user_idx").on(t.userId),
]);

// ─── Notification Zod Schemas & Types ────────────────────────────────

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ id: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

// ─── CRM Zod Schemas & Types ────────────────────────────────────────

export const insertCrmCompanySchema = createInsertSchema(crmCompanies).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertCrmCompany = z.infer<typeof insertCrmCompanySchema>;
export type CrmCompany = typeof crmCompanies.$inferSelect;

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmContact = typeof crmContacts.$inferSelect;

export const insertCrmLeadStatusSchema = createInsertSchema(crmLeadStatuses).omit({ id: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertCrmLeadStatus = z.infer<typeof insertCrmLeadStatusSchema>;
export type CrmLeadStatus = typeof crmLeadStatuses.$inferSelect;

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type CrmLead = typeof crmLeads.$inferSelect;

export const insertCrmLeadNoteSchema = createInsertSchema(crmLeadNotes).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertCrmLeadNote = z.infer<typeof insertCrmLeadNoteSchema>;
export type CrmLeadNote = typeof crmLeadNotes.$inferSelect;

export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;
export type ClientNote = typeof clientNotes.$inferSelect;

export const insertCrmTagSchema = createInsertSchema(crmTags).omit({ id: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
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
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type UtmAttribution = z.infer<typeof utmAttributionSchema>;

// ─── Existing Schemas ────────────────────────────────────────────────

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const insertDocCategorySchema = createInsertSchema(docCategories).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertDocCategory = z.infer<typeof insertDocCategorySchema>;
export type DocCategory = typeof docCategories.$inferSelect;

export const insertDocArticleSchema = createInsertSchema(docArticles).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertDocArticle = z.infer<typeof insertDocArticleSchema>;
export type DocArticle = typeof docArticles.$inferSelect;

export const insertDocTagSchema = createInsertSchema(docTags).omit({ id: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertDocTag = z.infer<typeof insertDocTagSchema>;
export type DocTag = typeof docTags.$inferSelect;

export const insertDocRevisionSchema = createInsertSchema(docRevisions).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertDocRevision = z.infer<typeof insertDocRevisionSchema>;
export type DocRevision = typeof docRevisions.$inferSelect;

export const insertIntegrationRecordSchema = createInsertSchema(integrationRecords).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertIntegrationRecord = z.infer<typeof insertIntegrationRecordSchema>;
export type IntegrationRecord = typeof integrationRecords.$inferSelect;

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;

export const ROLES = ["admin", "developer", "sales_rep", "lead_gen"] as const;
export type Role = typeof ROLES[number];

// ─── Team Chat ────────────────────────────────────────────────────────

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: text("channel").notNull().default("general"),
  senderId: text("sender_id").notNull().references(() => user.id),
  content: text("content").notNull(),
  parentId: varchar("parent_id"),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("chat_messages_channel_idx").on(t.channel),
  index("chat_messages_created_idx").on(t.createdAt),
  index("chat_messages_channel_created_idx").on(t.channel, t.createdAt),
  index("chat_messages_sender_idx").on(t.senderId),
  index("chat_messages_parent_idx").on(t.parentId),
]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Follow-up Tasks ──────────────────────────────────────────────────

export const followupTasks = pgTable("followup_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  notes: text("notes"),
  taskType: text("task_type").default("follow_up"),
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  assignedTo: text("assigned_to").references(() => user.id),
  opportunityId: varchar("opportunity_id").references(() => pipelineOpportunities.id),
  leadId: varchar("lead_id").references(() => crmLeads.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  followUpTime: text("follow_up_time"),
  followUpTimezone: text("follow_up_timezone"),
  outcome: text("outcome"),
  completionNote: text("completion_note"),
}, (t) => [
  index("followup_tasks_due_idx").on(t.dueDate),
  index("followup_tasks_opp_idx").on(t.opportunityId),
  index("followup_tasks_lead_idx").on(t.leadId),
  index("followup_tasks_contact_idx").on(t.contactId),
  index("followup_tasks_company_idx").on(t.companyId),
  index("followup_tasks_assigned_idx").on(t.assignedTo),
  index("followup_tasks_completed_idx").on(t.completed),
  index("followup_tasks_completed_due_idx").on(t.completed, t.dueDate),
  index("followup_tasks_created_by_idx").on(t.createdBy),
]);

export const insertFollowupTaskSchema = createInsertSchema(followupTasks).omit({ id: true, createdAt: true, completedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertFollowupTask = z.infer<typeof insertFollowupTaskSchema>;
export type FollowupTask = typeof followupTasks.$inferSelect;

// ─── Record History (immutable event log per record) ─────────────────

export const RECORD_HISTORY_EVENTS = [
  "created",
  "status_changed",
  "stage_changed",
  "assigned",
  "converted",
  "created_from_lead",
  "closed_won",
  "closed_lost",
  "checklist_completed",
  "checklist_uncompleted",
  "field_updated",
  "note_added",
  "note_deleted",
  "task_created",
  "task_completed",
  "task_reopened",
  "task_deleted",
  "contact_added",
  "contact_updated",
  "owner_changed",
  "service_tier_changed",
  "billing_event",
] as const;
export type RecordHistoryEvent = typeof RECORD_HISTORY_EVENTS[number];

export const recordHistory = pgTable("record_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  event: text("event").notNull(),
  fieldName: text("field_name"),
  fromValue: text("from_value"),
  toValue: text("to_value"),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("record_history_entity_idx").on(t.entityType, t.entityId),
  index("record_history_created_idx").on(t.createdAt),
]);

export const insertRecordHistorySchema = createInsertSchema(recordHistory).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertRecordHistory = z.infer<typeof insertRecordHistorySchema>;
export type RecordHistory = typeof recordHistory.$inferSelect;

// ─── Chat: DM Messages ────────────────────────────────────────────────

export const chatDmMessages = pgTable("chat_dm_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: text("sender_id").notNull().references(() => user.id),
  recipientId: text("recipient_id").notNull().references(() => user.id),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("chat_dm_sender_idx").on(t.senderId),
  index("chat_dm_recipient_idx").on(t.recipientId),
  index("chat_dm_created_idx").on(t.createdAt),
  index("chat_dm_conversation_idx").on(t.senderId, t.recipientId),
]);

export const insertChatDmMessageSchema = createInsertSchema(chatDmMessages).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertChatDmMessage = z.infer<typeof insertChatDmMessageSchema>;
export type ChatDmMessage = typeof chatDmMessages.$inferSelect;

// ─── Chat: Read State (last-read tracking per user per channel) ───────

export const chatReadState = pgTable("chat_read_state", {
  userId: text("user_id").notNull().references(() => user.id),
  channelId: text("channel_id").notNull(),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.channelId] }),
]);

export type ChatReadState = typeof chatReadState.$inferSelect;

// ─── Chat: Reactions ─────────────────────────────────────────────────

export const chatReactions = pgTable("chat_reactions", {
  messageId: varchar("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
  index("chat_reactions_msg_idx").on(t.messageId),
]);

export type ChatReaction = typeof chatReactions.$inferSelect;

// ─── File Attachments ─────────────────────────────────────────────────

export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),
  url: text("url").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploaderUserId: text("uploader_user_id").references(() => user.id),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("attachments_entity_idx").on(t.entityType, t.entityId),
  index("attachments_uploader_idx").on(t.uploaderUserId),
  index("attachments_created_idx").on(t.createdAt),
]);

export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// ─── Stripe: Customer Records ─────────────────────────────────────────

export const stripeCustomers = pgTable("stripe_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull().default("company"),
  entityId: text("entity_id").notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("stripe_customers_entity_idx").on(t.entityType, t.entityId),
  index("stripe_customers_stripe_idx").on(t.stripeCustomerId),
]);

export const insertStripeCustomerSchema = createInsertSchema(stripeCustomers).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertStripeCustomer = z.infer<typeof insertStripeCustomerSchema>;
export type StripeCustomer = typeof stripeCustomers.$inferSelect;

// ─── Stripe: Webhook Event Log ────────────────────────────────────────

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  rawPayload: text("raw_payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("stripe_events_type_idx").on(t.type),
  index("stripe_events_processed_idx").on(t.processed),
  index("stripe_events_created_idx").on(t.createdAt),
]);

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEvents).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertStripeWebhookEvent = z.infer<typeof insertStripeWebhookEventSchema>;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;

// ─── Workflow Jobs (Durable Async Outbox) ─────────────────────────────

export const workflowJobs = pgTable("workflow_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  payload: jsonb("payload").notNull(),
  sourceId: varchar("source_id"),
  sourceType: text("source_type"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  nextRunAt: timestamp("next_run_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("workflow_jobs_status_idx").on(t.status),
  index("workflow_jobs_next_run_idx").on(t.nextRunAt),
  index("workflow_jobs_source_idx").on(t.sourceId, t.type),
]);

export const insertWorkflowJobSchema = createInsertSchema(workflowJobs).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertWorkflowJob = z.infer<typeof insertWorkflowJobSchema>;
export type WorkflowJob = typeof workflowJobs.$inferSelect;

// ─── SMS Messages ─────────────────────────────────────────────────────

export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => crmLeads.id),
  direction: text("direction").notNull(), // "inbound" | "outbound"
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  content: text("content").notNull(),
  senderName: text("sender_name"),
  openPhoneMessageId: text("openphone_message_id").unique(),
  sentAt: timestamp("sent_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sms_messages_lead_idx").on(t.leadId),
  index("sms_messages_sent_at_idx").on(t.sentAt),
  index("sms_messages_openphone_id_idx").on(t.openPhoneMessageId),
]);

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;

// ─── Demo Configs (Demo Builder → CRM link) ───────────────────────────

export const demoConfigs = pgTable("demo_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => crmLeads.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").references(() => user.id),
  businessName: text("business_name").notNull(),
  trade: text("trade").notNull(),
  tier: text("tier").notNull().default("domina"),
  city: text("city"),
  phone: text("phone"),
  previewUrl: text("preview_url").notNull(),
  settings: text("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("demo_configs_lead_idx").on(t.leadId),
  index("demo_configs_created_by_idx").on(t.createdByUserId),
  index("demo_configs_created_idx").on(t.createdAt),
]);

export const insertDemoConfigSchema = createInsertSchema(demoConfigs).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertDemoConfig = z.infer<typeof insertDemoConfigSchema>;
export type DemoConfig = typeof demoConfigs.$inferSelect;

// ─── Stage-Based Task Automation Templates ────────────────────────────

export const AUTOMATION_TRIGGER_STAGES = [
  "new-lead",
  "contacted",
  "demo-scheduled",
  "demo-completed",
  "payment-sent",
  "closed-won",
  "closed-lost",
] as const;
export type AutomationTriggerStage = typeof AUTOMATION_TRIGGER_STAGES[number];

export const AUTOMATION_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type AutomationPriority = typeof AUTOMATION_PRIORITIES[number];

export const stageAutomationTemplates = pgTable("stage_automation_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggerStageSlug: text("trigger_stage_slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueOffsetDays: integer("due_offset_days").notNull().default(0),
  priority: text("priority").notNull().default("medium"),
  taskType: text("task_type").notNull().default("follow_up"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").references(() => user.id),
  updatedBy: text("updated_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("stage_auto_tpl_stage_idx").on(t.triggerStageSlug),
  index("stage_auto_tpl_active_idx").on(t.isActive),
  index("stage_auto_tpl_sort_idx").on(t.triggerStageSlug, t.sortOrder),
]);

export const insertStageAutomationTemplateSchema = createInsertSchema(stageAutomationTemplates).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertStageAutomationTemplate = z.infer<typeof insertStageAutomationTemplateSchema>;
export type StageAutomationTemplate = typeof stageAutomationTemplates.$inferSelect;

// ─── Automation Execution Log ─────────────────────────────────────────

export const AUTOMATION_EXEC_STATUSES = ["success", "skipped", "failed"] as const;
export type AutomationExecStatus = typeof AUTOMATION_EXEC_STATUSES[number];

export const automationExecutionLogs = pgTable("automation_execution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => crmLeads.id),
  opportunityId: varchar("opportunity_id").references(() => pipelineOpportunities.id),
  triggerStageSlug: text("trigger_stage_slug").notNull(),
  templateId: varchar("template_id").references(() => stageAutomationTemplates.id),
  generatedTaskId: varchar("generated_task_id").references(() => followupTasks.id),
  status: text("status").notNull().default("success"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("auto_exec_log_lead_idx").on(t.leadId),
  index("auto_exec_log_opp_idx").on(t.opportunityId),
  index("auto_exec_log_stage_idx").on(t.triggerStageSlug),
  index("auto_exec_log_tpl_idx").on(t.templateId),
  index("auto_exec_log_created_idx").on(t.createdAt),
  index("auto_exec_log_dup_check_idx").on(t.opportunityId, t.templateId, t.triggerStageSlug, t.status),
]);

export const insertAutomationExecutionLogSchema = createInsertSchema(automationExecutionLogs).omit({ id: true, createdAt: true });
// @ts-ignore -- drizzle-zod v0.8 uses zod/v4 types; z.infer constraint mismatch with zod v3 is harmless
export type InsertAutomationExecutionLog = z.infer<typeof insertAutomationExecutionLogSchema>;
export type AutomationExecutionLog = typeof automationExecutionLogs.$inferSelect;
