# Viva Web Designs — Internal CRM / Admin Platform

## Overview
This project is an internal operations platform for Viva Web Designs, a marketing agency. Its primary purpose is to streamline agency operations, particularly for serving Spanish-speaking home-service contractors. The platform includes a comprehensive Admin CRM/Pipeline for lead and client management, a Demo Builder for generating bilingual preview websites, and a public agency website.

The platform aims to enhance efficiency in lead management, sales processes, client onboarding, and team collaboration. The Demo Builder is a key feature, enabling rapid generation of localized preview sites across various service categories and tiers, which is crucial for their target market. The public agency site provides a professional online presence.

## User Preferences
- **NEVER** mention "latinos" or "Google Ads" in any copy.
- The Charlotte Painting Pro logo (`image_1_(5)_1772575534808_1773059817248.png`) should NEVER be replaced with the Viva logo.
- The brand phone number is **(980) 949-0548**.
- The `admin` role has full access across all modules.

## System Architecture

### UI/UX Decisions
The admin UI is fully bilingual (EN/ES) and uses React with Vite, Tailwind CSS, shadcn/ui, and Framer Motion for a modern, responsive, and interactive user experience. Routing is handled by wouter. The design prioritizes clarity and ease of use for internal agency staff.

### Technical Implementations
- **Frontend**: React + Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, wouter.
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL.
- **Authentication**: BetterAuth handles cookie-based sessions with roles: `admin`, `developer`, `sales_rep`, `lead_gen`.
- **Internationalization**: All admin UI supports English and Spanish, managed via `LanguageContext` and `localStorage`.
- **Data Fetching**: TanStack Query v5 with a pre-configured default fetcher. Cache keys use arrays for hierarchical invalidation. Mutations always invalidate relevant query keys.
- **Forms**: `useForm` with `zodResolver` and shadcn `Form` components, always providing `defaultValues`.
- **Search**: Implemented with a `useDebounce` hook (300ms) to optimize performance across list pages, resetting pagination on debounced search changes.
- **Role-Based Access**: `isRestricted()` function limits `sales_rep` and `lead_gen` roles to viewing only entities they own.
- **Performance Optimizations**:
    - Aggregations on `/api/clients` use grouped `LEFT JOIN`s instead of correlated subqueries.
    - Pipeline board grouping uses a single-pass `Map` for O(n) performance.
    - `refetchOnWindowFocus: true` for profile hooks ensures data freshness.
    - Timeline deduping shares query keys to prevent redundant HTTP calls.

### Feature Specifications
- **Admin CRM/Pipeline**:
    - **Sales Pipeline**: Features 7 stages from "New Lead" to "Closed – Won/Lost". Opportunity detail pages display website package badges (Empieza/Crece/Domina) and task follow-ups. Forecasting fields are database-only and hidden from the UI.
    - **CRM Lead Creation**: Manual lead creation via a modal atomically creates contact, company, CRM lead, and a pipeline opportunity in the "new-lead" stage.
    - **Follow-up Task System**: Tasks are linked polymorphically to `opportunityId`, `leadId`, `contactId`, or `companyId`. Includes `QuickTaskModal` with presets and a "Tasks Due Today" page.
    - **Stage-Based Task Automations**: Admin-configurable templates automatically generate tasks when opportunities enter specific pipeline stages, leveraging `stage_automation_templates` and `automation_execution_logs`.
- **Demo Builder**: Generates bilingual (EN/ES) preview sites across three tiers and 17 trade categories.
- **Team Chat**: Socket.io-based chat supporting `general`, `sales`, `onboarding`, `dev` channels and direct messages, with rich text editing via Tiptap.
- **Unified Profile Architecture**: A cross-domain service layer (`server/features/profiles/`) aggregates a canonical view of client accounts from all related entities. It provides REST endpoints for company, lead, and opportunity profiles, with role-based access control and UUID validation.
    - **Frontend Hooks**: `useUnifiedProfile` and `useProfileTimeline` fetch and display profile data with optimized caching (`PROFILE_KEYS`) and invalidation.
    - **`ProfileShell`**: A reusable tabbed UI component for displaying unified client profiles, offering sections for Overview, Timeline, Tasks, Files, and Service (billing + onboarding), each with dedicated edit dialogs.
    - **ClientProfilePage**: Adapts the `UnifiedProfileDto` to the legacy `ClientProfile` type for existing client account pages.

### Stage-Based Task Automations
Admin-configurable task templates that auto-generate tasks when opportunities enter specific pipeline stages.
- **Tables**: `stage_automation_templates`, `automation_execution_logs`
- **API**: `/api/automations/templates` (CRUD), `/api/automations/execution-logs` — admin-only
- **Trigger stages**: Uses `pipeline_stages.slug` values: `new-lead`, `contacted`, `demo-scheduled`, `demo-completed`, `payment-sent`, `closed-won`, `closed-lost`
- **Shared types**: `AUTOMATION_TRIGGER_STAGES`, `AUTOMATION_PRIORITIES`, `AUTOMATION_EXEC_STATUSES` in `shared/schema.ts`
- **Service**: `server/features/automations/` — storage.ts (Drizzle CRUD), routes.ts (Express), trigger.ts (stage-change trigger), index.ts
- **Trigger service** (`trigger.ts`): `executeStageAutomations()` — fetches active templates, checks for duplicates via execution logs, creates follow-up tasks, logs each execution. Fire-and-forget (`.catch()`) so it never blocks the parent route.
- **Trigger integration points** (in `server/features/pipeline/routes.ts`):
  1. `PUT /opportunities/:id/stage` — Pipeline Board drag-drop and detail page stage change
  2. `PUT /opportunities/:id` — General opportunity update when `stageId` changes
  3. `POST /convert-lead/:leadId` — Lead conversion (initial stage entry)
- **Duplicate prevention**: Checks `automationExecutionLogs` for existing `success` entry with same `opportunityId + templateId + triggerStageSlug`
- **Admin UI**: Admin Settings > Automations tab — `client/src/features/admin/pages/AutomationsTab.tsx`
- **i18n**: Full EN/ES under `t.automations.*`

### System Design Choices
- **Database Seed Strategy**: Idempotent seeding on startup for core data (users, stages, templates, integrations). Structural seeds use upserts. Dev-only fake data is separate.
- **Data-testid Attributes**: Every interactive and meaningful display element includes a descriptive `data-testid` for robust testing.
- **File Structure**: Organized into `client/src/features`, `client/src/components`, `client/src/hooks`, `client/src/i18n`, `client/src/pages` for the frontend, and `server/features`, `shared` for the backend and shared schemas. The `profiles` feature is a core cross-domain module.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Cloudflare R2**: Object storage for file uploads.
- **Stripe**: Payment processing, including webhooks and customer management.
- **Mailgun**: Optional for email notifications.
- **Socket.io**: Real-time communication for the team chat feature.