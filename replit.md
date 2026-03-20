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
`tests/integration/profiles-routes.test.ts` — 22 integration tests covering auth enforcement, UUID validation, role-based access control (restricted vs unrestricted roles), 404 propagation, and DTO shape consistency across all three entry points

### REST Endpoints
All mounted at `/api/profiles/` via `server/features/profiles/routes.ts` → `server/features/index.ts`.

| Method | Path | Auth |
|---|---|---|
| GET | `/api/profiles/company/:id` | `admin`, `developer` = unrestricted; `sales_rep`, `lead_gen` = must own a lead assigned to the company |
| GET | `/api/profiles/lead/:id` | `admin`, `developer` = unrestricted; `sales_rep`, `lead_gen` = must own the lead (`assignedTo = userId`) |
| GET | `/api/profiles/opportunity/:id` | `admin`, `developer` = unrestricted; `sales_rep`, `lead_gen` = must own the opportunity (`assignedTo = userId`) |

All routes validate `:id` is a valid UUID (400 on bad format), return 403 on access denial, 404 when the entity doesn't exist, and always return `UnifiedProfileDto`.

### Frontend Hooks — `client/src/features/profiles/`

| File | Purpose |
|---|---|
| `types.ts` | Frontend-safe mirror of `UnifiedProfileDto` and all `Mapped*` types (dates as `string`; no server imports) |
| `hooks.ts` | `useUnifiedProfile`, `useProfileTimeline`, `useProfileMutations` + `PROFILE_KEYS` factory |

#### `PROFILE_KEYS` — centralized cache key factory

```ts
PROFILE_KEYS.all                      // ["/api/profiles"]
PROFILE_KEYS.byType("lead")           // ["/api/profiles", "lead"]
PROFILE_KEYS.detail({ type, id })     // ["/api/profiles", type, id]
```

The TanStack default fetcher joins the array with `/`, mapping exactly to the REST endpoints.

#### `useUnifiedProfile(entry, { enabled? })`
Fetches the full `UnifiedProfileDto`. `staleTime: STALE.REALTIME` (30 s — shorter than the 1-min global default).

#### `useProfileTimeline(entry, { enabled? })`
Same query key as `useUnifiedProfile`; uses `select` to extract `profile.timeline.events`. No extra HTTP call when both hooks are mounted — zero duplicate transformations.

#### `useProfileMutations(entry)`
Returns `{ invalidate, addNote, updateStatus, assignOwner }`.
- `invalidate()` clears the profile cache **and** the underlying raw-entity caches (CRM leads, pipeline opportunities, etc.) so detail pages stay in sync.
- Stub mutations are wired to `invalidate` on success; `mutationFn` bodies will be filled in when the corresponding unified-write API routes are built.

#### `ProfileShell` — `client/src/features/profiles/ProfileShell.tsx`

Fully reusable, context-aware profile viewer. Drop it into any page:

```tsx
<ProfileShell entry={{ type: "company",     id: "..." }} />
<ProfileShell entry={{ type: "lead",        id: "..." }} />
<ProfileShell entry={{ type: "opportunity", id: "..." }} />
```

Tabbed layout: **Overview** (company/contact + sales snapshot) | **Timeline** | **Tasks** | **Files** | **Service** (billing + onboarding)

Named section exports for independent composition in sidebars/drawers:

| Export | Props | Description |
|---|---|---|
| `ProfileHeader` | `entry, company, derived` | Name, health badge, owner, context label, location |
| `CompanyContactCard` | `company, primaryContact, contacts` | Company fields + primary contact |
| `SalesSnapshotCard` | `entry, sales` | Active opportunity, source lead, counts |
| `TimelineSection` | `entry` | Calls `useProfileTimeline`; icon-per-type list |
| `TasksCard` | `work` | Next action highlight + task list with overdue indicators |
| `FilesCard` | `files` | File list with type icons and download links |
| `BillingOnboardingCard` | `service` | Stripe status + onboarding records |

Safe fallbacks everywhere: loading skeleton, error state, per-section empty states.
All interactive/display elements carry `data-testid` attributes.

### Migration Plan (future phases)
1. Migrate `/admin/clients/:id` tabs to consume `UnifiedProfileDto` via `useUnifiedProfile`
2. Migrate opportunity detail sidebar to use `<ProfileShell entry={{ type: "opportunity", id }}/>`
3. Implement unified-write API routes so `useProfileMutations` stubs become real

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
