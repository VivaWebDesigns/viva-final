# Viva Web Designs - Marketing Agency + Internal Platform

## Overview
Marketing agency website targeting contractors (Spanish-first, conversion-optimized) with an internal CRM/admin platform for team operations.

## Brand
- **Company**: Viva Web Designs
- **Colors**: Primary deep teal (#0D9488, hsl 175 85% 30%), accent emerald (#10B981), hover teal (#0F766E), gradient teal (#14B8A6), secondary deep charcoal (#111111), backgrounds white (#FFFFFF) and light gray (#F5F5F5). WhatsApp green (#25D366) unchanged.
- **Fonts**: Plus Jakarta Sans (body), Montserrat (headings), Inter (fallback)
- **Tone**: Confident, professional, clear, direct, Spanish-first
- **Rules**: NEVER mention "latinos" or "Google Ads" anywhere in copy

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + wouter
- **Backend**: Express.js + TypeScript + PostgreSQL + Drizzle ORM
- **Authentication**: BetterAuth with admin plugin (email/password)
- **Roles**: admin, developer, sales_rep

### Project Structure
```
├── client/src/
│   ├── features/           # Internal platform features
│   │   ├── auth/           # Login (with dev credentials card), auth client, protected routes
│   │   ├── admin/pages/    # Dashboard + AdminSettingsPage (user management + audit logs)
│   │   ├── chat/           # TeamChatPage — polling-based multi-channel team chat
│   │   ├── clients/        # ClientsPage — company cards with aggregated CRM stats
│   │   ├── crm/            # CRM: LeadList, LeadDetail, CompanyDetail, ContactDetail
│   │   ├── docs/           # App Docs library (CRUD)
│   │   ├── integrations/   # Integrations management UI
│   │   ├── notifications/  # Notification center UI
│   │   ├── onboarding/     # Onboarding pages (list, detail, wizard)
│   │   ├── pipeline/       # Pipeline board (drag-and-drop kanban), list, detail, stages
│   │   └── reports/        # Reports analytics page
│   ├── layouts/            # AdminLayout (sidebar shell + notification bell)
│   ├── pages/              # Marketing site pages
│   ├── components/         # Shared UI components
│   ├── content/            # Content system (content.json)
│   ├── empieza/            # Empieza demo sub-site
│   ├── crece/              # Crece demo sub-site
│   └── domina/             # Domina demo sub-site
├── server/
│   ├── features/           # Domain-based server features
│   │   ├── auth/           # BetterAuth config + middleware
│   │   ├── admin/          # Admin stats, seed, audit logs, user management (CRUD)
│   │   ├── chat/           # Chat messages: GET/POST/DELETE with channel support
│   │   ├── clients/        # Clients list: companies with aggregated SQL counts/values
│   │   ├── crm/            # CRM storage, routes, ingest, seed
│   │   ├── pipeline/       # Sales pipeline: stages, opportunities, activities
│   │   ├── onboarding/     # Client onboarding: records, checklists, templates
│   │   ├── notifications/  # Notification service, Mailgun, triggers, routes
│   │   ├── reports/        # Reports service + routes (read-only analytics)
│   │   ├── integrations/   # Integration records, health checks, seed, routes
│   │   ├── docs/           # Docs CRUD + seed data
│   │   └── audit/          # Audit logging service
│   ├── routes.ts           # Route aggregator (mounts features + legacy)
│   ├── storage.ts          # Legacy contact storage
│   └── db.ts               # Database connection
└── shared/
    └── schema.ts           # All Drizzle schemas + Zod validation
```

## Content System
All marketing website copy managed from `client/src/content/content.json`.
- `t("dotted.path")` — returns the Spanish `"es"` string
- `tArr("dotted.path")` — returns array of Spanish strings
- `tObjArr<T>("dotted.path")` — returns typed array of objects
- `tBool("dotted.path")` — returns boolean value

## Database Tables
### Legacy
- **contacts** — Lead capture from public forms (preserved)

### Auth (BetterAuth)
- **user** — Internal platform users (+ role field)
- **session** — Auth sessions
- **account** — Auth accounts
- **verification** — Email verification

### CRM
- **crm_companies** — Business records
- **crm_contacts** — Individual people
- **crm_leads** — Sales leads with UTM attribution
- **crm_lead_statuses** — Pipeline stages (New, Contacted, Qualified, Proposal, Won, Lost)
- **crm_lead_notes** — Activity timeline
- **crm_tags** — Tag definitions
- **crm_lead_tags** — Lead-tag join table

### Sales Pipeline
- **pipeline_stages** — Configurable pipeline stages
- **pipeline_opportunities** — Deals/opportunities
- **pipeline_activities** — Activity timeline

### Client Onboarding
- **onboarding_templates** — Reusable checklist templates
- **onboarding_records** — Onboarding records
- **onboarding_checklist_items** — Checklist items
- **onboarding_notes** — Activity timeline

### Notifications
- **notifications** — In-app and email notifications
- **notification_preferences** — Per-user notification preferences

### Docs & Integrations
- **doc_categories** — Doc library categories (22 seeded)
- **doc_articles** — Doc articles with content (45 seeded)
- **doc_tags** — Tag definitions
- **doc_article_tags** — Article-tag join table
- **doc_revisions** — Content revision history
- **integration_records** — Third-party integration config (Stripe, Mailgun, OpenAI, Cloudflare R2)

### Team Chat
- **chat_messages** — Team chat messages (channel, senderId, content, timestamp)

### Platform
- **audit_logs** — Sensitive action audit trail

## CRM Form-to-Lead Pipeline
```
Website Contact Form → POST /api/contacts
  → Zod validation + honeypot spam check
  → Save to legacy contacts table
  → CRM Ingest (non-blocking):
    → Deduplicate contact (email, then phone)
    → Create/find CRM contact + company
    → Link contact ↔ company
    → Create CRM lead with UTM attribution
    → Create system note on lead
    → Audit log
    → Notify admins/sales reps (non-blocking)
  → Email notification via Resend
```

## Notification System
### Triggers (server/features/notifications/triggers.ts)
- **notifyNewLead** — new website form lead → admins + sales reps
- **notifyLeadAssignment** — lead assigned → assignee
- **notifyStageChange** — opportunity moved → owner + admins
- **notifyOpportunityAssignment** — opportunity assigned → assignee
- **notifyOnboardingAssignment** — onboarding assigned → assignee
- **notifyOnboardingStatusChange** — status changed → owner + admins
- **notifySystemAlert** — system alert → admins + developers

### Mailgun Service
- Uses Mailgun HTTP API (no SDK)
- Requires: MAILGUN_API_KEY, MAILGUN_DOMAIN
- Optional: MAILGUN_FROM_EMAIL, MAILGUN_FROM_NAME
- Graceful degradation: returns "skipped" if not configured

## Integration System (v1.6)
### Health Checks (server/features/integrations/health.ts)
- Per-provider config detection (checks env var presence)
- Status: ready / partial / not_configured
- Feature flags: active (Mailgun) / planned (Stripe, R2) / scaffold (OpenAI)
- Test connection with live API verification

### Providers
- **Stripe** — Planned for billing. Requires: STRIPE_SECRET_KEY
- **Mailgun** — Active for notifications. Requires: MAILGUN_API_KEY, MAILGUN_DOMAIN
- **OpenAI** — Scaffolded for future AI features. Requires: OPENAI_API_KEY
- **Cloudflare R2** — Planned for file storage. Requires: 4 R2 env vars

## Key Routes
### Marketing (Public)
- `/` — Home, `/paquetes` — Packages, `/contacto` — Contact, `/demo` — Demo showroom

### Internal Platform (Protected)
- `/login` — Login page
- `/admin` — Dashboard
- `/admin/crm` — Lead list
- `/admin/crm/leads/:id` — Lead detail
- `/admin/crm/companies/:id` — Company detail
- `/admin/crm/contacts/:id` — Contact detail
- `/admin/pipeline` — Sales Pipeline board (kanban)
- `/admin/pipeline/list` — Opportunity list view
- `/admin/pipeline/opportunities/:id` — Opportunity detail
- `/admin/pipeline/stages` — Stage management (Admin/Developer)
- `/admin/onboarding` — Onboarding list
- `/admin/onboarding/new` — Onboarding wizard
- `/admin/onboarding/:id` — Onboarding detail
- `/admin/notifications` — Notification center
- `/admin/reports` — Reports analytics dashboard
- `/admin/integrations` — Integrations management (Admin/Developer)
- `/admin/clients` — Clients page (company cards with contacts/leads/pipeline stats)
- `/admin/chat` — Team Chat (multi-channel, polling-based real-time messaging)
- `/admin/payments` — Payments (placeholder — pending Stripe Billing feature)
- `/admin/settings` — Admin Settings (user management + role editing + audit logs)
- `/admin/docs` — App Docs library (45 articles)
- `/admin/demo-builder` — Demo link generator

### API Endpoints
- `POST /api/contacts` — Public contact form (+ CRM ingest)
- `POST /api/inquiries` — Public demo inquiry (+ CRM ingest)
- `ALL /api/auth/*` — BetterAuth
- `GET /api/users/me` — Current user
- `GET /api/admin/stats` — Dashboard stats
- `GET /api/admin/audit-logs` — Audit logs (admin)
- `POST /api/admin/seed-admin` — Create initial admin
- `POST /api/admin/seed` — Seed docs + integrations + CRM + pipeline + onboarding (admin)
- `GET/POST/PUT/DELETE /api/docs/*` — Docs CRUD
- `GET/PUT /api/integrations/*` — Integration management
- `GET /api/integrations/health` — Provider health checks
- `POST /api/integrations/:provider/test` — Test connection
- `GET/POST/PUT /api/crm/*` — CRM CRUD
- `GET/POST/PUT/DELETE /api/pipeline/*` — Pipeline CRUD
- `GET/POST/PUT/DELETE /api/onboarding/*` — Onboarding CRUD
- `GET/PUT /api/notifications/*` — Notification management
- `GET /api/reports/*` — Reports analytics (overview, leads-by-source, pipeline-breakdown, etc.)
- `GET /api/chat/channels` — List chat channels
- `GET /api/chat/messages?channel=` — Get messages for channel
- `POST /api/chat/messages` — Send a message
- `DELETE /api/chat/messages/:id` — Delete message (admin/developer only)
- `GET /api/clients` — Companies with aggregated contact/lead/opportunity stats
- `GET /api/admin/users` — List all platform users (admin only)
- `POST /api/admin/users` — Create new team member (admin only)
- `PUT /api/admin/users/:id` — Update role or ban status (admin only)

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Auth secret key
- `RESEND_API_KEY` — Email sending (legacy contact form)
- `MAILGUN_API_KEY` — Mailgun API key (system notifications)
- `MAILGUN_DOMAIN` — Mailgun sending domain
- `MAILGUN_FROM_EMAIL` — (optional) Sender email
- `MAILGUN_FROM_NAME` — (optional) Sender name
- `STRIPE_SECRET_KEY` — (planned) Stripe API key
- `STRIPE_WEBHOOK_SECRET` — (planned) Stripe webhook secret
- `OPENAI_API_KEY` — (scaffold) OpenAI API key
- `CLOUDFLARE_R2_ACCESS_KEY` — (planned) R2 access key
- `CLOUDFLARE_R2_SECRET_KEY` — (planned) R2 secret key
- `CLOUDFLARE_R2_BUCKET` — (planned) R2 bucket name
- `CLOUDFLARE_R2_ENDPOINT` — (planned) R2 endpoint URL
- `CLOUDFLARE_R2_PUBLIC_URL` — (optional) R2 public URL

## Admin Credentials
- **Email**: admin@vivawebdesigns.com
- **Password**: VivaAdmin2026!
- **Role**: admin

## v1.7 Hardening Notes
- Query optimizations: `getOnboardingStats` and `getPipelineStats` now use SQL aggregation (GROUP BY/COUNT/SUM) instead of fetching all rows into memory
- `findCompanyByName` tightened with input trimming and LIMIT 1
- Integrations page health loading state prevents false "Not Configured" flash
- Documentation completion: 6 new articles (Getting Started, Auth Flow, Known Issues, Frontend Architecture, Deployment Guide)
- Technical debt tracked in App Docs "Known Issues & Technical Debt" article

## Pending Features (Confirmed Order)
1. R2 File Storage (Cloudflare R2 — foundation for billing + chat)
2. Stripe Billing (user dismissed Replit integration — will need manual API key)
3. Team Chat Phase 1 (real-time messaging)
4. Team Chat Phase 2 (enhancements)

## Running
- `npm run dev` starts Express + Vite on port 5000
