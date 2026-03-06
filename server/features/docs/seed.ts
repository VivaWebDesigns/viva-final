import { db } from "../../db";
import { docCategories, docArticles } from "@shared/schema";
import { eq } from "drizzle-orm";

const CATEGORIES = [
  { name: "Getting Started", slug: "getting-started", description: "Quick-start guides and onboarding", sortOrder: 0 },
  { name: "Architecture Overview", slug: "architecture-overview", description: "System design and technical architecture", sortOrder: 1 },
  { name: "Authentication & Authorization", slug: "auth", description: "Login, sessions, roles, and permissions", sortOrder: 2 },
  { name: "Users, Roles & Permissions", slug: "users-roles-permissions", description: "User management and RBAC", sortOrder: 3 },
  { name: "CRM / Leads", slug: "crm-leads", description: "Customer relationship management and lead tracking", sortOrder: 4 },
  { name: "Sales Pipeline", slug: "sales-pipeline", description: "Sales workflow and deal tracking", sortOrder: 5 },
  { name: "Client Onboarding", slug: "client-onboarding", description: "New client setup workflows", sortOrder: 6 },
  { name: "Team Chat", slug: "team-chat", description: "Internal team communication", sortOrder: 7 },
  { name: "Payments & Billing", slug: "payments-billing", description: "Stripe integration and invoicing", sortOrder: 8 },
  { name: "Notifications & Mailgun", slug: "notifications-mailgun", description: "Email and notification systems", sortOrder: 9 },
  { name: "Contact Forms / Lead Intake", slug: "contact-forms", description: "Public form submissions and lead capture", sortOrder: 10 },
  { name: "Integrations", slug: "integrations", description: "Third-party service connections", sortOrder: 11 },
  { name: "Admin Tools", slug: "admin-tools", description: "Internal administration features", sortOrder: 12 },
  { name: "Developer Tools", slug: "developer-tools", description: "Development utilities and debugging", sortOrder: 13 },
  { name: "Database Schema", slug: "database-schema", description: "Table definitions and relationships", sortOrder: 14 },
  { name: "API Reference", slug: "api-reference", description: "Backend endpoint documentation", sortOrder: 15 },
  { name: "UI / Frontend Modules", slug: "ui-frontend", description: "React components and frontend architecture", sortOrder: 16 },
  { name: "Background Jobs / System Automation", slug: "background-jobs", description: "Scheduled tasks and automated processes", sortOrder: 17 },
  { name: "Deployment / DevOps", slug: "deployment-devops", description: "Build, deploy, and infrastructure", sortOrder: 18 },
  { name: "Changelog / Release Notes", slug: "changelog", description: "Version history and release notes", sortOrder: 19 },
  { name: "Known Issues / Technical Debt", slug: "known-issues", description: "Tracked issues and improvement areas", sortOrder: 20 },
];

const SEED_ARTICLES = [
  {
    title: "Architecture Overview",
    slug: "architecture-overview",
    categorySlug: "architecture-overview",
    status: "published",
    content: `# Architecture Overview

## Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Express.js + TypeScript + Node.js
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: BetterAuth with admin plugin
- **Storage**: Cloudflare R2 (planned)

## Project Structure
\`\`\`
├── client/src/           # Frontend (Vite root)
│   ├── features/         # Feature-based modules (auth, admin, docs, integrations)
│   ├── layouts/          # Layout components (AdminLayout)
│   ├── pages/            # Marketing site pages
│   ├── components/       # Shared UI components
│   ├── empieza/          # Empieza demo sub-site
│   ├── crece/            # Crece demo sub-site
│   └── domina/           # Domina demo sub-site
├── server/               # Backend
│   ├── features/         # Domain-based server features
│   │   ├── auth/         # Authentication (BetterAuth, middleware)
│   │   ├── admin/        # Admin stats and audit logs
│   │   ├── docs/         # App Docs CRUD
│   │   ├── integrations/ # Integration management
│   │   └── audit/        # Audit logging service
│   ├── routes.ts         # Route aggregator
│   ├── storage.ts        # Legacy contact storage
│   └── db.ts             # Database connection
└── shared/               # Shared types and schemas
    └── schema.ts         # Drizzle schema + Zod validation
\`\`\`

## Key Design Decisions
1. **Feature-based organization**: Server and client code organized by domain, not by type
2. **Non-destructive**: Internal platform coexists with the public marketing site
3. **Role-based access**: Admin, Developer, and Sales Rep roles with granular permissions
4. **Audit trail**: All sensitive actions logged for compliance`,
  },
  {
    title: "RBAC / Permissions Overview",
    slug: "rbac-permissions",
    categorySlug: "auth",
    status: "published",
    content: `# Role-Based Access Control (RBAC)

## Roles
| Role | Description | Access Level |
|------|-------------|-------------|
| **admin** | Full system access | Everything |
| **developer** | Technical access | App Docs, Integrations, Dev Tools |
| **sales_rep** | Sales operations | Dashboard, CRM, Pipeline, Payments |

## Protected Routes
- \`/admin/*\` — Requires authentication (any role)
- \`/admin/docs/*\` — Admin + Developer only
- \`/admin/integrations\` — Admin + Developer only
- \`/admin/settings\` — Admin only
- \`/api/admin/audit-logs\` — Admin only

## Implementation
- BetterAuth \`admin\` plugin manages role assignment
- \`requireAuth\` middleware validates session via BetterAuth API
- \`requireRole(...roles)\` middleware checks user role after auth
- Default role for new users: \`sales_rep\`

## Middleware Usage
\`\`\`typescript
// Any authenticated user
router.get("/stats", requireAuth, handler);

// Specific roles
router.get("/docs", requireRole("admin", "developer"), handler);
\`\`\``,
  },
  {
    title: "Admin Shell / Navigation",
    slug: "admin-shell-navigation",
    categorySlug: "admin-tools",
    status: "published",
    content: `# Admin Shell & Navigation

## Layout
The admin interface uses \`AdminLayout.tsx\` which provides:
- Collapsible sidebar with navigation
- Top bar with user info and sign out
- Main content area with breadcrumbs
- Mobile-responsive drawer

## Navigation Sections
| Section | Route | Icon | Access |
|---------|-------|------|--------|
| Dashboard | /admin | LayoutDashboard | All |
| CRM | /admin/crm | Users | All |
| Sales Pipeline | /admin/pipeline | TrendingUp | All |
| Client Onboarding | /admin/onboarding | UserPlus | All |
| Team Chat | /admin/chat | MessageSquare | All |
| Payments | /admin/payments | CreditCard | All |
| Notifications | /admin/notifications | Bell | All |
| Integrations | /admin/integrations | Puzzle | Admin, Dev |
| Reports | /admin/reports | BarChart3 | All |
| Admin | /admin/settings | Settings | Admin |
| App Docs | /admin/docs | BookOpen | Admin, Dev |`,
  },
  {
    title: "App Docs System Overview",
    slug: "app-docs-overview",
    categorySlug: "developer-tools",
    status: "published",
    content: `# App Docs System

## Purpose
Internal documentation library for the Viva Web Designs platform. Accessible to Admin and Developer roles.

## Features
- Category-based organization with sidebar navigation
- Full-text search across titles and content
- Markdown content support
- Metadata: author, last updated, status
- Revision history for articles
- Tag system for cross-cutting topics

## Database Tables
- \`doc_categories\` — Category definitions with sort order
- \`doc_articles\` — Article content with category and author links
- \`doc_tags\` — Tag definitions
- \`doc_article_tags\` — Many-to-many join table
- \`doc_revisions\` — Content history (auto-created on edit)

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/docs/categories | List all categories |
| POST | /api/docs/categories | Create category |
| GET | /api/docs/articles | List articles (filter by category, search) |
| GET | /api/docs/articles/:slug | Get article by slug |
| POST | /api/docs/articles | Create article |
| PUT | /api/docs/articles/:id | Update article (auto-creates revision) |
| DELETE | /api/docs/articles/:id | Delete article |
| GET | /api/docs/tags | List all tags |`,
  },
  {
    title: "Integrations System Overview",
    slug: "integrations-overview",
    categorySlug: "integrations",
    status: "published",
    content: `# Integrations System

## Supported Integrations
| Provider | Purpose | Status |
|----------|---------|--------|
| **Stripe** | Payment processing | Planned |
| **Mailgun** | Transactional email | Planned |
| **OpenAI** | AI text generation | Planned |
| **Cloudflare R2** | Object/file storage | Planned |

## Features
- Enable/disable toggle per integration
- Configuration completeness indicator
- Last tested/validated timestamp
- Provider-specific settings (JSON)
- Documentation links

## Database Table: \`integration_records\`
| Column | Type | Description |
|--------|------|-------------|
| provider | text | Provider name (unique) |
| enabled | boolean | Active status |
| config_complete | boolean | Configuration completeness |
| last_tested | timestamp | Last validation |
| settings | jsonb | Provider-specific config |

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/integrations | List all integrations |
| GET | /api/integrations/:provider | Get specific integration |
| PUT | /api/integrations/:id | Update integration |`,
  },
  {
    title: "Database Schema Reference",
    slug: "database-schema-reference",
    categorySlug: "database-schema",
    status: "published",
    content: `# Database Schema Reference

## Tables

### contacts (existing)
Lead capture from public forms.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| name | text | Required |
| email | text | |
| phone | text | Required |
| business, city, trade, service, message | text | Optional |
| created_at | timestamp | Auto |

### user (BetterAuth)
Internal platform users.
| Column | Type | Notes |
|--------|------|-------|
| id | text | Primary key |
| name, email | text | Required |
| email_verified | boolean | |
| role | text | admin, developer, sales_rep |
| image | text | Avatar URL |

### session, account, verification (BetterAuth)
Managed by BetterAuth for authentication.

### audit_logs
| Column | Type | Notes |
|--------|------|-------|
| id | varchar (UUID) | Primary key |
| user_id | text | FK → user |
| action | text | create, update, delete, etc. |
| entity | text | Table/resource name |
| entity_id | text | Affected record ID |
| metadata | jsonb | Additional context |
| ip_address | text | Request IP |

### doc_categories, doc_articles, doc_tags, doc_article_tags, doc_revisions
Documentation system tables. See App Docs System Overview.

### integration_records
Third-party integration configuration. See Integrations System Overview.`,
  },
  {
    title: "API Routes Reference",
    slug: "api-routes-reference",
    categorySlug: "api-reference",
    status: "published",
    content: `# API Routes Reference

## Public Endpoints (No Auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contacts | Submit contact form |
| POST | /api/inquiries | Submit demo inquiry |
| ALL | /api/auth/* | BetterAuth endpoints (login, signup, session) |

## Protected Endpoints (Require Auth)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/auth/me | Any | Current user info |
| POST | /api/auth/seed-admin | Public* | Create initial admin user |
| GET | /api/admin/stats | Any | Dashboard statistics |
| GET | /api/admin/audit-logs | Admin | Audit log viewer |

## Docs Endpoints (Admin + Developer)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/docs/categories | List categories |
| POST | /api/docs/categories | Create category |
| PUT | /api/docs/categories/:id | Update category |
| GET | /api/docs/articles | List/search articles |
| GET | /api/docs/articles/:slug | Get article |
| POST | /api/docs/articles | Create article |
| PUT | /api/docs/articles/:id | Update article |
| DELETE | /api/docs/articles/:id | Delete article |
| GET | /api/docs/tags | List tags |
| POST | /api/docs/tags | Create tag |

## Integrations Endpoints (Admin + Developer)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/integrations | List integrations |
| GET | /api/integrations/:provider | Get integration |
| PUT | /api/integrations/:id | Update integration |`,
  },
  {
    title: "Environment Variables",
    slug: "environment-variables",
    categorySlug: "deployment-devops",
    status: "published",
    content: `# Environment Variables

## Required
| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| BETTER_AUTH_SECRET | BetterAuth session secret (min 32 chars) |

## Optional
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| RESEND_API_KEY | Resend email API key | — |
| BETTER_AUTH_URL | Base URL for auth | http://localhost:5000 |

## Planned (for integrations)
| Variable | Description |
|----------|-------------|
| STRIPE_SECRET_KEY | Stripe API key |
| MAILGUN_API_KEY | Mailgun API key |
| OPENAI_API_KEY | OpenAI API key |
| CLOUDFLARE_R2_ACCESS_KEY | R2 access key |
| CLOUDFLARE_R2_SECRET_KEY | R2 secret key |
| CLOUDFLARE_R2_BUCKET | R2 bucket name |
| CLOUDFLARE_R2_ENDPOINT | R2 endpoint URL |`,
  },
  {
    title: "v1.0 — Foundation Release",
    slug: "v1-foundation-release",
    categorySlug: "changelog",
    status: "published",
    content: `# v1.0 — Foundation Release

**Date**: March 2026

## What's New
- BetterAuth authentication with email/password login
- Role-based access control (Admin, Developer, Sales Rep)
- Protected admin shell with sidebar navigation
- App Docs library with categories, articles, tags, and revisions
- Integrations overview with Stripe, Mailgun, OpenAI, and Cloudflare R2
- Audit logging for sensitive actions
- Feature-based file organization (client and server)

## Database Tables Added
- user, session, account, verification (BetterAuth)
- audit_logs
- doc_categories, doc_articles, doc_tags, doc_article_tags, doc_revisions
- integration_records

## Admin Navigation Sections (Placeholder)
Dashboard, CRM, Sales Pipeline, Client Onboarding, Team Chat,
Payments, Notifications, Integrations, Reports, Admin, App Docs

## Technical Notes
- All existing marketing site functionality preserved
- Non-destructive architecture extension
- Modular feature-based code organization`,
  },
];

export async function seedDocs() {
  const categoryMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const existing = await db.select().from(docCategories).where(eq(docCategories.slug, cat.slug));
    if (existing.length > 0) {
      categoryMap.set(cat.slug, existing[0].id);
      continue;
    }
    const [created] = await db.insert(docCategories).values(cat).returning();
    categoryMap.set(cat.slug, created.id);
  }

  for (const article of SEED_ARTICLES) {
    const existing = await db.select().from(docArticles).where(eq(docArticles.slug, article.slug));
    if (existing.length > 0) continue;

    const categoryId = categoryMap.get(article.categorySlug);
    await db.insert(docArticles).values({
      title: article.title,
      slug: article.slug,
      content: article.content,
      categoryId: categoryId || null,
      status: article.status,
    });
  }

  return { categories: CATEGORIES.length, articles: SEED_ARTICLES.length };
}
