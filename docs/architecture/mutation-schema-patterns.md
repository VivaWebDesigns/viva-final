# Mutation Schema Patterns

This document describes the validation approach used across all POST/PUT/PATCH API routes in the Viva Web Designs CRM/admin backend.

## General Rule

Every mutation route must validate `req.body` through an explicit Zod schema before any data reaches storage. No raw `req.body` is passed directly to storage functions.

## Schema Types

### Insert schemas (POST / create routes)

Defined in `shared/schema.ts` using `createInsertSchema` from `drizzle-zod`. Auto-generated fields (`id`, `createdAt`, `updatedAt`) are excluded via `.omit()`.

```ts
// shared/schema.ts
export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
  id: true, createdAt: true, updatedAt: true,
});
```

Used directly in route handlers:
```ts
const data = insertCrmLeadSchema.parse(req.body);
```

### Update schemas (PUT routes)

Defined locally in each `routes.ts` file using `z.object({...}).strict()`. Fields are listed explicitly — only the fields a user should be able to change are included. Unknown keys are rejected by `.strict()`.

```ts
const updateCrmLeadSchema = z.object({
  title: z.string().min(1).optional(),
  statusId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  // ...
}).strict();
```

### Why explicit update schemas rather than `.partial()` of insert?

- `.partial()` on insert schemas would allow updating fields like `companyId` or `fromWebsiteForm` that should be immutable after creation (e.g., UTM attribution fields on leads).
- Explicit schemas make the allowed surface area clear and auditable.
- `.strict()` rejects unknown keys, preventing mass-assignment of any DB column a client might guess.

## Coverage by Module

| Module | POST routes | PUT routes |
|--------|-------------|------------|
| CRM leads | `insertCrmLeadSchema` | `updateCrmLeadSchema` (local, strict) |
| CRM companies | `insertCrmCompanySchema` | `updateCrmCompanySchema` (local, strict) |
| CRM contacts | `insertCrmContactSchema` | `updateCrmContactSchema` (local, strict) |
| CRM tags | `insertCrmTagSchema` | N/A |
| CRM lead tags | N/A | `tagIdsSchema` — `{ tagIds: string[] }` |
| Pipeline stages | `insertPipelineStageSchema` | `updateStageSchema` (local, strict) |
| Pipeline opportunities | `insertPipelineOpportunitySchema` | `updateOpportunitySchema` (local, strict) |
| Pipeline activities | `insertPipelineActivitySchema` | N/A |
| Pipeline convert-lead | `convertLeadSchema` (local, strict) | N/A |
| Onboarding records | `createRecordSchema` (local, strict) | `updateRecordSchema` (local, strict) |
| Onboarding notes | `addNoteSchema` (local, strict) | N/A |
| Onboarding convert-opportunity | `convertOpportunitySchema` (local, strict) | N/A |
| Docs categories | `insertDocCategorySchema` | `updateDocCategorySchema` (local, strict) |
| Docs articles | `insertDocArticleSchema` | `updateDocArticleSchema` (local, strict) |
| Docs tags | `createDocTagSchema` (local, strict) | N/A |
| Docs article-tags | N/A | `articleTagsSchema` — `{ tagIds: string[] }` |
| Integrations | N/A | `updateIntegrationSchema` (local, strict) — only `enabled` + `settings` |
| Admin users | inline `z.object` | inline `z.object` |

## Immutability Notes

- **Lead attribution fields** (`utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `referrer`, `landingPage`, `formPageUrl`, `fromWebsiteForm`) are excluded from `updateCrmLeadSchema`. They are capture-time data and should not be edited after ingest.
- **Integration `provider`** is not in `updateIntegrationSchema`. Providers are seeded constants and must not be renamed at runtime.
- **Integration `configComplete` and `lastTested`** are managed exclusively by the `POST /:provider/test` endpoint. They are not externally settable via the update route.

## Validation Error Format

All routes return `{ message: string }` with HTTP 400 on validation failure. This is consistent with Zod's `.parse()` throwing a `ZodError` whose `.message` is the stringified validation error.

## Zod Version Note

`shared/schema.ts` uses `import { z } from "zod/v4"` (required by drizzle-zod 0.8.x).
All server route files use `import { z } from "zod"` (v3). These are compatible at runtime for `.parse()` and `.strict()` usage. See `client/src/lib/zodResolver.ts` for the frontend bridge.
