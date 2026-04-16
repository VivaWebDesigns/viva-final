# Viva Web Designs — Internal Platform: Architecture Index

> Last updated: 2026-03-10

This directory contains internal architecture documentation for the Viva Web Designs CRM/admin platform. It is intended to orient new developers, guide consistent implementation, and prevent architectural drift.

---

## System Overview

The platform is a **full-stack TypeScript monorepo** with:

- **Backend**: Express + Drizzle ORM + PostgreSQL + BetterAuth
- **Frontend**: React 18 + Vite + TanStack Query v5 + Wouter
- **Auth**: BetterAuth sessions, cookie-based, server-validated on every API call
- **Shared types**: `shared/schema.ts` — single source of truth for DB tables, Zod schemas, and TypeScript types

The app serves two distinct user audiences:

| Audience | Entry point | Auth required? |
|----------|-------------|---------------|
| Internal team (admin, developer, sales_rep) | `/admin/*` routes | Yes |
| Prospects (external) | Demo preview pages (`/preview/empieza`, etc.) | No |

The Demo Builder at `/admin/demo-builder` generates links to preview pages for prospects. Preview pages are separate Vite entry points that read configuration from URL params + localStorage.

---

## Architecture Documents

| Document | What it covers |
|----------|---------------|
| [`README.md`](./README.md) | This file — system overview and index |
| [`role-matrix.md`](./role-matrix.md) | Full permission matrix: backend API + frontend routes + sidebar nav |
| [`data-lifecycle.md`](./data-lifecycle.md) | How leads, opportunities, onboarding records, and clients flow through the system |
| [`event-model.md`](./event-model.md) | Notification triggers, channels, email delivery, and audit log events |
| [`module-map.md`](./module-map.md) | Feature module boundaries, responsibilities, and inter-module dependencies |
| [`mutation-schema-patterns.md`](./mutation-schema-patterns.md) | Zod validation approach for POST/PUT routes |
| [`query-freshness-strategy.md`](./query-freshness-strategy.md) | TanStack Query `staleTime` tiers and cache invalidation patterns |
| [`audit-log-patterns.md`](./audit-log-patterns.md) | Canonical `logAudit()` call structure and per-entity metadata shapes |
| [`logging-policy.md`](./logging-policy.md) | What the server logs, what it redacts, and why |
| [`external-services-access.md`](./external-services-access.md) | GitHub, Railway, Mailgun, Cloudflare, and secret-handling reference |

---

## Quick-Reference: Stack Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                         │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────┐   │
│  │  Wouter      │  │ TanStack Query │  │ Shadcn/Radix UI   │   │
│  │  (routing)   │  │ (data layer)   │  │ + Tailwind v3     │   │
│  └──────────────┘  └────────────────┘  └───────────────────┘   │
│  client/src/features/<module>  ← feature-sliced layout          │
│  client/src/lib/queryClient.ts ← shared fetch + STALE tiers    │
├─────────────────────────────────────────────────────────────────┤
│  HTTP  (fetch → /api/*)  —  BetterAuth at /api/auth/*           │
├─────────────────────────────────────────────────────────────────┤
│  Express (server/index.ts)                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Auth middleware: requireAuth / requireRole              │   │
│  │  Feature routers: /api/<module>  →  routes.ts            │   │
│  │  Storage layer: storage.ts  (Drizzle ORM)               │   │
│  │  Side-effects: logAudit(), createNotification()          │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                     │
│  shared/schema.ts  ← single Drizzle schema for all tables      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Conventions

### Path Aliases
```
@/          →  client/src/
@features/  →  client/src/features/
@shared/    →  shared/
@assets/    →  attached_assets/
```

### Zod Split (important)
- `shared/schema.ts` uses `"zod/v4"` — required for `drizzle-zod` compatibility.
- All server route files use `"zod"` (v3) — for local update schema definitions.
- The two must not be mixed in the same file.

### Type Pattern (per entity)
```ts
// shared/schema.ts
export const insertFooSchema = createInsertSchema(foos).omit({ id: true, createdAt: true });
export type InsertFoo = z.infer<typeof insertFooSchema>;   // write side
export type Foo      = typeof foos.$inferSelect;           // read side
```

### Default Query Client
The global query client (`client/src/lib/queryClient.ts`) provides:
- Default `queryFn` that fetches `queryKey.join("/")` as a URL (credentials: "include").
- `retry: false`, `staleTime: Infinity` as safe defaults overridden per-query site.
- Named `STALE` constants: `NEVER / SLOW / MEDIUM / FAST / REALTIME` — always import these, never use magic numbers.
- On 401, the default queryFn throws (and queries land in error state). Use `on401: "returnNull"` variant for queries that are valid when unauthenticated.

### Admin Provisioning
First admin is seeded via `POST /api/admin/seed-admin` (requires `SEED_ADMIN_SECRET` header in production). Subsequent users are created through the Admin Settings page (`/admin/settings`).
