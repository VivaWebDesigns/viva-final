# Viva Web Designs — Internal CRM / Admin Platform

## Overview
This project is an internal operations platform for Viva Web Designs, a marketing agency specializing in serving Spanish-speaking home-service contractors. It aims to streamline lead and client management, sales, client onboarding, and team collaboration. Key components include a comprehensive Admin CRM/Pipeline, a Demo Builder for generating bilingual preview websites, and a public agency website. The platform's strategic goal is to significantly enhance operational efficiency and market responsiveness.

## User Preferences
- **NEVER** mention "latinos" or "Google Ads" in any copy.
- The Charlotte Painting Pro logo (`image_1_(5)_1772575534808_1773059817248.png`) should NEVER be replaced with the Viva logo.
- The brand phone number is **(980) 949-0548**.
- The `admin` role has full access across all modules.

## System Architecture

### UI/UX Decisions
The admin UI is fully bilingual (EN/ES), built with React, Vite, Tailwind CSS, shadcn/ui, and Framer Motion for a modern, responsive, and interactive experience. Routing uses wouter. The design emphasizes clarity and ease of of use for internal agency staff.

### Technical Implementations
- **Frontend**: React + Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, wouter.
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL.
- **Authentication**: BetterAuth for cookie-based sessions with roles: `admin`, `developer`, `sales_rep`, `lead_gen`.
- **Internationalization**: Full English and Spanish support via `LanguageContext` and `localStorage`.
- **Data Fetching**: TanStack Query v5 with array-based cache keys for hierarchical invalidation. Mutations invalidate relevant query keys.
- **Forms**: `useForm` with `zodResolver` and shadcn `Form` components, utilizing `defaultValues`.
- **Search**: `useDebounce` hook (300ms) for optimized performance on list pages, resetting pagination on debounced changes.
- **Role-Based Access**: `isRestricted()` function limits `sales_rep` and `lead_gen` to their owned entities.
- **Performance Optimizations**: Aggregations use grouped `LEFT JOIN`s, pipeline board grouping uses a single-pass `Map`, `refetchOnWindowFocus` for profile hooks, and timeline deduping shares query keys.

### Feature Specifications
- **Admin CRM/Pipeline**: Manages leads and clients through a 7-stage sales pipeline. Includes manual lead creation, polymorphic follow-up task system with presets, and admin-configurable stage-based task automations.
- **Demo Builder**: Generates bilingual (EN/ES) preview sites across three tiers and 17 trade categories.
- **Team Chat**: Socket.io-based chat with `general`, `sales`, `onboarding`, `dev` channels and direct messages, featuring rich text editing via Tiptap.
- **Unified Profile Architecture**: A cross-domain service layer (`server/features/profiles/`) aggregates a canonical view of client accounts. Provides REST endpoints with role-based access and UUID validation.
    - **Frontend Hooks**: `useUnifiedProfile` and `useProfileTimeline` with optimized caching and invalidation.
    - **`ProfileShell`**: A tabbed profile viewer supporting company, lead, and opportunity entries, displaying quick stats, stage movement, notes, contacts, tasks, files, billing, and activity timeline.
    - **Profile Sub-resource Reads & Writes**: All tab fetches and cross-domain mutations are owned by the profile layer.
    - **Query Optimizations**: Reduced database queries from 18 to 13 across 4 sequential waves by consolidating queries, parallelizing fetches, and capping large result sets. Introduced `BOARD_CARD_COLUMNS` projection for pipeline board and paginated timeline endpoint for infinite scroll.
- **Typed Error Semantics**: Features a hierarchical error class structure (`ProfileError` and subclasses) with specific HTTP status codes and a centralized error handler for consistent and informative API responses, including handling for "orphaned" opportunities.

### System Design Choices
- **Database Seed Strategy**: Idempotent seeding on startup for core data, with separate dev-only fake data.
- **Data-testid Attributes**: Comprehensive `data-testid` attributes for robust testing.
- **File Structure**: Organized `client/src/features`, `client/src/components`, `client/src/hooks`, `client/src/i18n`, `client/src/pages` for frontend, and `server/features`, `shared` for backend and shared schemas. The `profiles` feature is a core cross-domain module.
- **Testing Architecture**: Three layers of testing (Unit, Integration, Smoke/E2E) with clear separation and conventions, including hermetic unit tests with call-sequence mocking for Drizzle ORM.

## External Dependencies
- **PostgreSQL**: Primary application database.
- **Cloudflare R2**: Object storage for file uploads.
- **Stripe**: Payment processing.
- **Socket.io**: Real-time communication.