# Event Model: Notifications & Audit Logs

> Last updated: 2026-03-10

This document describes the two event systems in the platform: the **notification system** (async, user-facing) and the **audit log** (persistent, admin-facing).

---

## Notification System

### Overview

Notifications are stored in the `notifications` table and optionally delivered by email via Mailgun. They are user-scoped (each notification has a `recipientId`).

### Trigger points

Notifications are fired as fire-and-forget side-effects inside route handlers, after the primary database mutation succeeds. All trigger functions are in `server/features/notifications/triggers.ts`.

| Trigger function | When it fires | Default channel | Recipients |
|-----------------|---------------|-----------------|------------|
| `notifyNewLead()` | Lead created via public form ingest | `both` (in-app + email) | All `admin` + `sales_rep` users |
| `notifyLeadAssignment()` | `assignedTo` set/changed on a lead | `both` | The newly assigned user |
| `notifyStageChange()` | Opportunity moves to a new pipeline stage | `in_app` | Opportunity owner + all `admin` users |
| `notifyOpportunityAssignment()` | `assignedTo` set/changed on an opportunity | `both` | The newly assigned user |
| `notifyOnboardingAssignment()` | `assignedTo` set/changed on an onboarding record | `both` | The newly assigned user |
| `notifyOnboardingStatusChange()` | Onboarding record status changes | `both` | All `admin` users + onboarding assignee |

### Notification types (schema constants)
```
new_lead | lead_assignment | stage_change | opportunity_assignment |
onboarding_assignment | onboarding_status | system_alert
```

### Delivery channels
```
in_app   — stored only; shown in NotificationCenterPage
email    — stored + sent via Mailgun asynchronously (fire-and-forget)
both     — stored + sent via Mailgun
```

### Email flow
1. `createNotification()` inserts the notification record with `emailStatus: "pending"`.
2. `sendEmailForNotification()` is called asynchronously (non-blocking, `.catch()`-guarded).
3. On success: `emailStatus → "sent"`, `sentAt` set.
4. On failure: `emailStatus → "failed"`, `failureReason` set.
5. If Mailgun is not configured: `emailStatus → "skipped"` (no email attempt).

### In-app notification API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/notifications` | Paginated list for the current user (filter by type, read status) |
| `GET /api/notifications/unread-count` | Unread count badge |
| `PUT /api/notifications/:id/read` | Mark single as read |
| `PUT /api/notifications/read-all` | Mark all as read for current user |
| `GET /api/notifications/preferences` | Get per-type opt-in preferences |
| `PUT /api/notifications/preferences` | Update preferences |

### Notification preferences
`notificationPreferences` records (`userId` + `type`) store per-user opt-in flags for `emailEnabled` and `inAppEnabled`. The notification service can check these before delivering (implementation detail — verify in `service.ts` if modifying).

### Adding a new trigger
1. Add a new function to `triggers.ts` following the existing pattern.
2. Import and call it in the relevant route handler, after the mutation succeeds, as a non-blocking `.catch()`-guarded call.
3. Use an existing `NotificationType` constant from `NOTIFICATION_TYPES` in schema, or add a new constant there.
4. Choose the appropriate channel (`in_app` for low-urgency, `both` for time-sensitive actions).

---

## Audit Log

### Overview

The audit log (`audit_logs`) provides a tamper-evident, time-ordered record of all significant mutations in the system. It is written synchronously within route handlers (not fire-and-forget), immediately after a successful database change.

The write function is `logAudit()` from `server/features/audit/service.ts`.

### Canonical call shape
```ts
await logAudit({
  userId:    req.authUser?.id,   // null for system events
  action:    "create",           // see Action Vocabulary below
  entity:    "crm_lead",         // see Entity Vocabulary below
  entityId:  lead.id,
  metadata:  { title: lead.title, source: lead.source },
  ipAddress: req.ip,
});
```

See [`audit-log-patterns.md`](./audit-log-patterns.md) for the full action vocabulary, entity vocabulary, and per-entity metadata shapes.

### Action vocabulary (standard strings)
| Action | Meaning |
|--------|---------|
| `create` | New record created |
| `update` | Existing record mutated |
| `delete` | Record permanently removed |
| `stage_change` | Opportunity moved to new pipeline stage |
| `create_user` | Admin created a platform user |
| `update_user` | Admin updated a user's role/status |
| `seed` | Admin ran a data seed operation |

### Entity vocabulary
`crm_lead` · `crm_company` · `crm_contact` · `crm_tag` · `pipeline_stage` · `pipeline_opportunity` · `pipeline_activity` · `onboarding_record` · `onboarding_checklist` · `onboarding_note` · `doc_category` · `doc_article` · `doc_tag` · `integration` · `user` · `followup_task`

### `metadata` content
`metadata` is a `jsonb` column. Each entity has an approved set of keys to include — see `audit-log-patterns.md`. **Never include PII (email, phone, message body) in metadata.**

### Audit log table indexes
```
audit_user_idx    on (userId)           — filter by acting user
audit_entity_idx  on (entity, entityId) — "show all changes to this record"
audit_created_idx on (createdAt)        — time-range queries
audit_action_idx  on (action)           — filter by action type
```

### Viewing audit logs
`GET /api/admin/audit-logs` — accessible to `admin` role only.

---

## Relationship Between the Two Systems

| | Audit Log | Notification |
|---|---|---|
| **Purpose** | Compliance / change history | Real-time user awareness |
| **Audience** | Admins (via admin panel) | Individual users (in-app + email) |
| **Persistence** | Permanent (never deleted) | Soft-state (can be read, future archival) |
| **Trigger** | Every successful mutation | Specific business events only |
| **Delivery** | DB write (sync) | DB write + optional email (async) |
| **PII** | Must not contain PII | Message strings are human-readable (avoid raw data) |

Both systems fire in the same route handler, in order:
```ts
const result = await storage.doMutation(data);
await logAudit({ ... });        // sync — audit always fires
notifyXxx(result).catch(...);   // async — notification is best-effort
```

This ordering means:
- A failed audit log write does not prevent the mutation from completing (it uses try/catch internally).
- A failed notification does not prevent either the mutation or the audit log.
- If the mutation fails, neither side-effect fires (they are placed after the await).
