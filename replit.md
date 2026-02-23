# Viva Web Designs - Marketing Agency Website

## Overview
Marketing agency website targeting Latino contractors (painters, electricians, landscapers, framers, glass installers, etc.). Spanish-first, conversion-optimized, multi-page site.

## Brand
- **Company**: Viva Web Designs
- **Colors**: Primary pink/magenta (hsl 340 82% 52%), secondary teal/green (hsl 160 100% 37%), accent amber
- **Fonts**: Plus Jakarta Sans (body), Montserrat (headings), Inter (fallback)
- **Tone**: Confident, professional, clear, direct, Spanish-first

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Framer Motion + wouter
- **Backend**: Express.js + PostgreSQL + Drizzle ORM
- **Pages**: Home (/), Paquetes (/paquetes), Plan Empieza (/paquetes/empieza), Plan Crece (/paquetes/crece), Plan Domina (/paquetes/domina), Contacto (/contacto)

## Key Files
- `client/src/pages/Home.tsx` - Landing page with hero, problem, services, stats, testimonials, process, CTA
- `client/src/pages/Paquetes.tsx` - Package listing page with 3 tiers (Empieza, Crece, Domina)
- `client/src/pages/PaqueteEmpieza.tsx` - Starter plan detail page ($497/mo)
- `client/src/pages/PaqueteCrece.tsx` - Growth plan detail page ($997/mo, most popular)
- `client/src/pages/PaqueteDomina.tsx` - Premium plan detail page ($1,997/mo)
- `client/src/pages/Contacto.tsx` - Contact form with lead capture
- `client/src/components/Navigation.tsx` - Fixed top nav with mobile menu (Inicio, Paquetes, Contacto)
- `client/src/components/Footer.tsx` - Full footer with package links, contact info, social
- `client/src/components/WhatsAppButton.tsx` - Floating WhatsApp button (bottom-right, all pages)
- `client/src/components/SEO.tsx` - Per-page SEO meta tags via react-helmet-async
- `shared/schema.ts` - Database schema for contacts table
- `server/routes.ts` - POST /api/contacts endpoint for lead capture
- `server/storage.ts` - Database storage layer
- `server/db.ts` - Database connection

## Database
- PostgreSQL with contacts table for lead capture
- Fields: id, name, email, phone, business, service, message, createdAt

## Running
- `npm run dev` starts Express + Vite on port 5000
