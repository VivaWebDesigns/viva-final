# Viva Web Designs — Internal CRM / Admin Platform

## Overview
This project is an internal operations platform for Viva Web Designs, a marketing agency. Its primary purpose is to streamline agency operations, particularly for serving Spanish-speaking home-service contractors. The platform includes a comprehensive Admin CRM/Pipeline for lead and client management, a Demo Builder for generating bilingual preview websites, and a public agency website.

The platform aims to enhance efficiency in lead management, sales processes, client onboarding, and team collaboration. The Demo Builder is a key feature, enabling rapid generation of localized preview sites across various service categories and tiers, which is crucial for their target market. The public agency site provides a professional online presence.

## User Preferences
- **NEVER** mention "latinos" or "Google Ads" in any copy.
- The Charlotte Painting Pro logo (`image_1_(5)_1772575534808_1773059817248.png`) should NEVER be replaced with the Viva logo.
- The brand phone number is **(980) 949-0548**.
- The `admin` role has full access across all modules.

## System Architecture

### UI/UX Decisions
The admin UI is fully bilingual (EN/ES) and uses React with Vite, Tailwind CSS, shadcn/ui, and Framer Motion for a modern, responsive, and interactive user experience. Routing is handled by wouter. The design prioritizes clarity and ease of use for internal agency staff.

### Technical Implementations
- **Frontend**: React + Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, wouter.
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL.
- **Authentication**: BetterAuth handles cookie-based sessions with roles: `admin`, `developer`, `sales_rep`, `lead_gen`.
- **Internationalization**: All admin UI supports English and Spanish, managed via `LanguageContext` and `localStorage`.
- **Data Fetching**: TanStack Query v5 with a pre-configured default fetcher. Cache keys use arrays for hierarchical invalidation. Mutations always invalidate relevant query keys.
- **Forms**: `useForm` with `zodResolver` and shadcn `Form` components, always providing `defaultValues`.
- **Search**: Implemented with a `useDebounce` hook (300ms) to optimize performance across list pages, resetting pagination on debounced search changes.
- **Role-Based Access**: `isRestricted()` function limits `sales_rep` and `lead_gen` roles to viewing only entities they own.
- **Performance Optimizations**:
    - Aggregations on `/api/clients` use grouped `LEFT JOIN`s instead of correlated subqueries.
    - Pipeline board grouping uses a single-pass `Map` for O(n) performance.
    - `refetchOnWindowFocus: true` for profile hooks ensures data freshness.
    - Timeline deduping shares query keys to prevent redundant HTTP calls.

### Feature Specifications
- **Admin CRM/Pipeline**:
    - **Sales Pipeline**: Features 7 stages from "New Lead" to "Closed – Won/Lost". Opportunity detail pages display website package badges (Empieza/Crece/Domina) and task follow-ups. Forecasting fields are database-only and hidden from the UI.
    - **CRM Lead Creation**: Manual lead creation via a modal atomically creates contact, company, CRM lead, and a pipeline opportunity in the "new-lead" stage.
    - **Follow-up Task System**: Tasks are linked polymorphically to `opportunityId`, `leadId`, `contactId`, or `companyId`. Includes `QuickTaskModal` with presets and a "Tasks Due Today" page.
    - **Stage-Based Task Automations**: Admin-configurable templates automatically generate tasks when opportunities enter specific pipeline stages, leveraging `stage_automation_templates` and `automation_execution_logs`.
- **Demo Builder**: Generates bilingual (EN/ES) preview sites across three tiers and 17 trade categories.
- **Team Chat**: Socket.io-based chat supporting `general`, `sales`, `onboarding`, `dev` channels and direct messages, with rich text editing via Tiptap.
- **Unified Profile Architecture**: A cross-domain service layer (`server/features/profiles/`) aggregates a canonical view of client accounts from all related entities. It provides REST endpoints for company, lead, and opportunity profiles, with role-based access control and UUID validation.
    - **Frontend Hooks**: `useUnifiedProfile` and `useProfileTimeline` fetch and display profile data with optimized caching (`PROFILE_KEYS`) and invalidation.
    - **`ProfileShell`**: A fully-featured tabbed profile viewer supporting all three entry types (company, lead, opportunity). Includes Quick Stats row (Contacts, Leads, Deals, Deal Value, Open Tasks), Move to Stage buttons (only for open pipeline opportunities, with CompleteTaskModal and PaymentSentModal integration), and seven tabs: Overview (Company/Contact + Sales Snapshot), Notes (rich text with categories and pinning), Contacts (add/edit dialog), Tasks (full CRUD with open/completed grouping), Files (upload + download), Billing (Stripe account + Service Overview + AccountHealthForm), and Activity (unified timeline). Stage buttons are hidden for closed-won/client profiles.
    - **Unified Profile Entry Points** (all three are thin wrappers over `ProfileShell`):
      - `client/src/features/profiles/LeadProfilePage.tsx` → `<ProfileShell entry={{ type: "lead", id }} />` — route `/admin/crm/leads/:id`
      - `client/src/features/profiles/OpportunityProfilePage.tsx` → `<ProfileShell entry={{ type: "opportunity", id }} />` — route `/admin/pipeline/opportunities/:id`
      - `client/src/features/profiles/ClientProfilePage.tsx` → `<ProfileShell entry={{ type: "company", id }} />` — route `/admin/clients/:id`
    - **Legacy pages preserved (nondestructive)**: `features/clients/ClientProfilePage.tsx` (old adapter-based page), `features/crm/LeadDetailPage.tsx`, `features/pipeline/OpportunityDetailPage.tsx`. These files are intact but no longer referenced by active routes.
    - **Profile Sub-resource Reads** — all tab fetches now owned by the profile layer (`/api/profiles/company/:id/...`):
      - `GET /api/profiles/company/:id/notes` — client notes with user name (replaces `/api/clients/:id/notes`)
      - `GET /api/profiles/company/:id/tasks` — all tasks for the company (company + lead + opportunity FK union) (replaces `/api/clients/:id/tasks`)
      - `GET /api/profiles/company/:id/files` — attachments (replaces `/api/clients/:id/files`)
      - `GET /api/profiles/company/:id/billing` — billing snapshot incl. Stripe data (replaces `/api/clients/:id/billing`)
      - `GET /api/profiles/company/:id/activity` — history log (replaces `/api/history/client/:id`)
    - **Profile Write Endpoints** — all cross-domain mutations owned by the profile layer (`server/features/profiles/routes.ts`):
      - Company-scoped: `POST/DELETE /company/:id/notes`, `POST/PATCH /company/:id/contacts/:contactId?`, `POST/PUT/DELETE /company/:id/tasks/:taskId?`, `PATCH /company/:id/account`, `PATCH /company/:id`
      - Lead-scoped: `POST /lead/:id/notes` (writes to `crmLeadNotes`)
      - Opportunity-scoped: `POST /opportunity/:id/notes` (writes to `pipelineActivities`)
      - Cross-type owner assignment: `PATCH /company|lead|opportunity/:id/owner`
      - Cross-type status update: `PATCH /company|lead|opportunity/:id/status`
    - **Profile Mutation Architecture** — `useProfileMutations(entry)` hook in `client/src/features/profiles/hooks.ts`:
      - `addNote` — routes by entry type to the correct domain table
      - `updateStatus` — routes by type: company→clientStatus, lead→statusId, opportunity→stageId
      - `assignOwner` — routes by type: company→accountOwnerId, lead/opportunity→assignedTo
      - All mutations call `invalidate()` on success, which clears the profile DTO cache and all relevant sub-resource caches
    - **Cache Key Conventions** — `PROFILE_KEYS` in `hooks.ts`:
      - `detail(entry)` — `["/api/profiles", type, id]` — the full profile DTO
      - `notes/tasks/files/billing/activity(companyId)` — `["/api/profiles/company", companyId, "<resource>"]` — tab-level reads
      - Legacy keys (`/api/clients/:id/...`) are no longer used by the profile layer but remain active for any remaining direct consumers
    - **Legacy routes remain active** (`server/features/clients/routes.ts`) — nondestructive; profile-layer endpoints delegate to the same DB/business logic but live under `/api/profiles/...`
    - **`GET /api/clients/:id` — Deprecated compatibility façade**:
      - Now a thin wrapper over `getProfileByCompanyId()` from the profile service. The prior bespoke aggregate assembly (6 parallel DB queries + joins for status name/stage name) has been eliminated.
      - Returns `X-Deprecated: Use GET /api/profiles/company/:id instead` response header.
      - Active consumers: **NONE**. The only historical consumer (`features/clients/ClientProfilePage.tsx`) is preserved in the codebase but not referenced by any active route.
      - Shape differences vs. original: `leads[].status` and `opportunities[].stage` are `null` (IDs available via the profile endpoint); `recentNotes` sourced from the unified timeline.
      - **Removal path**: Delete `features/clients/ClientProfilePage.tsx` → narrow all `/api/clients` cache-invalidation predicates to target only the list endpoint → remove this route from `server/features/clients/routes.ts`.
    - **`GET /api/clients` (list)** — still active, not deprecated. Used by `ClientsPage` for the client directory.
    - **`GET /api/clients/:id/notes|tasks|files|billing`** — superseded by profile-owned endpoints but routes remain active for backward compatibility. No active UI consumers following the ProfileShell migration.

### Stage-Based Task Automations
Admin-configurable task templates that auto-generate tasks when opportunities enter specific pipeline stages.
- **Tables**: `stage_automation_templates`, `automation_execution_logs`
- **API**: `/api/automations/templates` (CRUD), `/api/automations/execution-logs` (enriched with template/opportunity/task titles, supports `status`/`since`/`until` filters), `/api/automations/stats/stage-counts` — admin-only
- **Trigger stages**: Uses `pipeline_stages.slug` values: `new-lead`, `contacted`, `demo-scheduled`, `demo-completed`, `payment-sent`, `closed-won`, `closed-lost`
- **Shared types**: `AUTOMATION_TRIGGER_STAGES`, `AUTOMATION_PRIORITIES`, `AUTOMATION_EXEC_STATUSES` in `shared/schema.ts`
- **Service**: `server/features/automations/` — storage.ts (Drizzle CRUD), routes.ts (Express), trigger.ts (stage-change trigger), index.ts
- **Trigger service** (`trigger.ts`): `executeStageAutomations()` — fetches active templates, checks for duplicates via execution logs, creates follow-up tasks, logs each execution. Fire-and-forget (`.catch()`) so it never blocks the parent route.
- **Trigger integration points** (in `server/features/pipeline/routes.ts`):
  1. `PUT /opportunities/:id/stage` — Pipeline Board drag-drop and detail page stage change
  2. `PUT /opportunities/:id` — General opportunity update when `stageId` changes
  3. `POST /convert-lead/:leadId` — Lead conversion (initial stage entry)
- **Duplicate prevention**: Checks `automationExecutionLogs` for existing `success` entry with same `opportunityId + templateId + triggerStageSlug`. Composite index `auto_exec_log_dup_check_idx` on `(opportunityId, templateId, triggerStageSlug, status)` optimizes this query.
- **Admin UI**: Admin Settings > Automations tab — `client/src/features/admin/pages/AutomationsTab.tsx` — tabbed layout with Templates and Execution Logs panels; stage sidebar shows active/total counts; execution logs table with stage/status filters and enriched data (template title, opportunity title/link, generated task title)
- **i18n**: Full EN/ES under `t.automations.*`

### System Design Choices
- **Database Seed Strategy**: Idempotent seeding on startup for core data (users, stages, templates, integrations). Structural seeds use upserts. Dev-only fake data is separate.
- **Data-testid Attributes**: Every interactive and meaningful display element includes a descriptive `data-testid` for robust testing.
- **File Structure**: Organized into `client/src/features`, `client/src/components`, `client/src/hooks`, `client/src/i18n`, `client/src/pages` for the frontend, and `server/features`, `shared` for the backend and shared schemas. The `profiles` feature is a core cross-domain module.

## Testing Architecture

### Layer Separation

Tests are organized into three clearly separated layers. The `npm run test:unit` command is designed to pass **without any database or network access** — unit tests are the authoritative fast-feedback signal for CI and local development.

| Layer | Command | DB needed? | Location |
|---|---|---|---|
| **Unit** | `npm run test:unit` | No | `tests/unit/` |
| **Integration** | `npm run test:integration` | Yes (live Postgres) | `tests/integration/` |
| **Smoke / E2E** | `npm run test:smoke` | Yes | `tests/smoke/` |
| **All** | `npm test` | Yes | `tests/**` |

### Unit Test Conventions

Unit tests are **hermetic** — they mock `server/db` and test business logic in isolation.

**Pattern: call-sequence mock for Drizzle ORM**

Drizzle ORM uses a fluent chain (`db.select().from().where()…`).  Each `db.select()` call in the service is intercepted by a vitest mock that returns the next item in a deterministic response queue.

```typescript
const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));
vi.mock("../../server/db", () => ({ db: { select: mockSelect } }));

function makeChain(data: unknown[]): any {
  const chain: Record<string, any> = {};
  for (const m of ["from","where","limit","orderBy","leftJoin","groupBy","returning"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve, reject) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

function setupDbResponses(...responses: unknown[][]) {
  let i = 0;
  mockSelect.mockImplementation(() => makeChain(responses[i++] ?? []));
}
```

Each service function makes DB calls in a fixed sequence.  The test fixture comment documents the exact call-sequence so future contributors can update response arrays when the service code changes.

**Writing a new unit test:**
1. Trace the DB call sequence for the code path under test (see service file comments).
2. Call `setupDbResponses(response0, response1, …)` in the test body.
3. Assert on the JS-layer output — shapes, derived fields, computations, error messages.

### What belongs in each layer

| What to test | Layer |
|---|---|
| Service not-found errors | Unit |
| DTO always-array guarantees | Unit |
| Derived field computations (health, value, nextAction, rates) | Unit |
| Rate rounding / zero-denominator guards | Unit |
| JS reduce totals (totalOpen = Σ openCounts) | Unit |
| Pure mapper functions (mapCompany, mapLead, etc.) | Unit |
| SQL query correctness (real aggregate results) | Integration |
| DTO shape consistency across entry points (lead vs company vs opp) | Integration |
| Route auth enforcement and HTTP contract | Integration |

### File inventory

```
tests/
  unit/
    profiles-service.test.ts       ← hermetic: not-found, arrays, derived fields
    profiles-mappers.test.ts       ← pure functions: mappers, deriveHealth, etc.
    report-aggregations.test.ts    ← hermetic: rate math, reduce totals, shapes
    bootstrap.test.ts
    channel-normalization.test.ts
    provider-resilience.test.ts
    static-cache-headers.test.ts
    workflow-queue.test.ts
  integration/
    profiles-service.test.ts       ← live DB: DTO consistency across entry points
    report-aggregations.test.ts    ← live DB: SQL aggregation correctness
    profiles-routes.test.ts        ← mocked service, real route layer
    auth-middleware.test.ts
    public-contact-form.test.ts
  helpers/
    renderWithProviders.tsx
    handlers.ts
    server.ts
    session.ts
  __mocks__/
    assetStub.ts
```

## Profile Feature — Typed Error Semantics

### Error class hierarchy

All errors thrown inside `server/features/profiles/` extend `ProfileError`, which lives in `server/features/profiles/errors.ts`.  Each subclass carries a canonical HTTP status code.

```
ProfileError (base, 500)
├── ProfileValidationError   400  Caller supplied invalid / out-of-range input
├── ProfileForbiddenError    403  Caller lacks permission to access this profile
├── ProfileNotFoundError     404  Requested entity does not exist in the DB
├── ProfileLinkageError      422  Entity exists but a required relationship can't
│                                 be resolved (e.g. lead has no companyId)
└── ProfileDependencyError   503  Upstream DB / service failure — caller may retry
```

### Route error handler

`sendProfileError(res, err)` in `errors.ts` is the single dispatch point for all route `catch` blocks.

Rules applied in order:
1. **ProfileError subclass** → use `err.statusCode`.
2. **status < 500** → expose `err.message` verbatim (safe to show callers).
3. **status ≥ 500** → generic `"Internal server error"` to client; full message + stack logged to `stderr`.
4. **Non-ProfileError** → always 500 + generic message + `stderr` log.

### Where errors are thrown

| Layer | Throws | On |
|---|---|---|
| `relationships.ts` | `ProfileNotFoundError` | company / lead / opportunity row missing |
| `service.ts` | `ProfileNotFoundError` | company row missing in `assembleProfile` |
| `service.ts` | `ProfileLinkageError` | lead or opp resolved but `companyId` is null |
| `routes.ts` | `ProfileValidationError` | (ready for use; Zod validation handled inline) |

### Test coverage for error paths

| Test file | Assertions |
|---|---|
| `tests/unit/profiles-service.test.ts` | `instanceof ProfileNotFoundError`, `statusCode === 404`, `.entity`, `.entityId` |
| `tests/unit/profiles-service.test.ts` | `instanceof ProfileLinkageError`, `statusCode === 422` |
| `tests/integration/profiles-routes.test.ts` | HTTP 404 body contains entity name |
| `tests/integration/profiles-routes.test.ts` | HTTP 422 body contains linkage message |
| `tests/integration/profiles-routes.test.ts` | HTTP 500 body is generic (no DB detail leaked) |

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Cloudflare R2**: Object storage for file uploads.
- **Stripe**: Payment processing, including webhooks and customer management.
- **Mailgun**: Optional for email notifications.
- **Socket.io**: Real-time communication for the team chat feature.