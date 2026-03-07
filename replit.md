# Viva Web Designs - Marketing Agency + Internal Platform

## Overview
Viva Web Designs is a marketing agency specializing in web design for contractors, with a primary focus on the Spanish-speaking market. The project involves a conversion-optimized public-facing website and an integrated internal CRM/admin platform. The platform is designed to streamline team operations, manage sales pipelines, handle client onboarding, and provide comprehensive reporting. The overarching vision is to deliver a robust solution that empowers contractors with a strong online presence and provides Viva Web Designs with efficient tools to manage their client base and internal workflows.

## User Preferences
- **Communication style**: Confident, professional, clear, direct, Spanish-first.
- **Content Language**: All marketing website copy should be in Spanish.
- **Naming Conventions**: NEVER mention "latinos" or "Google Ads" anywhere in copy.
- **Workflow**: Iterative development is preferred.
- **Deployment**: The `npm run dev` command starts Express + Vite on port 5000.

## System Architecture
The project is built with a modern web stack, separating frontend and backend concerns.

**Frontend:**
- **Technology**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- **Animations**: Framer Motion for UI animations.
- **Routing**: wouter for client-side routing.
- **UI/UX**:
    - **Branding**: Primary deep teal (#0D9488), accent emerald (#10B981), hover teal (#0F766E), gradient teal (#14B8A6), secondary deep charcoal (#111111), white (#FFFFFF), and light gray (#F5F5F5) for backgrounds. WhatsApp green (#25D366) is retained.
    - **Typography**: Plus Jakarta Sans (body), Montserrat (headings), Inter (fallback).
- **Content Management**: All marketing website copy is managed via `client/src/content/content.json` using utility functions like `t()`, `tArr()`, `tObjArr<T>()`, and `tBool()` for localized content retrieval.
- **Performance**:
    - Code splitting with `React.lazy` and `Suspense` (Home page is eager loaded).
    - Optimized video and images (WebP format, lazy loading).
    - Non-render-blocking Google Fonts.

**Backend:**
- **Technology**: Express.js, TypeScript.
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM.
- **Authentication**: BetterAuth with an admin plugin, supporting `admin`, `developer`, and `sales_rep` roles.
- **CRM Form-to-Lead Pipeline**: Handles public contact form submissions, performing Zod validation, honeypot spam checks, saving to a legacy contacts table, and then asynchronously ingesting into the CRM (deduplication, contact/company creation, lead creation with UTM attribution, system notes, audit logging, and notifications).
- **Notification System**: Server-side triggers for various events (e.g., new lead, assignment, status changes) delivering in-app and email notifications.

**Core Features:**
- **Marketing Website**: Public-facing pages for services, packages, contact, and demo showrooms. Includes specific demo sub-sites (`empieza`, `crece`, `domina`).
- **Internal Platform**:
    - **Admin Dashboard**: Overview of key metrics, recent leads, and quick actions.
    - **CRM**: Manages leads, companies, and contacts with detailed views, notes, and tagging capabilities.
    - **Sales Pipeline**: Kanban board and list views for opportunities, stages, and activity tracking.
    - **Client Onboarding**: Manages onboarding records, checklist items, and timelines using configurable templates.
    - **Documentation**: An internal knowledge base with categories, articles, tags, and revision history.
    - **Integrations Management**: Configuration for third-party services.
    - **Reporting**: Comprehensive analytics on leads, conversions, pipeline performance, onboarding, and notifications.
    - **Notifications Center**: In-app notification management with filtering and read/unread status.
    - **Audit Logs**: Tracks sensitive actions within the platform.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **BetterAuth**: For user authentication and authorization.
- **Resend**: For sending email notifications from the legacy contact form.
- **Mailgun**: For sending system-generated email notifications (requires `MAILGUN_API_KEY` and `MAILGUN_DOMAIN`).
- **Cloudflare R2**: Planned for file storage (foundation for billing and chat).
- **Stripe**: Planned for billing functionality.