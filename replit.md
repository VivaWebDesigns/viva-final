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
- **Pages**: Home (/), Servicios (/servicios), Nosotros (/nosotros), Contacto (/contacto)

## Key Files
- `client/src/pages/Home.tsx` - Landing page with hero, problem, services, stats, testimonials, process, CTA
- `client/src/pages/Servicios.tsx` - Full services listing page
- `client/src/pages/Nosotros.tsx` - About page with story, values, timeline
- `client/src/pages/Contacto.tsx` - Contact form with lead capture
- `client/src/components/Navigation.tsx` - Fixed top nav with mobile menu
- `client/src/components/Footer.tsx` - Full footer with links, contact info, social
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
