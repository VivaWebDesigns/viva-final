# Viva Web Designs - Marketing Agency Website

## Overview
Marketing agency website targeting contractors. Spanish-first, conversion-optimized, multi-page site.

## Brand
- **Company**: Viva Web Designs
- **Colors**: Primary deep teal (#0D9488, hsl 175 85% 30%), accent emerald (#10B981), hover teal (#0F766E), gradient teal (#14B8A6), secondary deep charcoal (#111111), backgrounds white (#FFFFFF) and light gray (#F5F5F5). WhatsApp green (#25D366) unchanged.
- **Fonts**: Plus Jakarta Sans (body), Montserrat (headings), Inter (fallback)
- **Tone**: Confident, professional, clear, direct, Spanish-first
- **Rules**: NEVER mention "latinos" or "Google Ads" anywhere in copy

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Framer Motion + wouter
- **Backend**: Express.js + PostgreSQL + Drizzle ORM
- **Pages**: Home (/), Paquetes (/paquetes), Plan Empieza (/paquetes/empieza), Plan Crece (/paquetes/crece), Plan Domina (/paquetes/domina), Contacto (/contacto)

## Content System
All website copy is managed from a single file: **`client/src/content/content.json`**

Helper functions in `client/src/content/index.ts`:
- `t("dotted.path")` — returns the Spanish `"es"` string for any key
- `tArr("dotted.path")` — returns an array of Spanish strings
- `tObjArr<T>("dotted.path")` — returns a typed array of objects with mixed string/boolean values
- `tBool("dotted.path")` — returns a boolean value

**Content JSON structure:**
```
global       → company name, phone, email, WhatsApp URL
nav          → navigation links + CTA
footer       → footer text, links, contact info
home         → all home page sections
paquetes     → packages comparison page
empieza      → Plan Empieza detail page
crece        → Plan Crece detail page
domina       → Plan Domina detail page
contacto     → Contact page form labels + sidebar
```

**To edit copy:** Only modify `"es"` values in `content.json`. The English `"en"` values are for reference only and never appear on the site.

## Key Files
- `client/src/content/content.json` - ALL website copy (edit only "es" values)
- `client/src/content/index.ts` - t(), tArr(), tObjArr(), tBool() helpers
- `client/src/content/README.md` - Content editing guide
- `client/src/pages/Home.tsx` - Landing page
- `client/src/pages/Paquetes.tsx` - Package listing + comparison table
- `client/src/pages/PaqueteEmpieza.tsx` - Starter plan detail ($497)
- `client/src/pages/PaqueteCrece.tsx` - Growth plan detail ($997, most popular)
- `client/src/pages/PaqueteDomina.tsx` - Premium plan detail ($1,997)
- `client/src/pages/Contacto.tsx` - Contact form with lead capture
- `client/src/components/Navigation.tsx` - Fixed top nav with mobile menu
- `client/src/components/Footer.tsx` - Full footer
- `client/src/components/WhatsAppButton.tsx` - Floating WhatsApp button
- `client/src/components/SEO.tsx` - Per-page SEO meta tags via react-helmet-async
- `client/src/components/JsonLd.tsx` - Schema.org structured data
- `shared/schema.ts` - Database schema for contacts table
- `server/routes.ts` - POST /api/contacts endpoint for lead capture
- `server/storage.ts` - Database storage layer
- `server/db.ts` - Database connection

## Database
- PostgreSQL with contacts table for lead capture
- Fields: id, name, email, phone, business, city, trade, service, message, createdAt

## Running
- `npm run dev` starts Express + Vite on port 5000
