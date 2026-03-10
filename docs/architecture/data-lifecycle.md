# Data Lifecycle

> Last updated: 2026-03-10

This document traces how the four core business entities — **Lead → Opportunity → Onboarding Record → Client** — are created, mutated, and related to each other.

---

## 1. Lead

### What it is
A **Lead** (`crm_leads`) represents a prospect who has expressed interest. It is the first entity created in the sales funnel.

### How it enters the system

#### Path A — Website contact form (automatic ingest)
1. Visitor submits the public contact form at `/contact` or a demo inquiry.
2. `POST /api/contacts` or `POST /api/inquiries` — public, no auth.
3. Server saves a `contacts` record and creates a `crm_leads` row with `fromWebsiteForm: true`.
4. UTM fields (`utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`) and `referrer`, `landingPage`, `formPageUrl` are captured from the payload.
5. `notifyNewLead()` fires — all `admin` and `sales_rep` users receive an in-app + email notification.

#### Path B — Manual CRM creation
1. `POST /api/crm/leads` (requires `admin` or `sales_rep`).
2. `logAudit({ action: "create", entity: "crm_lead", ... })` is called.
3. No automatic notification fires (manual creation is a deliberate staff act).

### Key fields
| Field | Meaning |
|-------|---------|
| `title` | Display name for the lead (often business name) |
| `statusId` | FK to `crm_lead_statuses` (configurable pipeline statuses) |
| `source` | Enum-like string: `website_form`, `demo_inquiry`, `manual`, etc. |
| `assignedTo` | FK to `user.id` — when set/changed, `notifyLeadAssignment()` fires |
| `companyId` | Optional FK to `crm_companies` |
| `contactId` | Optional FK to `crm_contacts` |
| `fromWebsiteForm` | Boolean — distinguishes inbound from manual leads |
| UTM fields | Capture-time attribution — **immutable after creation** (excluded from update schema) |
| `value` | Estimated deal value (string/numeric) |

### What can happen to a Lead
- Status updates (moves through custom lead statuses)
- Notes added (`crm_lead_notes` — types: `note`, `call`, `email`, `task`, `status_change`, `system`)
- Tags applied (`crm_lead_tags`)
- Assigned to a team member (triggers notification)
- **Converted to an Opportunity** (see §2 below) — lead record stays, opportunity is created alongside

---

## 2. Opportunity

### What it is
An **Opportunity** (`pipeline_opportunities`) represents a qualified deal being actively pursued. It lives on the sales pipeline board.

### How it enters the system

#### Primary path — Convert from Lead
1. Sales rep or admin clicks "Convert to Opportunity" on a lead detail page.
2. `POST /api/pipeline/convert-lead/:leadId` (requires `admin` or `sales_rep`).
3. Server creates a `pipeline_opportunities` row with `leadId` pointing back to the source lead.
4. The new opportunity is placed in the default pipeline stage (`isDefault: true` on `pipeline_stages`).

#### Secondary path — Create directly
1. `POST /api/pipeline/opportunities` (requires `admin` or `sales_rep`).
2. No source lead required; `leadId` is nullable.

### Pipeline stages
Stages are configurable records in `pipeline_stages`. The 7 default stage slugs are:
`new-lead` → `contacted` → `demo-scheduled` → `demo-completed` → `payment-sent` → `closed-won` → `closed-lost`

Stages have `isClosed: boolean` and a `color` string. Only `admin` and `developer` may create/edit stages; only `admin` may delete them.

### Key fields
| Field | Meaning |
|-------|---------|
| `stageId` | Current stage (FK to `pipeline_stages`) |
| `status` | `open` / `won` / `lost` — overall opportunity outcome |
| `websitePackage` | `empieza` / `crece` / `domina` / null — the product tier being sold |
| `assignedTo` | FK to `user.id` — assignment notifications fire on change |
| `value` | Deal value as `numeric` |
| `probability` | 0–100 integer estimate |
| `expectedCloseDate` | Target close date |
| `nextActionDate` | When to follow up next |
| `stageEnteredAt` | Auto-set when stage changes (useful for time-in-stage analytics) |
| `sourceLeadTitle` | Snapshot of the lead title at conversion time |

### Stage movement
1. `PUT /api/pipeline/opportunities/:id/stage` — dedicated endpoint for stage moves.
2. `stageEnteredAt` is reset to `now()`.
3. A `pipeline_activities` record is written with type `stage_change`.
4. `notifyStageChange()` fires — opportunity owner + all admins receive an in-app notification.
5. `logAudit({ action: "stage_change", entity: "pipeline_opportunity", ... })` is called.

### What can happen to an Opportunity
- Stage moves (see above)
- Field updates (value, probability, dates, package tier)
- Activities logged (`pipeline_activities` — types: `stage_change`, `note`, `call`, `email`, `task`, `system`)
- Follow-up tasks attached (`followup_tasks` with `opportunityId`)
- **Converted to an Onboarding Record** when deal is won (see §3 below)

---

## 3. Onboarding Record

### What it is
An **Onboarding Record** (`onboarding_records`) tracks the client setup process after a deal is won. It replaces the need for a separate project management tool for standard onboarding.

### How it enters the system

#### Primary path — Convert from Opportunity
1. `POST /api/onboarding/convert-opportunity/:id` (requires `admin` or `sales_rep`).
2. Server creates an `onboarding_records` row with `opportunityId` pointing back.
3. If a `templateId` is provided (or a default template exists), checklist items are created from the template (`onboarding_checklist_items`).

#### Secondary path — Create directly
1. `POST /api/onboarding/records` — all three roles can create records.
2. `checklistItems` array can be provided inline at creation time.

### Statuses
`pending` → `in_progress` → `completed` / `on_hold`

Status changes trigger `notifyOnboardingStatusChange()` — admins and the assigned user are notified in-app.

### Key fields
| Field | Meaning |
|-------|---------|
| `clientName` | Display name for the onboarding record |
| `status` | Current lifecycle status |
| `opportunityId` | Source opportunity (nullable — can be standalone) |
| `companyId` / `contactId` | Links to CRM entities |
| `assignedTo` | FK to `user.id` — assignment notifications fire |
| `templateId` | FK to `onboarding_templates` — used at creation time |
| `kickoffDate` / `dueDate` | Timeline fields |
| `completedAt` | Set when status transitions to `completed` |

### Checklist
- Each record has an array of `onboarding_checklist_items`.
- Items belong to categories: `general`, `website`, `hosting`, `seo`, `ads`, `social`, `other`.
- Items have `isRequired` and `isCompleted` flags and optional `dueDate`.
- `PUT /api/onboarding/records/:id/checklist/:item` toggles completion.
- A `getProgress()` helper (SQL COUNT aggregate) computes completion percentages efficiently.

### Notes
Notes (`onboarding_notes`) track status changes, team comments, checklist updates, and system events. Types: `note`, `system`, `status_change`, `checklist_update`.

---

## 4. Client

### What it is
The **Clients** page (`/admin/clients`) is a read-only enriched view of `crm_companies`. A "client" in this context is any company record in the CRM, enriched with:
- Contact count (SQL subquery)
- Contact data (phone, email)
- Website

There is no separate "client" table. The `crmCompanies` table serves both prospects and active clients. The distinction is implied by whether the company has a `won` opportunity or a `completed` onboarding record.

### How companies enter the system
1. Auto-created when a contact form is submitted with a business name (via CRM ingest).
2. Manually created in the CRM companies list (`POST /api/crm/companies`).
3. Linked to leads and opportunities at creation or editing time.

---

## Entity Relationship Summary

```
contacts (website form submissions)
  │
  ├─→ crm_leads  ←──────────────── (manual creation)
  │       │
  │       ├── crm_lead_notes
  │       ├── crm_lead_tags
  │       └── followup_tasks (leadId)
  │       │
  │       └─→ pipeline_opportunities  ←─── (manual creation)
  │                   │
  │                   ├── pipeline_activities
  │                   ├── followup_tasks (opportunityId)
  │                   └─→ onboarding_records
  │                               │
  │                               ├── onboarding_checklist_items
  │                               └── onboarding_notes
  │
  ├─→ crm_companies  ←──────────── (manual creation or form ingest)
  │       │
  │       └── crm_contacts
  │
  └── (Clients page = enriched view of crm_companies)
```

---

## Notes on Immutability

- **Lead UTM/attribution fields** (`utmSource`, `utmMedium`, etc., `fromWebsiteForm`, `landingPage`) are excluded from `updateCrmLeadSchema`. They are write-once capture-time data.
- **`sourceLeadTitle`** on opportunities is a snapshot set at conversion; it is not kept in sync with the lead title.
- **`stageEnteredAt`** is managed by the server on stage change — it is not user-editable.
- **Onboarding `completedAt`** is set by the server when `status` transitions to `completed` — not by the client directly.
