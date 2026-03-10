# Viva Web Designs — Internal CRM / Admin Platform

## Overview
Viva Web Designs is a marketing agency focused on home-service contractors, primarily serving a Spanish-speaking audience with conversion-optimized demo sites. The project includes:
1. A **public-facing agency website** (React, wouter routing)
2. An **internal CRM/admin platform** for managing team operations, leads, sales pipeline, client onboarding, docs, chat, reports, and integrations
3. A **Demo Builder** — generates branded preview websites for prospects in 3 tiers (Empieza / Crece / Domina) across 17 trade categories, fully bilingual EN/ES

## Brand
- **Agency**: Viva Web Designs
- **Phone**: (980) 949-0548
- **Tone**: Confident, professional, direct, Spanish-first
- **Rules**: NEVER mention "latinos" or "Google Ads" anywhere in copy
- **Charlotte Painting Pro Logo** (CORRECT): `image_1_(5)_1772575534808_1773059817248.png` — house + brush design; NEVER replace with Viva logo

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + wouter
- **Backend**: Express.js + TypeScript + PostgreSQL + Drizzle ORM
- **Auth**: BetterAuth with admin plugin — roles: `admin`, `developer`, `sales_rep`
- **Port**: 5000 (Express serves both API and Vite frontend)

### Project Structure
```
client/
  src/
    pages/           — Main app pages (Home, Demo, Paquetes, AdminDemoBuilder, etc.)
    features/        — Feature modules (auth, CRM, pipeline, etc.)
    preview/         — Preview tier entry points + shared logic
      empieza-main.jsx   — Empieza tier preview entry
      crece-main.jsx     — Crece tier preview entry
      domina-main.jsx    — Domina tier preview entry
      tradeTemplates.js  — 17 trade templates + buildPreviewPayload()
      imageLibrary.js    — Auto-discovers local demo images via import.meta.glob
      demo-images/       — Curated local images by trade (see Image Library section)
    empieza/         — Empieza tier components (Home, Services, ContactForm, Nav)
    crece/           — Crece tier components
    domina/          — Domina tier components
server/
  features/
    admin/           — Admin user management
    auth/            — BetterAuth setup + middleware
    crm/             — CRM leads, companies, contacts, notes, tags
    pipeline/        — Kanban pipeline, stages, opportunities, activities
    onboarding/      — Client onboarding records, checklists, templates
    notifications/   — Internal + email notification system
    docs/            — Internal documentation library
    chat/            — Team chat (polling-based, multi-channel)
    reports/         — Analytics dashboards
    integrations/    — Third-party integration health checks
    audit/           — Audit log system
    clients/         — Client management
  routes.ts          — Public API routes (contacts, inquiries)
  storage.ts         — IStorage interface + MemStorage/PgStorage implementations
shared/
  schema.ts          — Drizzle schema + Zod insert schemas for all tables
  routes.ts          — Shared route types
```

## Demo Builder — Preview System
Three preview tiers built as separate Vite entry points, loaded in iframes:
- **Empieza** (`/preview/empieza.html`) — starter tier, simple single-section layout
- **Crece** (`/preview/crece.html`) — growth tier, multi-section with gallery
- **Domina** (`/preview/domina.html`) — premium tier, portfolio + advanced layout

### 17 Supported Trades
`painting`, `plumbing`, `roofing`, `electrician`, `landscaping`, `hvac`, `general`, `housecleaner`, `pressurewashing`, `carpenter`, `floorinstaller`, `tileinstaller`, `fenceinstaller`, `deckbuilder`, `shedbuilder`, `concrete`, `treeservice`

### Language System (EN/ES)
- All 3 tiers are fully bilingual with zero English leakage in Spanish mode
- `tradeNounES` fix: all 3 entry files extract `tnES = tradeNounES || tradeNoun` for proper Spanish nouns
- Language-aware payload fields: `servicesEN/ES`, `reviewsEN/ES`, `tradeNounEN/ES`
- tOverrides pattern: stored as `{ en: {...}, es: {...} }` in `window.__PREVIEW__`

### Key Files
- `client/src/preview/tradeTemplates.js` — 17 trade templates + `buildPreviewPayload()`
- `client/src/preview/imageLibrary.js` — auto-discovers local images; exports `getHeroImage`, `getGalleryImages`, `getSupportImages`, `hasCuratedImages`
- `client/src/preview/empieza-main.jsx` — entry with tradeNounES fix + full EN+ES tOv
- `client/src/preview/crece-main.jsx` — entry with tradeNounES fix + full EN+ES tOv
- `client/src/preview/domina-main.jsx` — entry with tradeNounES fix + full EN+ES dominaOv
- `client/src/empieza/hooks/use-language.tsx` — language-aware t() with tOverrides support
- `client/src/crece/hooks/use-language.tsx` — same for Crece
- `client/src/domina/i18n/LanguageContext.tsx` — Domina override merging

## Demo Image Library
Local curated images for demo builder, auto-discovered by Vite's `import.meta.glob`. **No code changes needed when adding images** — drop files in the folder and restart.

### Structure
`client/src/preview/demo-images/<trade>/hero|gallery|support/`

### Priority Order (never overridden by stock if curated images exist)
1. Local curated images (correct category folder)
2. Local curated images from sibling category (support → gallery fallback)
3. Unsplash stock images from trade template

### Randomization
- Hero arrays shuffled once at module load → random rotation per page load
- Gallery arrays shuffled once at module load → varied order per session
- Deterministic within a single page view

### Populated Trades
| Trade | Hero | Gallery | Support |
|-------|------|---------|---------|
| `plumbing` | 2 (bathroom vanity, copper pipe rough-in) | 5 (water heater, hose bib, toilet, washer/dryer, whole-house filter) | 1 (under-sink) |
| `landscaping` | 1 (lawn house) | 3 (patio hardscaping, garden/lawn, curb appeal lighting) | — |
| `deckbuilder` | 1 (composite deck) | 2 (covered porch, deck variation) | — |
| `fenceinstaller` | 2 (cedar horizontal, cedar with garden) | 4 (wood privacy, dark stained, fence run, horizontal yard) | — |
| `painting` | intentionally empty — keeps Charlotte Painting Pro video hero | intentionally empty — keeps CP Pro portfolio | — |

### Adding Images for a New Trade
1. Drop PNG/JPG/WebP into `client/src/preview/demo-images/<trade>/hero/` and/or `gallery/` and/or `support/`
2. Restart the dev server (Vite picks them up via import.meta.glob)
3. No code changes needed — `imageLibrary.js` is the single source of truth

## Database Tables
### Auth (BetterAuth)
- `user` — platform users (id, name, email, role, banned, createdAt)
- `session`, `account`, `verification` — BetterAuth internal tables

### CRM
- `crm_companies` — companies with address, industry, website, notes, tags
- `crm_contacts` — contacts linked to companies, with role, phone, email
- `crm_leads` — full lead records with status, source, assignee, score, tags
- `crm_lead_notes` — notes/calls/emails/tasks on leads (polymorphic type)
- `crm_tags`, `crm_lead_tags` — tag management
- `crm_lead_statuses` — configurable status pipeline stages

### Sales Pipeline
- `pipeline_stages` — kanban column definitions (name, color, order)
- `pipeline_opportunities` — deals linked to leads/companies with value, close date
- `pipeline_activities` — activity log per opportunity

### Client Onboarding
- `onboarding_templates` — reusable checklist templates
- `onboarding_records` — per-client onboarding instances
- `onboarding_checklist_items` — checklist rows with status, assignee, due date
- `onboarding_notes` — notes per onboarding record

### Docs
- `doc_categories`, `doc_articles`, `doc_tags`, `doc_article_tags`, `doc_revisions`

### Notifications
- `notifications` — internal notification records

### Other
- `contacts` — public contact form submissions
- `integration_records` — third-party integration health/config
- `audit_logs` — audit trail for admin actions

## CRM Form-to-Lead Pipeline
`POST /api/crm/leads` → validates with Zod → `findOrCreateCompany` (dedup by name) → `findOrCreateContact` (dedup by email) → `createLead` → `triggerLeadNotification` → 201 response

**CRITICAL query key pattern**: default fetcher joins queryKey with "/"; use single string for params: `["/api/reports/overview?days=30"]`

## Key API Routes
### Public
- `POST /api/contacts` — marketing contact form
- `POST /api/inquiries` — demo inquiry form

### CRM (Protected)
- `GET/POST /api/crm/leads` — list / create leads
- `GET/PUT/DELETE /api/crm/leads/:id` — single lead CRUD
- `POST /api/crm/leads/:id/notes` — add note to lead
- `GET/POST /api/crm/companies` — companies list / create
- `GET/POST /api/crm/contacts` — contacts list / create

### Pipeline (Protected)
- `GET/POST /api/pipeline/stages` — pipeline stages
- `GET/POST /api/pipeline/opportunities` — opportunities
- `PUT /api/pipeline/opportunities/:id` — update opportunity

### Admin (admin role only)
- `GET /api/admin/users` — list all platform users
- `POST /api/admin/users` — create new team member
- `PUT /api/admin/users/:id` — update role or ban status

## Notification System
Triggers: new lead created, lead stage changed, lead assigned, opportunity won/lost

## Integration System
Health checks at `server/features/integrations/health.ts`
Providers: Mailgun, Resend, Stripe (planned), OpenAI (scaffold), Cloudflare R2 (planned)

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Auth secret key
- `RESEND_API_KEY` — Email sending (legacy contact form)
- `MAILGUN_API_KEY` — Mailgun API key (system notifications)
- `MAILGUN_DOMAIN` — Mailgun sending domain
- `MAILGUN_FROM_EMAIL` — (optional) Sender email
- `MAILGUN_FROM_NAME` — (optional) Sender name
- `STRIPE_SECRET_KEY` — (planned)
- `CLOUDFLARE_R2_ACCESS_KEY` / `R2_SECRET_KEY` / `R2_BUCKET` / `R2_ENDPOINT` / `R2_PUBLIC_URL` — (planned)

## Admin Account Provisioning (Secure Bootstrap)
The initial admin account is created via `POST /api/admin/seed-admin`. This endpoint is **not** publicly accessible:
- In **production**: blocked unless `SEED_ADMIN_SECRET` env var is set.
- When `SEED_ADMIN_SECRET` is set: the caller must send `X-Seed-Secret: <value>` header.
- Admin email and password come from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars — no defaults in code.
- Idempotent: safe to call multiple times (no-op if account already exists).

**For local dev**, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in Replit Secrets. No secret header is required in development unless `SEED_ADMIN_SECRET` is also set.

**Do not document plaintext credentials here or anywhere in source code.**

## Technical Notes
- **Zod**: `shared/schema.ts` imports `z` from `"zod/v4"` (required for drizzle-zod v0.8.3 compatibility). All `zodResolver()` calls in form files use bridged wrapper at `client/src/lib/zodResolver.ts` — single cast site for Zod v3/v4 bridge.
- **tsconfig paths**: `@features/*`, `@crece/*`, `@domina/*`, `@empieza/*`, `@assets/*` are all registered in `tsconfig.json` and must match Vite's `vite.config.ts` aliases.
- **Express params type**: `ParamsDictionary[key]` is `string | string[]` in current `@types/express`. Use `req.params as Record<string, string>` or `req.params.X as string` in route handlers.
- **`window.__PREVIEW__`**: Typed in `client/src/preview/preview-env.d.ts`. `PreviewConfig` holds the payload + lang + tOverrides + domina (Domina-tier overrides). `PreviewPayload` lists all fields from `buildPreviewPayload()` in `tradeTemplates.js` — keep in sync when adding new fields.
- **tOverrides pattern**: `Record<string, unknown>` in PreviewConfig; hooks cast to `Record<string, string>` at use-site. Supports flat `{ key: val }` and nested `{ en: {...}, es: {...} }` shapes.
- BetterAuth must be mounted BEFORE `express.json()` in index.ts
- `import.meta.glob` for image auto-discovery requires Vite dev server restart when adding new files
- For hierarchical query keys use array: `queryKey: ['/api/crm/leads', id]` for correct cache invalidation

## Pending Features (Confirmed Order)
1. R2 File Storage (Cloudflare R2 — foundation for billing + chat)
2. Stripe Billing (manual API key — user dismissed Replit integration)
3. Team Chat Phase 1 (real-time messaging)
4. Team Chat Phase 2 (enhancements)

## Role Access Summary
See `docs/architecture/role-matrix.md` for the full matrix. Key principles:
- `developer` has **read access to all business data** (CRM, pipeline, onboarding, reports, clients) but **cannot mutate** leads, deals, or contacts.
- `sales_rep` has **full CRM/pipeline/onboarding write access** but cannot touch platform config (docs, integrations, user management).
- `admin` has full access to everything.
- Sidebar nav, frontend route guards, and API middleware are **fully aligned** — no nav item is visible to a role that would get 403 on its API calls.

## Feature History
- **v1.16**: React Query freshness / cache strategy — added five named `STALE` tier constants (`NEVER`/`SLOW`/`MEDIUM`/`FAST`/`REALTIME`) exported from `queryClient.ts`. Applied targeted `staleTime` overrides to 10 dynamic-data query call sites: notification list + unread count (30 s), dashboard + onboarding stats (2 min), CRM lead list + pipeline board/list + clients (1 min, board/leads also get `refetchOnWindowFocus: true`), onboarding records list (2 min + window focus), reports (5 min), chat channels (1 min). Static config queries (stages, statuses, tags, templates) remain at `Infinity`. Created `docs/architecture/query-freshness-strategy.md`.
- **v1.15**: Logging redaction / production-safe observability — rewrote the request logging middleware in `server/index.ts` to stop capturing full JSON response bodies (was dumping all lead/contact/CRM data verbatim). New middleware: generates a short `requestId` per request (stored in `res.locals.requestId`), logs `METHOD /path STATUS DURATIONms [requestId]` for all `/api/**` calls, appends the `message` string (not the full body) for 4xx/5xx only, routes 5xx to `console.error`. The global error handler now logs `method + path + status + requestId + message`; full stack trace only printed in non-production (`NODE_ENV !== "production"`). `mailgun.ts` success log no longer includes the recipient email address. Created `docs/architecture/logging-policy.md`.
- **v1.14**: Audit log payload consistency — fixed 9 logAudit call sites where context was silently dropped: admin `create_user`/`update_user` were missing `userId` (actor) and `ipAddress`; admin `seed_admin` was missing `ipAddress`; docs `PUT /categories/:id` had no metadata at all; docs `DELETE /articles/:id` had no metadata and deleted the record before logging (title+slug now captured first); onboarding `POST`/`PUT`/`DELETE`/`convert-opportunity` were all missing `ipAddress`. Onboarding update metadata improved to `{ clientName, changes: validated }`. Created `docs/architecture/audit-log-patterns.md` with canonical event shape, action vocabulary, entity types, and per-entity metadata conventions.
- **v1.13**: Clients module pagination/filtering correctness — moved search filtering from in-memory JS (post-pagination) into the SQL `WHERE` clause using Drizzle `ilike`/`or` with `.$dynamic()`. The count query now uses the same `WHERE` clause so `total` always reflects the filtered result set, not the full table. The data and count queries run in parallel with `Promise.all`. Zero TypeScript errors.
- **v1.12**: API validation tightening — added explicit Zod update schemas to 11 unprotected mutation routes. CRM: `updateCrmLeadSchema`, `updateCrmCompanySchema`, `updateCrmContactSchema`, `tagIdsSchema` for lead-tag PUT. Docs: `updateDocCategorySchema`, `updateDocArticleSchema`, `createDocTagSchema` (with auto-slug generation), `articleTagsSchema` for article-tag PUT. Integrations: `updateIntegrationSchema` (only `enabled`+`settings`; blocks `provider`/`configComplete`/`lastTested`). Pipeline: `convertLeadSchema` with strict field list. Onboarding: `convertOpportunitySchema` (strips date fields handled by the update route). All schemas use `.strict()` to reject unknown keys. Zero TypeScript errors. See `docs/architecture/mutation-schema-patterns.md`.
- **v1.11**: Authorization matrix normalization — added `developer` read access to all CRM GET routes (leads, companies, contacts, statuses, tags) and all pipeline opportunity GET routes (list, board, stats, detail, activities). Write operations remain `admin + sales_rep` only. Created `docs/architecture/role-matrix.md` as the authoritative role reference.
- **v1.10**: TypeScript type hardening — (1) added `client/src/preview/preview-env.d.ts` augmenting `Window` with fully-typed `PreviewConfig` / `PreviewPayload` interfaces; (2) added `domina` extension key to `PreviewConfig` for Domina-tier override merging; (3) typed `tOverrides` as `Record<string, unknown>` to support flat+nested shapes; (4) replaced all `(window as any).__PREVIEW__` with `window.__PREVIEW__` across 30 files; (5) added type import for `InsertPipelineOpportunity` in pipeline routes; (6) fixed `meta.fromStage/toStage` cast to `string` in pipeline stage-change handler; (7) added `P!` non-null assertions in Domina Home.tsx for TS-narrowed guard branches; (8) fixed Portfolio.tsx portfolio cast. Final result: 0 TypeScript errors.
- **v1.9**: TypeScript recovery — resolved all 535 errors → 0. Root fixes: (1) added `@features/*`, `@crece/*`, `@domina/*`, `@empieza/*`, `@assets/*` path aliases to tsconfig; (2) changed `shared/schema.ts` to `import { z } from "zod/v4"` for drizzle-zod v0.8.3 compatibility; (3) added `as string` / `Record<string, string>` casts for Express `req.params` throughout server routes; (4) renamed `details:` → `metadata:` in logAudit calls; (5) fixed `zodResolver(schema as any)` in ContactForm/Contacto files; (6) `(img as any)` cast for Gallery.tsx union type; (7) react-scroll type declaration; (8) misc component fixes.
- **v1.8**: Demo Image Library — curated local PNG images for plumbing/landscaping/deckbuilder/fenceinstaller; `imageLibrary.js` with `import.meta.glob` auto-discovery; Fisher-Yates shuffle for randomization; `getSupportImages()` with gallery fallback; `buildPreviewPayload()` uses local images first (hero → gallery → support → Unsplash); painting excluded to preserve CP Pro video+portfolio
- **v1.7**: Full EN/ES language system — all 3 preview tiers × 17 trades, zero English leakage in Spanish mode, tradeNounES fix in all 3 main entry files

## Running
- `npm run dev` starts Express + Vite on port 5000
