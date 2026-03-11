import { db } from "../../db";
import { docCategories, docArticles } from "@shared/schema";
import { eq } from "drizzle-orm";

const CATEGORIES = [
  { name: "Getting Started", slug: "getting-started", description: "Quick-start guides and onboarding", sortOrder: 0 },
  { name: "Architecture Overview", slug: "architecture-overview", description: "System design and technical architecture", sortOrder: 1 },
  { name: "Authentication & Authorization", slug: "auth", description: "Login, sessions, roles, and permissions", sortOrder: 2 },
  { name: "Users, Roles & Permissions", slug: "users-roles-permissions", description: "User management and RBAC", sortOrder: 3 },
  { name: "CRM / Leads", slug: "crm-leads", description: "Customer relationship management and lead tracking", sortOrder: 4 },
  { name: "Sales Pipeline", slug: "sales-pipeline", description: "Sales workflow and deal tracking", sortOrder: 5 },
  { name: "Client Onboarding", slug: "client-onboarding", description: "New client setup workflows", sortOrder: 6 },
  { name: "Team Chat", slug: "team-chat", description: "Internal team communication", sortOrder: 7 },
  { name: "Payments & Billing", slug: "payments-billing", description: "Stripe integration and invoicing", sortOrder: 8 },
  { name: "Notifications & Mailgun", slug: "notifications-mailgun", description: "Email and notification systems", sortOrder: 9 },
  { name: "Contact Forms / Lead Intake", slug: "contact-forms", description: "Public form submissions and lead capture", sortOrder: 10 },
  { name: "Integrations", slug: "integrations", description: "Third-party service connections", sortOrder: 11 },
  { name: "Admin Tools", slug: "admin-tools", description: "Internal administration features", sortOrder: 12 },
  { name: "Developer Tools", slug: "developer-tools", description: "Development utilities and debugging", sortOrder: 13 },
  { name: "Database Schema", slug: "database-schema", description: "Table definitions and relationships", sortOrder: 14 },
  { name: "API Reference", slug: "api-reference", description: "Backend endpoint documentation", sortOrder: 15 },
  { name: "UI / Frontend Modules", slug: "ui-frontend", description: "React components and frontend architecture", sortOrder: 16 },
  { name: "Background Jobs / System Automation", slug: "background-jobs", description: "Scheduled tasks and automated processes", sortOrder: 17 },
  { name: "Deployment / DevOps", slug: "deployment-devops", description: "Build, deploy, and infrastructure", sortOrder: 18 },
  { name: "Changelog / Release Notes", slug: "changelog", description: "Version history and release notes", sortOrder: 19 },
  { name: "Known Issues / Technical Debt", slug: "known-issues", description: "Tracked issues and improvement areas", sortOrder: 20 },
  { name: "Reports & Analytics", slug: "reports-analytics", description: "Dashboard reporting and analytics", sortOrder: 21 },
];

const SEED_ARTICLES = [
  {
    title: "Architecture Overview",
    slug: "architecture-overview",
    categorySlug: "architecture-overview",
    status: "published",
    content: `# Architecture Overview

## Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Express.js + TypeScript + Node.js
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: BetterAuth with admin plugin
- **Storage**: Cloudflare R2 (planned)

## Project Structure
\`\`\`
├── client/src/           # Frontend (Vite root)
│   ├── features/         # Feature-based modules (auth, admin, docs, integrations)
│   ├── layouts/          # Layout components (AdminLayout)
│   ├── pages/            # Marketing site pages
│   ├── components/       # Shared UI components
│   ├── empieza/          # Empieza demo sub-site
│   ├── crece/            # Crece demo sub-site
│   └── domina/           # Domina demo sub-site
├── server/               # Backend
│   ├── features/         # Domain-based server features
│   │   ├── auth/         # Authentication (BetterAuth, middleware)
│   │   ├── admin/        # Admin stats and audit logs
│   │   ├── docs/         # App Docs CRUD
│   │   ├── integrations/ # Integration management
│   │   └── audit/        # Audit logging service
│   ├── routes.ts         # Route aggregator
│   ├── storage.ts        # Legacy contact storage
│   └── db.ts             # Database connection
└── shared/               # Shared types and schemas
    └── schema.ts         # Drizzle schema + Zod validation
\`\`\`

## Key Design Decisions
1. **Feature-based organization**: Server and client code organized by domain, not by type
2. **Non-destructive**: Internal platform coexists with the public marketing site
3. **Role-based access**: Admin, Developer, and Sales Rep roles with granular permissions
4. **Audit trail**: All sensitive actions logged for compliance`,
  },
  {
    title: "RBAC / Permissions Overview",
    slug: "rbac-permissions",
    categorySlug: "auth",
    status: "published",
    content: `# Role-Based Access Control (RBAC)

## Roles
| Role | Description | Access Level |
|------|-------------|-------------|
| **admin** | Full system access | Everything |
| **developer** | Technical access | App Docs, Integrations, Dev Tools |
| **sales_rep** | Sales operations | Dashboard, CRM, Pipeline, Payments |

## Protected Routes
- \`/admin/*\` — Requires authentication (any role)
- \`/admin/docs/*\` — Admin + Developer only
- \`/admin/integrations\` — Admin + Developer only
- \`/admin/settings\` — Admin only
- \`/api/admin/audit-logs\` — Admin only

## Implementation
- BetterAuth \`admin\` plugin manages role assignment
- \`requireAuth\` middleware validates session via BetterAuth API
- \`requireRole(...roles)\` middleware checks user role after auth
- Default role for new users: \`sales_rep\`

## Middleware Usage
\`\`\`typescript
// Any authenticated user
router.get("/stats", requireAuth, handler);

// Specific roles
router.get("/docs", requireRole("admin", "developer"), handler);
\`\`\``,
  },
  {
    title: "Admin Shell / Navigation",
    slug: "admin-shell-navigation",
    categorySlug: "admin-tools",
    status: "published",
    content: `# Admin Shell & Navigation

## Layout
The admin interface uses \`AdminLayout.tsx\` which provides:
- Collapsible sidebar with navigation
- Top bar with user info and sign out
- Main content area with breadcrumbs
- Mobile-responsive drawer

## Navigation Sections
| Section | Route | Icon | Access |
|---------|-------|------|--------|
| Dashboard | /admin | LayoutDashboard | All |
| CRM | /admin/crm | Users | All |
| Sales Pipeline | /admin/pipeline | TrendingUp | All |
| Client Onboarding | /admin/onboarding | UserPlus | All |
| Team Chat | /admin/chat | MessageSquare | All |
| Payments | /admin/payments | CreditCard | All |
| Notifications | /admin/notifications | Bell | All |
| Integrations | /admin/integrations | Puzzle | Admin, Dev |
| Reports | /admin/reports | BarChart3 | All |
| Admin | /admin/settings | Settings | Admin |
| App Docs | /admin/docs | BookOpen | Admin, Dev |`,
  },
  {
    title: "App Docs System Overview",
    slug: "app-docs-overview",
    categorySlug: "developer-tools",
    status: "published",
    content: `# App Docs System

## Purpose
Internal documentation library for the Viva Web Designs platform. Accessible to Admin and Developer roles.

## Features
- Category-based organization with sidebar navigation
- Full-text search across titles and content
- Markdown content support
- Metadata: author, last updated, status
- Revision history for articles
- Tag system for cross-cutting topics

## Database Tables
- \`doc_categories\` — Category definitions with sort order
- \`doc_articles\` — Article content with category and author links
- \`doc_tags\` — Tag definitions
- \`doc_article_tags\` — Many-to-many join table
- \`doc_revisions\` — Content history (auto-created on edit)

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/docs/categories | List all categories |
| POST | /api/docs/categories | Create category |
| GET | /api/docs/articles | List articles (filter by category, search) |
| GET | /api/docs/articles/:slug | Get article by slug |
| POST | /api/docs/articles | Create article |
| PUT | /api/docs/articles/:id | Update article (auto-creates revision) |
| DELETE | /api/docs/articles/:id | Delete article |
| GET | /api/docs/tags | List all tags |`,
  },
  {
    title: "Integrations System Overview",
    slug: "integrations-overview",
    categorySlug: "integrations",
    status: "published",
    content: `# Integrations System

## Supported Integrations
| Provider | Purpose | Status |
|----------|---------|--------|
| **Stripe** | Payment processing | Planned |
| **Mailgun** | Transactional email | Planned |
| **OpenAI** | AI text generation | Planned |
| **Cloudflare R2** | Object/file storage | Planned |

## Features
- Enable/disable toggle per integration
- Configuration completeness indicator
- Last tested/validated timestamp
- Provider-specific settings (JSON)
- Documentation links

## Database Table: \`integration_records\`
| Column | Type | Description |
|--------|------|-------------|
| provider | text | Provider name (unique) |
| enabled | boolean | Active status |
| config_complete | boolean | Configuration completeness |
| last_tested | timestamp | Last validation |
| settings | jsonb | Provider-specific config |

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/integrations | List all integrations |
| GET | /api/integrations/:provider | Get specific integration |
| PUT | /api/integrations/:id | Update integration |`,
  },
  {
    title: "Database Schema Reference",
    slug: "database-schema-reference",
    categorySlug: "database-schema",
    status: "published",
    content: `# Database Schema Reference

## Tables

### contacts (existing)
Lead capture from public forms.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| name | text | Required |
| email | text | |
| phone | text | Required |
| business, city, trade, service, message | text | Optional |
| created_at | timestamp | Auto |

### user (BetterAuth)
Internal platform users.
| Column | Type | Notes |
|--------|------|-------|
| id | text | Primary key |
| name, email | text | Required |
| email_verified | boolean | |
| role | text | admin, developer, sales_rep |
| image | text | Avatar URL |

### session, account, verification (BetterAuth)
Managed by BetterAuth for authentication.

### audit_logs
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| user_id | text | FK → user |
| action | text | create, update, delete, etc. |
| entity | text | Table/resource name |
| entity_id | text | Affected record ID |
| metadata | jsonb | Additional context |
| ip_address | text | Request IP |

### doc_categories, doc_articles, doc_tags, doc_article_tags, doc_revisions
Documentation system tables. See App Docs System Overview.

### integration_records
Third-party integration configuration. See Integrations System Overview.`,
  },
  {
    title: "API Routes Reference",
    slug: "api-routes-reference",
    categorySlug: "api-reference",
    status: "published",
    content: `# API Routes Reference

## Public Endpoints (No Auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contacts | Submit contact form |
| POST | /api/inquiries | Submit demo inquiry |
| ALL | /api/auth/* | BetterAuth endpoints (login, signup, session) |

## Protected Endpoints (Require Auth)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/auth/me | Any | Current user info |
| POST | /api/admin/seed-admin | Gated (X-Seed-Secret header + env vars) | One-time bootstrap: create initial admin user |
| GET | /api/admin/stats | Any | Dashboard statistics |
| GET | /api/admin/audit-logs | Admin | Audit log viewer |

## Docs Endpoints (Admin + Developer)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/docs/categories | List categories |
| POST | /api/docs/categories | Create category |
| PUT | /api/docs/categories/:id | Update category |
| GET | /api/docs/articles | List/search articles |
| GET | /api/docs/articles/:slug | Get article |
| POST | /api/docs/articles | Create article |
| PUT | /api/docs/articles/:id | Update article |
| DELETE | /api/docs/articles/:id | Delete article |
| GET | /api/docs/tags | List tags |
| POST | /api/docs/tags | Create tag |

## Integrations Endpoints (Admin + Developer)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/integrations | List integrations |
| GET | /api/integrations/:provider | Get integration |
| PUT | /api/integrations/:id | Update integration |`,
  },
  {
    title: "Environment Variables",
    slug: "environment-variables",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Environment Variables

## Required
| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| BETTER_AUTH_SECRET | BetterAuth session secret (min 32 chars) |

## Optional
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| RESEND_API_KEY | Resend email API key | — |
| BETTER_AUTH_URL | Base URL for auth | http://localhost:5000 |

## Planned (for integrations)
| Variable | Description |
|----------|-------------|
| STRIPE_SECRET_KEY | Stripe API key |
| MAILGUN_API_KEY | Mailgun API key |
| OPENAI_API_KEY | OpenAI API key |
| CLOUDFLARE_R2_ACCESS_KEY | R2 access key |
| CLOUDFLARE_R2_SECRET_KEY | R2 secret key |
| CLOUDFLARE_R2_BUCKET | R2 bucket name |
| CLOUDFLARE_R2_ENDPOINT | R2 endpoint URL |`,
  },
  {
    title: "CRM Schema Overview",
    slug: "crm-schema-overview",
    categorySlug: "crm-leads",
    status: "published",
    content: `# CRM Schema Overview

## Tables

### crm_companies
Stores business/company records linked to leads and contacts.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| name | text | Required |
| dba | text | Trade/DBA name |
| website, phone, email | text | Contact info |
| address, city, state, zip, country | text | Location |
| industry | text | Business type |
| preferred_language | text | Default: es |
| notes | text | Internal notes |

### crm_contacts
Individual people associated with companies and leads.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| company_id | varchar | FK → crm_companies |
| first_name | text | Required |
| last_name | text | |
| email, phone, alt_phone | text | Contact info |
| title | text | Job title |
| preferred_language | text | Default: es |

### crm_leads
Sales opportunities with full attribution tracking.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| company_id | varchar | FK → crm_companies |
| contact_id | varchar | FK → crm_contacts |
| status_id | varchar | FK → crm_lead_statuses |
| title | text | Lead title (required) |
| value | numeric | Deal value |
| source | text | contact_form, demo_inquiry, manual |
| utm_source, utm_medium, utm_campaign | text | UTM attribution |
| utm_term, utm_content | text | UTM attribution |
| referrer, landing_page, form_page_url | text | Page attribution |
| from_website_form | boolean | Auto-created flag |
| assigned_to | text | FK → user |

### crm_lead_statuses
Pipeline status definitions.
| Slug | Default Color | Closed? |
|------|--------------|---------|
| new | #3B82F6 | No |
| contacted | #F59E0B | No |
| qualified | #8B5CF6 | No |
| proposal | #EC4899 | No |
| won | #10B981 | Yes |
| lost | #EF4444 | Yes |

### crm_lead_notes
Activity timeline entries for leads.
Types: note, call, email, task, status_change, system

### crm_tags / crm_lead_tags
Tagging system for leads (many-to-many).

## Indexes
- crm_companies: name, email, phone
- crm_contacts: email, phone, company_id
- crm_leads: status_id, company_id, contact_id, created_at, assigned_to`,
  },
  {
    title: "Lead/Company/Contact Relationships",
    slug: "crm-relationships",
    categorySlug: "crm-leads",
    status: "published",
    content: `# CRM Entity Relationships

## Relationship Model
\`\`\`
Company (1) ←──→ (N) Contacts
Company (1) ←──→ (N) Leads
Contact (1) ←──→ (N) Leads
Lead    (1) ←──→ (N) Notes
Lead    (N) ←──→ (N) Tags
\`\`\`

## Key Relationships
- A **Company** can have many Contacts and many Leads
- A **Contact** belongs to at most one Company (optional)
- A **Lead** belongs to at most one Company and one Contact (both optional)
- A **Lead** has many Notes (activity timeline)
- A **Lead** has many Tags (many-to-many via crm_lead_tags)

## Nullable Foreign Keys
All CRM foreign keys are nullable to support:
- Leads without company info (e.g., individual inquiries)
- Contacts without company association
- Leads without assigned contact (e.g., from anonymous forms)

## UI Navigation
- Lead detail shows linked Company and Contact (clickable)
- Company detail shows all linked Contacts and Leads
- Contact detail shows linked Company and all Leads`,
  },
  {
    title: "Website Contact Form to CRM Flow",
    slug: "crm-form-to-lead-flow",
    categorySlug: "contact-forms",
    status: "published",
    content: `# Website Contact Form → CRM Lead Flow

## System Path
\`\`\`
Website Contact Form
  → POST /api/contacts (with UTM attribution)
  → Zod validation + honeypot spam check
  → Save to legacy contacts table (preserves existing behavior)
  → CRM Ingest Service:
    1. Honeypot check (reject if filled)
    2. Parse name → firstName + lastName
    3. Deduplicate contact (email, then phone)
    4. Create or find CRM contact
    5. Create or find CRM company (from business name)
    6. Link contact ↔ company
    7. Get default lead status ("New")
    8. Create CRM lead with full UTM attribution
    9. Create system note on lead
    10. Audit log the creation
  → Email notification via Resend
  → Return 201 to frontend
\`\`\`

## Dual Endpoints
| Endpoint | Source | Notes |
|----------|--------|-------|
| POST /api/contacts | Main contact form (/contacto) | Full form fields |
| POST /api/inquiries | Demo tier forms (empieza/crece/domina) | Simplified fields |

Both endpoints write to legacy \`contacts\` table AND create CRM leads.

## Non-Blocking Error Handling
CRM ingest and email notification are wrapped in try/catch blocks. If either fails, the contact form still succeeds (non-blocking). Errors are logged to console.

## Frontend UTM Capture
The Contacto.tsx form uses \`useUtmParams()\` hook to capture:
- URL params: utm_source, utm_medium, utm_campaign, utm_term, utm_content
- Browser: document.referrer
- Page: window.location.href (landing page), window.location.pathname (form page)

These are merged with form data on submission.`,
  },
  {
    title: "Source Attribution Fields",
    slug: "crm-source-attribution",
    categorySlug: "crm-leads",
    status: "published",
    content: `# Lead Source Attribution

## UTM Parameters
| Field | Column | Example |
|-------|--------|---------|
| Campaign Source | utm_source | google, facebook, newsletter |
| Campaign Medium | utm_medium | cpc, email, social |
| Campaign Name | utm_campaign | spring_2026, contractor_promo |
| Campaign Term | utm_term | painting contractor |
| Campaign Content | utm_content | ad_variation_a |

## Page Attribution
| Field | Column | Description |
|-------|--------|-------------|
| Referrer | referrer | Previous page URL (document.referrer) |
| Landing Page | landing_page | First page visited (full URL) |
| Form Page URL | form_page_url | Page path where form was submitted |

## Source Metadata
| Field | Column | Values |
|-------|--------|--------|
| Source Type | source | contact_form, demo_inquiry, manual |
| Source Label | source_label | Human-readable label |
| Website Form Flag | from_website_form | true if auto-created from form |

## Testing Attribution
Append UTM params to the contact page URL:
\`\`\`
/contacto?utm_source=google&utm_medium=cpc&utm_campaign=test
\`\`\`
The form will automatically capture these and include them in the CRM lead.`,
  },
  {
    title: "Deduplication Logic",
    slug: "crm-deduplication",
    categorySlug: "crm-leads",
    status: "published",
    content: `# CRM Deduplication Logic

## Contact Deduplication
When a form submission arrives, the ingest service checks for existing CRM contacts:

1. **Email match first**: If the submitted email matches an existing crm_contact email
2. **Phone match fallback**: If no email match, check if phone matches

## Behavior on Duplicate
- **Contact found**: Reuses the existing contact record
- **Missing fields filled**: If the existing contact is missing email/phone that the new submission has, the contact is updated
- **New lead still created**: A new lead is always created (even for existing contacts)
- **System note**: The lead note indicates "Contact already existed in CRM (duplicate detected)"

## Company Deduplication
- Companies are matched by exact name (case-insensitive via ilike)
- If a matching company exists, it is reused
- If the contact has no company link, it is linked to the found/created company

## Design Decisions
- **Non-destructive**: Duplicates never overwrite existing data
- **Always creates a lead**: Even if contact exists, each form submission creates a new lead
- **Safe merging**: Only fills empty fields, never overwrites populated ones
- **Audit trail**: All duplicate detections are logged in audit_logs`,
  },
  {
    title: "CRM API Endpoints",
    slug: "crm-api-endpoints",
    categorySlug: "api-reference",
    status: "published",
    content: `# CRM API Endpoints

All CRM endpoints require authentication. Available to admin and sales_rep roles.

## Leads
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/crm/leads | List leads (search, statusId, source, assignedTo, fromWebsiteForm, page, limit) |
| POST | /api/crm/leads | Create lead |
| GET | /api/crm/leads/:id | Get lead detail |
| PUT | /api/crm/leads/:id | Update lead |
| GET | /api/crm/leads/:id/notes | Get lead activity notes |
| POST | /api/crm/leads/:id/notes | Add note to lead |
| GET | /api/crm/leads/:id/tags | Get lead tags |
| PUT | /api/crm/leads/:id/tags | Set lead tags |

## Companies
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/crm/companies | List companies (search, page, limit) |
| POST | /api/crm/companies | Create company |
| GET | /api/crm/companies/:id | Get company detail |
| PUT | /api/crm/companies/:id | Update company |

## Contacts
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/crm/contacts | List contacts (search, page, limit) |
| POST | /api/crm/contacts | Create contact |
| GET | /api/crm/contacts/:id | Get contact detail |
| PUT | /api/crm/contacts/:id | Update contact |

## Reference Data
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/crm/statuses | List lead statuses |
| GET | /api/crm/tags | List CRM tags |
| POST | /api/crm/tags | Create CRM tag |

## Pagination
List endpoints return:
\`\`\`json
{ "items": [...], "total": 42, "page": 1, "limit": 50 }
\`\`\``,
  },
  {
    title: "Sales Pipeline Schema",
    slug: "pipeline-schema",
    categorySlug: "sales-pipeline",
    status: "published",
    content: `# Sales Pipeline Schema

## Tables

### pipeline_stages
Configurable pipeline stage definitions.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| name | text | Required (e.g., "Discovery") |
| slug | text | Unique, URL-safe identifier |
| color | text | Hex color for UI display |
| sort_order | integer | Display order |
| is_default | boolean | Default stage for new opportunities |
| is_closed | boolean | Terminal stages (Won/Lost) |

### pipeline_opportunities
Sales deals/opportunities tracked through pipeline stages.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| title | text | Required |
| value | numeric | Deal value in dollars |
| stage_id | varchar | FK → pipeline_stages |
| lead_id | varchar | FK → crm_leads (source lead) |
| company_id | varchar | FK → crm_companies |
| contact_id | varchar | FK → crm_contacts |
| assigned_to | text | FK → user (owner) |
| status | text | open, won, lost |
| expected_close_date | timestamp | Forecasted close date |
| next_action_date | timestamp | Next follow-up/action date |
| follow_up_date | timestamp | Reminder date |
| stage_entered_at | timestamp | When current stage was entered |
| probability | integer | Win probability percentage |
| source_lead_title | text | Original lead title (for history) |
| notes | text | General notes |

### pipeline_activities
Activity timeline for opportunities (like CRM lead notes).
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| opportunity_id | varchar | FK → pipeline_opportunities |
| user_id | text | FK → user (who performed action) |
| type | text | stage_change, note, call, email, task, system |
| content | text | Activity description |
| metadata | jsonb | Additional context (e.g., stage names) |

## Indexes
- pipeline_opportunities: stage_id, assigned_to, status, expected_close_date, created_at, lead_id, company_id
- pipeline_activities: opportunity_id, created_at

## Default Stages
| Name | Slug | Color | Closed? |
|------|------|-------|---------|
| Discovery | discovery | #3B82F6 | No |
| Proposal | proposal | #8B5CF6 | No |
| Negotiation | negotiation | #F59E0B | No |
| Closed Won | closed-won | #10B981 | Yes |
| Closed Lost | closed-lost | #EF4444 | Yes |`,
  },
  {
    title: "Opportunity Lifecycle",
    slug: "pipeline-opportunity-lifecycle",
    categorySlug: "sales-pipeline",
    status: "published",
    content: `# Opportunity Lifecycle

## States
An opportunity has two independent tracking dimensions:

### Stage (Pipeline Position)
Tracks where the deal is in the sales process:
Discovery → Proposal → Negotiation → Closed Won / Closed Lost

### Status (Deal Outcome)
- **open** — Active deal in pipeline
- **won** — Deal successfully closed
- **lost** — Deal lost/abandoned

## Lifecycle Flow
\`\`\`
Lead Created → [Convert to Opportunity]
  → Discovery (open)
  → Proposal (open)
  → Negotiation (open)
  → Closed Won (won) | Closed Lost (lost)
\`\`\`

## Stage Changes
When an opportunity moves to a new stage:
1. stage_id is updated to the new stage
2. stage_entered_at is set to current timestamp
3. If the new stage is marked "closed" (is_closed=true):
   - Status auto-changes to "won" (closed-won) or "lost" (closed-lost)
4. A stage_change activity is logged with from/to stage names

## Reopening
Won/Lost opportunities can be reopened:
- Status reverts to "open"
- Moved back to the default or first stage
- Activity logged

## Key Dates
| Field | Purpose |
|-------|---------|
| expected_close_date | Revenue forecasting |
| next_action_date | Task/follow-up tracking |
| follow_up_date | Reminder scheduling |
| stage_entered_at | Stage duration metrics |
| created_at | Opportunity age tracking |`,
  },
  {
    title: "Stage System",
    slug: "pipeline-stage-system",
    categorySlug: "sales-pipeline",
    status: "published",
    content: `# Pipeline Stage System

## Overview
Pipeline stages are fully configurable — they are database records, not hard-coded constants. Admin and Developer roles can add, edit, reorder, and delete stages.

## Stage Properties
| Property | Type | Purpose |
|----------|------|---------|
| name | text | Display name |
| slug | text | URL-safe unique identifier |
| color | hex | Visual color in board and badges |
| sort_order | integer | Column order in kanban board |
| is_default | boolean | Auto-assigned to new opportunities |
| is_closed | boolean | Terminal stage (triggers status change) |

## Default Stages (Seeded)
1. Discovery (#3B82F6) — Default stage
2. Proposal (#8B5CF6)
3. Negotiation (#F59E0B)
4. Closed Won (#10B981) — Closed
5. Closed Lost (#EF4444) — Closed

## Stage Management UI
Located at /admin/pipeline/stages (Admin and Developer access).
- Add new stages with name, color picker, and closed toggle
- Delete stages (opportunities in that stage lose their stage assignment)
- View sort order and stage metadata

## Closed Stage Behavior
When an opportunity moves to a closed stage:
- If slug is "closed-won" → status set to "won"
- Otherwise → status set to "lost"
- This logic lives in the moveOpportunity storage function`,
  },
  {
    title: "Lead → Opportunity Conversion",
    slug: "pipeline-lead-conversion",
    categorySlug: "sales-pipeline",
    status: "published",
    content: `# Lead → Opportunity Conversion

## Overview
CRM leads can be converted into pipeline opportunities. This creates a new opportunity linked back to the source lead, preserving the full history chain.

## Conversion Flow
\`\`\`
Lead Detail Page
  → Click "Convert to Opportunity"
  → Select target pipeline stage
  → POST /api/pipeline/convert-lead/:leadId
  → Creates opportunity with:
    - title from lead title
    - value from lead value
    - company/contact from lead associations
    - assigned_to from lead assignment
    - source_lead_title preserved for history
  → System activity logged: "Created from lead: [title]"
  → Navigate to new opportunity detail
\`\`\`

## Data Carried Over
| Lead Field | Opportunity Field |
|------------|------------------|
| title | title |
| value | value |
| company_id | company_id |
| contact_id | contact_id |
| assigned_to | assigned_to |
| notes | notes |
| title | source_lead_title |

## Important Notes
- The lead is NOT deleted or modified
- The opportunity gets a lead_id FK pointing back to the source lead
- Multiple opportunities can be created from the same lead
- The opportunity detail page shows a "Source Lead" link for traceability
- Conversion is logged in audit_logs

## API
\`\`\`
POST /api/pipeline/convert-lead/:leadId
Body: { stageId: "uuid", title?: "override", value?: "override" }
Returns: Created opportunity object
\`\`\``,
  },
  {
    title: "Pipeline API Routes",
    slug: "pipeline-api-routes",
    categorySlug: "api-reference",
    status: "published",
    content: `# Pipeline API Routes

All pipeline endpoints require authentication.

## Stages
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/pipeline/stages | All | List all stages (sorted) |
| POST | /api/pipeline/stages | Admin, Dev | Create stage |
| PUT | /api/pipeline/stages/:id | Admin, Dev | Update stage |
| DELETE | /api/pipeline/stages/:id | Admin | Delete stage |

## Opportunities
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/pipeline/opportunities | Admin, Sales | List (search, stageId, assignedTo, status, page, limit) |
| GET | /api/pipeline/opportunities/board | Admin, Sales | Board data (grouped by stage) |
| GET | /api/pipeline/opportunities/stats | Admin, Sales | Pipeline stats (value by stage) |
| POST | /api/pipeline/opportunities | Admin, Sales | Create opportunity |
| GET | /api/pipeline/opportunities/:id | Admin, Sales | Get detail |
| PUT | /api/pipeline/opportunities/:id | Admin, Sales | Update opportunity |
| PUT | /api/pipeline/opportunities/:id/stage | Admin, Sales | Move to stage (logs activity) |

## Activities
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/pipeline/opportunities/:id/activities | Admin, Sales | Activity timeline |
| POST | /api/pipeline/opportunities/:id/activities | Admin, Sales | Add activity |

## Lead Conversion
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /api/pipeline/convert-lead/:leadId | Admin, Sales | Convert lead to opportunity |

## Board Endpoint Response
\`\`\`json
{
  "stages": [...],
  "board": {
    "stage-uuid-1": {
      "stage": { ... },
      "opportunities": [...]
    }
  }
}
\`\`\`

## Pagination (List Endpoint)
\`\`\`json
{ "items": [...], "total": 42, "page": 1, "limit": 50 }
\`\`\``,
  },
  {
    title: "Pipeline UI Modules",
    slug: "pipeline-ui-modules",
    categorySlug: "ui-frontend",
    status: "published",
    content: `# Pipeline UI Modules

## Frontend Files
All pipeline UI lives in \`client/src/features/pipeline/\`:

| File | Route | Description |
|------|-------|-------------|
| PipelineBoardPage.tsx | /admin/pipeline | Kanban board view |
| PipelineListPage.tsx | /admin/pipeline/list | Table/list view |
| OpportunityDetailPage.tsx | /admin/pipeline/opportunities/:id | Full detail page |
| StageManagementPage.tsx | /admin/pipeline/stages | Stage config (Admin/Dev) |

## Board View (PipelineBoardPage)
- Columns for each stage (sorted by sort_order)
- Cards show: title, company, value, probability, next action date
- Hover reveals left/right arrow buttons to move between stages
- Framer Motion for smooth card transitions
- Stage header shows opportunity count and total value
- Toggle to switch to list view

## List View (PipelineListPage)
- Searchable with filters for stage, status
- Paginated results
- Each row shows title, stage badge, value, dates
- Click to navigate to detail

## Detail Page (OpportunityDetailPage)
- Summary: title, value, probability, dates, stage
- Stage buttons to move between stages
- Mark Won / Mark Lost / Reopen actions
- Activity timeline (notes, calls, emails, stage changes)
- Add activity form with type selector
- Sidebar: linked company, contact, and source lead

## Stage Management (StageManagementPage)
- List of all stages with color dots and metadata
- Add new stage form with name, color picker, closed toggle
- Delete stages with confirmation
- Admin/Developer only`,
  },
  {
    title: "Pipeline Activity Logging",
    slug: "pipeline-activity-logging",
    categorySlug: "sales-pipeline",
    status: "published",
    content: `# Pipeline Activity Logging

## Activity Types
| Type | When Created | Auto? |
|------|-------------|-------|
| stage_change | Opportunity moves between stages | Auto |
| system | Lead conversion, opportunity creation | Auto |
| note | User adds a note | Manual |
| call | User logs a call | Manual |
| email | User logs an email | Manual |
| task | User logs a task | Manual |

## Auto-Generated Activities
### Stage Change
Created by moveOpportunity() in storage layer.
\`\`\`json
{
  "type": "stage_change",
  "content": "Moved from \\"Discovery\\" to \\"Proposal\\"",
  "metadata": {
    "fromStageId": "uuid",
    "fromStageName": "Discovery",
    "toStageId": "uuid",
    "toStageName": "Proposal",
    "newStatus": "open"
  }
}
\`\`\`

### Lead Conversion
Created by convertLeadToOpportunity() in storage layer.
\`\`\`json
{
  "type": "system",
  "content": "Created from lead: \\"Company Name - Contact\\"",
  "metadata": { "leadId": "uuid", "leadTitle": "..." }
}
\`\`\`

### Opportunity Creation
Created by POST /api/pipeline/opportunities route.

## Audit Trail
In addition to pipeline_activities, all pipeline mutations are logged in audit_logs with:
- action: create, update, stage_change, convert_lead, delete
- entity: pipeline_opportunity, pipeline_stage, pipeline_activity
- metadata: relevant context (title, stage names, lead ID)`,
  },
  {
    title: "v1.0 — Foundation Release",
    slug: "v1-foundation-release",
    categorySlug: "changelog",
    status: "published",
    content: `# v1.0 — Foundation Release

**Date**: March 2026

## What's New
- BetterAuth authentication with email/password login
- Role-based access control (Admin, Developer, Sales Rep)
- Protected admin shell with sidebar navigation
- App Docs library with categories, articles, tags, and revisions
- Integrations overview with Stripe, Mailgun, OpenAI, and Cloudflare R2
- Audit logging for sensitive actions
- Feature-based file organization (client and server)

## v1.1 — CRM Foundation (March 2026)
- CRM schema: companies, contacts, leads, statuses, notes, tags
- Lead list with search, filter by status/source, pagination
- Lead detail with status management, notes/activity timeline
- Company and contact detail pages
- Website contact form → CRM lead pipeline (auto-creates leads)
- UTM source attribution capture (utm_source, utm_medium, utm_campaign, etc.)
- Contact deduplication (email/phone matching)
- Honeypot anti-spam on contact forms
- Dashboard updated with CRM stats and recent leads
- 6 new CRM documentation articles

## v1.2 — Sales Pipeline (March 2026)
- Pipeline schema: stages, opportunities, activities
- Configurable pipeline stages (Discovery, Proposal, Negotiation, Closed Won, Closed Lost)
- Kanban board view with click-to-move stage transitions
- Opportunity list view with search, filters, pagination
- Opportunity detail page with activity timeline and stage management
- Stage management page (Admin/Developer only)
- Lead → Opportunity conversion flow
- Pipeline stats on dashboard (total value, deals by stage)
- Mark Won / Mark Lost / Reopen actions
- 7 new pipeline documentation articles

## Database Tables
### v1.0
- user, session, account, verification (BetterAuth)
- audit_logs, doc_categories, doc_articles, doc_tags, doc_article_tags, doc_revisions
- integration_records

### v1.1
- crm_companies, crm_contacts, crm_leads, crm_lead_statuses
- crm_lead_notes, crm_tags, crm_lead_tags

### v1.2
- pipeline_stages, pipeline_opportunities, pipeline_activities

## v1.3 — Client Onboarding (March 2026)
- Onboarding schema: templates, records, checklist items, notes
- Multi-step onboarding wizard (client info → checklist → dates → review)
- Template-based checklists with 12 default items across 11 categories
- Onboarding list with search, filter, progress display, overdue highlighting
- Onboarding detail page with checklist management, status actions, timeline
- Won opportunity → onboarding conversion flow
- Dashboard updated with onboarding overview section
- 6 new onboarding documentation articles

## Database Tables
### v1.0
- user, session, account, verification (BetterAuth)
- audit_logs, doc_categories, doc_articles, doc_tags, doc_article_tags, doc_revisions
- integration_records

### v1.1
- crm_companies, crm_contacts, crm_leads, crm_lead_statuses
- crm_lead_notes, crm_tags, crm_lead_tags

### v1.2
- pipeline_stages, pipeline_opportunities, pipeline_activities

### v1.3
- onboarding_templates, onboarding_records, onboarding_checklist_items, onboarding_notes

## v1.4 — System Notifications & Mailgun (March 2026)
- Notification schema: notifications, notification_preferences
- In-app notification center with type/read filters
- Notification bell with unread count badge in header (polls every 30s)
- Mailgun email service abstraction (HTTP API, no SDK)
- Event-driven notification triggers for: new leads, lead assignment, stage changes, opportunity assignment, onboarding assignment/status
- System alert notifications for admin/developer roles
- Email delivery tracking (pending/sent/failed/skipped)
- Related entity linking (click notification to navigate to lead/opportunity/onboarding)
- Non-blocking triggers — notification failures never break parent operations
- Graceful degradation when Mailgun is not configured
- 6 new notification documentation articles

## Database Tables
### v1.0
- user, session, account, verification (BetterAuth)
- audit_logs, doc_categories, doc_articles, doc_tags, doc_article_tags, doc_revisions
- integration_records

### v1.1
- crm_companies, crm_contacts, crm_leads, crm_lead_statuses
- crm_lead_notes, crm_tags, crm_lead_tags

### v1.2
- pipeline_stages, pipeline_opportunities, pipeline_activities

### v1.3
- onboarding_templates, onboarding_records, onboarding_checklist_items, onboarding_notes

### v1.4
- notifications, notification_preferences

## v1.5 — Reports & Analytics Dashboard (March 2026)
- Reporting service with modular query functions
- Combined overview endpoint for single-request dashboard load
- Leads by source breakdown with value totals
- Leads by status breakdown with color-coded bars
- Lead conversion rate (leads → opportunities)
- Lead activity trend (daily bar chart)
- Pipeline value by stage visualization
- Won vs Lost comparison with win rate calculation
- Onboarding progress breakdown with checklist completion rate
- Notification summary by type with unread counts
- Date range filters (7d, 30d, 90d, All time)
- Responsive grid layout with stat cards and section panels
- No new database tables (read-only reporting on existing data)
- 3 new reporting documentation articles

## v1.6 — Integrations Management (March 2026)
- Expanded integrations UI with provider detail panels
- Environment variable detection with per-var status indicators (set/missing)
- Feature flag badges (Active in Production / Planned / Scaffolded)
- Health check API with per-provider config detection
- Test Connection button with live API verification (Mailgun domain verify, Stripe balance check, OpenAI models check)
- Provider-specific setup instructions and operational notes
- Used-by feature mapping per integration
- Summary stats bar (Total / Configured / Active / Enabled)
- Richer seed data with setup instructions, optional env vars, and operational context
- No new database tables (uses existing integration_records)
- 3 new integration documentation articles

## v1.7 — Hardening & Documentation Pass (March 2026)
- Query optimization: \`getOnboardingStats\` now uses SQL GROUP BY + COUNT instead of fetching all rows
- Query optimization: \`getPipelineStats\` now uses SQL SUM/COUNT with GROUP BY instead of JS-side aggregation
- Query optimization: \`findCompanyByName\` adds input trimming and LIMIT 1
- Health loading state: Integrations page now shows "Checking..." during health API load instead of false "Not Configured"
- Summary stats: Integrations page stat cards show skeleton pulse animation while data loads
- Documentation completion: 6 new articles (Getting Started, Authentication Flow, Known Issues, Frontend Architecture, Deployment Guide, v1.7 changelog)
- Technical debt notes documented in App Docs
- Total doc count: 22 categories, 45 articles
- No new database tables — optimization and documentation only

## Technical Notes
- All existing marketing site functionality preserved
- Non-destructive architecture extension
- Modular feature-based code organization`,
  },
  {
    title: "Onboarding Schema",
    slug: "onboarding-schema",
    categorySlug: "client-onboarding",
    status: "published",
    content: `# Onboarding Schema

## Tables

### onboarding_templates
Reusable checklist templates for onboarding workflows.
- **id** (UUID PK)
- **name** — template display name
- **slug** — unique identifier
- **description** — optional summary
- **items** (JSONB) — array of checklist item definitions
- **createdAt / updatedAt**

### onboarding_records
Main onboarding tracking records.
- **id** (UUID PK)
- **clientName** — display name for the client/project
- **status** — pending | in_progress | completed | on_hold
- **opportunityId** (FK → pipeline_opportunities) — source deal
- **companyId** (FK → crm_companies) — linked company
- **contactId** (FK → crm_contacts) — linked contact
- **assignedTo** (FK → user) — internal owner
- **templateId** (FK → onboarding_templates) — source template
- **kickoffDate** — scheduled kickoff date
- **dueDate** — target completion date
- **completedAt** — actual completion timestamp
- **notes** — free-form notes
- **createdAt / updatedAt**

### onboarding_checklist_items
Individual checklist items attached to an onboarding record.
- **id** (UUID PK)
- **onboardingId** (FK → onboarding_records, CASCADE DELETE)
- **category** — one of: contract, payment, branding, domain_dns, website, google_business, google_ads, meta_facebook, social, content, kickoff
- **label** — item title
- **description** — optional detail
- **isRequired** — whether the item is mandatory
- **isCompleted** — completion state
- **completedAt** — when marked complete
- **completedBy** (FK → user) — who completed it
- **sortOrder** — display order
- **dueDate** — optional item-level due date

### onboarding_notes
Activity timeline for onboarding records.
- **id** (UUID PK)
- **onboardingId** (FK → onboarding_records, CASCADE DELETE)
- **userId** (FK → user) — author
- **type** — note | system | status_change | checklist_update
- **content** — text content
- **metadata** (JSONB) — structured data
- **createdAt**

## Indexes
- onboarding_records: status, assignedTo, opportunityId, companyId, dueDate, createdAt
- onboarding_checklist_items: onboardingId, category, isCompleted
- onboarding_notes: onboardingId, createdAt`,
  },
  {
    title: "Onboarding Wizard Flow",
    slug: "onboarding-wizard-flow",
    categorySlug: "client-onboarding",
    status: "published",
    content: `# Onboarding Wizard Flow

The onboarding wizard is a 4-step process for creating new client onboarding records.

## Step 1: Client Information
- **Client Name** (required) — the project or client display name
- **Company** (optional) — link to an existing CRM company
- **Contact** (optional) — link to an existing CRM contact

## Step 2: Checklist Items
- Select a template to pre-populate checklist items
- Default template: "Standard Web Design Onboarding" with 12 items
- Toggle individual items on/off to customize
- Items are grouped by category

## Step 3: Dates & Assignment
- **Kickoff Date** — when the project kicks off
- **Due Date** — target completion date
- **Notes** — additional instructions or context

## Step 4: Review & Create
- Summary of all selections
- Client name, linked records, dates, checklist summary
- Click "Create Onboarding" to finalize

## After Creation
- Redirects to the new onboarding detail page
- System note logged: "Onboarding record created"
- Audit log entry recorded`,
  },
  {
    title: "Checklist Model",
    slug: "onboarding-checklist-model",
    categorySlug: "client-onboarding",
    status: "published",
    content: `# Onboarding Checklist Model

## Categories
The checklist system organizes items into 11 categories:

| Category | Description |
|----------|-------------|
| contract | Contract/SOW receipt and signing |
| payment | Initial payment confirmation |
| branding | Logo, colors, fonts, style guide |
| domain_dns | Domain registrar/DNS access |
| website | Hosting/CPanel credentials |
| google_business | Google Business Profile access |
| google_ads | Google Ads account access |
| meta_facebook | Facebook/Meta Business access |
| social | Social media platform access |
| content | Photos, copy, testimonials |
| kickoff | Kickoff meeting scheduling/completion |

## Template System
- Templates define reusable sets of checklist items
- Default template: "Standard Web Design Onboarding" (12 items)
- Template items stored as JSONB array with category, label, description, isRequired
- When creating an onboarding record, template items are copied to individual checklist_items rows

## Item Completion
- Each item can be toggled complete/incomplete
- Completing an item records completedAt timestamp and completedBy user
- Unchecking an item clears completion data
- Each toggle creates a "checklist_update" note in the timeline

## Progress Calculation
- Progress = (completed items / total items) × 100
- Shown as percentage and fraction (e.g., "8/12 (67%)")
- Progress bar displayed on list and detail views

## Overdue Detection
- Items with dueDate before current time and not completed are flagged as overdue
- Overdue items highlighted in red on the detail page`,
  },
  {
    title: "Opportunity → Onboarding Handoff",
    slug: "onboarding-opportunity-handoff",
    categorySlug: "client-onboarding",
    status: "published",
    content: `# Opportunity → Onboarding Handoff

## Conversion Flow
Won pipeline opportunities can be converted to onboarding records via:
1. **Opportunity Detail Page** — "Start Onboarding" button (visible only for won opportunities)
2. **API** — POST /api/onboarding/convert-opportunity/:opportunityId

## What Gets Transferred
When converting an opportunity to onboarding:
- **clientName** — derived from linked company name, or opportunity title as fallback
- **opportunityId** — FK reference preserved for traceability
- **companyId** — carried over from opportunity
- **contactId** — carried over from opportunity
- **assignedTo** — carried over from opportunity
- **templateId** — if provided, template checklist items are auto-created

## Validation Rules
- Only opportunities with status "won" can be converted
- System note logged: "Onboarding created from opportunity: [title]"
- Audit log entry created

## After Conversion
- User is navigated to the new onboarding detail page
- The onboarding record links back to the source opportunity
- The opportunity detail page shows the linked onboarding`,
  },
  {
    title: "Onboarding API Routes",
    slug: "onboarding-api-routes",
    categorySlug: "api-reference",
    status: "published",
    content: `# Onboarding API Routes

All routes require authentication. Base path: /api/onboarding

## Records

### GET /records
List onboarding records with optional filters.
- Query params: status, search, page, limit
- Returns: { records: OnboardingRecord[], total: number }

### POST /records
Create a new onboarding record.
- Body: { clientName, status?, companyId?, contactId?, templateId?, kickoffDate?, dueDate?, notes?, checklistItems? }
- Returns: OnboardingRecord

### GET /records/:id
Get onboarding detail with checklist and progress.
- Returns: OnboardingRecord & { checklist, progress }

### PUT /records/:id
Update an onboarding record.
- Body: { clientName?, status?, assignedTo?, kickoffDate?, dueDate?, notes? }
- Auto-sets completedAt when status changes to "completed"

### DELETE /records/:id
Delete an onboarding record (Admin only). Cascades to checklist items and notes.

## Checklist

### GET /records/:id/checklist
Get all checklist items for a record.

### PUT /records/:id/checklist/:itemId
Toggle a checklist item complete/incomplete. Auto-logs timeline note.

## Notes / Timeline

### GET /records/:id/notes
Get activity timeline for a record (newest first).

### POST /records/:id/notes
Add a note to the timeline.
- Body: { content, type?, metadata? }

## Templates

### GET /templates
List all onboarding templates.

## Conversion

### POST /convert-opportunity/:opportunityId
Create onboarding from a won opportunity.
- Body: { templateId?, ...extraData }
- Returns: OnboardingRecord

## Stats

### GET /stats
Get onboarding statistics.
- Returns: { total, pending, inProgress, completed, onHold, overdue }`,
  },
  {
    title: "Onboarding UI Modules",
    slug: "onboarding-ui-modules",
    categorySlug: "ui-frontend",
    status: "published",
    content: `# Onboarding UI Modules

All onboarding frontend code lives in \`client/src/features/onboarding/\`.

## Pages

### OnboardingListPage
- Path: /admin/onboarding
- Features: search by client name, filter by status, stat cards (total, pending, in progress, completed, overdue), paginated list with progress display, overdue highlighting
- "New Onboarding" button links to wizard

### OnboardingDetailPage
- Path: /admin/onboarding/:id
- Layout: 2-column (main + sidebar)
- Main column: progress bar, checklist grouped by category, activity timeline with add note form
- Sidebar: status actions (Start, Complete, Put On Hold, Resume, Reopen), dates display, linked records (company, contact, opportunity)
- Checklist items can be toggled via checkboxes
- Overdue items highlighted in red

### OnboardingWizardPage
- Path: /admin/onboarding/new
- 4-step wizard with animated transitions
- Step indicators show progress
- Template selection auto-populates checklist items
- Final review step before creation

## Dashboard Integration
- "Active Onboardings" section on dashboard (shows pending, in progress, completed, on hold counts)
- "Client Onboarding" quick action link
- Onboarding section only appears when records exist

## Opportunity Detail Integration
- "Start Onboarding" button on won opportunities (OpportunityDetailPage)
- Calls POST /api/onboarding/convert-opportunity/:id
- Navigates to new onboarding record after creation`,
  },
  {
    title: "Notification Schema",
    slug: "notification-schema",
    categorySlug: "notifications-mailgun",
    status: "published",
    content: `# Notification Schema

## Tables

### notifications
Stores all in-app and email notification records.
- **id** (UUID PK)
- **recipientId** — FK to user table (who receives this notification)
- **type** — notification category: new_lead, lead_assignment, stage_change, opportunity_assignment, onboarding_assignment, onboarding_status, system_alert
- **title** — short headline displayed in notification center
- **message** — descriptive body text
- **relatedEntityType** — optional: lead, opportunity, onboarding, company, contact
- **relatedEntityId** — optional UUID of the related entity (for click-through navigation)
- **channel** — delivery channel: in_app, email, both
- **emailStatus** — email delivery state: pending, sent, failed, skipped
- **isRead** — boolean read state
- **readAt** — timestamp when marked read
- **sentAt** — timestamp when email was sent
- **failureReason** — error message if email delivery failed
- **metadata** — JSONB for additional context
- **createdAt** — auto-set creation timestamp

### notification_preferences
Per-user, per-type notification preferences (for future use).
- **id** (UUID PK)
- **userId** — FK to user
- **type** — notification type string
- **emailEnabled** — boolean (default true)
- **inAppEnabled** — boolean (default true)

## Indexes
- recipientId, type, isRead, createdAt, (relatedEntityType + relatedEntityId) composite`,
  },
  {
    title: "Mailgun Integration Overview",
    slug: "mailgun-integration-overview",
    categorySlug: "notifications-mailgun",
    status: "published",
    content: `# Mailgun Integration Overview

## Architecture
The Mailgun service is a modular abstraction layer at \`server/features/notifications/mailgun.ts\`. It uses the Mailgun HTTP API directly (no SDK dependency) for maximum control and minimal footprint.

## Configuration
Mailgun requires two environment variables:
- **MAILGUN_API_KEY** — your Mailgun API key
- **MAILGUN_DOMAIN** — your verified Mailgun domain (e.g., mg.vivawebdesigns.com)

Optional:
- **MAILGUN_FROM_EMAIL** — sender address (defaults to noreply@{domain})
- **MAILGUN_FROM_NAME** — sender display name (defaults to "Viva Web Designs")

## Graceful Degradation
If Mailgun is not configured (missing env vars), the system:
1. Returns \`status: "skipped"\` instead of failing
2. Logs a warning message to console
3. Continues to create in-app notifications normally
4. Never blocks or breaks parent operations

## Service API
- \`isConfigured()\` — returns boolean indicating if Mailgun env vars are set
- \`sendEmail(to, subject, html, options?)\` — sends email via Mailgun API
  - Returns \`{ success, status, messageId?, error? }\`
  - options: \`{ replyTo?, tags? }\`

## Security
- API key stored as environment secret (never hardcoded)
- Uses HTTP Basic Auth (api:{key}) per Mailgun API spec
- All send attempts and failures are logged to console`,
  },
  {
    title: "Notification Event Flow",
    slug: "notification-event-flow",
    categorySlug: "notifications-mailgun",
    status: "published",
    content: `# Notification Event Flow

## How Notifications Are Triggered
Notifications are event-driven. When a relevant action occurs in the CRM, Pipeline, or Onboarding system, a trigger function fires asynchronously. This is additive and non-blocking — if a notification trigger fails, it is caught silently and does not affect the parent operation.

## Trigger Functions (server/features/notifications/triggers.ts)

| Trigger | Event | Recipients | Channel |
|---------|-------|-----------|---------|
| notifyNewLead | New lead created via website form or CRM | All admins + sales reps | both (in-app + email) |
| notifyLeadAssignment | Lead assigned to a user | The assignee | both |
| notifyStageChange | Opportunity moved to a different stage | Opportunity owner + admins | in_app |
| notifyOpportunityAssignment | Opportunity assigned to a user | The assignee | both |
| notifyOnboardingAssignment | Onboarding record assigned | The assignee | both |
| notifyOnboardingStatusChange | Onboarding status updated | Owner + admins | in_app |
| notifySystemAlert | System/integration alert | All admins + developers | both |

## Flow
1. Business action completes (e.g., lead created)
2. Trigger function is called in a try/catch block
3. Trigger queries the user table to find recipients by role
4. For each recipient, \`createNotification()\` is called
5. If channel is "email" or "both", email is sent via Mailgun service
6. Notification record is saved to the database with delivery status

## Non-Blocking Design
All trigger calls follow this pattern:
\`\`\`typescript
try { notifyNewLead({ id, title, source }); } catch (_) {}
\`\`\`
This ensures notification failures never break the primary operation.`,
  },
  {
    title: "Email Template System Foundation",
    slug: "email-template-foundation",
    categorySlug: "notifications-mailgun",
    status: "published",
    content: `# Email Template System Foundation

## Current Implementation
The notification service includes a basic HTML email template builder (\`buildEmailHtml()\` in \`server/features/notifications/service.ts\`). This generates a branded email with:
- Viva Web Designs branded header (dark background)
- Notification title and message body
- Footer with automated notification disclaimer

## Template Registry (Future)
The architecture is designed to support a template registry where different notification types can have custom email templates. To add a new template:

1. Create a template function in \`service.ts\` or a separate \`templates/\` directory
2. Map the notification type to the template in \`sendEmailForNotification()\`
3. Templates receive the full Notification object including metadata

## Customization Points
- **Header branding**: Logo, colors, company name
- **Body layout**: Per-type content formatting
- **Footer**: Unsubscribe links, legal text
- **Metadata insertion**: Dynamic data from the notification metadata JSONB field

## Mailgun Tags
Each email is tagged with the notification type (e.g., "new_lead", "stage_change") for tracking and analytics in the Mailgun dashboard.`,
  },
  {
    title: "Notification API Routes",
    slug: "notification-api-routes",
    categorySlug: "notifications-mailgun",
    status: "published",
    content: `# Notification API Routes

All routes are under \`/api/notifications\` and require authentication.

## Endpoints

### GET /api/notifications
Returns the current user's notifications with optional filters.
- **Query params**: type, is_read (true/false), limit, offset
- **Response**: \`{ notifications: Notification[], total: number }\`

### GET /api/notifications/unread-count
Returns the count of unread notifications for the current user.
- **Response**: \`{ count: number }\`

### PUT /api/notifications/:id/read
Marks a single notification as read. Only works for notifications belonging to the current user.
- **Response**: \`{ message: "Marked as read" }\`

### PUT /api/notifications/read-all
Marks all unread notifications as read for the current user.
- **Response**: \`{ message: "Marked N notifications as read", count: number }\`

### GET /api/notifications/preferences
Returns the notification preferences for the current user (for future use).
- **Response**: Array of NotificationPreference objects

## Notes
- All endpoints scope results to the authenticated user (recipientId = user.id)
- The unread-count endpoint is polled every 30 seconds by the frontend bell component
- Notifications are ordered by createdAt descending (newest first)`,
  },
  {
    title: "Notification Center UI",
    slug: "notification-center-ui",
    categorySlug: "notifications-mailgun",
    status: "published",
    content: `# Notification Center UI

## Components

### Notification Bell (AdminLayout header)
- Displays a bell icon in the top-right header area
- Shows a red badge with unread count when > 0
- Polls \`/api/notifications/unread-count\` every 30 seconds
- Clicking navigates to \`/admin/notifications\`

### NotificationCenterPage
Full notification list page at \`/admin/notifications\`.

**Features:**
- Notification list with type icons and color coding
- Unread indicator (teal left border + dot)
- Type filter dropdown (All, New Lead, Lead Assignment, Stage Change, etc.)
- Read status filter (All, Unread, Read)
- Mark individual notification as read (check button)
- Mark all as read button
- Email delivery status icon (sent/failed/skipped)
- Related entity linking — click a notification to navigate to the related lead, opportunity, or onboarding record
- Empty state when no notifications
- Animated list with Framer Motion

**Type Icons:**
- New Lead: Users (blue)
- Lead Assignment: UserPlus (indigo)
- Stage Change: TrendingUp (amber)
- Opportunity Assignment: TrendingUp (emerald)
- Onboarding Assignment: UserPlus (teal)
- Onboarding Status: ArrowRight (purple)
- System Alert: AlertTriangle (red)

**Data Test IDs:**
- text-notifications-title, button-mark-all-read, select-type-filter, select-read-filter
- notification-item-{id}, button-mark-read-{id}, text-empty-state
- button-notification-bell, badge-unread-count (in AdminLayout)`,
  },
  {
    title: "Reports API Reference",
    slug: "reports-api-reference",
    categorySlug: "reports-analytics",
    status: "published",
    content: `# Reports API Reference

## Endpoints

All report endpoints require authentication and one of: admin, developer, or sales_rep role.

### GET /api/reports/overview
Combined summary endpoint — loads all report modules in a single request.

**Query Parameters:**
- \`days\` (optional): Number of days to filter (e.g., 7, 30, 90)
- \`from\` / \`to\` (optional): Custom date range (ISO date strings)

**Response:**
\`\`\`json
{
  "leadsBySource": [{ "source": "contact_form", "sourceLabel": "Website Contact Form", "count": 5, "totalValue": 12000 }],
  "leadsByStatus": [{ "statusId": "abc", "statusName": "New", "statusColor": "#3B82F6", "count": 3 }],
  "conversion": { "total": 10, "converted": 3, "rate": 30 },
  "pipeline": { "byStage": [...], "totalOpen": 5, "totalValue": 50000 },
  "wonLost": { "won": { "count": 2, "value": 20000 }, "lost": { "count": 1, "value": 5000 }, "winRate": 67 },
  "onboarding": { "total": 3, "byStatus": {...}, "overdue": 1, "avgCompletionDays": 14, "checklist": { "total": 36, "completed": 18, "rate": 50 } },
  "notifications": { "byType": [...], "total": 25, "unread": 5 }
}
\`\`\`

### Individual Endpoints
- \`GET /api/reports/leads-by-source\` — Leads grouped by source
- \`GET /api/reports/leads-by-status\` — Leads grouped by status
- \`GET /api/reports/lead-conversion\` — Conversion rate metrics
- \`GET /api/reports/leads-trend?days=30\` — Daily lead creation trend
- \`GET /api/reports/pipeline-breakdown\` — Pipeline value by stage
- \`GET /api/reports/won-lost\` — Won vs Lost counts and values
- \`GET /api/reports/onboarding-breakdown\` — Onboarding status breakdown
- \`GET /api/reports/notification-summary\` — Notification type summary

All individual endpoints accept the same \`days\`/\`from\`/\`to\` query parameters where applicable.`,
  },
  {
    title: "Reports Dashboard Modules",
    slug: "reports-dashboard-modules",
    categorySlug: "reports-analytics",
    status: "published",
    content: `# Reports Dashboard Modules

## Overview
The Reports page (/admin/reports) provides analytics across CRM, pipeline, onboarding, and notifications.

## Dashboard Layout

### Top-Level Stat Cards
Four summary cards at the top:
1. **Total Leads** — Count with conversion sub-stat
2. **Conversion Rate** — Percentage of leads that became opportunities
3. **Pipeline Value** — Total dollar value with open opportunity count
4. **Win Rate** — Percentage based on won vs lost, color-coded

### Leads by Source
Horizontal bar chart showing lead counts grouped by source (Website Contact Form, referral, etc.). Includes total value for each source.

### Leads by Status
Horizontal bar chart showing lead counts grouped by CRM lead status (New, Qualified, etc.) with status colors.

### Pipeline Value by Stage
Horizontal bars showing total deal value per pipeline stage (Discovery → Closed Won/Lost). Shows deal count for each stage.

### Won vs Lost
Side-by-side comparison cards showing won/lost counts and values. Includes calculated win rate with color indicator.

### Onboarding Overview
Grid of status counts (Pending, In Progress, Completed, On Hold). Shows overdue count, checklist completion rate, and average days to complete.

### Notification Summary
Breakdown of notifications by type with total/unread counts. Shows unread badges per notification type.

### Lead Activity Trend
Bar chart showing daily lead creation over the selected time period. Hover tooltips show exact date and count.

## Date Range Filter
Toggle between 7 days, 30 days, 90 days, and All time. Affects all date-sensitive modules simultaneously.

## Data Test IDs
- text-reports-title, filter-date-range, btn-range-{days}
- card-report-total-leads, card-report-conversion, card-report-pipeline-value, card-report-win-rate
- card-leads-by-source, card-leads-by-status, card-pipeline-by-stage, card-won-lost
- stat-won, stat-lost, card-onboarding-overview, stat-onboarding-{status}
- card-notification-summary, card-leads-trend, chart-leads-trend`,
  },
  {
    title: "Reports Performance & Query Design",
    slug: "reports-performance-queries",
    categorySlug: "reports-analytics",
    status: "published",
    content: `# Reports Performance & Query Design

## Query Architecture
- Reports use read-only queries against existing tables — no new schema required
- The overview endpoint runs 7 queries in parallel via Promise.all for fast loading
- Date range filtering uses SQL WHERE clauses with \`gte\` and \`<\` operators on indexed timestamp columns

## Existing Indexes Used
Reports benefit from these existing database indexes:
- \`crm_leads_created_idx\` — Lead trend and date-filtered queries
- \`crm_leads_status_idx\` — Leads by status grouping
- \`pipeline_opp_status_idx\` — Won/Lost filtering
- \`pipeline_opp_stage_idx\` — Pipeline by stage grouping
- \`onboarding_status_idx\` — Onboarding status breakdown
- \`notif_type_idx\` — Notification summary grouping
- \`notif_read_idx\` — Unread notification filtering

## Query Patterns
- **Aggregation:** Uses SQL \`count(*)\`, \`sum()\`, and \`FILTER (WHERE ...)\` for efficient grouping
- **Pipeline breakdown:** Fetches all stages + opportunities in 2 queries, aggregates in JS
- **Onboarding stats:** Single table scan with JS filtering (small dataset)
- **Conversion rate:** Two count queries (total leads vs distinct lead IDs in opportunities)

## Performance Considerations
- Overview endpoint parallelizes all sub-queries for ~100-200ms total response
- No JOINs needed except leads-by-status (joins lead_statuses for name/color)
- All date filtering uses indexed columns (createdAt, updatedAt)
- Frontend uses TanStack Query with automatic caching — repeat visits are instant
- Date range changes trigger new queries but results cache independently by queryKey

## Future Optimization Notes
- If lead volume exceeds 10,000+, consider materialized views for trend data
- Pipeline breakdown could switch to SQL GROUP BY if opportunity count grows large
- Onboarding stats should move to SQL aggregation at scale`,
  },
  {
    title: "Integration Architecture",
    slug: "integration-architecture",
    categorySlug: "integrations",
    status: "published",
    content: `# Integration Architecture

## Overview
The Integrations module manages connections to four third-party services: Stripe, Mailgun, OpenAI, and Cloudflare R2. Each provider has configuration detection, health checking, and feature flag awareness.

## Database Model
All integrations use the \`integration_records\` table:
- \`provider\` — Unique slug (stripe, mailgun, openai, cloudflare-r2)
- \`enabled\` — Admin toggle for enabling/disabling
- \`configComplete\` — Whether the provider passes configuration checks
- \`lastTested\` — Timestamp of last successful test
- \`settings\` — JSONB storing provider metadata (name, description, docsUrl, requiredEnvVars, optionalEnvVars, setupInstructions, operationalNotes, usedBy, featureFlag)

## Health Check System
\`GET /api/integrations/health\` runs config detection for all providers:
- Checks presence of required and optional environment variables
- Reports status: \`ready\` (all required vars set), \`partial\` (some set), \`not_configured\` (none set)
- Reports feature flag: \`active\` (used in production), \`planned\` (feature not yet built), \`scaffold\` (API scaffolded only)
- Lists which features use each provider

## Test Connection System
\`POST /api/integrations/:provider/test\` runs live connectivity tests:
- **Mailgun**: Verifies domain via Mailgun API (\`GET /v3/domains/{domain}\`)
- **Stripe**: Verifies API key via Stripe balance endpoint (\`GET /v1/balance\`)
- **OpenAI**: Verifies API key via models endpoint (\`GET /v1/models\`)
- **Cloudflare R2**: Confirms env vars are set (full connectivity test pending R2 implementation)

On successful test, the integration's \`lastTested\` timestamp and \`configComplete\` flag are updated.

## File Structure
\`\`\`
server/features/integrations/
├── index.ts      # Route export
├── routes.ts     # API endpoints (list, get, update, health, test)
├── storage.ts    # Drizzle ORM CRUD
├── health.ts     # Provider health checks
└── seed.ts       # Default provider configurations
\`\`\``,
  },
  {
    title: "Provider Setup Guide",
    slug: "provider-setup-guide",
    categorySlug: "integrations",
    status: "published",
    content: `# Provider Setup Guide

## Stripe (Planned)
**Required:** \`STRIPE_SECRET_KEY\`
**Optional:** \`STRIPE_WEBHOOK_SECRET\`

1. Create a Stripe account at stripe.com
2. Navigate to Developers → API Keys in your Stripe Dashboard
3. Copy your Secret Key (starts with sk_test_ or sk_live_)
4. Set STRIPE_SECRET_KEY in your environment variables
5. For webhook events, set STRIPE_WEBHOOK_SECRET from the webhook endpoint settings

**Status:** Planned — will power client billing, invoice generation, and payment tracking.

---

## Mailgun (Active)
**Required:** \`MAILGUN_API_KEY\`, \`MAILGUN_DOMAIN\`
**Optional:** \`MAILGUN_FROM_EMAIL\`, \`MAILGUN_FROM_NAME\`

1. Create a Mailgun account at mailgun.com
2. Add and verify your sending domain
3. Navigate to API Keys and copy your Private API Key
4. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in your environment variables

**Status:** Active — handles notification emails. Falls back to in-app only when not configured.

---

## OpenAI (Scaffolded)
**Required:** \`OPENAI_API_KEY\`

1. Create an OpenAI account at platform.openai.com
2. Navigate to API Keys and create a new secret key
3. Set OPENAI_API_KEY in your environment variables

**Status:** Scaffolded — no active API calls made yet. Planned for lead scoring, content generation, and activity summaries.

---

## Cloudflare R2 (Planned)
**Required:** \`CLOUDFLARE_R2_ACCESS_KEY\`, \`CLOUDFLARE_R2_SECRET_KEY\`, \`CLOUDFLARE_R2_BUCKET\`, \`CLOUDFLARE_R2_ENDPOINT\`
**Optional:** \`CLOUDFLARE_R2_PUBLIC_URL\`

1. Log into your Cloudflare Dashboard
2. Navigate to R2 Object Storage and create a bucket
3. Create an API token with read/write access
4. Set all four required environment variables

**Status:** Planned — exclusive file storage provider for uploads, invoices, and chat attachments.

## Security Notes
- Sensitive values (API keys, secrets) are NEVER exposed through the API
- The health endpoint only reports whether variables are present, not their values
- All integration endpoints require admin or developer role`,
  },
  {
    title: "Integration Troubleshooting",
    slug: "integration-troubleshooting",
    categorySlug: "integrations",
    status: "published",
    content: `# Integration Troubleshooting

## Common Issues

### "Configuration needed" but env vars are set
- Ensure environment variables are set in the Replit Secrets panel, not just in .env files
- Restart the application after setting new environment variables
- Run "Test Connection" to update the configuration status

### Mailgun emails not sending
- Verify MAILGUN_API_KEY and MAILGUN_DOMAIN are both set
- Check that your sending domain is verified in the Mailgun dashboard
- Run the Mailgun test connection — it verifies domain status
- Check notification records for email_status = "failed" with failure reasons
- Note: When Mailgun is not configured, emails are gracefully skipped (status = "skipped")

### Stripe test connection fails
- Verify STRIPE_SECRET_KEY starts with sk_test_ (test mode) or sk_live_ (production)
- Check that the API key has not been revoked in your Stripe Dashboard
- Ensure your Stripe account is active and in good standing

### OpenAI test connection fails
- Verify OPENAI_API_KEY is valid and not expired
- Check that your OpenAI account has API credits or a payment method
- Note: OpenAI is currently scaffolded only — no active usage in the platform

### R2 configuration shows partial
- All four required variables must be set: ACCESS_KEY, SECRET_KEY, BUCKET, ENDPOINT
- CLOUDFLARE_R2_PUBLIC_URL is optional — only needed if you want direct public file URLs
- The endpoint URL format is typically: https://<account-id>.r2.cloudflarestorage.com

## Health Check API
\`GET /api/integrations/health\` returns real-time configuration status for all providers.

Response fields per provider:
- \`configured\` — boolean, all required vars present
- \`status\` — "ready" / "partial" / "not_configured"
- \`missingVars\` — list of missing environment variable names
- \`presentVars\` — list of configured variable names
- \`featureFlag\` — "active" / "planned" / "scaffold"
- \`notes\` — operational context
- \`usedBy\` — features that depend on this provider

## Test Connection API
\`POST /api/integrations/:provider/test\` runs a live connectivity test.

Successful tests update:
- \`lastTested\` — timestamp of the test
- \`configComplete\` — set to true

Failed tests are logged in the audit trail for debugging.`,
  },
  {
    title: "Getting Started",
    slug: "getting-started-guide",
    categorySlug: "getting-started",
    status: "published",
    content: `# Getting Started

## Accessing the Platform
1. Navigate to the login page at \`/login\`
2. Enter your email and password
3. You will be redirected to \`/admin\` — the main dashboard

## Default Admin Account
The platform ships with a pre-configured admin account for initial setup. Contact your system administrator for credentials.

## Dashboard Overview
After login you'll see the admin dashboard with:
- **CRM Stats** — Total leads, recent activity, leads by status
- **Pipeline Stats** — Open deals, total pipeline value, deals by stage
- **Onboarding Overview** — Active onboardings, progress, overdue items
- **Recent Activity** — Latest system events

## Navigation
Use the sidebar to navigate between modules:
- **Dashboard** — Overview and key metrics
- **CRM** — Leads, companies, contacts
- **Pipeline** — Sales opportunities and stages
- **Onboarding** — Client onboarding workflows
- **Notifications** — System alerts and email notifications
- **Reports** — Analytics and reporting
- **Docs** — This documentation library
- **Settings** — Integrations and preferences

## Roles
- **Admin** — Full access to all modules including settings and user management
- **Developer** — Access to most modules, stage management, and system tools
- **Sales Rep** — CRM, pipeline, onboarding, and notification access

## Quick Actions
- Create a new lead from the CRM page
- Convert a lead to an opportunity in the pipeline
- Start client onboarding from a won opportunity
- View reports for performance insights`,
  },
  {
    title: "Authentication Flow",
    slug: "authentication-flow",
    categorySlug: "auth",
    status: "published",
    content: `# Authentication Flow

## Overview
The platform uses BetterAuth for authentication, providing secure email/password login with session management.

## Login Process
1. User submits email + password to \`POST /api/auth/sign-in/email\`
2. BetterAuth validates credentials and creates a session
3. Session cookie (\`better-auth.session_token\`) is set in the response
4. Frontend redirects to \`/admin\`

## Session Management
- Sessions are stored in the \`session\` table
- Session tokens are HttpOnly cookies (not accessible via JavaScript)
- Sessions persist across browser restarts until expiration
- BetterAuth handles session renewal automatically

## Protected Routes
All \`/api/*\` routes (except auth endpoints and public contact form) require authentication.

The \`requireAuth\` middleware:
1. Reads the session cookie from the request
2. Validates the session with BetterAuth
3. Attaches \`req.user\` with user data and role
4. Returns 401 if no valid session exists

## Role-Based Access Control (RBAC)
The \`requireRole(...roles)\` middleware extends \`requireAuth\`:
- Checks \`req.user.role\` against allowed roles
- Returns 403 if the user's role is not in the allowed list
- Used to protect admin-only and developer-only endpoints

## Roles
| Role | Value | Access |
|------|-------|--------|
| Admin | \`admin\` | Full access to all features |
| Developer | \`developer\` | Most features, stage management |
| Sales Rep | \`sales_rep\` | CRM, pipeline, onboarding, notifications |

## Security Notes
- BetterAuth is mounted BEFORE \`express.json()\` in the middleware stack
- Password hashing is handled internally by BetterAuth
- No API keys or tokens are exposed to the frontend
- Session validation occurs on every authenticated request`,
  },
  {
    title: "Known Issues & Technical Debt",
    slug: "known-issues-technical-debt",
    categorySlug: "known-issues",
    status: "published",
    content: `# Known Issues & Technical Debt

## Current Technical Debt

### Query Optimization (Addressed in v1.7)
- **Resolved**: \`getOnboardingStats\` and \`getPipelineStats\` previously fetched all rows into memory for counting. Now use SQL aggregation (GROUP BY, COUNT, SUM).
- **Monitoring**: Board view (\`getOpportunitiesByStage\`) fetches all open opportunities. Acceptable at current scale but should be paginated if opportunity count grows significantly.

### Schema & Validation
- Pipeline routes define local Zod schemas (\`updateStageSchema\`, \`updateOpportunitySchema\`) instead of using shared schemas from \`@shared/schema.ts\`. Low priority — works correctly but creates mild duplication.
- \`createInsertSchema().extend()\` from drizzle-zod is incompatible with Zod v4; update schemas use \`z.object()\` directly. Track drizzle-zod compatibility in future updates.

### Architecture Patterns
- Audit logging calls (\`logAudit\`) are repeated in most mutating route handlers. Could be consolidated into middleware or a service layer decorator pattern.
- Notification triggers follow the same pattern — a service layer for "mutate + audit + notify" would reduce route handler boilerplate.
- Provider metadata in \`health.ts\` is hardcoded (env var names, usedBy, notes) rather than derived from integration settings in the database. This is intentional for reliability but means changes require code updates.

### Frontend
- No dark mode support yet (all styles use light theme)
- No WebSocket/SSE for real-time updates — notification bell polls every 30 seconds
- Demo sub-sites (empieza, crece, domina) share duplicate \`sidebar.tsx\` and \`chart.tsx\` components

### Planned but Not Yet Built
- **R2 File Storage** — Cloudflare R2 integration for file uploads (next feature)
- **Stripe Billing** — Payment processing and invoice management
- **Team Chat** — Internal messaging (Phase 1 + Phase 2)

## Known Issues
- PostCSS plugin warning in dev console about missing \`from\` option — cosmetic, does not affect functionality
- BetterAuth session cookie name varies by environment — ensure consistent domain configuration in production
- Contact form deduplication uses case-insensitive matching which may produce false positives for common names

## Performance Notes
- Report overview endpoint runs 7 queries in parallel (\`Promise.all\`) for efficient single-request loading
- All list endpoints use pagination with parallel count queries
- Database indexes cover all foreign keys and common filter columns
- Non-blocking notification triggers prevent notification failures from affecting user operations`,
  },
  {
    title: "Frontend Architecture",
    slug: "frontend-architecture",
    categorySlug: "ui-frontend",
    status: "published",
    content: `# Frontend Architecture

## Routing
The app uses \`wouter\` for client-side routing with the following structure:
- \`/\` — Marketing home page
- \`/login\` — Authentication page
- \`/admin\` — Protected admin dashboard
- \`/admin/crm\` — CRM lead list
- \`/admin/crm/:id\` — Lead detail
- \`/admin/pipeline\` — Sales pipeline (board + list views)
- \`/admin/pipeline/:id\` — Opportunity detail
- \`/admin/onboarding\` — Onboarding list
- \`/admin/onboarding/new\` — Onboarding wizard
- \`/admin/onboarding/:id\` — Onboarding detail
- \`/admin/notifications\` — Notification center
- \`/admin/reports\` — Reports & analytics
- \`/admin/docs\` — Documentation library
- \`/admin/integrations\` — Integrations management

## Data Fetching
- TanStack Query v5 for all API requests
- Default fetcher configured in \`@/lib/queryClient\` joins queryKey arrays with "/"
- Mutations use \`apiRequest\` helper for POST/PUT/DELETE
- Cache invalidation via \`queryClient.invalidateQueries({ queryKey: [...] })\`

## Component Organization
\`\`\`
client/src/
├── features/          # Feature modules
│   ├── auth/          # Login page, auth hooks
│   ├── admin/         # Dashboard, admin layout
│   ├── crm/           # Lead list, lead detail, companies, contacts
│   ├── pipeline/      # Board view, opportunity detail, stage management
│   ├── onboarding/    # Onboarding list, wizard, detail
│   ├── notifications/ # Notification center
│   ├── reports/       # Reports dashboard
│   ├── docs/          # Documentation viewer
│   └── integrations/  # Integration management
├── layouts/           # AdminLayout (sidebar + header)
├── components/ui/     # shadcn/ui components
├── hooks/             # Shared hooks (useToast, etc.)
└── lib/               # Utilities (queryClient, utils)
\`\`\`

## UI Framework
- **Tailwind CSS** for styling
- **shadcn/ui** for component primitives (Button, Card, Badge, Dialog, etc.)
- **Framer Motion** for animations
- **Lucide React** for icons
- **Recharts** for chart visualizations (via shadcn chart components)

## State Management
- Server state: TanStack Query (no local state duplication)
- Form state: react-hook-form with zodResolver
- UI state: React useState for local toggles, expanded panels, etc.
- No global state management library — server state is the source of truth`,
  },
  {
    title: "Realtime Architecture Overview",
    slug: "team-chat-realtime-architecture",
    categorySlug: "team-chat",
    status: "published",
    content: `# Realtime Architecture Overview

## Stack
- **Socket.IO** — WebSocket transport between browser clients and the Express server.
- **Rooms** — Each channel gets a Socket.IO room named \`channel:<id>\` (e.g. \`channel:sales\`). Direct messages use \`user:<id>\` rooms.
- **Shared types** — \`shared/socket-types.ts\` defines the typed event contracts (\`ServerToClientEvents\`, \`ClientToServerEvents\`, etc.).

## Connection Lifecycle
1. Client calls \`io()\` with an auth cookie.
2. Server middleware (\`socket.ts\`) validates the BetterAuth session and attaches \`userId\`, \`userName\`, \`userRole\` to \`socket.data\`.
3. Server auto-joins the socket to \`user:<userId>\` for DMs and presence.
4. Server broadcasts \`chat:presence\` with the current online user list.

## Channel Join / Leave
- Client emits \`join:channel\` with a channel ID string.
- Server normalizes the ID via \`normalizeChannelId()\` (maps legacy \`"ventas"\` → \`"sales"\`).
- If the normalized ID is in the canonical list, the socket joins \`channel:<normalized>\`.
- On channel switch, the client emits \`leave:channel\` for the previous channel first.

## Message Broadcast
1. Client POSTs to \`/api/chat/messages\`.
2. The route handler normalizes the channel, inserts the row, then calls \`io.to("channel:<id>").emit("chat:channel_message", payload)\`.
3. All sockets in the room receive the event in real time.

## Presence
- On connect: broadcast updated online list.
- On disconnect: remove user, broadcast updated list.
- Clients receive \`chat:presence\` with the full \`onlineUserIds\` array.

## Typing Indicators
- Client emits \`typing:start\` / \`typing:stop\` with a \`TypingTarget\`.
- Server broadcasts \`chat:typing\` to the relevant room.
- Frontend shows/hides a typing indicator with a short debounce timeout.`,
  },
  {
    title: "Canonical Chat Channel Dictionary",
    slug: "team-chat-channel-dictionary",
    categorySlug: "team-chat",
    status: "published",
    content: `# Canonical Chat Channel Dictionary

## Source of Truth
All channel identifiers are defined in \`shared/channels.ts\`. Both the server (socket + REST) and the frontend import from this single file.

## Channels
| ID | Display Name | Description |
|----|-------------|-------------|
| \`general\` | General | Team announcements and conversation |
| \`sales\` | Sales | Sales pipeline and prospects |
| \`onboarding\` | Onboarding | Client onboarding coordination |
| \`dev\` | Dev | Technical and development topics |

## Exports
| Export | Type | Purpose |
|--------|------|---------|
| \`CHANNEL_IDS\` | \`as const\` object | Lookup by key (\`CHANNEL_IDS.sales\`) |
| \`CANONICAL_CHANNEL_IDS\` | \`string[]\` | Flat array for iteration / validation |
| \`CHANNEL_DEFINITIONS\` | \`{ id, name, description }[]\` | Full metadata for UI rendering |
| \`normalizeChannelId(raw)\` | function | Maps any string to a canonical ID or \`undefined\` |

## Legacy Migration: ventas → sales
The database originally used \`"ventas"\` as the Sales channel identifier. A one-time migration in \`server/features/chat/routes.ts\` renamed all existing rows:
\`\`\`sql
UPDATE chat_messages SET channel = 'sales' WHERE channel = 'ventas';
UPDATE chat_read_state SET channel_id = 'sales' WHERE channel_id = 'ventas';
\`\`\`
The \`normalizeChannelId()\` utility also maps \`"ventas"\` → \`"sales"\` at runtime so any stale client or API call is transparently corrected.`,
  },
  {
    title: "Socket Event Contract Reference",
    slug: "team-chat-socket-events",
    categorySlug: "team-chat",
    status: "published",
    content: `# Socket Event Contract Reference

All types are defined in \`shared/socket-types.ts\`.

## Server → Client Events

### \`chat:channel_message\`
Broadcast when a new message is posted in a channel.
| Field | Type | Notes |
|-------|------|-------|
| id | string | Message UUID |
| channel | string | Canonical channel ID |
| content | string | HTML content |
| senderId | string | Author user ID |
| senderName | string | Author display name |
| senderRole | string | Author role |
| createdAt | string | ISO timestamp |
| parentId | string or null | Thread parent |
| isPinned | boolean | Pin status |
| reactions | array | \`{ emoji, count, users[] }\` |
| replyCount | number | Thread reply count |

### \`chat:dm_message\`
Sent to sender and recipient when a DM is created.
| Field | Type |
|-------|------|
| id | string |
| senderId | string |
| recipientId | string |
| content | string |
| readAt | string or null |
| createdAt | string |

### \`chat:typing\`
Broadcast to the relevant room on typing start/stop.
| Field | Type |
|-------|------|
| userId | string |
| userName | string |
| target | string (channel ID or user ID) |
| targetType | "channel" or "dm" |
| isTyping | boolean |

### \`chat:presence\`
Broadcast to all on connect/disconnect.
| Field | Type |
|-------|------|
| onlineUserIds | string[] |

### \`chat:unread_update\`
Sent to a specific user.
| Field | Type |
|-------|------|
| channelId | string (optional) |
| dmUserId | string (optional) |
| unreadCount | number |

## Client → Server Events

| Event | Payload | Purpose |
|-------|---------|---------|
| \`join:channel\` | channelId: string | Join a channel room |
| \`leave:channel\` | channelId: string | Leave a channel room |
| \`typing:start\` | \`{ target, targetType }\` | Signal typing began |
| \`typing:stop\` | \`{ target, targetType }\` | Signal typing ended |`,
  },
  {
    title: "Realtime Troubleshooting Guide",
    slug: "team-chat-troubleshooting",
    categorySlug: "team-chat",
    status: "published",
    content: `# Realtime Troubleshooting Guide

## Known Failure Mode: Join Allowlist Mismatch

### Symptom
Messages send and persist in the database, but other users in the same channel do not see them in real time. Typing indicators and presence may also not work for specific channels.

### Root Cause
The socket server maintains an allowlist of valid channel IDs. If this list gets out of sync with the canonical channel definitions (e.g., using a legacy ID like \`"ventas"\` instead of \`"sales"\`), \`join:channel\` silently fails — the client never joins the room, so broadcasts land in an empty audience.

### Resolution
Ensure the socket server imports \`CANONICAL_CHANNEL_IDS\` from \`shared/channels.ts\` instead of maintaining a hardcoded list. The \`normalizeChannelId()\` utility transparently maps legacy IDs.

## Verifying Channel Rooms

### Server-side
In the socket connection handler, log the rooms after a join:
\`\`\`typescript
socket.on("join:channel", (channelId) => {
  const normalized = normalizeChannelId(channelId);
  if (normalized) {
    socket.join(\\\`channel:\\\${normalized}\\\`);
    console.log("Rooms:", [...socket.rooms]);
  }
});
\`\`\`

### Client-side
Open DevTools → Network → WS tab. Filter for \`join:channel\` frames and confirm the emitted channel ID matches a canonical value.

## Verifying Presence
1. Open Team Chat in two browser tabs with different users.
2. Both should see each other's avatar in the online indicator.
3. If not, check the \`chat:presence\` event in the WS frames.

## Verifying Typing Indicators
1. Open Team Chat in two tabs, same channel.
2. Start typing in one tab.
3. The other tab should show "[User] is typing..." within 1-2 seconds.

## Common Pitfalls
- **Legacy client cache**: A stale browser cache may emit \`"ventas"\` instead of \`"sales"\`. \`normalizeChannelId()\` handles this transparently.
- **DM path unaffected**: DMs use \`user:<id>\` rooms and are not subject to channel normalization.
- **No error emitted**: Socket.IO does not emit an error when \`join:channel\` is silently rejected — this is by design in the server handler.`,
  },
  {
    title: "Deployment Guide",
    slug: "deployment-guide",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Deployment Guide

## Environment
The platform runs on Replit with the following stack:
- **Runtime**: Node.js (via tsx for TypeScript execution)
- **Database**: PostgreSQL (Replit-managed)
- **Build**: Vite for frontend bundling

## Start Command
\`\`\`
npm run dev
\`\`\`
This starts an Express server that serves both the API and the Vite-bundled frontend on port 5000.

## Environment Variables
### Required
| Variable | Purpose |
|----------|---------|
| \`DATABASE_URL\` | PostgreSQL connection string (auto-set by Replit) |

### Optional (per integration)
| Variable | Purpose |
|----------|---------|
| \`MAILGUN_API_KEY\` | Mailgun email delivery |
| \`MAILGUN_DOMAIN\` | Mailgun sending domain |
| \`STRIPE_SECRET_KEY\` | Stripe payment processing |
| \`OPENAI_API_KEY\` | OpenAI API access |
| \`R2_ACCESS_KEY_ID\` | Cloudflare R2 storage |
| \`R2_SECRET_ACCESS_KEY\` | Cloudflare R2 storage |
| \`R2_BUCKET_NAME\` | Cloudflare R2 bucket |
| \`R2_ENDPOINT\` | Cloudflare R2 endpoint URL |

## Database Management
- Schema is managed via Drizzle ORM in \`shared/schema.ts\`
- Push schema changes: \`npm run db:push\`
- Seed data: \`POST /api/admin/seed\` (requires admin auth)
- The seed endpoint populates: documentation articles, integration records, CRM demo data, pipeline stages, and onboarding templates

## Health Checks
- \`GET /api/integrations/health\` — Check all integration configurations
- \`POST /api/integrations/:provider/test\` — Test individual provider connectivity

## Production Considerations
- Set \`NODE_ENV=production\` for optimized builds
- Ensure all required environment variables are configured
- Run the seed endpoint after first deployment to populate initial data
- Monitor notification delivery via the notification center`,
  },
  {
    title: "Environment Bootstrap Overview",
    slug: "bootstrap-overview",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Environment Bootstrap Overview

## What is Bootstrap?
Bootstrap is the controlled initialization of a new or freshly deployed environment. It covers three distinct concerns:

| Concern | What it does | When to run |
|---------|-------------|-------------|
| **Schema migration** | Create or alter database tables | Before first boot after schema changes |
| **User seeding** | Create admin/dev/sales accounts from env vars | Once per environment (idempotent) |
| **Feature seeding** | Populate config data: statuses, stages, templates, integrations, docs | On first boot or on demand |

## Bootstrap is NOT
- Part of normal production request handling
- Required on every server restart (seeds skip if data already exists)
- A migration system — schema is managed separately via Drizzle

## How It Works (v2+)
After the Phase 2 refactor, seeding is removed from the unconditional server boot path.

The \`server/bootstrap.ts\` orchestrator runs after the server is listening and:
1. Checks database connectivity
2. Determines if auto-seeding is enabled via \`VIVA_AUTO_SEED\`
3. Runs user seeds then feature seeds (if enabled)
4. Logs each step clearly

## Auto-Seed Defaults
| Environment | Default behavior |
|-------------|-----------------|
| \`NODE_ENV !== "production"\` | Auto-seed enabled (dev ergonomics) |
| \`NODE_ENV === "production"\`  | Auto-seed SKIPPED (set \`VIVA_AUTO_SEED=true\` to opt in) |

Set \`VIVA_AUTO_SEED=true\` in Replit Secrets to enable auto-seeding in production on first deploy.`,
  },
  {
    title: "Migrations vs Seeds vs Startup",
    slug: "bootstrap-migrations-vs-seeds",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Migrations vs Seeds vs Startup

Understanding the difference between these three concerns prevents environment drift and production incidents.

## Schema Migrations
**What**: Structural database changes (CREATE TABLE, ALTER COLUMN, ADD INDEX).
**Tool**: Drizzle ORM push model.
**Command**: \`npm run db:push\`
**When**: Before deploying code that requires new or changed columns/tables.
**Idempotent**: Yes — Drizzle compares live schema against \`shared/schema.ts\` and applies only the diff.

## Seeds
**What**: Populating config/reference data or creating initial user accounts.
**Two categories**:
- **User seeds** (\`prod-seed.ts\`, \`dev-seed.ts\`): Create admin/developer/sales accounts from env vars.
- **Feature seeds** (\`crm/seed.ts\`, \`pipeline/seed.ts\`, \`onboarding/seed.ts\`, \`integrations/seed.ts\`, \`docs/seed.ts\`): Populate config data that must exist for the app to function (statuses, stages, templates, etc.).

**When**: Once per environment on initial setup, and again if data is wiped.
**Idempotent**: Yes — all seeds use upsert patterns; re-running is safe.

**How to run**:
- Auto (dev): starts automatically via \`VIVA_AUTO_SEED\` default
- Manual script: \`npx tsx scripts/seed.ts\`
- HTTP endpoint: \`POST /api/admin/seed-all\` (admin auth required)

## Startup
**What**: Express server listen, route registration, Socket.IO init, Vite/static setup.
**Should NOT include**: Any seed logic (as of Phase 2 hardening).
**Boot time**: < 2 seconds (database connectivity is checked post-listen, non-blocking).

## Summary
\`\`\`
Deploy new code
  → npm run db:push        (schema sync, if needed)
  → npm run dev / start    (server starts, DB ping, seeds skipped or run per VIVA_AUTO_SEED)
  → npx tsx scripts/seed.ts  (manual seed if needed)
\`\`\``,
  },
  {
    title: "Production Startup Lifecycle",
    slug: "bootstrap-production-lifecycle",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Production Startup Lifecycle

## Boot Sequence
\`\`\`
1. NODE_ENV=production tsx server/index.ts
2. Express app created
3. BetterAuth /api/auth/* handler registered
4. Route handlers registered (all features)
5. Static file serving enabled (Vite bundle)
6. httpServer.listen({ port: 5000, host: "0.0.0.0" })
7. → "serving on port 5000" logged
8. runBootstrap() called (non-blocking, post-listen)
   a. DB connectivity check → logged
   b. VIVA_AUTO_SEED evaluation:
      - If NOT set: "auto-seed: SKIPPED" logged, bootstrap exits
      - If set to true: seeds run in sequence
9. Server accepts requests immediately (bootstrap is non-blocking)
\`\`\`

## Logs to Expect
\`\`\`
[express] serving on port 5000
[bootstrap] environment: production
[bootstrap] database connectivity: OK
[bootstrap] schema management: drizzle push model
[bootstrap] auto-seed: SKIPPED (set VIVA_AUTO_SEED=true ...)
\`\`\`

Or, if \`VIVA_AUTO_SEED=true\`:
\`\`\`
[bootstrap] auto-seed: RUNNING (VIVA_AUTO_SEED=true)
[prod-seed] admin user already exists (admin@...)
[prod-seed] developer user already exists (dev@...)
[prod-seed] sales_rep user already exists (sales@...)
[bootstrap] bootstrap complete
\`\`\`

## Environment Variables Required for Production
| Variable | Purpose | Required |
|----------|---------|----------|
| \`DATABASE_URL\` | PostgreSQL connection | Yes |
| \`BETTER_AUTH_SECRET\` | Auth session secret | Yes |
| \`SEED_ADMIN_EMAIL\` | Admin account email | Yes (for seeding) |
| \`SEED_ADMIN_PASSWORD\` | Admin account password | Yes (for seeding) |
| \`VIVA_AUTO_SEED\` | Enable automatic seeds | Opt-in |

## What Happens Without Seeds
The app starts and serves requests normally. However:
- No admin user exists → cannot log in
- No CRM statuses → lead creation fails
- No pipeline stages → pipeline board is empty
- No onboarding templates → template selector is empty

Run seeds via script or HTTP endpoint after first deploy.`,
  },
  {
    title: "Safe Seed Execution Runbook",
    slug: "bootstrap-seed-runbook",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Safe Seed Execution Runbook

All seed operations are idempotent. Running them multiple times is safe — existing records are skipped or upserted without data loss.

---

## Method 1: Auto-Seed via Environment Variable (Recommended for First Deploy)

Set \`VIVA_AUTO_SEED=true\` in your environment secrets before the first deployment. The server will run all seeds automatically on startup.

**Steps**:
1. In Replit Secrets, set \`VIVA_AUTO_SEED=true\`
2. Also set \`SEED_ADMIN_EMAIL\`, \`SEED_ADMIN_PASSWORD\`, \`SEED_DEV_EMAIL\`, \`SEED_DEV_PASSWORD\`, \`SEED_SALES_EMAIL\`, \`SEED_SALES_PASSWORD\`
3. Deploy / restart the server
4. Check logs for \`[bootstrap] bootstrap complete\`
5. Optional: remove \`VIVA_AUTO_SEED=true\` after first successful seed (seeds are skipped on subsequent boots anyway since data already exists)

---

## Method 2: Manual Script

Run the seed script directly in your shell. This does not require the server to be running.

\`\`\`bash
npx tsx scripts/seed.ts
\`\`\`

Expected output:
\`\`\`
[seed-script] Starting seed run...
[seed-script] Seeding admin/prod users...
[prod-seed] admin user already exists (admin@...)
[seed-script] Seeding CRM statuses...
[seed-script] CRM statuses: 6 records
[seed-script] Pipeline stages: 7 records
[seed-script] Onboarding templates: 1 template(s)
[seed-script] Integrations: 4 records
[seed-script] Docs: 21 categories, N articles
[seed-script] Seed run complete in Xms
\`\`\`

---

## Method 3: HTTP Endpoint (Runtime Re-Seed)

Use this when you need to re-seed config data while the app is running (e.g., after adding a new article or stage to seed data).

\`\`\`bash
curl -X POST https://your-app.replit.app/api/admin/seed-all \\
  -H "Cookie: <session cookie>" \\
  -H "X-Seed-Secret: <SEED_ADMIN_SECRET value>"
\`\`\`

Requirements:
- Must be authenticated as an \`admin\` role user
- If \`SEED_ADMIN_SECRET\` env var is set, the \`X-Seed-Secret\` header is required
- Note: this endpoint seeds feature data only (not user accounts)

---

## Verification Checklist
After seeding, verify:
- [ ] Login works with admin credentials
- [ ] CRM > Lead statuses list returns 6 statuses (New, Contacted, Qualified, Proposal, Won, Lost)
- [ ] Pipeline board shows 7 stages
- [ ] Onboarding > Templates shows "Standard Web Design Onboarding"
- [ ] Integrations page shows 4 providers (Stripe, Mailgun, OpenAI, Cloudflare R2)
- [ ] App Docs has articles populated`,
  },
  {
    title: "Bootstrap Troubleshooting Guide",
    slug: "bootstrap-troubleshooting",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Bootstrap Troubleshooting Guide

## Symptom: Cannot log in after fresh deploy

**Cause**: Seeds were not run, so no admin user exists.

**Fix**:
1. Run \`npx tsx scripts/seed.ts\` from the shell, or
2. Set \`VIVA_AUTO_SEED=true\` in Secrets and restart the server, or
3. Use the legacy \`POST /api/admin/seed-admin\` endpoint if accessible.

---

## Symptom: "[bootstrap] database connectivity: FAILED"

**Cause**: \`DATABASE_URL\` is not set or the database is not reachable.

**Fix**:
1. Check Replit Secrets for \`DATABASE_URL\`
2. In Replit, the database auto-provisions — confirm the PostgreSQL integration is connected
3. Run \`npm run db:push\` to verify connectivity

---

## Symptom: Seeds run on every restart (high startup latency)

**Cause**: \`VIVA_AUTO_SEED=true\` is set but seeds are already complete.

**Fix**: Remove \`VIVA_AUTO_SEED\` from Secrets. Seeds are idempotent and fast, but removing the flag is cleaner. The seeds will be skipped in production without it.

---

## Symptom: "auto-seed: SKIPPED" but I want it to run

**Fix**: Set \`VIVA_AUTO_SEED=true\` in environment secrets and restart.

---

## Symptom: Seed script exits with error

**Common causes**:
1. \`DATABASE_URL\` not set in environment
2. Database schema is behind — run \`npm run db:push\` first
3. \`SEED_ADMIN_EMAIL\` or \`SEED_ADMIN_PASSWORD\` not set (user seed skips silently, feature seed continues)

**Check**: Scan console output for lines starting with \`[seed-script]\` or \`[prod-seed]\` to identify the failing step.

---

## Symptom: "POST /api/admin/seed-all → 403"

**Cause**: Either not authenticated as admin, or \`X-Seed-Secret\` header is missing/wrong.

**Fix**:
1. Log in as admin first and include the session cookie
2. Check \`SEED_ADMIN_SECRET\` env var and pass its value in the \`X-Seed-Secret\` header

---

## Symptom: App Docs articles are missing after re-deploy

**Cause**: Articles were manually deleted from the database, or a new article was added to seed data after the initial seed.

**Fix**: Run \`POST /api/admin/seed-all\` or \`npx tsx scripts/seed.ts\`. The seed uses an "insert if not exists by slug" pattern — new articles are added, existing ones are preserved.`,
  },

  // ── Phase 3: Durable Async Workflow ──────────────────────────────────

  {
    title: "Public Inquiry Processing Lifecycle",
    slug: "inquiry-processing-lifecycle",
    categorySlug: "contact-forms",
    status: "published",
    content: `# Public Inquiry Processing Lifecycle

## Overview

When a visitor submits a public contact or demo inquiry form, the platform processes the request in two distinct phases:

1. **Synchronous phase** — runs inside the HTTP request, must complete before the user gets a response
2. **Async phase** — runs out-of-band via the job worker, completely invisible to the end user

## Phase 1: Synchronous (Request Path)

\`\`\`
POST /api/contacts  or  POST /api/inquiries
   │
   ├── Zod validation (reject on error → 400)
   ├── Honeypot check (bot detected → 201 silent drop)
   ├── storage.createContact() → primary DB write
   ├── enqueueJob("crm_ingest", …)  — DB row, ~1ms
   ├── enqueueJob("email_notification", …) — DB row, ~1ms
   └── 201 response with contact record
\`\`\`

**The user always gets a 201 response immediately after DB persistence, regardless of external provider availability.**

## Phase 2: Async (Worker Path)

\`\`\`
Worker (5s poll) → claimNextJob()
   │
   ├── type = "crm_ingest"
   │     └── ingestWebsiteFormSubmission()
   │           ├── find or create CRM contact
   │           ├── find or create CRM company
   │           ├── create CRM lead
   │           ├── add lead note
   │           └── logAudit + notifyNewLead
   │
   └── type = "email_notification"
         └── resend.emails.send()
               └── Resend API (external)
\`\`\`

## Failure Isolation

- If Resend is down: contact is still saved, CRM lead is still created. Only the email is delayed.
- If CRM ingest fails: contact is still saved, email is still sent. CRM entry is retried.
- If the worker crashes: on restart, all pending/retry_scheduled jobs resume automatically.

## Data Flow

| Step | Location | Blocking? |
|------|----------|-----------|
| Contact record | \`contacts\` table | Yes — request path |
| Job queue entries | \`workflow_jobs\` table | Yes — request path |
| CRM lead/contact | \`crm_leads\`, \`crm_contacts\` | No — async worker |
| Email to team | Resend API | No — async worker |
`,
  },

  {
    title: "Sync vs Async Responsibilities",
    slug: "sync-vs-async-responsibilities",
    categorySlug: "background-jobs",
    status: "published",
    content: `# Sync vs Async Responsibilities

## Design Principle

The request path must only do work that is essential for producing a correct response. Everything else is a side effect and should be deferred.

## Synchronous Responsibilities (Request Path)

These must complete before the HTTP response is sent:

- **Input validation** — Zod schema parsing; return 400 on failure
- **Spam detection** — honeypot field check; return silent 201 on bot detection
- **Primary persistence** — write the contact record to \`contacts\` table
- **Job enqueueing** — write job rows to \`workflow_jobs\` table (this is DB work, not external I/O)

## Async Responsibilities (Worker Path)

These run out-of-band via the job worker:

- **CRM ingest** — create/update CRM contact, company, and lead records
- **Email notification** — send team notification via Resend API
- **Audit logging** — secondary audit events from CRM ingest
- **In-app notifications** — \`notifyNewLead()\` fan-out to admin/sales users

## Why This Boundary?

| Concern | Sync path | Async path |
|---------|-----------|------------|
| User-facing latency | Directly impacted | No impact |
| External provider timeout | Directly impacts user | Absorbed by retry |
| Failure recovery | Must succeed or reject cleanly | Retried automatically |
| Observability | 4xx/5xx HTTP status | Job status in DB |

## Anti-patterns Avoided

- **Before Phase 3**: \`await ingestWebsiteFormSubmission()\` blocked the request. A 3-second Resend timeout = 3-second user-facing delay.
- **Silent drops**: errors were caught and logged but not retried. A provider outage meant lost data.
- **Tight coupling**: a CRM bug could cause contact form submissions to return 500.
`,
  },

  {
    title: "Queue / Job Architecture Overview",
    slug: "queue-job-architecture-overview",
    categorySlug: "background-jobs",
    status: "published",
    content: `# Queue / Job Architecture Overview

## Pattern: DB Outbox

The Viva CRM uses a **database outbox pattern** — jobs are stored as rows in the \`workflow_jobs\` PostgreSQL table and processed by a polling worker. No external queue broker (Redis, RabbitMQ, etc.) is required.

## Components

### workflow_jobs table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| type | text | Job type: \`crm_ingest\`, \`email_notification\` |
| status | text | Current status (see below) |
| payload | jsonb | Serialized job parameters |
| sourceId | varchar | Idempotency key (contact record ID or derived key) |
| sourceType | text | Form origin: \`contact_form\`, \`demo_inquiry\` |
| attempts | int | Number of processing attempts made |
| maxAttempts | int | Maximum allowed attempts (default: 3) |
| lastError | text | Error message from last failed attempt |
| nextRunAt | timestamp | Earliest time the job can next be claimed |
| createdAt | timestamp | Job creation time |
| completedAt | timestamp | When the job successfully completed |

### Queue module (\`server/features/workflow/queue.ts\`)

- \`enqueueJob(type, payload, sourceId, sourceType)\` — creates a job row, with idempotency guard
- \`claimNextJob()\` — transactional claim of the next ready job
- \`markJobCompleted(id)\` — marks job done
- \`markJobFailed(id, error, attempts, max)\` — schedules retry or dead-letters
- \`requeueJob(id)\` — admin manual retry
- \`getJobsByStatus(status)\` / \`getAllRecentJobs()\` — admin visibility

### Processor (\`server/features/workflow/processor.ts\`)

Routes each job type to its handler. Throws on failure so the worker applies backoff.

### Worker (\`server/features/workflow/worker.ts\`)

- Started by \`server/bootstrap.ts\` after DB connectivity is confirmed
- Polls every **5 seconds**
- Processes **one job per tick** (prevents thundering herd)
- Uses \`isRunning\` guard to prevent concurrent ticks

## Job Status State Machine

\`\`\`
              ┌─────────┐
  enqueueJob  │ pending │
  ──────────► │         │
              └────┬────┘
                   │ claimNextJob()
                   ▼
              ┌────────────┐
              │ processing │ ◄── attempts incremented
              └─────┬──────┘
                    │
        ┌───────────┴──────────────┐
        │ success                  │ failure
        ▼                          ▼
  ┌───────────┐        shouldRetry?
  │ completed │        ├── yes → ┌──────────────────┐
  └───────────┘        │         │ retry_scheduled  │ ──► (back to claimed)
                       │         └──────────────────┘
                       └── no  → ┌────────┐
                                 │ failed │  (dead-letter)
                                 └────────┘
                                      │
                              requeueJob() (admin)
                                      │
                                      ▼
                                 ┌─────────┐
                                 │ pending │
                                 └─────────┘
\`\`\`

## Job Types

| Type | Handler | External call |
|------|---------|---------------|
| \`crm_ingest\` | \`ingestWebsiteFormSubmission()\` | None (pure DB) |
| \`email_notification\` | \`resend.emails.send()\` | Resend API |
`,
  },

  {
    title: "Retry and Backoff Policy",
    slug: "retry-and-backoff-policy",
    categorySlug: "background-jobs",
    status: "published",
    content: `# Retry and Backoff Policy

## Overview

When a workflow job fails, the system applies exponential backoff before retrying. After all attempts are exhausted, the job is dead-lettered with status \`failed\`.

## Attempt Limits

All jobs default to **3 maximum attempts** (\`maxAttempts = 3\`).

## Backoff Schedule

| Attempt | Status after failure | Next run delay |
|---------|----------------------|----------------|
| 1 | retry_scheduled | +5 minutes |
| 2 | retry_scheduled | +20 minutes |
| 3 (final) | failed (dead-letter) | — |

## Pure Helper Functions

\`\`\`typescript
// Returns the Date at which the next retry should run
calculateNextRunAt(attemptNumber: number): Date

// Returns true if another retry should be scheduled
shouldRetry(attempts: number, maxAttempts: number): boolean
\`\`\`

These are exported pure functions, making them independently unit-testable without a database.

## Failure Path

1. Worker calls \`processJob(job)\` — throws on provider error
2. Worker catches the error, calls \`markJobFailed(id, error, attempts, maxAttempts)\`
3. Inside \`markJobFailed\`:
   - \`shouldRetry(attempts, maxAttempts)\` → if true: set \`status='retry_scheduled'\`, \`nextRunAt=calculateNextRunAt(attempts)\`
   - if false: set \`status='failed'\`, log dead-letter warning

## What Triggers Failure?

- **Resend API**: network timeout, HTTP 4xx/5xx, invalid API key
- **CRM ingest**: DB constraint violations, unexpected null fields, missing lead status configuration

## Transient vs Permanent Failures

The retry system treats all failures as potentially transient. After 3 attempts, a human should investigate via the admin job view.

## Manual Override

An admin can requeue any \`failed\` job via:
- **HTTP**: \`POST /api/workflow/jobs/:id/retry\`
- This resets \`attempts=0\`, \`status='pending'\`, \`nextRunAt=now\`

## Worker Recovery

If the server crashes while a job is \`processing\`, the job is stuck. On next worker startup, these stale \`processing\` jobs are visible in the admin UI. An admin can manually requeue them.
`,
  },

  {
    title: "Failure Recovery and Support Troubleshooting",
    slug: "failure-recovery-and-support-troubleshooting",
    categorySlug: "background-jobs",
    status: "published",
    content: `# Failure Recovery and Support Troubleshooting

## Diagnosing Failed Jobs

### Via API (admin/developer role required)

\`\`\`
GET /api/workflow/jobs?status=failed
\`\`\`

Returns up to 100 failed jobs with:
- \`type\` — job type (\`crm_ingest\` or \`email_notification\`)
- \`payload\` — form data submitted by the user
- \`lastError\` — exact error message from the last failed attempt
- \`attempts\` — how many times it was tried
- \`createdAt\` — when the form was originally submitted
- \`sourceId\` / \`sourceType\` — the contact record ID and form type

### List all recent jobs

\`\`\`
GET /api/workflow/jobs
\`\`\`

### Filter by any status

\`\`\`
GET /api/workflow/jobs?status=retry_scheduled
GET /api/workflow/jobs?status=processing
GET /api/workflow/jobs?status=completed
\`\`\`

## Retrying a Failed Job

\`\`\`
POST /api/workflow/jobs/:id/retry
\`\`\`

This resets the job to \`pending\` with \`attempts=0\` so it will be picked up in the next worker poll (within 5 seconds).

## Common Failure Scenarios

### Symptom: CRM leads not appearing after form submission

**Check**: \`GET /api/workflow/jobs?status=failed\` and look for \`type=crm_ingest\`

**Cause**: CRM ingest failed — likely missing lead status config, or DB error

**Fix**:
1. Ensure CRM statuses are seeded: \`POST /api/admin/seed-all\`
2. Check \`lastError\` in the job record
3. Requeue: \`POST /api/workflow/jobs/:id/retry\`

---

### Symptom: Team not receiving email notifications

**Check**: \`GET /api/workflow/jobs?status=failed\` and look for \`type=email_notification\`

**Cause**: Resend API down or \`RESEND_API_KEY\` not configured

**Fix**:
1. Verify \`RESEND_API_KEY\` is set in environment secrets
2. Check Resend dashboard for sending errors
3. Requeue job once the issue is resolved

---

### Symptom: Jobs stuck in "processing" status

**Cause**: Server crashed while a job was being processed

**Fix**:
1. Identify stuck jobs: \`GET /api/workflow/jobs?status=processing\`
2. These will not automatically retry (status won't change to retry_scheduled)
3. Manual requeue: \`POST /api/workflow/jobs/:id/retry\`

---

### Symptom: Duplicate CRM leads

**Cause**: A job was requeued after already completing (should be rare)

**How it's prevented**: \`enqueueJob()\` only creates a new job if no \`pending\`, \`processing\`, or \`retry_scheduled\` job exists for the same \`(sourceId, type)\` pair.

**Note**: CRM ingest itself also deduplicates contacts by email/phone. Even if a job runs twice, the CRM layer won't create a duplicate contact — only a duplicate lead might appear.

## Audit Trail

All CRM ingest operations write to the audit log (\`audit_logs\` table) with \`action=crm_lead_created\`. Cross-reference the job's \`sourceId\` (contact record ID) with audit log \`entityId\` to trace the full lifecycle.
`,
  },

  {
    title: "Data Model Reference: workflow_jobs",
    slug: "data-model-workflow-jobs",
    categorySlug: "database-schema",
    status: "published",
    content: `# Data Model Reference: workflow_jobs

## Table: \`workflow_jobs\`

The outbox job table for durable async processing of public form side effects.

| Column | PG Type | Nullable | Default | Description |
|--------|---------|----------|---------|-------------|
| id | varchar | NO | gen_random_uuid() | Primary key (UUID) |
| type | text | NO | — | Job type identifier |
| status | text | NO | 'pending' | Current lifecycle status |
| payload | jsonb | NO | — | Job parameters (form data, attribution, email content) |
| source_id | varchar | YES | NULL | Idempotency key (contact record UUID or derived key) |
| source_type | text | YES | NULL | Form origin: \`contact_form\` or \`demo_inquiry\` |
| attempts | int4 | NO | 0 | Number of processing attempts made |
| max_attempts | int4 | NO | 3 | Maximum allowed attempts before dead-lettering |
| last_error | text | YES | NULL | Error message from last failed attempt |
| next_run_at | timestamp | NO | now() | Earliest time the worker may claim this job |
| created_at | timestamp | NO | now() | Job creation timestamp |
| completed_at | timestamp | YES | NULL | Timestamp when job reached \`completed\` status |

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| workflow_jobs_status_idx | status | Fast filter by status for worker claims and admin queries |
| workflow_jobs_next_run_idx | next_run_at | Fast time-gated claim query |
| workflow_jobs_source_idx | source_id, type | Idempotency deduplication check |

## Job Types

| type value | Handler | Payload shape |
|------------|---------|---------------|
| \`crm_ingest\` | \`ingestWebsiteFormSubmission()\` | \`{ formData, attribution, sourceType }\` |
| \`email_notification\` | \`resend.emails.send()\` | \`{ to, subject, html }\` |

## Status Values

| status | Meaning |
|--------|---------|
| \`pending\` | Waiting to be claimed by the worker |
| \`processing\` | Currently being executed |
| \`completed\` | Successfully finished (completedAt is set) |
| \`retry_scheduled\` | Failed, will retry after nextRunAt |
| \`failed\` | Dead-lettered — exhausted all attempts |

## Drizzle Schema Location

\`shared/schema.ts\` — exported as \`workflowJobs\`, \`insertWorkflowJobSchema\`, \`InsertWorkflowJob\`, \`WorkflowJob\`

## Related Files

| File | Role |
|------|------|
| \`server/features/workflow/queue.ts\` | Enqueue, claim, complete, fail, admin query |
| \`server/features/workflow/processor.ts\` | Job type dispatch |
| \`server/features/workflow/worker.ts\` | Polling worker (5s interval) |
| \`server/features/workflow/routes.ts\` | Admin HTTP endpoints |
| \`server/routes.ts\` | Public form handlers that enqueue jobs |
`,
  },
];

export async function seedDocs() {
  const categoryMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const existing = await db.select().from(docCategories).where(eq(docCategories.slug, cat.slug));
    if (existing.length > 0) {
      categoryMap.set(cat.slug, existing[0].id);
      continue;
    }
    const [created] = await db.insert(docCategories).values(cat).returning();
    categoryMap.set(cat.slug, created.id);
  }

  for (const article of SEED_ARTICLES) {
    const existing = await db.select().from(docArticles).where(eq(docArticles.slug, article.slug));
    if (existing.length > 0) continue;

    const categoryId = categoryMap.get(article.categorySlug);
    await db.insert(docArticles).values({
      title: article.title,
      slug: article.slug,
      content: article.content,
      categoryId: categoryId || null,
      status: article.status,
    });
  }

  return { categories: CATEGORIES.length, articles: SEED_ARTICLES.length };
}
