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
| POST | /api/auth/seed-admin | Public* | Create initial admin user |
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

## Technical Notes
- All existing marketing site functionality preserved
- Non-destructive architecture extension
- Modular feature-based code organization`,
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
