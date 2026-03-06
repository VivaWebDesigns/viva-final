# Viva Web Designs - Marketing Agency + Internal Platform

## Overview
Marketing agency website targeting contractors (Spanish-first, conversion-optimized) with an internal CRM/admin platform for team operations.

## Brand
- **Company**: Viva Web Designs
- **Colors**: Primary deep teal (#0D9488, hsl 175 85% 30%), accent emerald (#10B981), hover teal (#0F766E), gradient teal (#14B8A6), secondary deep charcoal (#111111), backgrounds white (#FFFFFF) and light gray (#F5F5F5). WhatsApp green (#25D366) unchanged.
- **Fonts**: Plus Jakarta Sans (body), Montserrat (headings), Inter (fallback)
- **Tone**: Confident, professional, clear, direct, Spanish-first
- **Rules**: NEVER mention "latinos" or "Google Ads" anywhere in copy

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + wouter
- **Backend**: Express.js + TypeScript + PostgreSQL + Drizzle ORM
- **Authentication**: BetterAuth with admin plugin (email/password)
- **Roles**: admin, developer, sales_rep

### Project Structure
```
├── client/src/
│   ├── features/           # Internal platform features
│   │   ├── auth/           # Login, auth client, protected routes
│   │   ├── admin/pages/    # Dashboard + placeholder pages
│   │   ├── docs/           # App Docs library (CRUD)
│   │   └── integrations/   # Integrations overview
│   ├── layouts/            # AdminLayout (sidebar shell)
│   ├── pages/              # Marketing site pages
│   ├── components/         # Shared UI components
│   ├── content/            # Content system (content.json)
│   ├── empieza/            # Empieza demo sub-site
│   ├── crece/              # Crece demo sub-site
│   └── domina/             # Domina demo sub-site
├── server/
│   ├── features/           # Domain-based server features
│   │   ├── auth/           # BetterAuth config + middleware
│   │   ├── admin/          # Admin stats, seed, audit logs
│   │   ├── docs/           # Docs CRUD + seed data
│   │   ├── integrations/   # Integration records + seed
│   │   └── audit/          # Audit logging service
│   ├── routes.ts           # Route aggregator (mounts features + legacy)
│   ├── storage.ts          # Legacy contact storage
│   └── db.ts               # Database connection
└── shared/
    └── schema.ts           # All Drizzle schemas + Zod validation
```

## Content System
All marketing website copy managed from `client/src/content/content.json`.
- `t("dotted.path")` — returns the Spanish `"es"` string
- `tArr("dotted.path")` — returns array of Spanish strings
- `tObjArr<T>("dotted.path")` — returns typed array of objects
- `tBool("dotted.path")` — returns boolean value

## Database Tables
- **contacts** — Lead capture from public forms
- **user** — Internal platform users (BetterAuth + role)
- **session** — Auth sessions (BetterAuth)
- **account** — Auth accounts (BetterAuth)
- **verification** — Email verification (BetterAuth)
- **audit_logs** — Sensitive action audit trail
- **doc_categories** — Doc library categories (21 seeded)
- **doc_articles** — Doc articles with content
- **doc_tags** — Tag definitions
- **doc_article_tags** — Article-tag join table
- **doc_revisions** — Content revision history
- **integration_records** — Third-party integration config (Stripe, Mailgun, OpenAI, Cloudflare R2)

## Key Routes
### Marketing (Public)
- `/` — Home, `/paquetes` — Packages, `/contacto` — Contact, `/demo` — Demo showroom
- `/paquetes/empieza|crece|domina` — Plan detail pages

### Internal Platform (Protected)
- `/login` — Login page
- `/admin` — Dashboard
- `/admin/crm` — CRM (placeholder)
- `/admin/pipeline` — Sales Pipeline (placeholder)
- `/admin/onboarding` — Client Onboarding (placeholder)
- `/admin/chat` — Team Chat (placeholder)
- `/admin/payments` — Payments (placeholder)
- `/admin/notifications` — Notifications (placeholder)
- `/admin/integrations` — Integrations overview (working)
- `/admin/reports` — Reports (placeholder)
- `/admin/settings` — Admin settings (placeholder)
- `/admin/docs` — App Docs library (working)
- `/admin/demo-builder` — Demo link generator

### API Endpoints
- `POST /api/contacts` — Public contact form
- `POST /api/inquiries` — Public demo inquiry
- `ALL /api/auth/*` — BetterAuth (login, signup, session)
- `GET /api/users/me` — Current user (auth required)
- `GET /api/admin/stats` — Dashboard stats (auth)
- `GET /api/admin/audit-logs` — Audit logs (admin only)
- `POST /api/admin/seed-admin` — Create initial admin user
- `POST /api/admin/seed-public` — Seed docs + integrations
- `GET/POST/PUT/DELETE /api/docs/*` — Docs CRUD (admin/developer)
- `GET/PUT /api/integrations/*` — Integrations CRUD (admin/developer)

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Auth secret key
- `RESEND_API_KEY` — Email sending
- `PORT` — Server port (default 5000)

## Admin Credentials
- **Email**: admin@vivawebdesigns.com
- **Password**: VivaAdmin2026!
- **Role**: admin

## Demo System
- Empieza (`/empieza`), Crece (`/crece`), Domina (`/domina`) — Demo tiers
- Preview (`/preview/empieza|crece|domina`) — Private preview URLs
- 7 trade templates in `client/src/preview/tradeTemplates.js`

## Performance Optimizations
- Code splitting via React.lazy + Suspense (Home stays eager)
- Optimized video (960KB MP4 + WebM with WebP poster)
- Optimized WebP images (~1.1MB total from ~20MB originals)
- Native lazy loading on gallery images
- Non-render-blocking Google Fonts

## Running
- `npm run dev` starts Express + Vite on port 5000
