/**
 * Preview entry point for Plan Empieza (/preview/empieza)
 *
 * This renders the same Empieza demo site but with custom business info
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
 *      on every t() call and returns the override value if present.
 *   4. window.__PREVIEW__.lang sets the initial language on first render.
 *   5. Navigation.tsx reads window.__PREVIEW__.phone for phone link and WhatsApp button.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@empieza/App.tsx";
import "@empieza/index.css";

// --- 1. Parse URL params with fallback defaults ---
function getParam(name, fallback) {
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

const name    = getParam("name",    "Charlotte Painting Pro");
const city    = getParam("city",    "Charlotte");
const phone   = getParam("phone",   "(704) 555-0123");
const service = getParam("service", "Painting");
const cta     = getParam("cta",     "Get Your Free Estimate");
// Language: "en" or "es". Empieza's LanguageProvider reads window.__PREVIEW__.lang for initial state.
const lang    = getParam("lang",    "en");

// --- 2. Inject preview params into window BEFORE React renders ---
// The empieza LanguageProvider checks window.__PREVIEW__.tOverrides on each t() call.
// window.__PREVIEW__.phone is used by Navigation for tel: and WhatsApp links.
// window.__PREVIEW__.lang sets the initial language.
window.__PREVIEW__ = {
  phone,
  lang,
  tOverrides: {
    // Override the CTA button text
    getFreeEstimate: cta,

    // Override hero subtitle to use the custom city
    heroSubtitle: `Transforming homes across ${city} with precision and passion. Quality interior and exterior painting that stands the test of time.`,

    // Override the about section intro to use business name and city
    aboutP1: `Welcome to ${name}, proudly serving the greater ${city} area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your painting and staining needs.`,
  },
};

// --- 3. Render the Empieza demo app (no DemoBar — this is a private preview) ---
createRoot(document.getElementById("root-preview-empieza")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
