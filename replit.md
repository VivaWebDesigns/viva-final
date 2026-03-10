# Viva Web Designs — Internal CRM / Admin Platform

## Overview
Viva Web Designs is a marketing agency specializing in home-service contractors, primarily targeting a Spanish-speaking audience with conversion-optimized demo sites. The project encompasses:
- A **public-facing agency website**.
- An **internal CRM/admin platform** for managing team operations, leads, sales, client onboarding, documentation, chat, reporting, and integrations.
- A **Demo Builder** that generates branded preview websites across three tiers (Empieza, Crece, Domina) and 17 trade categories, fully bilingual in English and Spanish.

The business vision is to streamline internal processes, enhance client acquisition and management, and provide robust, localized demo capabilities to support sales efforts.

## User Preferences
- **Communication Style**: Confident, professional, direct.
- **Language**: Spanish-first communication.
- **Brand Rules**: NEVER mention "latinos" or "Google Ads" in any copy.
- **Specific Asset Usage**: Always use the provided "Charlotte Painting Pro Logo" (`image_1_(5)_1772575534808_1773059817248.png`); do not replace it with the Viva logo.
- **Interaction**: Assume `admin` role for full access when performing tasks.

## System Architecture

### Frontend
- **Framework**: React with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Animation**: Framer Motion
- **Routing**: wouter

### Backend
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM

### Authentication
- **System**: BetterAuth with an admin plugin
- **Roles**: `admin`, `developer`, `sales_rep`

### Project Structure Highlights
- **`client/`**: Organizes frontend into `pages`, `features`, and distinct `preview` (Empieza, Crece, Domina) directories for the demo builder. `preview` contains trade templates and an auto-discovering image library.
- **`server/`**: Structured by `features` such as `admin`, `auth`, `crm`, `pipeline`, `onboarding`, `notifications`, `docs`, `chat`, `reports`, `integrations`, `audit`, and `clients`.
- **`shared/`**: Contains shared Drizzle schema and Zod validation schemas.

### Demo Builder — Preview System
- **Tiers**: Three distinct preview tiers (Empieza, Crece, Domina) implemented as separate Vite entry points and loaded in iframes.
- **Supported Trades**: 17 categories including `painting`, `plumbing`, `roofing`, `electrician`, `landscaping`, `hvac`, `general`, `housecleaner`, `pressurewashing`, `carpenter`, `floorinstaller`, `tileinstaller`, `fenceinstaller`, `deckbuilder`, `shedbuilder`, `concrete`, `treeservice`.
- **Bilingual Support**: Full EN/ES localization with dynamic `tradeNounES` and language-aware payload fields (`servicesEN/ES`, `reviewsEN/ES`). Uses a `tOverrides` pattern for content overriding.

### Demo Image Library
- **Mechanism**: Local curated images auto-discovered using Vite's `import.meta.glob`. New images are recognized on server restart without code changes.
- **Structure**: `client/src/preview/demo-images/<trade>/hero|gallery|support/`.
- **Priority**: Local curated images take precedence over stock images.
- **Randomization**: Hero and gallery image arrays are shuffled for varied presentation.

### Database Schema (Drizzle ORM)
- **Auth**: `user`, `session`, `account`, `verification`.
- **CRM**: `crm_companies`, `crm_contacts`, `crm_leads`, `crm_lead_notes`, `crm_tags`, `crm_lead_tags`, `crm_lead_statuses`.
- **Sales Pipeline**: `pipeline_stages`, `pipeline_opportunities`, `pipeline_activities`.
- **Client Onboarding**: `onboarding_templates`, `onboarding_records`, `onboarding_checklist_items`, `onboarding_notes`.
- **Documentation**: `doc_categories`, `doc_articles`, `doc_tags`, `doc_article_tags`, `doc_revisions`.
- **Notifications**: `notifications`.
- **Follow-up Tasks**: `followup_tasks` (linked to opportunities, leads, or contacts; tracks due dates and completion).
- **Team Chat**: `chat_messages`.
- **Notification Preferences**: `notification_preferences`.
- **Other**: `contacts`, `integration_records`, `audit_logs`.

### Sales Pipeline
- **7 Stage Slugs**: `new-lead`, `contacted`, `demo-scheduled`, `demo-completed`, `payment-sent`, `closed-won`, `closed-lost`.
- **Website Package Field**: `websitePackage` on opportunities (values: `empieza`/`crece`/`domina`/null).
- **Board Enrichment**: `getOpportunitiesByStage()` returns `contactMap` + `companyMap` for card display.
- **Charlotte Painting Pro** is the default Domina demo (uses asset `image_1_(5)_1772575534808_1773059817248.png`).

### Follow-up Task System
- Full CRUD task management linked to opportunities, leads, or contacts.
- **QuickTaskModal**: Reusable component at `client/src/components/QuickTaskModal.tsx` with preset timing options (1d/2d/5d/1w/2w/1mo/2mo/6mo/1yr/Custom).
- **TasksDueTodayPage**: Dashboard at `/admin/tasks` showing overdue + due-today sections with complete/reschedule actions.
- **Task sections** embedded in OpportunityDetailPage and LeadDetailPage right sidebars.
- **Pipeline board cards** show a "Task" button that opens QuickTaskModal.

### Performance Indexes
- Comprehensive database indexes added across all tables for hot query paths.
- `enrichTasks()` uses `inArray()` for efficient batch contact/company lookups.
- `getProgress()` uses SQL COUNT aggregate instead of full row fetch.

### API Routes
- **Public**: `POST /api/contacts`, `POST /api/inquiries`.
- **CRM (Protected)**: CRUD operations for leads, companies, and contacts.
- **Pipeline (Protected)**: CRUD for stages and opportunities.
- **Tasks (Protected)**: `GET/POST /api/tasks`, `PUT /api/tasks/:id`, `PUT /api/tasks/:id/complete`, `DELETE /api/tasks/:id`, `GET /api/tasks/due-today`, `GET /api/tasks/for-opportunity/:id`, `GET /api/tasks/for-lead/:id`.
- **Admin (Admin Role Only)**: User management (`/api/admin/users`).

### Admin Account Provisioning
- **Endpoint**: `POST /api/admin/seed-admin` for initial admin setup.
- **Security**: Requires `SEED_ADMIN_SECRET` header in production; uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from environment variables.

### Technical Implementations
- **Zod**: Used for schema validation, with a specific version for Drizzle ORM compatibility.
- **TypeScript Paths**: Configured aliases for modular imports.
- **Express Params**: Handled type casting for `req.params`.
- **`window.__PREVIEW__`**: Global object for preview configuration and overrides.
- **Query Caching**: Implemented `react-query` with named `STALE` tiers for optimized data freshness.
- **Logging**: Production-safe logging middleware to redact sensitive data and provide clear request tracing.
- **Audit Logging**: Consistent payload for tracking critical actions with detailed metadata.
- **API Validation**: Strict Zod schemas for all mutation routes to ensure data integrity.
- **Authorization**: Role-based access control (RBAC) enforced at both frontend (navigation, route guards) and backend (API middleware) levels. `developer` has read-only access to business data; `sales_rep` has full CRM/pipeline write access but no platform config access; `admin` has full access.

## External Dependencies
- **Authentication**: BetterAuth (custom implementation)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email Sending**:
    - Mailgun (for system notifications)
    - Resend (for legacy contact form)
- **Planned Integrations**:
    - Stripe (for billing)
    - OpenAI (scaffolded)
    - Cloudflare R2 (for file storage)
## Frontend Smoke Tests

### Running Tests
```bash
npx vitest run               # single run (CI-friendly)
npx vitest                   # watch mode
npx vitest run --reporter=verbose  # verbose output
```

### Framework & Setup
- **Runner**: Vitest (native Vite config sharing — same path aliases)
- **DOM**: happy-dom (lightweight, fast)
- **Component rendering**: @testing-library/react + @testing-library/jest-dom
- **API mocking**: msw (node server-side interceptors)
- **Config**: `vitest.config.ts` at project root

### File Layout
```
tests/
  setup.ts                       Global shims (matchMedia, ResizeObserver, jest-dom matchers)
  __mocks__/assetStub.ts         Stubs all @assets/* image imports → harmless string
  helpers/
    renderWithProviders.tsx      Wraps UI in fresh QueryClient + wouter Router per test
    session.ts                   Mock session shapes (ADMIN_SESSION, SALES_REP_SESSION, etc.)
    server.ts                    MSW node server instance
    handlers.ts                  Smart catch-all GET /api/* handler returning minimal valid data
  smoke/                         11 smoke test files (one per critical admin screen)
```

### Auth Mocking Pattern
Every test file mocks `@features/auth/authClient` at the module level:
```tsx
vi.mock("@features/auth/authClient", () => ({
  useSession: () => ADMIN_SESSION,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
```
For role-gating tests, use `vi.hoisted(() => vi.fn())` so the return value can be swapped per-test.

### Coverage
| Page | Test File | Key Assertions |
|---|---|---|
| Login | `smoke/login.test.tsx` | Email/password inputs + submit button present |
| Dashboard | `smoke/dashboard.test.tsx` | Renders headings without crashing |
| CRM Leads | `smoke/crm-leads.test.tsx` | Renders + search input |
| Pipeline Board | `smoke/pipeline-board.test.tsx` | Renders without crashing |
| Onboarding | `smoke/onboarding.test.tsx` | Renders + search input |
| Notifications | `smoke/notifications.test.tsx` | Renders without crashing |
| Reports | `smoke/reports.test.tsx` | Renders without crashing |
| Docs | `smoke/docs.test.tsx` | Renders without crashing |
| Clients | `smoke/clients.test.tsx` | Renders + search input |
| Admin Settings | `smoke/admin-settings.test.tsx` | Admin sees page; sales_rep/developer see "Access Denied" |
| Demo Builder | `smoke/demo-builder.test.tsx` | Renders + Business Name input present |
