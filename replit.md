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
│   │   ├── auth/           # Login, auth client, protected routes
│   │   ├── admin/pages/    # Dashboard + placeholder pages
│   │   ├── crm/            # CRM: LeadList, LeadDetail, CompanyDetail, ContactDetail
│   │   ├── docs/           # App Docs library (CRUD)
│   │   └── integrations/   # Integrations overview
│   ├── layouts/            # AdminLayout (sidebar shell)
│   ├── pages/              # Marketing site pages
│   ├── components/         # Shared UI components
│   ├── content/            # Content system (content.json)
│   ├── empieza/            # Empieza demo sub-site
│   ├── crece/              # Crece demo sub-site
│   └── domina/             # Domina demo sub-site
├── server/
│   ├── features/           # Domain-based server features
│   │   ├── auth/           # BetterAuth config + middleware
│   │   ├── admin/          # Admin stats, seed, audit logs
│   │   ├── crm/            # CRM storage, routes, ingest, seed
│   │   ├── pipeline/       # Sales pipeline: stages, opportunities, activities
│   │   ├── docs/           # Docs CRUD + seed data
│   │   ├── integrations/   # Integration records + seed
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
- **crm_companies** — Business records (name, dba, website, phone, email, address, industry, language)
- **crm_contacts** — Individual people (firstName, lastName, email, phone, altPhone, title, companyId FK)
- **crm_leads** — Sales opportunities (title, value, status, source, UTM attribution, contact/company FKs)
- **crm_lead_statuses** — Pipeline stages (New, Contacted, Qualified, Proposal, Won, Lost)
- **crm_lead_notes** — Activity timeline (note, call, email, task, status_change, system)
- **crm_tags** — Tag definitions
- **crm_lead_tags** — Lead-tag join table

### Sales Pipeline
- **pipeline_stages** — Configurable pipeline stages (Discovery, Proposal, Negotiation, Closed Won, Closed Lost)
- **pipeline_opportunities** — Deals/opportunities (title, value, stage, status, dates, probability, lead/company/contact FKs)
- **pipeline_activities** — Activity timeline (stage_change, note, call, email, task, system)

### Docs & Integrations
- **doc_categories** — Doc library categories (21 seeded)
- **doc_articles** — Doc articles with content (22 seeded including 6 CRM + 7 pipeline docs)
- **doc_tags** — Tag definitions
- **doc_article_tags** — Article-tag join table
- **doc_revisions** — Content revision history
- **integration_records** — Third-party integration config (Stripe, Mailgun, OpenAI, Cloudflare R2)

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
  → Email notification via Resend
```
Frontend captures UTM params (utm_source, utm_medium, utm_campaign, utm_term, utm_content) + referrer + landing page from URL.

## Key Routes
### Marketing (Public)
- `/` — Home, `/paquetes` — Packages, `/contacto` — Contact, `/demo` — Demo showroom
- `/paquetes/empieza|crece|domina` — Plan detail pages

### Internal Platform (Protected)
- `/login` — Login page
- `/admin` — Dashboard (stats + recent leads + quick actions)
- `/admin/crm` — Lead list (searchable, filterable, paginated)
- `/admin/crm/leads/:id` — Lead detail (status, attribution, notes, contact/company)
- `/admin/crm/companies/:id` — Company detail (info, linked contacts/leads)
- `/admin/crm/contacts/:id` — Contact detail (info, linked company/leads)
- `/admin/pipeline` — Sales Pipeline board (kanban view)
- `/admin/pipeline/list` — Opportunity list view
- `/admin/pipeline/opportunities/:id` — Opportunity detail
- `/admin/pipeline/stages` — Stage management (Admin/Developer only)
- `/admin/onboarding` — Client Onboarding (placeholder)
- `/admin/chat` — Team Chat (placeholder)
- `/admin/payments` — Payments (placeholder)
- `/admin/notifications` — Notifications (placeholder)
- `/admin/integrations` — Integrations overview (working)
- `/admin/reports` — Reports (placeholder)
- `/admin/settings` — Admin settings (placeholder)
- `/admin/docs` — App Docs library (working, 15 articles)
- `/admin/demo-builder` — Demo link generator

### API Endpoints
- `POST /api/contacts` — Public contact form (+ CRM ingest)
- `POST /api/inquiries` — Public demo inquiry (+ CRM ingest)
- `ALL /api/auth/*` — BetterAuth (login, signup, session)
- `GET /api/users/me` — Current user (auth required)
- `GET /api/admin/stats` — Dashboard stats (auth)
- `GET /api/admin/audit-logs` — Audit logs (admin only)
- `POST /api/admin/seed-admin` — Create initial admin user
- `POST /api/admin/seed` — Seed docs + integrations + CRM statuses (admin)
- `GET/POST/PUT/DELETE /api/docs/*` — Docs CRUD (admin/developer)
- `GET/PUT /api/integrations/*` — Integrations CRUD (admin/developer)
- `GET/POST /api/crm/leads` — Lead list/create (admin/sales_rep)
- `GET/PUT /api/crm/leads/:id` — Lead detail/update
- `GET/POST /api/crm/leads/:id/notes` — Lead notes
- `GET/PUT /api/crm/leads/:id/tags` — Lead tags
- `GET/POST /api/crm/companies` — Company list/create
- `GET/PUT /api/crm/companies/:id` — Company detail/update
- `GET/POST /api/crm/contacts` — Contact list/create
- `GET/PUT /api/crm/contacts/:id` — Contact detail/update
- `GET /api/crm/statuses` — Lead status list
- `GET/POST /api/crm/tags` — CRM tags
- `GET/POST /api/pipeline/stages` — Pipeline stages list/create
- `PUT/DELETE /api/pipeline/stages/:id` — Stage update/delete
- `GET/POST /api/pipeline/opportunities` — Opportunity list/create
- `GET /api/pipeline/opportunities/board` — Kanban board data
- `GET /api/pipeline/opportunities/stats` — Pipeline value stats
- `GET/PUT /api/pipeline/opportunities/:id` — Opportunity detail/update
- `PUT /api/pipeline/opportunities/:id/stage` — Move to stage
- `GET/POST /api/pipeline/opportunities/:id/activities` — Activity timeline
- `POST /api/pipeline/convert-lead/:leadId` — Convert lead to opportunity

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Auth secret key
- `RESEND_API_KEY` — Email sending
- `PORT` — Server port (default 5000)

## Admin Credentials
- **Email**: admin@vivawebdesigns.com
- **Password**: VivaAdmin2026!
- **Role**: admin

## Demo System
- Empieza (`/empieza`), Crece (`/crece`), Domina (`/domina`) — Demo tiers
- Preview (`/preview/empieza|crece|domina`) — Private preview URLs
- 7 trade templates in `client/src/preview/tradeTemplates.js`

## Performance Optimizations
- Code splitting via React.lazy + Suspense (Home stays eager)
- Optimized video (960KB MP4 + WebM with WebP poster)
- Optimized WebP images (~1.1MB total from ~20MB originals)
- Native lazy loading on gallery images
- Non-render-blocking Google Fonts

## Running
- `npm run dev` starts Express + Vite on port 5000
