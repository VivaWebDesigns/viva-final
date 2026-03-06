/**
 * Preview entry point for Plan Domina (/preview/domina)
 *
 * This renders the same Domina demo site but with custom business info
 * injected via URL query parameters. No "Modo Demo" bar is shown here —
 * this is a private sales preview meant to be shared with prospects.
 *
 * Supported URL parameters (all optional, all have fallback defaults):
 *   ?name=   Business name shown in key sections
 *   ?city=   City name shown in hero and footer copy
 *   ?phone=  Phone number shown in navigation (formatted, e.g. "(704) 555-0123")
 *   ?service= Service type label (for future use / CTA label)
 *   ?cta=    Text for the primary "Get Estimate" CTA button
 *
 * How it works:
 *   1. URL params are read before React renders.
 *   2. window.__PREVIEW__ is set with the parsed values.
 *   3. The LanguageContext in domina/i18n/LanguageContext.tsx deep-merges
 *      window.__PREVIEW__.domina into each language's translation object,
 *      so t.nav.phone, t.home.heroSubtitle, etc. are all overridden.
 *   4. Navigation.tsx reads window.__PREVIEW__.phone for tel: and WhatsApp links.
 *
 * Domina uses an object-based t (e.g. t.home.ctaEstimate) instead of
 * a key-based t("key") function, so overrides are structured as nested objects.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@domina/App.tsx";
import "@domina/index.css";

// --- 1. Parse URL params with fallback defaults ---
function getParam(name, fallback) {
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

const name    = getParam("name",    "Charlotte Painting Pro");
const city    = getParam("city",    "Charlotte");
const phone   = getParam("phone",   "(704) 555-0123");
const service = getParam("service", "Painting");
const cta     = getParam("cta",     "Get a Free Estimate");

// --- 2. Inject preview params into window BEFORE React renders ---
// The domina LanguageContext deep-merges window.__PREVIEW__.domina into
// each language's translation object. Keys match the structure in i18n/en.ts.
window.__PREVIEW__ = {
  // Used directly by Navigation.tsx for tel: and WhatsApp links
  phone,

  // Nested overrides matched to domina's typed translation structure (i18n/en.ts)
  domina: {
    nav: {
      // Override the phone number shown in the nav header
      phone: phone,
      // Override the CTA button text
      getEstimate: cta,
    },
    home: {
      // Override hero subtitle to use the custom city
      heroSubtitle: `Transforming homes across ${city} with precision and passion. Quality interior and exterior painting that stands the test of time.`,
      // Override bottom CTA section description
      readySubtitle: `Get a free, no-obligation estimate. We serve ${city} and the surrounding area.`,
      // Override CTA button text in hero
      ctaEstimate: cta,
    },
    footer: {
      // Override footer copyright line to use business name
      copyright: `${name}. All rights reserved.`,
    },
    about: {
      // Override about intro paragraph to use business name and city
      paragraph1: `Welcome to ${name}, proudly serving the greater ${city} area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your painting and staining needs.`,
      // Override values paragraph to use business name
      valuesText: `At ${name}, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care and respect we'd give our own.`,
    },
  },
};

// --- 3. Render the Domina demo app (no DemoBar — this is a private preview) ---
createRoot(document.getElementById("root-preview-domina")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
