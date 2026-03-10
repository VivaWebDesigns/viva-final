# Audit Log Patterns

This document defines the canonical structure for audit log events written via `logAudit()` across all Viva Web Designs CRM/admin feature modules.

## Canonical Event Shape

```ts
logAudit({
  userId:    string | null,   // ID of the acting user (req.authUser?.id). Null for system/webhook events.
  action:    string,          // Verb describing what happened (see Action Vocabulary below)
  entity:    string,          // Entity type being acted on (see Entity Types below)
  entityId:  string | null,   // Primary key of the affected record
  metadata:  object | null,   // Context-specific payload (see per-entity metadata below)
  ipAddress: string | null,   // req.ip — always include on user-initiated routes
})
```

All fields are persisted to the `audit_logs` table. The `createdAt` timestamp is auto-populated by the database.

## Action Vocabulary

Use these exact strings for `action`. Consistent naming enables filtering by action in the audit log UI.

| action | meaning |
|--------|---------|
| `create` | A new record was created |
| `update` | An existing record was modified |
| `delete` | A record was permanently deleted |
| `create_user` | Admin created a new platform user |
| `update_user` | Admin modified a user's role, name, or banned status |
| `seed_admin` | Bootstrap: first admin account was created |
| `crm_lead_created` | A lead was ingested from a web form or external source |
| `stage_change` | A pipeline opportunity moved to a different stage |
| `convert_lead` | A CRM lead was promoted to a pipeline opportunity |
| `update` (integration) | Integration settings were updated |
| `test_integration` | A connectivity test was run against an integration provider |

## Entity Types

| entity | table |
|--------|-------|
| `user` | `user` |
| `crm_lead` | `crm_leads` |
| `crm_lead_note` | `crm_lead_notes` |
| `crm_lead_tags` | `crm_lead_tags` (join table) |
| `crm_company` | `crm_companies` |
| `crm_contact` | `crm_contacts` |
| `crm_tag` | `crm_tags` |
| `pipeline_stage` | `pipeline_stages` |
| `pipeline_opportunity` | `pipeline_opportunities` |
| `pipeline_activity` | `pipeline_activities` |
| `onboarding_record` | `onboarding_records` |
| `doc_category` | `doc_categories` |
| `doc_article` | `doc_articles` |
| `integration` | `integration_records` |

## Metadata Conventions

Keep metadata small and human-readable. Include the display name of the record, and for destructive/high-value operations include enough context to understand what was lost.

| entity + action | metadata keys |
|-----------------|---------------|
| `user` create_user | `{ email, role, name }` |
| `user` update_user | `{ role?, name?, banned? }` (only changed fields) |
| `user` seed_admin | `{ email }` |
| `crm_lead` create/update | `{ title }` |
| `crm_lead_note` create | `{ leadId, type }` |
| `crm_lead_tags` update | `{ tagIds }` |
| `crm_company` create/update | `{ name }` |
| `crm_contact` create/update | `{ name }` (full name string) |
| `crm_tag` create | `{ name }` |
| `crm_lead` crm_lead_created (ingest) | `{ source, contactId, companyId, isDuplicate, utmSource }` |
| `pipeline_stage` create/update/delete | `{ name }` |
| `pipeline_opportunity` create | `{ title }` |
| `pipeline_opportunity` update | `{ title }` |
| `pipeline_opportunity` stage_change | `{ fromStageId, fromStageName, toStageId, toStageName, newStatus }` |
| `pipeline_opportunity` convert_lead | `{ leadId, title }` |
| `pipeline_activity` create | `{ opportunityId, type }` |
| `onboarding_record` create | `{ clientName }` |
| `onboarding_record` update | `{ clientName, changes: { ...updatedFields } }` |
| `onboarding_record` delete | `{ clientName }` |
| `onboarding_record` create (from opportunity) | `{ fromOpportunity, clientName }` |
| `doc_category` create | `{ name }` |
| `doc_category` update | `{ name, slug }` |
| `doc_article` create/update | `{ title }` |
| `doc_article` delete | `{ title, slug }` |
| `integration` update | `{ provider }` |
| `integration` test_integration | `{ provider, result: "pass" \| "fail" }` |

## userId Rules

- **User-initiated routes**: always pass `userId: req.authUser?.id`
- **System/webhook events** (e.g., CRM ingest from web form): pass `userId: null` — no authenticated user
- **Bootstrap** (`seed_admin`): pass no `userId` — there is no acting user during initial setup

## ipAddress Rules

- Include `ipAddress: req.ip` on all user-initiated route handlers
- Omit on storage-layer calls (ingest, internal jobs) — no request context available

## Notes

- The `logAudit()` function swallows its own errors (`console.error` only) — audit failures never disrupt the primary operation
- `metadata` is `jsonb` in PostgreSQL — any serializable object is valid
- Do not include sensitive data (passwords, secrets, full PII) in metadata
