# Record History vs Audit Log

> Created: 2026-03-10

The platform maintains two separate append-only trails. They serve different audiences and have different schemas. This document clarifies why both exist and when to use each.

---

## `audit_logs` — Platform-level security trail

| Property | Value |
|---|---|
| Table | `audit_logs` |
| Written by | `logAudit()` in route handlers |
| Who can read | `admin` only (`GET /api/admin/audit-logs`) |
| Purpose | Compliance, security, "who did what from where" |
| Schema focus | `userId`, `action`, `entity`, `entityId`, `ipAddress`, `userAgent`, `metadata (jsonb)` |
| Retention | Permanent — no delete operations exist |

`audit_logs` answers: **"Which user performed which HTTP action, from which IP, at what time?"**

It is a security log. Every significant mutation (create, update, delete, bulk) calls `logAudit()` with the acting user and a free-form metadata blob. The blob may contain diffs, but the shape is unstructured.

---

## `record_history` — Business-process event trail

| Property | Value |
|---|---|
| Table | `record_history` |
| Written by | `appendHistorySafe()` in route handlers, non-blocking |
| Who can read | All authenticated roles (`GET /api/history/:entityType/:entityId`) |
| Purpose | UX timeline, business process awareness, overdue detection |
| Schema focus | `entityType`, `entityId`, `event`, `fieldName`, `fromValue`, `toValue`, `actorName`, `note` |
| Retention | Permanent — no delete operations |

`record_history` answers: **"What business events happened to this lead/opportunity/record, and in what order?"**

It is a UX-facing domain log. Events have typed `event` strings (e.g., `status_changed`, `converted`, `stage_changed`), structured `fromValue`/`toValue` fields for diffing, and a human-readable `actorName`. The frontend `RecordTimeline` component renders these events as a visual timeline on lead and opportunity detail pages.

### Non-blocking design

`appendHistorySafe()` wraps `appendHistory()` in a `try/catch` and does not `await` the result in critical paths. A history write failure **never** causes the primary API operation to fail. This mirrors the same pattern used for notification triggers.

---

## Summary

| Concern | Use `audit_logs` | Use `record_history` |
|---|---|---|
| Security / compliance | ✓ | |
| IP address tracking | ✓ | |
| Free-form metadata | ✓ | |
| Business event timeline (UX) | | ✓ |
| Structured field diffs | | ✓ |
| Visible to sales reps | | ✓ |
| Frontend `RecordTimeline` component | | ✓ |

Both tables are append-only. Neither has update or delete routes.
