# Role Access Matrix — Viva Web Designs CRM

> Last updated: 2026-03-10
> Roles: `admin` · `developer` · `sales_rep`
> Legend: ✓ allowed · ✗ denied

---

## Guiding Principles

| Role | Intended scope |
|------|---------------|
| `admin` | Full platform control — users, billing, audit, all data |
| `developer` | Technical management — docs, integrations, stage config; read-only view of all business data |
| `sales_rep` | Business operations — CRM, pipeline deals, onboarding execution |

**Key rule:** `developer` has broad read access so it can support the platform without blind spots, but cannot mutate business data (leads, opportunities, onboarding records). `sales_rep` can mutate business data but cannot touch platform configuration (docs, integrations, user management).

---

## Backend API

### Dashboard / Admin Stats

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| GET /api/admin/stats | ✓ | ✓ | ✓ |
| GET /api/admin/audit-logs | ✓ | ✗ | ✗ |
| GET /api/admin/users | ✓ | ✗ | ✗ |
| POST /api/admin/users | ✓ | ✗ | ✗ |
| PUT /api/admin/users/:id | ✓ | ✗ | ✗ |
| POST /api/admin/seed | ✓ | ✗ | ✗ |
| POST /api/admin/seed-admin | gated (see bootstrap docs) | — | — |

### CRM

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| GET /api/crm/leads | ✓ | ✓ (read) | ✓ |
| GET /api/crm/leads/:id | ✓ | ✓ (read) | ✓ |
| GET /api/crm/leads/:id/notes | ✓ | ✓ (read) | ✓ |
| GET /api/crm/leads/:id/tags | ✓ | ✓ (read) | ✓ |
| POST /api/crm/leads | ✓ | ✗ | ✓ |
| PUT /api/crm/leads/:id | ✓ | ✗ | ✓ |
| POST /api/crm/leads/:id/notes | ✓ | ✗ | ✓ |
| PUT /api/crm/leads/:id/tags | ✓ | ✗ | ✓ |
| GET /api/crm/companies | ✓ | ✓ (read) | ✓ |
| GET /api/crm/companies/:id | ✓ | ✓ (read) | ✓ |
| POST /api/crm/companies | ✓ | ✗ | ✓ |
| PUT /api/crm/companies/:id | ✓ | ✗ | ✓ |
| GET /api/crm/contacts | ✓ | ✓ (read) | ✓ |
| GET /api/crm/contacts/:id | ✓ | ✓ (read) | ✓ |
| POST /api/crm/contacts | ✓ | ✗ | ✓ |
| PUT /api/crm/contacts/:id | ✓ | ✗ | ✓ |
| GET /api/crm/statuses | ✓ | ✓ (read) | ✓ |
| GET /api/crm/tags | ✓ | ✓ (read) | ✓ |
| POST /api/crm/tags | ✓ | ✗ | ✓ |

### Pipeline

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| GET /api/pipeline/stages | ✓ | ✓ | ✓ |
| POST /api/pipeline/stages | ✓ | ✓ | ✗ |
| PUT /api/pipeline/stages/:id | ✓ | ✓ | ✗ |
| DELETE /api/pipeline/stages/:id | ✓ | ✗ | ✗ |
| GET /api/pipeline/opportunities | ✓ | ✓ (read) | ✓ |
| GET /api/pipeline/opportunities/board | ✓ | ✓ (read) | ✓ |
| GET /api/pipeline/opportunities/stats | ✓ | ✓ (read) | ✓ |
| GET /api/pipeline/opportunities/:id | ✓ | ✓ (read) | ✓ |
| GET /api/pipeline/opportunities/:id/activities | ✓ | ✓ (read) | ✓ |
| POST /api/pipeline/opportunities | ✓ | ✗ | ✓ |
| PUT /api/pipeline/opportunities/:id | ✓ | ✗ | ✓ |
| PUT /api/pipeline/opportunities/:id/stage | ✓ | ✗ | ✓ |
| POST /api/pipeline/opportunities/:id/activities | ✓ | ✗ | ✓ |
| POST /api/pipeline/convert-lead/:leadId | ✓ | ✗ | ✓ |

### Client Onboarding

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| GET /api/onboarding/records | ✓ | ✓ | ✓ |
| GET /api/onboarding/records/:id | ✓ | ✓ | ✓ |
| POST /api/onboarding/records | ✓ | ✓ | ✓ |
| PUT /api/onboarding/records/:id | ✓ | ✓ | ✓ |
| DELETE /api/onboarding/records/:id | ✓ | ✗ | ✗ |
| GET /api/onboarding/records/:id/checklist | ✓ | ✓ | ✓ |
| PUT /api/onboarding/records/:id/checklist/:item | ✓ | ✓ | ✓ |
| GET /api/onboarding/records/:id/notes | ✓ | ✓ | ✓ |
| POST /api/onboarding/records/:id/notes | ✓ | ✓ | ✓ |
| GET /api/onboarding/templates | ✓ | ✓ | ✓ |
| GET /api/onboarding/stats | ✓ | ✓ | ✓ |
| POST /api/onboarding/convert-opportunity/:id | ✓ | ✗ | ✓ |

> Note: `developer` can write onboarding records and checklists because technical setup tasks (DNS, hosting config, etc.) are legitimately owned by the developer role.

### Docs

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| All GET/POST/PUT/DELETE | ✓ | ✓ | ✗ |

### Reports

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| All GET | ✓ | ✓ | ✓ |

### Integrations

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| All GET/PUT/POST | ✓ | ✓ | ✗ |

### Notifications

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| All (read/mark-read/preferences) | ✓ | ✓ | ✓ |

### Team Chat

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| GET /channels, GET /messages | ✓ | ✓ | ✓ |
| POST /messages | ✓ | ✓ | ✓ |
| DELETE /messages/:id | ✓ | ✓ | ✗ |

### Clients

| Endpoint | admin | developer | sales_rep |
|----------|-------|-----------|-----------|
| GET / | ✓ | ✓ | ✓ |

---

## Frontend Route Guards (App.tsx + ProtectedRoute)

| Route | admin | developer | sales_rep | Notes |
|-------|-------|-----------|-----------|-------|
| /admin (Dashboard) | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/crm/* | ✓ | ✓ | ✓ | API read-only for developer |
| /admin/pipeline/* | ✓ | ✓ | ✓ | API read-only for developer |
| /admin/pipeline/stages | ✓ | ✓ | ✗ | ProtectedRoute `["admin","developer"]` |
| /admin/onboarding/* | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/chat | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/clients | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/notifications | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/reports | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/demo-builder | ✓ | ✓ | ✓ | Any authenticated user |
| /admin/integrations | ✓ | ✓ | ✗ | ProtectedRoute `["admin","developer"]` |
| /admin/docs | ✓ | ✓ | ✗ | ProtectedRoute `["admin","developer"]` |
| /admin/settings | ✓ | ✗ | ✗ | ProtectedRoute `["admin"]` |

---

## Sidebar Navigation Visibility

| Item | admin | developer | sales_rep |
|------|-------|-----------|-----------|
| Dashboard | ✓ | ✓ | ✓ |
| Clients | ✓ | ✓ | ✓ |
| CRM | ✓ | ✓ | ✓ |
| Sales Pipeline | ✓ | ✓ | ✓ |
| Client Onboarding | ✓ | ✓ | ✓ |
| Team Chat | ✓ | ✓ | ✓ |
| Payments | ✓ | ✓ | ✓ |
| Notifications | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | ✓ |
| Demo Builder | ✓ | ✓ | ✓ |
| Integrations | ✓ | ✓ | ✗ |
| App Docs | ✓ | ✓ | ✗ |
| Admin | ✓ | ✗ | ✗ |

---

## Summary of Changes Made (2026-03-10)

Previously, `developer` was blocked from all CRM reads and all pipeline opportunity reads — but those pages were visible in the nav for all roles, creating a "blank screen on 403" experience.

**Changes applied:**
- CRM `GET` routes (`/leads`, `/leads/:id`, `/leads/:id/notes`, `/leads/:id/tags`, `/companies`, `/companies/:id`, `/contacts`, `/contacts/:id`, `/statuses`, `/tags`) — added `developer` read access.
- Pipeline `GET` routes (`/opportunities`, `/opportunities/board`, `/opportunities/stats`, `/opportunities/:id`, `/opportunities/:id/activities`) — added `developer` read access.
- Write operations on CRM/pipeline remain `admin + sales_rep` only.
- Frontend routing and sidebar nav were already consistent — no changes needed.
