# React Query Freshness Strategy

This document describes the cache freshness policy for TanStack Query v5 across the Viva Web Designs CRM/admin platform.

## Global Defaults

Defined in `client/src/lib/queryClient.ts`:

```ts
staleTime: Infinity        // Data never goes stale by default
refetchInterval: false     // No background polling by default
refetchOnWindowFocus: false // No re-fetch when user re-focuses the tab
retry: false               // No automatic retries on failure
```

The `Infinity` default is intentional for **static config data** — pipeline stages, CRM statuses, CRM tags, doc categories, onboarding templates, integration provider configs. These only change via explicit admin mutations, which already call `queryClient.invalidateQueries(...)` to reset the cache immediately.

## Named Freshness Tiers

`STALE` constants are exported from `client/src/lib/queryClient.ts` for use at call sites:

```ts
STALE.NEVER    = Infinity    // static config (default)
STALE.SLOW     = 5 * 60_000 // 5 min  — reports, aggregated analytics
STALE.MEDIUM   = 2 * 60_000 // 2 min  — dashboard/onboarding overview stats
STALE.FAST     =     60_000 // 1 min  — CRM lists, pipeline, clients
STALE.REALTIME =     30_000 // 30 s   — notifications, unread counts
```

Import them at the call site — never use magic numbers.

## Domain-by-Domain Policy

### Notifications & Unread Count — `STALE.REALTIME` (30 s)

- `GET /api/notifications` — used in `NotificationCenterPage`
- `GET /api/notifications/unread-count` — used in `AdminLayout` (also polled at 30 s interval) and `NotificationCenterPage`

New notifications can arrive from any team member's action. Both queries align with the 30-second polling interval already on the sidebar badge.

### Dashboard & Onboarding Stats — `STALE.MEDIUM` (2 min)

- `GET /api/admin/stats` — `DashboardPage`
- `GET /api/onboarding/stats` — `DashboardPage`, `OnboardingListPage`

Aggregated counts (leads, opportunities, onboarding states). Tolerable to be 2 minutes behind; over-fetching these for every tab switch is wasteful.

### CRM Lists, Pipeline, Clients — `STALE.FAST` (1 min)

- `GET /api/crm/leads` — `LeadListPage` (also `refetchOnWindowFocus: true`)
- `GET /api/pipeline/opportunities` — `PipelineListPage`
- `GET /api/pipeline/opportunities/board` — `PipelineBoardPage` (also `refetchOnWindowFocus: true`)
- `GET /api/clients` — `ClientsPage`

These are operational views used during active sales and onboarding work. Leads arrive via server-side form ingest; pipeline cards may be moved by another team member. The 1-minute window keeps the UI reasonably current without hammering the DB. `refetchOnWindowFocus: true` is added to the board and lead list so that switching back from another tab gives the user a fresh view.

### Onboarding Records List — `STALE.MEDIUM` (2 min) + `refetchOnWindowFocus: true`

- `GET /api/onboarding/records` — `OnboardingListPage`

Records are created from pipeline conversions (potentially by another user). 2-minute staleness is acceptable; window-focus refetch catches the case where a user creates a record in another tab.

### Reports & Analytics — `STALE.SLOW` (5 min)

- `GET /api/reports/overview` — `ReportsPage`
- `GET /api/reports/leads-trend` — `ReportsPage`

Aggregated analytics computed server-side. These are expensive queries and the data only meaningfully changes as new leads accumulate over time. 5-minute staleness is perfectly acceptable.

### Chat Channels — `STALE.FAST` (1 min)

- `GET /api/chat/channels` — `TeamChatPage`

Channel list rarely changes but could gain new channels. The messages feed already polls at 4-second intervals independently.

## Keep at Infinity (Static Config)

| Query | Reason |
|-------|--------|
| `/api/pipeline/stages` | Rarely changes; mutations invalidate |
| `/api/crm/statuses` | Same |
| `/api/crm/tags` | Same |
| `/api/onboarding/templates` | Same |
| `/api/integrations/providers` | Same |
| `/api/docs/categories` | Same |
| Detail pages (lead, company, contact, opportunity, onboarding) | Loaded by ID, mutations always invalidate on success |

## Adding New Queries

1. Identify the data's change frequency: config → `STALE.NEVER`, list/aggregated → pick the appropriate tier.
2. Use `STALE.*` constants, never magic numbers.
3. If the data is modified by mutations within the app, ensure those mutations call `queryClient.invalidateQueries(...)` with the correct key — this is more reliable than relying solely on staleTime.
4. Only add `refetchOnWindowFocus: true` to high-volatility lists where seeing stale data on tab return would be disruptive (e.g., the pipeline board).
