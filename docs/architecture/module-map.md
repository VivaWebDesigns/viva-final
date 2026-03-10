# Module Map

> Last updated: 2026-03-10 (P16 + P17 + P18 additions)

This document describes the responsibilities and boundaries of each feature module in the platform.

---

## Module Layout

Every feature is implemented as a paired backend + frontend slice:

```
server/features/<module>/
  index.ts      — re-exports (routes, services)
  routes.ts     — Express Router, middleware, Zod validation, logAudit/notify calls
  storage.ts    — Drizzle ORM queries (no business logic, no HTTP concerns)
  service.ts    — (optional) standalone logic callable by other modules
  triggers.ts   — (optional) side-effect functions (notifications, emails)
  seed.ts       — (optional) initial data seeding function

client/src/features/<module>/
  <Page>.tsx    — Page components registered in App.tsx
  <Component>.tsx — Feature-specific sub-components
```

---

## Backend Modules

### `auth`
**Responsibility**: Session bootstrap, user authentication, middleware guards.

- BetterAuth instance configured with `emailAndPassword` provider + `admin` plugin.
- `requireAuth` middleware — validates session via `auth.api.getSession()`, attaches `req.authUser` and `req.authSession`.
- `requireRole(...roles)` middleware — calls `requireAuth` then checks `req.authUser.role`.
- All protected routes apply one of these two middlewares as the first argument.
- BetterAuth handles `/api/auth/*` before Express JSON middleware runs.

### `admin`
**Responsibility**: Platform administration — user management, stats, audit log queries.

- User CRUD: create, update role, ban/unban users — `admin` role only.
- `GET /api/admin/stats` — aggregate counts across leads, contacts, articles, categories, integrations.
- `GET /api/admin/audit-logs` — paginated audit log access — `admin` only.
- `POST /api/admin/seed-admin` — initial admin account bootstrapping (uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from env).

### `crm`
**Responsibility**: Leads, companies, contacts, lead statuses, tags, and bulk operations.

- **Leads** — the primary entry point for prospects; support inbound (website form) and manual creation.
- **Companies** — organizations (prospects and clients).
- **Contacts** — individuals within companies.
- **Lead statuses** — configurable stages (distinct from pipeline stages).
- **Tags** — cross-entity labels for filtering.
- **Bulk operations** — safe multi-record mutations on leads (admin + sales_rep only, max 200 per request):
  - `POST /api/crm/leads/bulk/assign` — assign or unassign multiple leads
  - `POST /api/crm/leads/bulk/status` — set or clear status on multiple leads
  - `POST /api/crm/leads/bulk/tags/add` — add tags to multiple leads (upsert, no duplicates)
  - `POST /api/crm/leads/bulk/tags/remove` — remove tags from multiple leads
  - `POST /api/crm/leads/bulk/delete` — admin only; cascades to notes/tags; unlinks pipeline opportunities/tasks transactionally
- **CSV Import/Export** — `admin` + `sales_rep` only; uses `server/lib/csv.ts` utilities and `server/features/crm/csvImportExport.ts` service:
  - `GET /api/crm/leads/export-csv` — exports all leads with enriched contact/company/status columns
  - `POST /api/crm/leads/import-csv` — body: `text/plain` CSV; creates leads, resolves contacts by email/phone, resolves companies by name
  - `GET /api/crm/contacts/export-csv` — exports all contacts with resolved company name
  - `POST /api/crm/contacts/import-csv` — body: `text/plain` CSV; skips duplicates by email
  - Dedup strategy: companies by name, contacts by email then phone; leads always created (no natural key)
  - Required CSV columns: `title` (leads), `first_name` (contacts)
- **Lead enrichment** — `GET /api/crm/leads` returns leads enriched with status, contact, and company via `enrichLeads()` batch function (3 parallel `inArray` queries).
- **Assignable users** — `GET /api/crm/leads/assignable-users` returns all non-banned users for assignment pickers (all roles).
- The public contact form (`POST /api/contacts`) and inquiry form (`POST /api/inquiries`) are separate endpoints outside this router (handled in `server/routes.ts` directly) and write to `crm_leads` via CRM storage.

### `pipeline`
**Responsibility**: Sales pipeline stages, opportunities (deals), and activity history.

- **Stages** — configurable ordered stages (e.g., `new-lead`, `demo-scheduled`, `closed-won`). Stage mutations are `admin/developer` only.
- **Opportunities** — deals moving through stages. Linked to leads, companies, contacts.
- **Activities** — append-only history per opportunity (stage changes, notes, calls, etc.).
- **Board** endpoint (`GET /api/pipeline/opportunities/board`) — returns stages + all opportunities grouped by stage, with snapshot maps for contacts/companies. Uses `inArray()` for efficient batch enrichment.
- **Convert lead** — `POST /api/pipeline/convert-lead/:leadId` creates an opportunity from a lead.
  - **Hardened (P16)**: Returns `409 { message, opportunityId }` if the lead was already converted; auto-upserts a "Converted" CRM lead status (slug: `converted`, color: `#7c3aed`) and records history events on both the lead (`converted`) and the opportunity (`created_from_lead`).
  - **Lookup by lead** — `GET /api/pipeline/opportunities/by-lead/:leadId` returns the linked opportunity or `null`. Used by the lead detail page to show a "View Opportunity" button instead of the convert selector once a lead has been converted.

### `history`
**Responsibility**: Immutable record-level event trail (P18).

- `record_history` table: `id`, `entityType`, `entityId`, `event`, `fieldName`, `fromValue`, `toValue`, `actorId`, `actorName`, `note`, `createdAt`.
- `appendHistory(params)` — inserts one event row. Always called via `appendHistorySafe()` which wraps in `try/catch` so a history write failure never breaks the primary operation.
- `getHistory(entityType, entityId)` — returns events ordered newest-first.
- `GET /api/history/:entityType/:entityId` — accessible to all authenticated roles.
- **Events recorded**: `status_changed`, `assigned`, `stage_changed`, `closed_won`, `closed_lost`, `converted`, `created_from_lead`, `checklist_completed`, `checklist_uncompleted`.
- See `docs/architecture/record-history-vs-audit-log.md` for the distinction between this table and `audit_logs`.

### `workflow`
**Responsibility**: SLA / overdue detection (P17).

- `getOverdueSummary()` runs 4 parallel Drizzle queries and returns `{ staleLead, overdueOpportunity, overdueOnboarding, overdueChecklist, totalCount }`.
  - **Stale leads**: `updatedAt < now − 30 days`, status ≠ `converted`, no linked opportunity (LEFT JOIN).
  - **Overdue opportunities**: `status = open` AND any date field (`nextActionDate`, `followUpDate`, `expectedCloseDate`) is past.
  - **Overdue onboarding**: `status IN (pending, in_progress)` AND `dueDate < now`.
  - **Overdue checklist items**: `isCompleted = false` AND `dueDate < now`.
- `GET /api/workflow/overdue-summary` — `admin` + `sales_rep` only. No cron needed — check-on-read.
- Frontend polls every 5 minutes and surfaces a red warning pill in the sidebar when `totalCount > 0`.

### `onboarding`
**Responsibility**: Post-sale client setup tracking.

- **Records** — one per client onboarding engagement; holds status, assignee, dates, notes.
- **Checklist items** — per-record task list (categories: general, website, hosting, seo, ads, social, other).
- **Templates** — reusable checklist templates applied at record creation.
- **Notes** — timestamped log entries per record (system, manual, status changes, checklist updates).
- **Progress** computed via SQL COUNT aggregate (`getProgress()`) — not by loading all items.
- **Convert opportunity** — `POST /api/onboarding/convert-opportunity/:id` creates a record from a won opportunity.

### `clients`
**Responsibility**: Read-only view of CRM companies with enriched contact data.

- Single `GET /api/clients` endpoint.
- Queries `crm_companies` with a SQL subquery for `contactCount`.
- No write operations — clients are managed through the CRM module.

### `notifications`
**Responsibility**: In-app and email notification delivery and preferences.

- `createNotification()` — core write function; do not bypass this to write directly to the table.
- `triggers.ts` — business-event trigger functions called by other modules.
- `mailgun.ts` — Mailgun HTTP client for email delivery.
- Per-user read/mark-read/preferences API.
- All writes use the `notifications` table; email status is tracked in-row.

### `reports`
**Responsibility**: Aggregated business analytics.

- `GET /api/reports/overview` — comprehensive metrics across CRM, pipeline, onboarding, and notifications.
- `GET /api/reports/leads-trend` — time-series lead volume.
- Read-only. All three roles can access.
- Queries are designed to be run infrequently (`STALE.SLOW` = 5 min on the frontend).

### `docs`
**Responsibility**: Internal knowledge base for team documentation.

- Categories, articles, tags, article-tag relationships, revision history.
- Accessible to `admin` and `developer` only — not exposed to `sales_rep`.
- Articles support a rich-text `content` field (stored as text/HTML).
- Revisions track historical content for each article.

### `integrations`
**Responsibility**: Third-party service configuration records.

- Integration records track provider name, enabled state, settings (jsonb), and test status.
- `POST /:provider/test` — runs a connectivity test; updates `configComplete` and `lastTested`.
- `configComplete` and `lastTested` are managed server-side only; excluded from the user-facing update schema.
- Accessible to `admin` and `developer` only.

### `tasks`
**Responsibility**: Follow-up tasks linked to leads or opportunities.

- `followup_tasks` table: title, notes, dueDate, completed, assignedTo, opportunityId, leadId, contactId.
- `GET /api/tasks/due-today` — returns tasks due today + overdue tasks (for the Tasks dashboard page).
- `GET /api/tasks/for-opportunity/:id` and `for-lead/:id` — used in detail pages.
- `PUT /api/tasks/:id/complete` — shorthand complete endpoint.
- Write operations require `admin` or `sales_rep`; reads allow all three roles.

### `chat`
**Responsibility**: Internal team messaging.

- Channels + messages per channel.
- Messages scoped to authenticated users.
- Delete restricted to `admin` and `developer`.
- Frontend polls messages at 4-second intervals independently of TanStack Query.

### `audit`
**Responsibility**: Append-only audit trail.

- `logAudit()` — the sole public API. Called by route handlers across all feature modules.
- No update or delete operations exist on `audit_logs`.
- Readable via `GET /api/admin/audit-logs` (admin only).

---

## Frontend Modules

Each frontend module in `client/src/features/<module>/` contains:
- One or more page components registered in `client/src/App.tsx`.
- Feature-specific sub-components (modals, cards, detail views).
- No shared state between modules — data is fetched per-page via TanStack Query.

### Cross-cutting client concerns

| File / Dir | Purpose |
|-----------|---------|
| `client/src/lib/queryClient.ts` | Shared QueryClient, `apiRequest()`, `STALE` constants |
| `client/src/components/ui/` | Shadcn component library |
| `client/src/components/QuickTaskModal.tsx` | Reusable task creation modal used by pipeline and CRM detail pages |
| `client/src/layouts/AdminLayout.tsx` | Shell layout with sidebar navigation; role-aware nav item visibility |
| `client/src/features/auth/ProtectedRoute.tsx` | Route guard component (`isLoading → spinner`, `!isAuthenticated → redirect`, `!role → Access Denied`) |
| `client/src/features/auth/useAuth.ts` | Auth hook — wraps `useSession` from `authClient`, exposes `user`, `role`, `isLoading`, `isAuthenticated`, `signIn`, `signOut` |
| `client/src/contexts/PreviewLangContext.tsx` | Language context (EN/ES) for the Demo Builder — shared between `AdminDemoBuilder` and the nav language toggle |

---

## Inter-Module Dependencies

```
notifications  ←── crm, pipeline, onboarding  (triggers called from routes)
audit          ←── crm, pipeline, onboarding, admin, docs, integrations, tasks
crm            ←── pipeline (convert-lead links leadId)
pipeline       ←── onboarding (convert-opportunity links opportunityId)
clients        ←── crm (reads crm_companies)
reports        ←── crm, pipeline, onboarding, notifications (read-only aggregation)
```

**Rule**: Storage functions within a module should only query tables that module owns. Cross-module data needs are fulfilled via joined queries within the owning module's storage, or by a `reports`-style read. Modules must not import each other's storage functions — they use the database directly if cross-cutting.

---

## Shared Schema Usage Rules

1. **Import types only on the frontend**: Use `import type { Foo } from "@shared/schema"`. Never import runtime values (table objects, zod schemas) in frontend code.
2. **Server routes import from `@shared/schema`** for insert schemas used on `POST` routes.
3. **Server routes define update schemas locally** in their own `routes.ts` using `zod` (v3).
4. **Storage functions** accept typed parameters (`InsertFoo`, `Partial<InsertFoo>`) — they do not re-validate.
5. **Do not add server-only fields to shared schema** (e.g., raw passwords, internal tokens). The schema is shared with the frontend build.
