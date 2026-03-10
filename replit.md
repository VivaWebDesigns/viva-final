# Viva Web Designs — Internal CRM / Admin Platform

## Overview
Viva Web Designs is a marketing agency focused on home-service contractors, targeting a Spanish-speaking audience with conversion-optimized demo sites. The project includes a public-facing agency website, an internal CRM/admin platform, and a Demo Builder. The CRM/admin platform manages team operations, leads, sales, client onboarding, documentation, chat, reporting, and integrations. The Demo Builder generates bilingual (EN/ES) preview websites across three tiers and 17 trade categories. The vision is to streamline operations, enhance client acquisition, and provide robust, localized demo capabilities.

## User Preferences
- **Communication Style**: Confident, professional, direct.
- **Language**: Spanish-first communication for the internal team.
- **Brand Rules**: NEVER mention "latinos" or "Google Ads" in any copy.
- **Phone**: (980) 949-0548
- **Specific Asset Usage**: Always use the provided "Charlotte Painting Pro Logo" (`image_1_(5)_1772575534808_1773059817248.png`); do not replace it with the Viva logo.
- **Interaction**: Assume `admin` role for full access when performing tasks.

## System Architecture

### Core Technologies
- **Frontend**: React with Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, wouter.
- **Backend**: Express.js, TypeScript, PostgreSQL, Drizzle ORM.
- **Authentication**: BetterAuth with an admin plugin, cookie-based sessions, and roles (`admin`, `developer`, `sales_rep`).

### Key Features and Design Decisions
- **Role-Based Access Control**: Granular permissions for `admin`, `developer`, and `sales_rep` across various modules (CRM, Pipeline, Onboarding, Chat, Reports, Billing, Settings, Docs).
- **Project Structure**: Clear separation of `client/` (pages, features, components) and `server/` (features, API routes), with a `shared/` module for Drizzle schemas and types.
- **Demo Builder**: Generates branded preview websites across three tiers (Empieza, Crece, Domina) and 17 trade categories, with full bilingual support. It integrates with the CRM to save `demoConfigs` linked to leads. Features a local image library for trade-specific images with priority over stock.
- **Database Schema**: Comprehensive Drizzle ORM schema covering authentication, CRM, sales pipeline, client onboarding, documentation, notifications, follow-up tasks, team chat, file attachments, billing, and demo configurations.
- **Team Chat System (Phase II + Rich Text Editor)**: Real-time socket-based communication via Socket.io (attached to the same HTTP server, single-port). Features channels, direct messages, unread tracking, message reactions, threading, message pinning, @mentions, and search. Socket.io auth middleware validates BetterAuth session cookie on connect; each user auto-joins `user:{id}` room for DM routing. Channel rooms: `channel:{id}`. Events: `chat:channel_message`, `chat:dm_message`, `chat:typing`, `chat:presence`. REST/polling is preserved as fallback (intervals reduced to 30-60s). New UI: socket connection indicator (Wifi/WifiOff icon), "+" New DM picker with online presence dots (green dot for online users), typing indicators. DM conversations query rewritten in Drizzle to fix pre-existing GROUP BY 500 error. Shared types in `shared/socket-types.ts`; socket server in `server/features/chat/socket.ts`; client hook in `client/src/hooks/useSocket.ts`. **Rich Text Editor**: The chat input uses a Tiptap-based rich text editor (`client/src/features/chat/RichTextEditor.tsx`) with Bold/Italic/Strikethrough/Link formatting, emoji picker (emoji-picker-react), Enter-to-send, and DOMPurify-based HTML sanitization. Messages are stored and rendered as sanitized HTML. The editor exposes a `RichTextEditorHandle` ref interface for programmatic control (clearEditor, insertMentionText, etc.). Placeholder updates dynamically when switching between channels and DMs via Tiptap extension manager. The `sanitizeHtml` utility is exported from `RichTextEditor.tsx` and used in both message rendering and before sending.
- **File Management**: Utilizes Cloudflare R2 for storage, abstracted via a `storage.ts` service with graceful fallback. Supports file uploads with metadata storage.
- **Stripe Billing Integration**: Handles Stripe webhooks and customer management. Credentials can be configured via the Integrations page (stored in `integrationRecords.settings` JSONB) or via environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). DB config takes precedence over env vars. A centralized `server/features/integrations/stripe-config.ts` service handles config precedence, secret masking, and connection testing. The Integrations page has a Stripe Configure dialog that saves credentials securely and shows masked key previews.
- **Reporting System**: Provides key metrics such as Conversion Rate, Pipeline Value, Win Rate, and Overdue Leads, with a dedicated service for metric queries.
- **Sales Pipeline**: Structured with 7 stages and includes a `websitePackage` field for opportunities.
- **Follow-up Task System**: Full CRUD task management linked to various entities, with quick task creation and a dashboard for due tasks.
- **Record History System**: Immutable event logging for entities like leads, opportunities, onboarding records, and client accounts, displayed via a `RecordTimeline` component.
- **Client Profile Workspace (Phase 2)**: Full account-management hub at `/admin/clients/:id` with 7 tabs — Overview, Notes, Contacts, Tasks, Files, Billing, Activity. Phase 2 additions: (1) Tasks tab — full CRUD follow-up task management scoped to clients via `companyId` FK on `followupTasks`; tasks are grouped by status (overdue/open/completed) with type badges. (2) Files tab — upload/list/delete attachments using the `POST /api/attachments/upload` endpoint with `entityType=client`; files show uploader, size, date, download link. (3) Billing tab — Stripe customer lookup, service overview panel with serviceTier/carePlanStatus/launchDate/renewalDate, editable billing notes. (4) Account Health section in Overview — new `crmCompanies` fields: `launchDate`, `renewalDate`, `websiteStatus`, `carePlanStatus`, `serviceTier`, `billingNotes`; saved via `PATCH /api/clients/:id/account`. Open task count badge on stats row navigates to Tasks tab. New API routes: `GET/POST /:id/tasks`, `PUT /:id/tasks/:taskId/complete`, `DELETE /:id/tasks/:taskId`, `GET /:id/billing`, `GET /:id/files`, `PATCH /:id/account`.
- **Overdue/SLA Detection**: Identifies stale leads, overdue opportunities, and onboarding items, with a visual indicator in the UI.
- **Lead-to-Opportunity Conversion**: API endpoint for converting leads, with checks for existing conversions and historical logging.
- **Docs Library**: Supports categories, tags, revision history, archiving, and markdown rendering for internal documentation.
- **Admin Account Provisioning**: Secure endpoint for initial admin setup using environment variables and a secret header.
- **Technical Considerations**: Uses Zod for validation (split versions for Drizzle compatibility), cookie-based BetterAuth sessions, TypeScript path aliases, and TanStack Query for caching with defined `STALE` tiers.

## External Dependencies

- **PostgreSQL**: Primary database.
- **BetterAuth**: Authentication system.
- **Cloudflare R2**: Object storage for file uploads.
- **Stripe**: Payment processing and billing.
- **Mailgun**: (Optional) Email notifications.