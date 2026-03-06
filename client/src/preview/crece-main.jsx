/**
 * Preview entry point for Plan Crece (/preview/crece)
 *
 * This renders the same Crece demo site but with custom business info
 * injected via URL query parameters. No "Modo Demo" bar is shown here —
 * this is a private sales preview meant to be shared with prospects.
 *
 * Supported URL parameters (all optional, all have fallback defaults):
 *   ?name=    Business name shown in key sections
 *   ?city=    City name shown in hero and footer copy
 *   ?phone=   Phone number shown in navigation (formatted, e.g. "(704) 555-0123")
 *   ?service= Service type label (for future use / CTA label)
 *   ?cta=     Text for the primary "Get Estimate" CTA button
 *   ?lang=    Language to display: "en" (English) or "es" (Spanish). Default: "en"
 *
 * How it works:
 *   1. URL params are read before React renders.
 *   2. window.__PREVIEW__ is set with the parsed values.
 *   3. The LanguageProvider in hooks/use-language.tsx checks window.__PREVIEW__.tOverrides
 *      on every t("dot.key") call and returns the override value if present.
 *   4. localStorage "language" is set so Crece's LanguageProvider picks it up as initial state.
 *   5. Navigation.tsx reads window.__PREVIEW__.phone for phone link and WhatsApp button.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@crece/App.tsx";
import "@crece/index.css";

// --- 1. Parse URL params with fallback defaults ---
function getParam(name, fallback) {
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

const name    = getParam("name",    "Charlotte Painting Pro");
const city    = getParam("city",    "Charlotte");
const phone   = getParam("phone",   "(704) 555-0123");
const service = getParam("service", "Painting");
const cta     = getParam("cta",     "Get Your Free Estimate");
// Language: "en" or "es". Crece's LanguageProvider reads from localStorage "language".
const lang    = getParam("lang",    "en");

// --- 2. Set localStorage BEFORE React renders so Crece's LanguageProvider initialises correctly ---
localStorage.setItem("language", lang);

// --- 3. Inject preview params into window BEFORE React renders ---
// The crece LanguageProvider checks window.__PREVIEW__.tOverrides on each t("key") call.
// window.__PREVIEW__.phone is used by Navigation for tel: and WhatsApp links.
window.__PREVIEW__ = {
  phone,
  tOverrides: {
    // Override the CTA button text
    "nav.freeEstimate": cta,

    // Override hero subtitle to use the custom city
    "hero.subtitle": `Transforming homes across ${city} with precision and passion. Quality interior and exterior painting that stands the test of time.`,

    // Override about section to use business name and city
    "about.description1": `Welcome to ${name}, proudly serving the greater ${city} area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your painting and staining needs.`,

    // Override values section to use business name
    "about.values.desc": `At ${name}, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care and respect we'd give our own. That's the foundation of every project we take on.`,

    // Override the CTA section description to use city
    "cta.desc": `Get a free, no-obligation estimate. We serve ${city} and the surrounding area.`,

    // Override the footer description to use city
    "footer.desc": `${city}'s premier painting experts. We bring color and life to your home with professional interior and exterior painting services.`,
  },
};

// --- 4. Render the Crece demo app (no DemoBar — this is a private preview) ---
createRoot(document.getElementById("root-preview-crece")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
