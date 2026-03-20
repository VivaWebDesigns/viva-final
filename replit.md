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
- **Auth**: BetterAuth — cookie sessions, roles: `admin`, `developer`, `sales_rep`, `lead_gen`
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
- **Search debounce**: `useDebounce` hook at `client/src/hooks/use-debounce.ts` (300ms) — used in LeadListPage, PipelineListPage, OnboardingListPage, ClientsPage. Input state is `rawSearch`; debounced `search` drives the query key. `useEffect(() => setPage(1), [search])` resets pagination on debounced change.
- **Role guard**: `isRestricted()` = `role === "sales_rep" || role === "lead_gen"` — restricted roles may only view entities they own

## Performance Notes
- **`/api/clients` aggregates**: Replaced 5 correlated subqueries with 4 grouped LEFT JOINs (`contact_agg`, `lead_agg`, `opp_agg`, `onb_agg`). Drizzle subquery aliases pattern: `db.select({...}).from(table).groupBy(...).as("alias")`.
- **Pipeline board grouping**: `getOpportunitiesByStage()` uses a single-pass `Map` to group opportunities by stageId instead of `Array.filter` inside a `for` loop (O(n) vs O(n²)).
- **Profile freshness**: `useUnifiedProfile` + `useProfileTimeline` have `refetchOnWindowFocus: true` so detail views refresh when the user returns to a tab.
- **Timeline dedup**: `useProfileTimeline` shares the same query key as `useUnifiedProfile` and uses `select` to extract events — zero extra HTTP calls when both hooks are mounted on the same page.

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
Tasks are linked to `opportunityId`, `leadId`, `contactId`, and/or `companyId`. `QuickTaskModal` has 10 presets (1d/2d/5d/1w/2w/1mo/2mo/6mo/1yr/custom). Tasks Due Today page has "Schedule Follow-up" button for standalone tasks. Note: `followupTasks` table has NO `metadata` column.

## Team Chat
Socket.io on same HTTP server (single port). Channels: `general`, `sales`, `onboarding`, `dev` (stable DB keys). Direct messages supported. Rich text via Tiptap. `sanitizeHtml` exported from `client/src/features/chat/RichTextEditor.tsx`.

## Module Map
| Route | Feature |
|---|---|
| `/admin/dashboard` | Overview stats (real DB counts only — no fake data) |
| `/admin/crm/*` | Leads, contacts, companies |
| `/admin/crm/leads/:id` | **Lead Profile** — unified ProfileShell (lead context) |
| `/admin/pipeline` | Kanban board + list view |
| `/admin/pipeline/opportunities/:id` | **Opportunity Profile** — unified ProfileShell (opportunity context) |
| `/admin/onboarding` | Client onboarding checklists |
| `/admin/clients/:id` | Account hub (7 tabs: Overview, Notes, Contacts, Tasks, Files, Billing, Activity) |
| `/admin/tasks` | Tasks due today + overdue |
| `/admin/reports` | Pipeline metrics, conversion, win rate |
| `/admin/chat` | Team chat (channels + DMs) |
| `/admin/docs` | Internal documentation library |
| `/admin/settings` | Integrations, user management, stage management |
| `/admin/demo-builder` | Demo site generator |
| `/demo/*` | Public demo sites (empieza/crece/domina templates) |

---

## Unified Profile Architecture

`server/features/profiles/` is a cross-domain service layer that assembles a canonical view of a client account from all related entities. It is additive and non-destructive — existing routes, storage, and UI are unchanged.

### Build History (11 Phases)

| Phase | Work |
|---|---|
| 1 | `dto.ts`, `types.ts`, `relationships.ts` — DTO shape, identity resolution |
| 2 | `mappers.ts` — entity mappers, derived-value helpers, timeline event mappers |
| 3 | `service.ts` — `assembleProfile`, three public entry points |
| 4 | `routes.ts` — REST endpoints, UUID validation, role-based access |
| 5 | `ProfileShell.tsx` — tabbed UI; named section exports |
| 6 | `hooks.ts` — `useUnifiedProfile`, `useProfileTimeline`, `PROFILE_KEYS`; `ClientProfilePage` wired via `adaptToClient` adapter |
| 7 | `LeadProfilePage.tsx`, `OpportunityProfilePage.tsx` — thin wrappers; old detail pages preserved |
| 8 | Unified timeline — `crm_lead_notes` + `client_notes` + `pipeline_activities` merged, actor batch-resolved, sorted newest-first |
| 9 | Edit dialogs wired into `ProfileShell` — Company, Primary Contact, Source Lead, Active Opportunity each have a `Pencil` edit button; `useEntityMutations` centralises all four mutation hooks |
| 10 | Performance — debounce on all 4 list pages; `/api/clients` grouped JOINs; pipeline grouping O(n²)→O(n); `refetchOnWindowFocus` on profile hooks |
| 11 | Bug fixes — `sourceLead` pinned by `primaryLeadId` when viewing a lead profile; `activeOpportunity` pinned by `primaryOpportunityId` for opportunity profiles; `attachments` query gains `entityType: "client"` filter; `leadRows` ordered by `desc(createdAt)` |

### Server-Side Files
| File | Purpose |
|---|---|
| `types.ts` | `ProfileContextType`, `ProfileHealth`, `TimelineEventType`, `ResolvedIdentity`, `BillingSummary` |
| `dto.ts` | `UnifiedProfileDto`, `UnifiedTimelineEvent` — canonical output shape |
| `relationships.ts` | Identity resolution: companyId/leadId/opportunityId → all linked entity IDs |
| `mappers.ts` | Entity mappers + derived helpers (`deriveHealth`, `resolveValue`, `resolvePrimaryContact`, `resolveNextAction`, `resolveLastActivityAt`) + timeline event mappers |
| `service.ts` | `getProfileByCompanyId`, `getProfileByLeadId`, `getProfileByOpportunityId` |
| `index.ts` | Public re-exports |

### `assembleProfile` — key internals

```ts
// Opts pin the primary entity when entering via a specific lead or opportunity
async function assembleProfile(companyId: string, opts?: AssembleOpts): Promise<UnifiedProfileDto>

interface AssembleOpts {
  primaryLeadId?: string;       // pins sourceLead to this lead (lead-profile entry)
  primaryOpportunityId?: string; // pins activeOpportunity to this opp (opp-profile entry)
}
```

- **`leadRows`** ordered by `desc(crmLeads.createdAt)` — newest lead first
- **`sourceLead`**: when `primaryLeadId` is set → find that lead in the array; else falls back to `leads[0]` (newest)
- **`activeOpportunity`**: when `primaryOpportunityId` is set → use that specific opp regardless of status; else finds first open opp
- **`attachments`** filtered by `entityType = "client"` AND `entityId = companyId` (avoids cross-entity UUID collisions)

### Domain Relationships
- `crmCompanies` is the identity hub — all other entities resolve to a company
- `crmContacts` → `crmCompanies` (via `companyId`); `isPrimary` identifies the primary contact
- `crmLeads` → `crmCompanies` + `crmContacts`
- `pipelineOpportunities` → `crmLeads` (via `leadId`); 1-to-1 in practice
- `onboardingRecords` → `pipelineOpportunities` + `crmCompanies`
- `followupTasks` — polymorphic: `leadId`, `opportunityId`, `contactId`, `companyId`
- `attachments` / `stripeCustomers` — polymorphic via `entityType` + `entityId`

### Health Derivation
`deriveHealth(lastActivityAt)` → `healthy` (<14 d), `at_risk` (14–30 d), `stale` (>30 d), `unknown` (no activity)

### REST Endpoints
All mounted at `/api/profiles/` via `server/features/profiles/routes.ts` → `server/features/index.ts`.

| Method | Path | Auth |
|---|---|---|
| GET | `/api/profiles/company/:id` | admin/developer = unrestricted; sales_rep/lead_gen = must own a lead for the company |
| GET | `/api/profiles/lead/:id` | admin/developer = unrestricted; sales_rep/lead_gen = `assignedTo = userId` on lead |
| GET | `/api/profiles/opportunity/:id` | admin/developer = unrestricted; sales_rep/lead_gen = `assignedTo = userId` on opp |

All routes: UUID validation (400 on bad format), 403 on access denial, 404 when entity not found, always returns `UnifiedProfileDto`.

### Frontend Hooks — `client/src/features/profiles/`

| File | Purpose |
|---|---|
| `types.ts` | Frontend-safe mirror of `UnifiedProfileDto` (dates as `string`; no server imports) |
| `hooks.ts` | `useUnifiedProfile`, `useProfileTimeline`, `PROFILE_KEYS` factory |
| `edit/useEntityMutations.ts` | Four mutation hooks: `useCompanyMutation`, `useContactMutation`, `useLeadMutation`, `useOpportunityMutation` — all call `invalidateProfile` on success |

#### `PROFILE_KEYS` — centralized cache key factory
```ts
PROFILE_KEYS.all                      // ["/api/profiles"]
PROFILE_KEYS.byType("lead")           // ["/api/profiles", "lead"]
PROFILE_KEYS.detail({ type, id })     // ["/api/profiles", type, id]
```
The TanStack default fetcher joins the array with `/`, mapping exactly to the REST endpoints.

#### `useUnifiedProfile(entry, { enabled? })`
Fetches the full `UnifiedProfileDto`. `staleTime: STALE.REALTIME` (30s). `refetchOnWindowFocus: true`.

#### `useProfileTimeline(entry, { enabled? })`
Same query key as `useUnifiedProfile`; uses `select` to extract `profile.timeline.events`. Zero extra HTTP calls when both hooks are mounted.

#### `invalidateProfile(queryClient, entry)`
Clears profile cache AND underlying raw-entity caches so list pages and detail pages stay in sync:
- `PROFILE_KEYS.detail(entry)`
- `/api/crm/companies`
- `/api/crm/leads`
- `/api/pipeline/opportunities`
- `/api/clients`

### `ProfileShell` — `client/src/features/profiles/ProfileShell.tsx`

Drop into any page:
```tsx
<ProfileShell entry={{ type: "company",     id: "..." }} />
<ProfileShell entry={{ type: "lead",        id: "..." }} />
<ProfileShell entry={{ type: "opportunity", id: "..." }} />
```

**Tabs**: Overview (company/contact + sales snapshot) | Timeline | Tasks | Files | Service (billing + onboarding)

**Edit buttons** — pencil icon on each section opens a dialog:
| Section | Dialog | PUT endpoint |
|---|---|---|
| Company card | `EditCompanyDialog` | `PUT /api/crm/companies/:id` |
| Primary Contact | `EditContactDialog` | `PUT /api/crm/contacts/:id` |
| Active / Current Opportunity | `EditOpportunityDialog` | `PUT /api/pipeline/opportunities/:id` |
| Source Lead (lead-type profiles) | `EditLeadDialog` | `PUT /api/crm/leads/:id` |

**SalesSnapshotCard opportunity label**:
- `entry.type === "opportunity"` → "Current Opportunity" (handles closed/won/lost opps)
- all other types → "Active Opportunity"

Named section exports for independent composition:

| Export | Props | Description |
|---|---|---|
| `ProfileHeader` | `entry, company, derived` | Name, health badge, owner, context label, location |
| `CompanyContactCard` | `company, primaryContact, contacts, entry?` | Company fields + primary contact; `entry` enables per-section edit wiring |
| `SalesSnapshotCard` | `entry, sales` | Current/active opportunity, source lead, counts |
| `TimelineSection` | `entry` | Calls `useProfileTimeline`; icon-per-type merged feed |
| `TasksCard` | `work` | Next action highlight + task list with overdue indicators |
| `FilesCard` | `files` | File list with type icons and download links |
| `BillingOnboardingCard` | `service` | Stripe status + onboarding records |

Safe fallbacks everywhere: loading skeleton, error state, per-section empty states.
All interactive/display elements carry `data-testid` attributes.

### `ClientProfilePage` — `client/src/features/clients/ClientProfilePage.tsx`
1927-line account hub for existing clients. Wired to `useUnifiedProfile` via the `adaptToClient()` shape adapter (converts `UnifiedProfileDto` → legacy `ClientProfile` type). The adapter is pure shape transformation — no data fetching duplication. Notes, tasks, files, and billing are fetched independently only within their respective tabs (tab-gated, not duplicated).

### Tests
- `tests/unit/profiles-mappers.test.ts` — 38 unit tests covering all mapper functions and derived-value helpers (no DB dependency)
- `tests/unit/profiles-service.test.ts` — 12 tests covering all three entry paths, error cases, and DTO invariants
- `tests/integration/profiles-routes.test.ts` — 22 integration tests covering auth, UUID validation, RBAC, 404 propagation, and DTO shape consistency

---

## File Structure
```
client/src/
  features/          # Feature modules (crm, pipeline, onboarding, tasks, chat, etc.)
    profiles/
      ProfileShell.tsx          # Main profile UI — tabbed, 7 named section exports
      hooks.ts                  # useUnifiedProfile, useProfileTimeline, PROFILE_KEYS
      types.ts                  # Frontend DTO mirror (dates as string)
      edit/
        useEntityMutations.ts   # Company/Contact/Lead/Opportunity mutation hooks
        EditCompanyDialog.tsx
        EditContactDialog.tsx
        EditLeadDialog.tsx
        EditOpportunityDialog.tsx
  components/        # Shared components (QuickTaskModal, RecordTimeline, etc.)
  hooks/
    use-debounce.ts  # useDebounce<T>(value, delayMs) — 300ms search debounce
  i18n/              # LanguageContext + locales (en.ts, es.ts)
  pages/             # Top-level page wrappers + App.tsx routing
server/
  features/          # API routes + storage per feature
  features/profiles/ # Unified Profile domain — cross-domain composition layer
    service.ts        # assembleProfile(companyId, opts?) — core assembly
    relationships.ts  # resolveByLeadId/CompanyId/OpportunityId
    mappers.ts        # Entity + derived-value + timeline event mappers
    dto.ts            # UnifiedProfileDto, UnifiedTimelineEvent
    types.ts          # Server-side type contracts
    routes.ts         # REST endpoints with auth enforcement
    index.ts          # Public re-exports
  features/index.ts  # All route mounting + /admin/seed endpoint
  index.ts           # Server startup + seed auto-runs
shared/
  schema.ts          # Drizzle schema (source of truth for all types)
```
