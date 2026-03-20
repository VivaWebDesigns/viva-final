# Viva Web Designs — Internal CRM / Admin Platform

## Project Overview
Internal operations platform for a marketing agency serving Spanish-speaking home-service contractors. Includes:
- **Admin CRM/Pipeline** — lead management, sales pipeline, client onboarding, team chat, reporting
- **Demo Builder** — generates bilingual (EN/ES) preview sites across 3 tiers and 17 trade categories
- **Public agency site** — at routes `/`, `/services`, `/portfolio`, etc.

## Critical Rules
- **NEVER** mention "latinos" or "Google Ads" in any copy
- **Charlotte Painting Pro logo**: `image_1_(5)_1772575534808_1773059817248.png` — NEVER replace with Viva logo
- Brand phone: **(980) 949-0548**
- Admin role has full access across all modules

## Tech Stack
- **Frontend**: React + Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, wouter routing
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL
- **Auth**: BetterAuth — cookie sessions, roles: `admin`, `developer`, `sales_rep`
- **Storage**: Cloudflare R2 (file uploads), PostgreSQL (all other data)
- **Payments**: Stripe (webhook + customer management via `integrationRecords` JSONB or env vars)
- **Email**: Mailgun (optional, notifications)

## i18n Architecture
All admin UI is bilingual EN/ES. `client/src/i18n/LanguageContext.tsx` exports `useAdminLang()` → `{ lang, setLang, t }`. Stored in `localStorage` key `"admin-lang"`. Source of truth: `client/src/i18n/locales/en.ts` (defines `AdminTranslations` type); `es.ts` must mirror every key.

## Key Patterns
- **Slug lookup for stage/status names**: `(t.pipeline.stageNames as Record<string, string>)[stage.slug] || stage.name`
- **Queries**: TanStack Query v5 object form only; default fetcher pre-configured; cache keys use arrays for hierarchical invalidation
- **Mutations**: `apiRequest` from `@/lib/queryClient`; always invalidate relevant query keys after
- **Forms**: `useForm` + `zodResolver` + shadcn `Form` components; always provide `defaultValues`
- **data-testid**: Every interactive and meaningful display element must have a descriptive `data-testid`

## Database — Seed Strategy
**On startup** (auto, idempotent): users (admin/dev/sales), pipeline stages, CRM lead statuses, onboarding templates, integration configs, doc categories.

**Structural seeds** (safe to run anytime, use upsert):
- `server/features/pipeline/seed.ts` → `seedPipelineStages()`
- `server/features/crm/seed.ts` → `seedCrmStatuses()`
- `server/features/onboarding/seed.ts` → `seedOnboardingTemplates()`
- `server/features/integrations/seed.ts` → `seedIntegrations()`
- `server/features/docs/seed.ts` → `seedDocs()`

**Dev-only fake data**: `server/features/crm/seed-v2.ts` — NOT connected to any endpoint or startup. Manual use only.

**User seeds**: `server/features/admin/prod-seed.ts` (all environments), `server/features/admin/dev-seed.ts` (dev only). Reads from env secrets: `SEED_ADMIN_EMAIL/PASSWORD`, `SEED_DEV_EMAIL/PASSWORD`, `SEED_SALES_EMAIL/PASSWORD`.

## Sales Pipeline
**7 stages** (in order): New Lead → Contacted → Demo Scheduled → Demo Completed → Payment Sent → Closed – Won → Closed – Lost

**Opportunity detail page** shows: website package badge (Empieza/Crece/Domina), stage entered date, next follow-up from task system. Forecasting fields (probability, value, expected close, next action date) are **hidden from UI** (columns still exist in DB).

**Website packages**: `WEBSITE_PACKAGES = ["empieza", "crece", "domina"]` — colors: empieza=blue-100/blue-700, crece=violet-100/violet-700, domina=amber-100/amber-700.

## CRM — Manual Lead Creation
`POST /api/crm/leads/manual` — atomically creates: contact → company (if businessName) → CRM lead → pipeline opportunity in "new-lead" stage. Modal: `client/src/features/crm/CreateLeadModal.tsx`.

## Follow-up Task System
Tasks are linked to `opportunityId`, `leadId`, `contactId`, and/or `companyId`. `QuickTaskModal` has 10 presets (1d/2d/5d/1w/2w/1mo/2mo/6mo/1yr/custom). Tasks Due Today page has "Schedule Follow-up" button for standalone tasks.

## Team Chat
Socket.io on same HTTP server (single port). Channels: `general`, `sales`, `onboarding`, `dev` (stable DB keys). Direct messages supported. Rich text via Tiptap. `sanitizeHtml` exported from `client/src/features/chat/RichTextEditor.tsx`.

## Module Map
| Route | Feature |
|---|---|
| `/admin/dashboard` | Overview stats (real DB counts only — no fake data) |
| `/admin/crm/*` | Leads, contacts, companies |
| `/admin/pipeline` | Kanban board + list view |
| `/admin/pipeline/:id` | Opportunity detail |
| `/admin/onboarding` | Client onboarding checklists |
| `/admin/clients/:id` | Account hub (7 tabs: Overview, Notes, Contacts, Tasks, Files, Billing, Activity) |
| `/admin/tasks` | Tasks due today + overdue |
| `/admin/reports` | Pipeline metrics, conversion, win rate |
| `/admin/chat` | Team chat (channels + DMs) |
| `/admin/docs` | Internal documentation library |
| `/admin/settings` | Integrations, user management, stage management |
| `/admin/demo-builder` | Demo site generator |
| `/demo/*` | Public demo sites (empieza/crece/domina templates) |

## Unified Profile Architecture

`server/features/profiles/` is a cross-domain service layer that assembles a canonical view of a client account from all related entities. It is additive and non-destructive — existing routes, storage, and UI are unchanged.

### Files
| File | Purpose |
|---|---|
| `types.ts` | `ProfileContextType`, `ProfileHealth`, `TimelineEventType`, `ResolvedIdentity`, `BillingSummary` |
| `dto.ts` | `UnifiedProfileDto`, `UnifiedTimelineEvent` — the canonical output shape |
| `relationships.ts` | Identity resolution: given a companyId/leadId/opportunityId, resolves all linked entity IDs |
| `mappers.ts` | Entity mappers (`mapCompany`, `mapContact`, `mapLead`, `mapOpportunity`, `mapTask`, `mapOnboarding`, `mapFile`) + derived-value helpers (`deriveHealth`, `resolveValue`, `resolvePrimaryContact`, `resolveNextAction`, `resolveLastActivityAt`) + timeline event mappers |
| `service.ts` | `getProfileByCompanyId`, `getProfileByLeadId`, `getProfileByOpportunityId` |
| `index.ts` | Public re-exports |

### Domain Relationships
- `crmCompanies` is the identity hub. All other entities resolve to a company.
- `crmContacts` → `crmCompanies` (via `companyId`); `isPrimary` flag identifies the primary contact
- `crmLeads` → `crmCompanies` + `crmContacts` (via `companyId`, `contactId`)
- `pipelineOpportunities` → `crmLeads` (via `leadId`); 1-to-1 in practice
- `onboardingRecords` → `pipelineOpportunities` + `crmCompanies` (via `opportunityId`, `companyId`)
- `followupTasks` → all four domains (polymorphic: `leadId`, `opportunityId`, `contactId`, `companyId`)
- `attachments` / `stripeCustomers` → polymorphic via `entityType` + `entityId`

### Health Derivation
`deriveHealth(lastActivityAt)` → healthy (<14 days), at_risk (14–30 days), stale (>30 days), unknown (no activity)

### Tests
`tests/unit/profiles-mappers.test.ts` — 38 unit tests covering all mapper functions and derived-value helpers (no DB dependency)
`tests/unit/profiles-service.test.ts` — 12 tests covering all three entry paths, error cases, and DTO invariants (runs against live seeded DB)

### Migration Plan (future phases)
1. Add a `GET /api/profiles/:companyId` route (thin — calls `getProfileByCompanyId` only)
2. Migrate `/admin/clients/:id` tabs to consume `UnifiedProfileDto` instead of ad-hoc queries
3. Migrate opportunity detail sidebar to use `getProfileByOpportunityId`

## File Structure
```
client/src/
  features/          # Feature modules (crm, pipeline, onboarding, tasks, chat, etc.)
  components/        # Shared components (QuickTaskModal, RecordTimeline, etc.)
  i18n/              # LanguageContext + locales (en.ts, es.ts)
  pages/             # Top-level page wrappers + App.tsx routing
server/
  features/          # API routes + storage per feature
  features/profiles/ # Unified Profile domain — cross-domain composition layer
  features/index.ts  # All route mounting + /admin/seed endpoint
  index.ts           # Server startup + seed auto-runs
shared/
  schema.ts          # Drizzle schema (source of truth for all types)
```
